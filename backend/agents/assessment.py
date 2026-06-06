"""
Agent 4: Assessment Agent
Evaluates certification readiness and generates practice questions.

Cert Mode: Multi-step reasoning chain.
  Step 1 — Generate 5 cert-track questions with difficulty progression
  Step 2 — Evaluate each answer against accuracy, depth, and concept coverage
  Step 3 — Synthesise into a readiness verdict vs 75% passing threshold
"""

import asyncio
import json
import logging
from typing import Dict, Any, List
from services.llm import LLM, safe_json
from services.foundry_iq import FoundryIQClient

logger = logging.getLogger(__name__)


_QUESTION_GEN_PROMPT = """
You are an Azure certification exam question writer.

Certification target: {cert_track}
Candidate profile: {coach_summary}

Generate exactly 5 exam-style questions with difficulty progression:
  Q1 — Recall: definition or basic concept
  Q2 — Comprehension: explain how/why something works
  Q3 — Application: choose the right service for a scenario
  Q4 — Analysis: compare two services or approaches
  Q5 — Scenario: multi-constraint architectural decision

For each question output JSON with keys:
  id (1-5), difficulty ("recall"|"comprehension"|"application"|"analysis"|"scenario"),
  question (string), skill_area (short phrase), ideal_answer_points (list of 3 strings)

Return a JSON array only. No prose, no markdown fences.
""".strip()

_EVAL_PROMPT = """
You are an Azure certification examiner evaluating a candidate's answer.

Certification: {cert_track}
Question ({difficulty}): {question}
Candidate answer: {answer_excerpt}

Score 1-10 on each dimension:
  - accuracy: Is the technical content correct?
  - depth: Does the answer go beyond surface level?
  - concept_coverage: Are the key exam points addressed?
  - clarity: Is the explanation well structured?
  - practical_application: Evidence of real-world understanding?

Also provide:
  - strength (one sentence: best thing about this answer)
  - gap (one sentence: most important missing point)
  - follow_up_question (a probing follow-up)

Return a single JSON object only. No prose, no markdown fences.
""".strip()

_SYNTHESIS_PROMPT = """
You are a certification exam assessor synthesising results across a full practice session.

Certification: {cert_track}
Per-question evaluations (JSON): {evaluations_json}

Produce a final assessment:
  - overall_readiness_score (float 1-10; passing threshold is 7.5)
  - readiness_label ("Exam Ready" | "Almost Ready" | "Needs Practice" | "Early Stage")
  - verdict (2-3 sentence summary)
  - cross_answer_strengths (list of 3 strings)
  - cross_answer_weaknesses (list of 3 strings)
  - recommended_study_areas (list of 3-5 specific topics to drill)
  - accuracy_avg (float)
  - depth_avg (float)
  - coverage_avg (float)

Return a single JSON object only. No prose, no markdown fences.
""".strip()

_PRACTICE_QUESTIONS_PROMPT = """
You are a certification study coach generating practice questions.

Certification: {cert_track}
Candidate profile: {coach_summary}
Foundry context: {context_summary}
Base questions: {base_questions_json}

Generate up to 8 practice questions targeting this candidate's weak areas. For each:
  - skill_area (string)
  - question (string)
  - tip (one actionable study tip)

Return JSON with key "questions" containing the array. No prose, no markdown fences.
""".strip()


def _coach_summary(coach_output: dict) -> str:
    return (
        f"Overall score: {coach_output.get('overall_score', 'unknown')}/10. "
        f"Cert target: {coach_output.get('cert_track', 'AZ-204')}. "
        f"Strengths: {', '.join(coach_output.get('strengths', [])[:3]) or 'none'}. "
        f"Gaps: {', '.join(coach_output.get('weaknesses', [])[:3]) or 'none'}."
    )


def _answer_excerpt(coach_output: dict, question_index: int, total_questions: int = 5) -> str:
    transcript = coach_output.get("transcript", "") or coach_output.get(
        "communication_analysis", {}
    ).get("transcript", "")
    if not transcript:
        return "(no transcript available)"
    total_chars = len(transcript)
    share = total_chars // max(total_questions, 1)
    window = max(share, 800)
    start = question_index * share
    end = min(start + window, total_chars)
    excerpt = transcript[start:end].strip()
    if len(excerpt) < 80:
        return f"{excerpt}\n\n(Brief answer — evaluate concept and intent expressed.)" if excerpt else "(no answer provided)"
    return excerpt


def _context_summary(context: Any) -> str:
    if not context:
        return "No additional context available."
    if isinstance(context, str):
        return context[:400]
    if isinstance(context, dict):
        return json.dumps(context)[:400]
    return str(context)[:400]


