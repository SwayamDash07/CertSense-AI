"""
Agent 3: Study Plan Agent
Generates personalized 7-day certification study roadmaps.
Grounded by Foundry IQ learning resources.
"""

import asyncio
import logging
from typing import Dict, Any, Optional

from services.llm import LLM, safe_json
from services.foundry_iq import FoundryIQClient

logger = logging.getLogger(__name__)


class StudyPlanAgent:

    EXERCISE_LIBRARY = {
        "concept_coverage": [
            {
                "name": "Skill Outline Mapping",
                "duration": "20 min",
                "description": "Download the official Microsoft exam skills outline. Map each skill area to your confidence level (1-3). Focus next sessions on all 1s.",
                "goal": "Identify exact exam scope and personal gaps"
            },
            {
                "name": "Concept Flashcard Sprint",
                "duration": "15 min",
                "description": "Create one flashcard per service you can't define in one sentence. Review daily using spaced repetition.",
                "goal": "Solidify recall of core service definitions"
            }
        ],
        "technical_depth": [
            {
                "name": "Microsoft Learn Module",
                "duration": "30 min",
                "description": "Complete one Microsoft Learn module for your weakest skill area. Take notes on limits, pricing tiers, and configuration options.",
                "goal": "Build depth beyond surface-level definitions"
            },
            {
                "name": "Hands-on Lab",
                "duration": "45 min",
                "description": "Deploy the service in Azure portal or via CLI. Document what you configured and why. Real configuration builds memory.",
                "goal": "Practical experience locks in theoretical knowledge"
            }
        ],
        "scenario_practice": [
            {
                "name": "Scenario Question Drill",
                "duration": "20 min",
                "description": "Answer 10 scenario-based practice questions. For each wrong answer, read the explanation and note the decision rule.",
                "goal": "Train multi-constraint architectural reasoning"
            },
            {
                "name": "Service Selection Matrix",
                "duration": "15 min",
                "description": "Build a comparison table for commonly confused service pairs (e.g. Service Bus vs Event Hub). Include: use case, throughput, ordering, replay.",
                "goal": "Eliminate confusion on service selection questions"
            }
        ],
        "mock_exam": [
            {
                "name": "Timed Practice Test",
                "duration": "45 min",
                "description": "Complete a 40-question timed practice exam. Target 75%+. Review all incorrect answers immediately after.",
                "goal": "Simulate real exam conditions and identify remaining gaps"
            },
            {
                "name": "Weak Area Review",
                "duration": "20 min",
                "description": "Review only the skill areas where you scored below 70% in your practice test. One Microsoft Learn module per weak area.",
                "goal": "Targeted gap closure before exam day"
            }
        ],
        "verbal_explanation": [
            {
                "name": "Teach-Back Recording",
                "duration": "15 min",
                "description": "Record yourself explaining a service or concept out loud as if teaching a colleague. Play it back and note any gaps or hesitations.",
                "goal": "Verbal explanation reveals gaps that reading hides"
            },
            {
                "name": "Concept Summary Sprint",
                "duration": "10 min",
                "description": "For each key service, write a 3-sentence summary: what it is, when to use it, and one limit or constraint. Say it aloud.",
                "goal": "Build fluent verbal recall for voice-based practice"
            }
        ]
    }

    GOAL_SCHEDULES = {
        "AZ-204": {
            "theme": "Azure Developer Associate Prep",
            "milestone": "Exam-ready in 7 days",
            "focus_progression": ["concept_coverage", "technical_depth", "scenario_practice", "mock_exam", "verbal_explanation"]
        },
        "AZ-400": {
            "theme": "Azure DevOps Engineer Expert Prep",
            "milestone": "Exam-ready in 7 days",
            "focus_progression": ["concept_coverage", "technical_depth", "scenario_practice", "mock_exam", "verbal_explanation"]
        },
        "DP-203": {
            "theme": "Azure Data Engineer Associate Prep",
            "milestone": "Exam-ready in 7 days",
            "focus_progression": ["concept_coverage", "technical_depth", "scenario_practice", "mock_exam", "verbal_explanation"]
        },
    }

    DAY_THEMES = {
        "AZ-204": [
            ("Day 1", "Skill gap mapping & core service recall",          "concept_coverage"),
            ("Day 2", "Azure Functions, App Service & API Management",    "technical_depth"),
            ("Day 3", "Storage, Cosmos DB & caching",                     "technical_depth"),
            ("Day 4", "Security: Key Vault, Managed Identity, AAD",       "scenario_practice"),
            ("Day 5", "Messaging: Service Bus, Event Hub, Event Grid",    "scenario_practice"),
            ("Day 6", "Full mock exam + weak area review",                "mock_exam"),
            ("Day 7", "Verbal explanation practice & final review",       "verbal_explanation"),
        ],
        "AZ-400": [
            ("Day 1", "Skill gap mapping & DevOps principles",            "concept_coverage"),
            ("Day 2", "Azure Pipelines: CI build & test stages",          "technical_depth"),
            ("Day 3", "Release pipelines, environments & approvals",      "technical_depth"),
            ("Day 4", "Infrastructure as Code: Terraform & Bicep",        "scenario_practice"),
            ("Day 5", "Monitoring, security scanning & compliance",       "scenario_practice"),
            ("Day 6", "Full mock exam + weak area review",                "mock_exam"),
            ("Day 7", "Verbal explanation practice & final review",       "verbal_explanation"),
        ],
        "DP-203": [
            ("Day 1", "Skill gap mapping & data platform overview",       "concept_coverage"),
            ("Day 2", "Azure Data Factory & Synapse pipelines",           "technical_depth"),
            ("Day 3", "Databricks, Spark & Delta Lake",                   "technical_depth"),
            ("Day 4", "Stream Analytics & real-time ingestion",           "scenario_practice"),
            ("Day 5", "Data Lake design, partitioning & security",        "scenario_practice"),
            ("Day 6", "Full mock exam + weak area review",                "mock_exam"),
            ("Day 7", "Verbal explanation practice & final review",       "verbal_explanation"),
        ],
    }

    def __init__(self):
        self.llm = LLM()
        self.foundry_iq = FoundryIQClient()

    async def generate(self, coach_output: dict, goal: str) -> dict:
        weaknesses = coach_output.get("weaknesses", [])
        priority_ranking = coach_output.get("priority_ranking", [])
        metrics = coach_output.get("metrics", {})
        cert_track = goal.upper() if goal.upper() in self.GOAL_SCHEDULES else "AZ-204"
        schedule = self.GOAL_SCHEDULES[cert_track]

        resources = await self.foundry_iq.get_resources(
            topic=goal,
            weakness_areas=[p.get("area", "") for p in priority_ranking]
        )

        daily_plan = self._build_daily_plan(cert_track)

        llm_plan = await self._llm_generate_study_plan(
            coach_output=coach_output,
            goal=cert_track,
            daily_plan=daily_plan,
            resources=resources
        )

        return {
            "theme": schedule["theme"],
            "milestone": schedule["milestone"],
            "daily_plan": daily_plan,
            "resources": resources,
            "quick_wins": self._get_quick_wins(priority_ranking),
            "llm_enhancements": llm_plan,
            "estimated_improvement": self._estimate_improvement(metrics)
        }

    async def _llm_generate_study_plan(self, coach_output, goal, daily_plan, resources) -> dict:
        weaknesses = coach_output.get("weaknesses", [])
        strengths = coach_output.get("strengths", [])
        overall_score = coach_output.get("overall_score", 5.0)
        priority_ranking = coach_output.get("priority_ranking", [])
        resources_block = f"\nAvailable resources:\n{resources}\n" if resources else ""

        prompt = f"""You are an Azure certification coach creating a personalized study plan.

Certification: {goal}
Current readiness score: {overall_score}/10 (passing threshold: 7.5)
Knowledge gaps: {weaknesses}
Strengths: {strengths}
Priority areas: {[p.get("area", "") for p in priority_ranking]}
{resources_block}
7-day plan structure:
{[{"day": d["day"], "theme": d["theme"]} for d in daily_plan]}

Return ONLY valid JSON, no markdown fences:
{{
  "personalized_message": "2-3 sentence motivational message referencing their specific gaps and cert target",
  "daily_tips": {{"Day 1": "tip", "Day 2": "tip", "Day 3": "tip", "Day 4": "tip", "Day 5": "tip", "Day 6": "tip", "Day 7": "tip"}},
  "success_metrics": ["metric 1", "metric 2", "metric 3"],
  "motivational_checkpoints": ["after day 2 checkpoint", "after day 4 checkpoint", "after day 7 checkpoint"]
}}

Rules:
- daily_tips must have exactly 7 keys Day 1 through Day 7
- success_metrics must be 3 measurable strings specific to {goal}
- All values non-empty strings"""

        try:
            raw = await self.llm.complete_json(prompt, temperature=0.3, max_tokens=800)
            result = safe_json(raw, default={})
            if not result or "personalized_message" not in result:
                return self._fallback_llm_plan(goal, overall_score)
            return result
        except Exception as exc:
            logger.error("LLM study plan failed: %s: %s", type(exc).__name__, exc)
            return self._fallback_llm_plan(goal, overall_score)

    def _fallback_llm_plan(self, goal: str, overall_score: float) -> dict:
        return {
            "personalized_message": (
                f"Your current readiness score of {overall_score}/10 means you need to reach 7.5 to pass {goal}. "
                "Follow this 7-day plan consistently — daily hands-on practice is the fastest path to exam confidence."
            ),
            "daily_tips": {
                "Day 1": "Download the official skills outline and rate your confidence per topic.",
                "Day 2": "Complete one Microsoft Learn module for your weakest service area.",
                "Day 3": "Deploy the service hands-on in Azure portal — configuration builds memory.",
                "Day 4": "Practice 10 scenario questions. Note decision rules for wrong answers.",
                "Day 5": "Build a comparison table for services you confuse with each other.",
                "Day 6": "Take a full timed practice exam. Target 75%+.",
                "Day 7": "Record yourself explaining your top 5 weakest concepts out loud."
            },
            "success_metrics": [
                f"Practice exam score reaches 75%+ on {goal} question bank",
                "Can explain every service in the skills outline in under 60 seconds",
                "Zero incorrect answers on service-selection scenario questions"
            ],
            "motivational_checkpoints": [
                "After Day 2: You should have a clear map of your exact knowledge gaps.",
                "After Day 4: Practice scores should show measurable improvement on weak areas.",
                "After Day 7: Final mock exam score should be at or above passing threshold."
            ]
        }

    def _build_daily_plan(self, cert_track: str) -> list:
        themes = self.DAY_THEMES.get(cert_track, self.DAY_THEMES["AZ-204"])
        days = []
        for day_label, theme, exercise_type in themes:
            exercises = self.EXERCISE_LIBRARY.get(exercise_type, self.EXERCISE_LIBRARY["concept_coverage"])
            days.append({
                "day": day_label,
                "theme": theme,
                "exercises": exercises,
                "total_time": sum(int(e["duration"].split()[0]) for e in exercises),
                "checkpoint": "Record yourself explaining today's topic and compare to yesterday"
            })
        return days

    def _get_quick_wins(self, priority_ranking: list) -> list:
        return [
            {
                "action": item.get("area"),
                "impact": "high",
                "time": item.get("time_to_improve"),
                "tip": f"Focus here first — {item.get('rationale', '')}"
            }
            for item in priority_ranking if item.get("difficulty") == "low"
        ][:3]

    def _estimate_improvement(self, metrics: dict) -> dict:
        current = metrics.get("readiness_score", 5.0)
        gain = 2.0 if current < 6.0 else 1.2 if current < 7.5 else 0.5
        return {
            "current_score": current,
            "projected_score": round(min(current + gain, 10.0), 1),
            "passing_threshold": 7.5,
            "confidence": "high" if current < 7.0 else "medium",
            "timeframe": "7 days with daily practice"
        }