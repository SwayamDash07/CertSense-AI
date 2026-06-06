"""
Agent 1: Orchestrator Agent
Coordinates the entire multi-agent certification readiness workflow.
Routes tasks based on cert track, aggregates results, generates final response.
Uses Microsoft Foundry for agent orchestration.
"""

import asyncio
import json
from typing import AsyncGenerator, Dict, Any, Optional
from agents.communication_coach import CommunicationCoachAgent
from agents.study_plan import StudyPlanAgent
from agents.assessment import AssessmentAgent
from agents.insights import InsightsAgent
from services.foundry_client import FoundryClient
from services.speech_processor import SpeechProcessor
from models.schemas import AnalysisRequest, AnalysisResult, AgentEvent


class OrchestratorAgent:
    """
    Orchestrator Agent: Master coordinator of the certification readiness multi-agent system.

    Responsibilities:
    - Understand user's cert target (AZ-204 / AZ-400 / DP-203)
    - Route tasks to appropriate specialized agents
    - Aggregate all agent outputs
    - Generate unified final response with full reasoning chain

    Microsoft Foundry Integration:
    - Registered as primary orchestrator agent in Foundry workspace
    - Logs reasoning steps to Foundry IQ knowledge store
    """

    GOAL_WORKFLOWS = {
        "AZ-204": {
            "focus": "AZ-204",
            "role": "Azure Developer Associate",
            "question_types": ["recall", "comprehension", "application", "analysis", "scenario"],
            "key_metrics": ["concept_coverage", "technical_depth", "scenario_accuracy", "readiness_score"],
            "assessment_style": "Azure Developer Associate exam evaluation"
        },
        "AZ-400": {
            "focus": "AZ-400",
            "role": "Azure DevOps Engineer Expert",
            "question_types": ["recall", "comprehension", "application", "analysis", "scenario"],
            "key_metrics": ["concept_coverage", "technical_depth", "scenario_accuracy", "readiness_score"],
            "assessment_style": "Azure DevOps Engineer Expert exam evaluation"
        },
        "DP-203": {
            "focus": "DP-203",
            "role": "Azure Data Engineer Associate",
            "question_types": ["recall", "comprehension", "application", "analysis", "scenario"],
            "key_metrics": ["concept_coverage", "technical_depth", "scenario_accuracy", "readiness_score"],
            "assessment_style": "Azure Data Engineer Associate exam evaluation"
        },
    }

    def __init__(self):
        self.coach_agent = CommunicationCoachAgent()
        self.study_plan_agent = StudyPlanAgent()
        self.assessment_agent = AssessmentAgent()
        self.insights_agent = InsightsAgent()
        self.foundry_client = FoundryClient()
        self.speech_processor = SpeechProcessor()

    async def run(self, request: AnalysisRequest, session_history: list = None) -> AnalysisResult:
        goal = request.goal.upper() if request.goal.upper() in self.GOAL_WORKFLOWS else "AZ-204"
        workflow = self.GOAL_WORKFLOWS[goal]

        speech_data = await self.speech_processor.process(
            audio_data=request.audio_data,
            transcript=request.transcript
        )

        coach_output = await self.coach_agent.analyze(speech_data, workflow)
        study_plan = await self.study_plan_agent.generate(coach_output, goal)
        assessment = await self.assessment_agent.evaluate(coach_output, goal, workflow)
        insights = await self.insights_agent.generate(coach_output, session_history or [])

        final = self._aggregate(
            coach_output, study_plan, assessment, insights, goal,
            speech_data.get("transcript", "")
        )

        await self.foundry_client.log_session(request.session_id, final)
        return final

    async def stream_analysis(self, data: dict, session_id: str) -> AsyncGenerator[AgentEvent, None]:
        raw_goal = data.get("goal", "AZ-204").upper()
        goal = raw_goal if raw_goal in self.GOAL_WORKFLOWS else "AZ-204"
        transcript = data.get("transcript", "")
        workflow = self.GOAL_WORKFLOWS[goal]

        yield self._event("orchestrator", "started", {
            "message": f"Orchestrator activated — routing to {goal} readiness workflow",
            "goal": goal,
            "agents_queued": ["readiness_coach", "study_plan", "assessment", "insights"]
        })
        await asyncio.sleep(0.3)

        yield self._event("orchestrator", "routing", {
            "message": "Processing explanation transcript...",
            "step": "speech_processing"
        })

        speech_data = await self.speech_processor.process(audio_data=None, transcript=transcript)

        yield self._event("orchestrator", "speech_processed", {
            "message": "Input ready — dispatching to Readiness Coach Agent",
            "speech_metrics": speech_data.get("metrics", {})
        })
        await asyncio.sleep(0.2)

        yield self._event("readiness_coach", "started", {
            "message": f"Analyzing concept explanation against {goal} skill areas..."
        })

        async for step in self.coach_agent.stream_analyze(speech_data, workflow):
            yield self._event("readiness_coach", "reasoning", step)

        coach_output = await self.coach_agent.analyze(speech_data, workflow)

        yield self._event("readiness_coach", "completed", {
            "message": "Readiness analysis complete",
            "score": coach_output.get("overall_score"),
            "strengths": coach_output.get("strengths", []),
            "weaknesses": coach_output.get("weaknesses", []),
            "priority_ranking": coach_output.get("priority_ranking", [])
        })
        await asyncio.sleep(0.2)

        yield self._event("study_plan", "started", {
            "message": f"Generating personalized 7-day {goal} study roadmap..."
        })

        study_plan = await self.study_plan_agent.generate(coach_output, goal)

        yield self._event("study_plan", "completed", {
            "message": "Study plan ready",
            "plan": study_plan
        })
        await asyncio.sleep(0.2)

        yield self._event("assessment", "started", {
            "message": f"Generating {workflow['assessment_style']} practice questions..."
        })

        assessment = await self.assessment_agent.evaluate(coach_output, goal, workflow)

        yield self._event("assessment", "completed", {
            "message": "Assessment ready",
            "readiness_score": assessment.get("readiness_score"),
            "practice_questions": assessment.get("questions", [])
        })
        await asyncio.sleep(0.2)

        yield self._event("insights", "started", {
            "message": "Analysing session history and tracking readiness trends..."
        })

        insights = await self.insights_agent.generate(coach_output, [])

        yield self._event("insights", "completed", {
            "message": "Insights generated",
            "trend": insights.get("trend"),
            "report": insights.get("report")
        })
        await asyncio.sleep(0.2)

        final = self._aggregate(coach_output, study_plan, assessment, insights, goal)

        yield self._event("orchestrator", "completed", {
            "message": "All agents completed — final readiness report ready",
            "result": final
        })

    def _event(self, agent: str, status: str, data: dict) -> dict:
        return {"agent": agent, "status": status, "data": data}

    def _aggregate(self, coach, study_plan, assessment, insights, goal, transcript="") -> dict:
        return {
            "goal": goal,
            "transcript": transcript,
            "overall_score": coach.get("overall_score", 5.0),
            "communication_analysis": coach,
            "study_plan": study_plan,
            "assessment": assessment,
            "insights": insights,
            "final_recommendation": self._generate_recommendation(coach, goal)
        }

    def _generate_recommendation(self, coach: dict, goal: str) -> str:
        score = coach.get("overall_score", 5.0)
        weaknesses = coach.get("weaknesses", [])
        passing = 7.5

        if score >= 9.0:
            return f"Excellent {goal} readiness — you are prepared to sit the exam. Book your slot."
        elif score >= passing:
            return f"Good {goal} readiness. Consolidate your weak areas over the next 3-5 days before booking."
        elif score >= 6.0:
            return f"Approaching {goal} passing threshold. Complete the 7-day study plan targeting: {', '.join(w for w in weaknesses[:2])}."
        else:
            return f"Significant {goal} preparation needed. Commit to the full study plan — daily hands-on practice is essential."


class OrchestratorService:
    def __init__(self):
        self.agent = OrchestratorAgent()

    async def stream_analysis(self, data: dict, session_id: str) -> AsyncGenerator[dict, None]:
        async for event in self.agent.stream_analysis(data, session_id):
            yield event

    async def run_analysis(self, request, session_history=None):
        return await self.agent.run(request, session_history)