QUESTION_BANKS = {
    "AZ-204": {
        "recall": [
            "What is the difference between Azure Functions Consumption plan and Premium plan?",
            "What authentication options does Azure API Management support?",
        ],
        "application": [
            "A company needs to process 10,000 events per second with no data loss. Which Azure service should they use?",
            "When would you choose Cosmos DB over Azure SQL Database?",
        ],
        "scenario": [
            "Design a serverless order processing system that handles spikes and guarantees delivery.",
        ]
    },
    "AZ-400": {
        "recall": [
            "What is the difference between a pipeline artifact and a release artifact in Azure DevOps?",
            "What does shift-left testing mean in a DevOps context?",
        ],
        "application": [
            "How would you implement blue-green deployment using Azure DevOps pipelines?",
            "A team wants zero-downtime deployments. What strategy and tooling would you recommend?",
        ],
        "scenario": [
            "Design a CI/CD pipeline for a microservices app with 12 independent services.",
        ]
    },
    "DP-203": {
        "recall": [
            "What is the difference between a dedicated SQL pool and a serverless SQL pool in Synapse?",
            "When should you use Delta Lake format over Parquet?",
        ],
        "application": [
            "A pipeline needs to ingest 1TB of JSON daily and make it queryable within 1 hour. Design the solution.",
            "How would you handle late-arriving data in Azure Stream Analytics?",
        ],
        "scenario": [
            "Design a lakehouse architecture for a retail company with real-time and batch requirements.",
        ]
    }
}

RUBRICS = {
    "AZ-204": {"criteria": ["Accuracy", "Depth", "Concept Coverage", "Practical Application", "Clarity"], "weights": [0.3, 0.25, 0.2, 0.15, 0.1], "passing_score": 7.5},
    "AZ-400": {"criteria": ["Accuracy", "Depth", "Concept Coverage", "Practical Application", "Clarity"], "weights": [0.3, 0.25, 0.2, 0.15, 0.1], "passing_score": 7.5},
    "DP-203": {"criteria": ["Accuracy", "Depth", "Concept Coverage", "Practical Application", "Clarity"], "weights": [0.3, 0.25, 0.2, 0.15, 0.1], "passing_score": 7.5},
}


