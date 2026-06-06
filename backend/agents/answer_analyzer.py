"""
Answer Analyzer Agent
Extracts structured interview intelligence from a candidate's latest answer.
Used by InterviewerAgent to drive investigative follow-up questions.
"""

import logging
from services.llm import LLM, safe_json

logger = logging.getLogger(__name__)

_PROMPT = """You are an expert interview analyst. A candidate just answered an interview question.

Question asked: {question}
Candidate's answer: {answer}

Extract structured intelligence from this answer. Think carefully:
- What specific claims did the candidate make? (projects built, results achieved, roles held)
- What technical skills or tools were mentioned?
- What details are suspiciously vague or missing?
- What topics could be explored more deeply?
- Are there leadership signals? (led team, made decision, resolved conflict, influenced stakeholders)
- Are there communication signals? (clarity, confidence, structure, hedging language)
- What technical concepts were mentioned that an interviewer could drill into?
- On a scale of 0.0-1.0, how confident and specific does the answer sound?

Respond ONLY with valid JSON. No preamble, no markdown fences.

{{
  "claims": ["specific claim 1", "specific claim 2"],
  "skills": ["skill or tool 1", "skill or tool 2"],
  "missing_details": ["vague area 1", "vague area 2"],
  "interesting_topics": ["topic worth exploring 1", "topic 2"],
  "leadership_signals": ["leadership moment 1"],
  "communication_signals": ["signal 1"],
  "technical_topics": ["technical concept 1", "technical concept 2"],
  "confidence_score": 0.0
}}"""

_EVAL_PROMPT = """You are a senior interviewer evaluating whether a candidate's answer was actually good.

Question: {question}
Candidate's answer: {answer}
Skills the candidate said they want to improve: {target_skills}

Evaluate the CONTENT and QUALITY of this answer — not just communication style.
Score 1-10 on each dimension:
- relevance: Did they actually answer the question asked?
- depth: Did they go beyond surface-level? Specific examples, numbers, outcomes?
- star_structure: Did the answer follow Situation → Task → Action → Result?
- honesty: Did they acknowledge gaps or just oversell?
- skill_match: Does the answer demonstrate progress/awareness in their target skill areas?

Also provide:
- verdict: one sentence — was this a strong, average, or weak answer and why?
- what_was_good: the single best thing about this answer (one sentence, be specific)
- what_was_missing: the most important thing missing or vague (one sentence, be specific)
- coaching_tip: one concrete thing they should do differently next time (one sentence)

Respond ONLY with valid JSON. No preamble, no markdown fences.

{{
  "relevance": 0,
  "depth": 0,
  "star_structure": 0,
  "honesty": 0,
  "skill_match": 0,
  "overall_answer_score": 0.0,
  "verdict": "",
  "what_was_good": "",
  "what_was_missing": "",
  "coaching_tip": ""
}}"""


class AnswerAnalyzer:
    """
    Analyzes a single candidate answer and returns structured interview intelligence.
    Called once per round, before the next question is generated.
    """

    def __init__(self):
        self.llm = LLM()

    async def analyze(self, question: str, answer: str) -> dict:
        if not answer or not answer.strip():
            logger.debug("AnswerAnalyzer: empty answer, returning defaults")
            return self._empty()

        prompt = _PROMPT.format(
            question=question[:500],
            answer=answer[:800],
        )

        try:
            raw = await self.llm.complete_json(prompt, max_tokens=400)
        except Exception as exc:
            logger.error("AnswerAnalyzer LLM call failed: %s: %s", type(exc).__name__, exc)
            return self._empty()

        result = safe_json(raw, self._empty())
        validated = {**self._empty(), **result}
        validated["confidence_score"] = max(0.0, min(1.0, float(validated.get("confidence_score", 0.5))))

        logger.debug(
            "AnswerAnalyzer: claims=%d skills=%d technical_topics=%d confidence=%.2f",
            len(validated["claims"]),
            len(validated["skills"]),
            len(validated["technical_topics"]),
            validated["confidence_score"],
        )
        return validated

    async def evaluate(self, question: str, answer: str, target_skills: list) -> dict:
        """
        Evaluate the CONTENT quality of the answer — not just signals.
        Returns scores and coaching feedback for each completed round.
        """
        if not answer or not answer.strip():
            return self._empty_eval()

        prompt = _EVAL_PROMPT.format(
            question=question[:500],
            answer=answer[:800],
            target_skills=", ".join(target_skills) if target_skills else "not specified",
        )

        try:
            raw = await self.llm.complete_json(prompt, max_tokens=500)
        except Exception as exc:
            logger.error("AnswerAnalyzer evaluate() LLM call failed: %s: %s", type(exc).__name__, exc)
            return self._empty_eval()

        result = safe_json(raw, self._empty_eval())
        validated = {**self._empty_eval(), **result}

        # Clamp scores
        for key in ["relevance", "depth", "star_structure", "honesty", "skill_match"]:
            validated[key] = max(1, min(10, int(validated.get(key, 5))))
        validated["overall_answer_score"] = round(
            max(1.0, min(10.0, float(validated.get("overall_answer_score", 5.0)))), 1
        )

        logger.debug("AnswerEval: score=%.1f verdict=%s", validated["overall_answer_score"], validated["verdict"][:60])
        return validated

    @staticmethod
    def _empty() -> dict:
        return {
            "claims": [],
            "skills": [],
            "missing_details": [],
            "interesting_topics": [],
            "leadership_signals": [],
            "communication_signals": [],
            "technical_topics": [],
            "confidence_score": 0.5,
        }

    @staticmethod
    def _empty_eval() -> dict:
        return {
            "relevance": 5,
            "depth": 5,
            "star_structure": 5,
            "honesty": 5,
            "skill_match": 5,
            "overall_answer_score": 5.0,
            "verdict": "Answer could not be evaluated.",
            "what_was_good": "",
            "what_was_missing": "",
            "coaching_tip": "",
        }