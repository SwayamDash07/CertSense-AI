"""
Interviewer Agent — Investigative interview conductor.

Flow:
  Round 1 (fixed): "Tell me about the skills you want to work on"
    → stores target_skills in memory

  Round 2+ :
    User Answer
      → AnswerAnalyzer.analyze()   (extract claims, signals, gaps)
      → AnswerAnalyzer.evaluate()  (score content quality, give coaching tip)
      → InterviewMemory update
      → StrategySelector
      → QuestionGenerator (grounded in what they said AND how well they said it)

Rules:
- First question is always about skills to improve — personalises all subsequent questions
- Every follow-up is grounded in the candidate's actual words
- Per-answer evaluation is stored and returned so the final report shows per-round feedback
- Never repeat deeply explored topics
"""

import re
from services.llm import LLM
from agents.answer_analyzer import AnswerAnalyzer

# ── Strategy catalog ──────────────────────────────────────────────────────────

STRATEGIES = [
    "Concept Depth",
    "Architecture Understanding",
    "Service Comparison",
    "Scenario Application",
    "Security & Compliance",
    "Cost Optimization",
    "Troubleshooting",
    "Best Practices",
]

# ── System prompt ─────────────────────────────────────────────────────────────

_SYSTEM = """You are a senior Azure certification examiner conducting a verbal exam practice session.
Your job is to ask ONE precise follow-up question based on what the candidate just explained.

Hard rules:
- Output the question ONLY. No intro, no numbering, no commentary.
- Maximum 35 words.
- Never ask generic questions unrelated to the candidate's answer.
- Ground every question in a specific service, concept, or decision the candidate mentioned.
- If the answer was vague or incomplete, ask for a concrete example or clarify a specific Azure service.
- If the answer was strong, go deeper — ask about tradeoffs, failure scenarios, or alternative approaches.
- Always relate questions back to the candidate's target certification track (AZ-204, AZ-400, or DP-203).
- Challenge understanding without being hostile."""

# ── Fixed opening question ─────────────────────────────────────────────────────

OPENING_QUESTION = "Which Azure certification are you preparing for, and which topic areas do you feel least confident about right now?"

# ── Prompt templates ──────────────────────────────────────────────────────────

_NEXT_PROMPT = """Strategy for this question: {strategy}

Candidate's target certification and weak areas: {target_skills}

Intelligence from their last answer:
- Answer quality score: {answer_score}/10
- Verdict on last answer: {verdict}
- What was good: {what_was_good}
- What was missing: {what_was_missing}
- Claims made: {claims}
- Azure services/concepts mentioned: {skills}
- Vague/missing details: {missing_details}
- Architecture signals: {leadership_signals}
- Technical topics: {technical_topics}
- Confidence level: {confidence_score}/1.0

Topics already deeply explored (avoid): {explored_topics}
Full conversation so far:
{history_text}

Using the strategy "{strategy}", generate ONE exam-style follow-up question about Azure.
- If the last answer score was below 6, push for more depth or a concrete Azure example on the same area.
- If the last answer was strong, advance to a harder angle (tradeoffs, failure scenarios, cost implications).
- Relate to their target certification track and weak areas when possible.
Output the question only."""

# ── Helpers ───────────────────────────────────────────────────────────────────

def _history_to_text(history: list) -> str:
    lines = []
    for i, turn in enumerate(history, 1):
        lines.append(f"Q{i}: {turn.get('question', '')}")
        lines.append(f"A{i}: {turn.get('answer', '')[:300]}")
    return "\n".join(lines)


def _extract_target_skills(answer: str) -> list:
    """
    Simple heuristic to pull skill keywords from the opening answer.
    The LLM analysis will do the heavy lifting; this is a fast fallback.
    """
    keywords = []
    lower = answer.lower()
    skill_words = [
        "app service", "functions", "cosmos db", "service bus", "event hub",
        "api management", "key vault", "managed identity", "blob storage", "azure ad",
        "devops", "pipelines", "kubernetes", "aks", "container", "terraform",
        "synapse", "data factory", "databricks", "data lake", "stream analytics",
        "security", "rbac", "networking", "vnet", "monitoring", "logic apps",
    ]
    for word in skill_words:
        if word in lower:
            keywords.append(word)
    return keywords[:5] if keywords else ["Azure core services"]


def _pick_strategy(analysis: dict, memory: dict, round_number: int) -> str:
    depth = memory.get("depth", {})
    scores = {s: 0 for s in STRATEGIES}

    if analysis.get("technical_topics"):
        topic = analysis["technical_topics"][0]
        if depth.get(topic, 0) < 2:
            scores["Concept Depth"] += 3
            scores["Architecture Understanding"] += 2

    if analysis.get("leadership_signals"):
        signal = analysis["leadership_signals"][0]
        if depth.get(signal, 0) < 2:
            scores["Scenario Application"] += 3
            scores["Best Practices"] += 2

    if analysis.get("missing_details"):
        scores["Service Comparison"] += 2
        scores["Troubleshooting"] += 2

    if analysis.get("claims"):
        scores["Architecture Understanding"] += 2

    if analysis.get("confidence_score", 0.5) < 0.5:
        scores["Concept Depth"] += 2

    if round_number <= 2:
        scores["Concept Depth"] += 1
    elif round_number == 3:
        scores["Service Comparison"] += 1
        scores["Scenario Application"] += 1
    elif round_number >= 4:
        scores["Security & Compliance"] += 1
        scores["Cost Optimization"] += 1

    explored = [t for t, d in depth.items() if d >= 2]
    if any(e in str(explored) for e in ["security", "rbac", "identity"]):
        scores["Security & Compliance"] -= 1

    return max(scores, key=scores.get)