class AssessmentAgent:

    def __init__(self):
        self.llm = LLM()
        self.foundry_iq = FoundryIQClient()

    async def evaluate(self, coach_output: dict, goal: str, workflow: dict) -> dict:
        return await self._evaluate_cert(coach_output, goal, workflow)

    async def _evaluate_cert(self, coach_output: dict, goal: str, workflow: dict) -> dict:
        cert_track = workflow.get("focus", goal.upper())

        q_raw = await self.llm.complete_json(
            _QUESTION_GEN_PROMPT.format(cert_track=cert_track, coach_summary=_coach_summary(coach_output))
        )
        questions = safe_json(q_raw, default=None)
        if not isinstance(questions, list):
            questions = self._fallback_questions(cert_track)

        eval_tasks = [
            self._evaluate_single_answer(q, coach_output, i, len(questions), cert_track)
            for i, q in enumerate(questions)
        ]
        per_question_evals = await asyncio.gather(*eval_tasks, return_exceptions=True)

        clean_evals = []
        for i, ev in enumerate(per_question_evals):
            if isinstance(ev, Exception):
                logger.warning("Per-question eval %d failed: %s", i, ev)
                clean_evals.append(self._fallback_eval(questions[i]))
            else:
                clean_evals.append(ev)

        syn_raw = await self.llm.complete_json(
            _SYNTHESIS_PROMPT.format(cert_track=cert_track, evaluations_json=json.dumps(clean_evals, indent=2))
        )
        synthesis = safe_json(syn_raw, default={})
        if not synthesis:
            synthesis = self._fallback_synthesis(clean_evals)

        readiness_score = float(synthesis.get("overall_readiness_score", 6.5))
        readiness_label = synthesis.get("readiness_label", "Needs Practice")
        rubric = RUBRICS.get(cert_track, RUBRICS["AZ-204"])

        return {
            "readiness_score": readiness_score,
            "readiness_label": readiness_label,
            "passing_threshold": rubric["passing_score"],
            "verdict": synthesis.get("verdict", ""),
            "cross_answer_strengths": synthesis.get("cross_answer_strengths", []),
            "cross_answer_weaknesses": synthesis.get("cross_answer_weaknesses", []),
            "recommended_study_areas": synthesis.get("recommended_study_areas", []),
            "readiness_breakdown": {
                "Accuracy":             round(synthesis.get("accuracy_avg", readiness_score * 0.95), 1),
                "Depth":                round(synthesis.get("depth_avg", readiness_score * 0.9), 1),
                "Concept Coverage":     round(synthesis.get("coverage_avg", readiness_score * 0.85), 1),
                "Practical Application":round(readiness_score * 0.88, 1),
                "Clarity":              round(readiness_score * 0.92, 1),
            },
            "questions": [
                {
                    "id": q.get("id", i + 1),
                    "difficulty": q.get("difficulty", "application"),
                    "question": q.get("question", ""),
                    "skill_area": q.get("skill_area", ""),
                    "ideal_answer_points": q.get("ideal_answer_points", []),
                    "scores": {
                        "accuracy":             ev.get("accuracy", 0),
                        "depth":                ev.get("depth", 0),
                        "concept_coverage":     ev.get("concept_coverage", 0),
                        "clarity":              ev.get("clarity", 0),
                        "practical_application":ev.get("practical_application", 0),
                    },
                    "strength":      ev.get("strength", ""),
                    "gap":           ev.get("gap", ""),
                    "follow_up":     ev.get("follow_up_question", ""),
                }
                for i, (q, ev) in enumerate(zip(questions, clean_evals))
            ],
            "mock_assessment": self._build_mock_assessment(cert_track, questions),
            "gaps_to_close": synthesis.get("cross_answer_weaknesses", []),
            "rubric": rubric,
        }

    async def _evaluate_single_answer(self, question: dict, coach_output: dict, idx: int, total: int, cert_track: str) -> dict:
        prompt = _EVAL_PROMPT.format(
            cert_track=cert_track,
            difficulty=question.get("difficulty", "application"),
            question=question.get("question", ""),
            answer_excerpt=_answer_excerpt(coach_output, idx, total),
        )
        raw = await self.llm.complete_json(prompt)
        result = safe_json(raw, default={})
        return result if result else self._fallback_eval(question)

    async def _generate_practice_questions(self, coach_output, goal, base_questions, context):
        cert_track = goal.upper()
        prompt = _PRACTICE_QUESTIONS_PROMPT.format(
            cert_track=cert_track,
            coach_summary=_coach_summary(coach_output),
            context_summary=_context_summary(context),
            base_questions_json=json.dumps(base_questions, indent=2),
        )
        try:
            raw = await self.llm.complete_json(prompt)
            result = safe_json(raw, default={})
            if isinstance(result, dict) and "questions" in result:
                return result
            if isinstance(result, list):
                return {"questions": result}
        except Exception as exc:
            logger.warning("generate_practice_questions failed: %s", exc)
        return {"questions": base_questions}

    def _fallback_questions(self, cert_track: str) -> list:
        bank = QUESTION_BANKS.get(cert_track, QUESTION_BANKS["AZ-204"])
        return [
            {"id": 1, "difficulty": "recall",         "question": bank["recall"][0],       "skill_area": "Core concepts",    "ideal_answer_points": ["Correct definition", "Key differences", "Use case"]},
            {"id": 2, "difficulty": "recall",         "question": bank["recall"][-1],      "skill_area": "Service knowledge","ideal_answer_points": ["Feature list", "Limitations", "Configuration"]},
            {"id": 3, "difficulty": "application",    "question": bank["application"][0],  "skill_area": "Service selection","ideal_answer_points": ["Correct service chosen", "Justification", "Alternatives considered"]},
            {"id": 4, "difficulty": "application",    "question": bank["application"][-1], "skill_area": "Architecture",     "ideal_answer_points": ["Requirements addressed", "Trade-offs", "Scalability"]},
            {"id": 5, "difficulty": "scenario",       "question": bank["scenario"][0],     "skill_area": "Design",           "ideal_answer_points": ["End-to-end solution", "Constraints handled", "Best practices cited"]},
        ]

    def _fallback_eval(self, question: dict) -> dict:
        return {
            "accuracy": 5, "depth": 5, "concept_coverage": 5,
            "clarity": 5, "practical_application": 5,
            "strength": "Unable to evaluate — LLM unavailable.",
            "gap": "Re-run with a working LLM connection for detailed feedback.",
            "follow_up_question": question.get("question", ""),
        }

    def _fallback_synthesis(self, evals: list) -> dict:
        avg = lambda key: sum(e.get(key, 5) for e in evals) / max(len(evals), 1)
        score = round((avg("accuracy") + avg("depth") + avg("concept_coverage")) / 3, 1)
        return {
            "overall_readiness_score": score,
            "readiness_label": "Needs Practice" if score < 7.5 else "Almost Ready",
            "verdict": "Full synthesis unavailable — individual question scores shown above.",
            "cross_answer_strengths": [],
            "cross_answer_weaknesses": [],
            "recommended_study_areas": ["Core service concepts", "Scenario-based application", "Architectural trade-offs"],
            "accuracy_avg": avg("accuracy"),
            "depth_avg": avg("depth"),
            "coverage_avg": avg("concept_coverage"),
        }

    def _build_mock_assessment(self, cert_track: str, questions: list) -> dict:
        return {
            "title": f"{cert_track} Mock Assessment",
            "duration_minutes": 20,
            "instructions": f"Answer each question as you would in the {cert_track} exam. Aim for complete, specific answers referencing Azure service names and configurations.",
            "questions": questions[:5],
            "scoring_guide": f"Passing threshold: 7.5/10. Focus on accuracy, depth, and practical application."
        }