def _update_memory(memory: dict, question: str, analysis: dict) -> dict:
    memory.setdefault("topics_covered", [])
    memory.setdefault("claims_explored", [])
    memory.setdefault("depth", {})
    memory.setdefault("question_history", [])
    memory.setdefault("answer_evaluations", [])

    memory["question_history"].append(question)

    for topic in analysis.get("technical_topics", []):
        memory["depth"][topic] = memory["depth"].get(topic, 0) + 1
        if topic not in memory["topics_covered"]:
            memory["topics_covered"].append(topic)

    for signal in analysis.get("leadership_signals", []):
        memory["depth"][signal] = memory["depth"].get(signal, 0) + 1

    for claim in analysis.get("claims", []):
        if claim not in memory["claims_explored"]:
            memory["claims_explored"].append(claim)

    return memory


def _explored_topics(memory: dict) -> list:
    return [t for t, d in memory.get("depth", {}).items() if d >= 2]


# ── Agent ─────────────────────────────────────────────────────────────────────

class InterviewerAgent:
    """
    Investigative interviewer.
    Round 1 is always the skills question.
    Round 2+ generates questions grounded in previous answers + per-answer evaluations.
    """

    def __init__(self):
        self.llm = LLM()
        self.analyzer = AnswerAnalyzer()

    async def start(self, goal: str, max_rounds: int = 5) -> dict:
        """
        Return the fixed opening question and initialise memory.
        No LLM call needed for round 1.
        """
        memory = {
            "goal": goal,
            "target_skills": [],
            "topics_covered": [],
            "claims_explored": [],
            "depth": {},
            "question_history": [OPENING_QUESTION],
            "answer_evaluations": [],  # populated from round 2 onwards
        }
        return {"question": OPENING_QUESTION, "memory": memory, "round": 1}

    async def next_question(
        self,
        goal: str,
        round_number: int,
        history: list,
        memory: dict,
        max_rounds: int = 5,
    ) -> dict:
        """
        Generate the next investigative question.
        Also evaluates the previous answer and stores the result in memory.
        """
        if not history:
            return await self.start(goal, max_rounds)

        last_turn    = history[-1]
        last_question = last_turn.get("question", "")
        last_answer   = last_turn.get("answer", "")

        # ── Round 2 special: extract target skills from opening answer ─────────
        if round_number == 2:
            skill_analysis = await self.analyzer.analyze(last_question, last_answer)
            extracted = skill_analysis.get("skills", []) + skill_analysis.get("interesting_topics", [])
            heuristic = _extract_target_skills(last_answer)
            target_skills = list(dict.fromkeys(extracted + heuristic))[:6]
            memory["target_skills"] = target_skills
        else:
            target_skills = memory.get("target_skills", [])

        # ── Step 1: Analyze signals from last answer ──────────────────────────
        analysis = await self.analyzer.analyze(last_question, last_answer)

        # ── Step 2: Evaluate content quality of last answer ───────────────────
        evaluation = await self.analyzer.evaluate(last_question, last_answer, target_skills)

        # Store evaluation in memory so final report can surface it
        memory.setdefault("answer_evaluations", [])
        memory["answer_evaluations"].append({
            "round": round_number - 1,
            "question": last_question,
            "answer_preview": last_answer[:200],
            **evaluation,
        })

        # ── Step 3: Update memory ─────────────────────────────────────────────
        memory = _update_memory(memory, last_question, analysis)

        # ── Step 4: Pick strategy ─────────────────────────────────────────────
        strategy = _pick_strategy(analysis, memory, round_number)

        # ── Step 5: Generate next question ────────────────────────────────────
        explored = _explored_topics(memory)

        prompt = _NEXT_PROMPT.format(
            strategy=strategy,
            target_skills=", ".join(target_skills) if target_skills else "not yet identified",
            answer_score=evaluation.get("overall_answer_score", 5.0),
            verdict=evaluation.get("verdict", ""),
            what_was_good=evaluation.get("what_was_good", ""),
            what_was_missing=evaluation.get("what_was_missing", ""),
            claims=", ".join(analysis["claims"][:3]) or "none identified",
            skills=", ".join(analysis["skills"][:4]) or "none identified",
            missing_details=", ".join(analysis["missing_details"][:3]) or "none",
            leadership_signals=", ".join(analysis["leadership_signals"][:2]) or "none",
            technical_topics=", ".join(analysis["technical_topics"][:3]) or "none",
            confidence_score=round(analysis["confidence_score"], 2),
            explored_topics=", ".join(explored) if explored else "none yet",
            history_text=_history_to_text(history),
        )

        question = await self._call(prompt)

        # ── Step 6: Record question ───────────────────────────────────────────
        memory["question_history"].append(question)

        return {
            "question": question,
            "memory": memory,
            "round": round_number,
            "strategy": strategy,
            "analysis": analysis,
            "last_answer_evaluation": evaluation,  # sent to frontend for live feedback
        }

    async def _call(self, user_prompt: str) -> str:
        raw = await self.llm.chat(
            user_prompt,
            system=_SYSTEM,
            temperature=0.7,
            max_tokens=80,
        )
        raw = re.sub(r"^(?:\d+[\.\)]\s*|Q:\s*)", "", raw.strip())
        return raw