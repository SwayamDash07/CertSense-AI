"""
Agent 2: Readiness Coach Agent
Primary reasoning agent for analyzing certification readiness.
Evaluates concept explanation quality from voice/text input.
Grounded by Foundry IQ knowledge sources.
"""

import asyncio
import logging
import re
from typing import AsyncGenerator, Optional

from services.llm import LLM, safe_json
from services.foundry_iq import FoundryIQClient

logger = logging.getLogger(__name__)


# Key technical terms per cert track — used for concept coverage heuristic
CERT_KEYWORDS = {
    "AZ-204": ["azure functions", "app service", "cosmos db", "blob storage", "api management",
                "service bus", "event hub", "key vault", "managed identity", "container"],
    "AZ-400": ["ci/cd", "pipeline", "github actions", "azure devops", "monitoring", "terraform",
                "infrastructure as code", "release", "artifact", "test automation"],
    "DP-203": ["data factory", "synapse", "databricks", "data lake", "pipeline", "spark",
                "stream analytics", "etl", "partition", "delta lake"],
}


class CommunicationCoachAgent:
    """
    Readiness Coach Agent

    Responsibilities:
    - Analyze candidate's verbal/written concept explanation
    - Evaluate technical accuracy, depth, and coverage
    - Score readiness against certification passing threshold (75%)
    - Rank knowledge gaps by priority for study plan

    Grounded by Foundry IQ with:
    - Azure certification study guides
    - Exam skill outlines
    - Role-based learning paths
    """

    def __init__(self):
        self.llm = LLM()
        self.foundry_iq = FoundryIQClient()

    async def analyze(self, speech_data: dict, workflow: dict) -> dict:
        """Full synchronous analysis — returns complete readiness output."""
        transcript = speech_data.get("transcript", "")
        metrics = speech_data.get("metrics", {})

        local_analysis = self._local_analyze(transcript, metrics, workflow)

        context = await self.foundry_iq.get_context(
            query=f"certification readiness for {workflow.get('focus', 'AZ-204')}",
            domains=["certification", "azure", workflow.get("focus", "AZ-204")]
        )

        llm_analysis = await self._llm_analyze(
            transcript=transcript,
            metrics=metrics,
            workflow=workflow,
            local_hints=local_analysis,
            grounding_context=context
        )

        return self._merge(local_analysis, llm_analysis)

    async def stream_analyze(self, speech_data: dict, workflow: dict) -> AsyncGenerator[dict, None]:
        """Stream intermediate reasoning steps."""
        transcript = speech_data.get("transcript", "")
        cert = workflow.get("focus", "AZ-204")

        yield {"step": "scanning_concepts", "message": f"Scanning explanation for {cert} concept coverage..."}
        await asyncio.sleep(0.4)

        coverage = self._concept_coverage(transcript, cert)
        yield {
            "step": "concept_coverage",
            "message": f"Covered {coverage['covered']}/{coverage['total']} key concepts",
            "data": coverage
        }
        await asyncio.sleep(0.3)

        yield {"step": "depth_analysis", "message": "Evaluating technical depth and accuracy..."}
        await asyncio.sleep(0.3)

        depth = self._assess_depth(transcript)
        yield {
            "step": "depth_scored",
            "message": f"Explanation depth score: {depth:.1f}/10",
            "data": {"depth": depth}
        }
        await asyncio.sleep(0.3)

        yield {"step": "gap_analysis", "message": "Identifying knowledge gaps and weak areas..."}
        await asyncio.sleep(0.4)

        yield {"step": "prioritizing", "message": "Ranking study priorities for maximum exam impact..."}
        await asyncio.sleep(0.4)

    async def _llm_analyze(
        self,
        transcript: str,
        metrics: dict,
        workflow: dict,
        local_hints: dict,
        grounding_context: Optional[str]
    ) -> dict:
        """Deep LLM reasoning for cert concept evaluation."""
        focus = workflow.get("focus", "AZ-204")
        context_block = f"\nCertification knowledge context:\n{grounding_context}\n" if grounding_context else ""

        prompt = f"""You are an expert Azure certification coach evaluating a candidate's concept explanation.
{context_block}
Certification target: {focus}

Candidate explanation:
\"\"\"
{transcript}
\"\"\"

Heuristic analysis:
- Concept coverage score: {local_hints.get("metrics", {}).get("concept_coverage_score", "unknown")}/10
- Technical depth score: {local_hints.get("metrics", {}).get("depth_score", "unknown")}/10
- Word count: {local_hints.get("metrics", {}).get("word_count", "unknown")}
- Overall heuristic score: {local_hints.get("overall_score", "unknown")}/10

Identified gaps: {local_hints.get("weaknesses", [])}
Identified strengths: {local_hints.get("strengths", [])}

Evaluate this explanation against {focus} exam requirements. Return ONLY valid JSON, no markdown fences:
{{
  "overall_score": 0.0,
  "insights": "2-3 sentence summary of exam readiness and most critical finding",
  "detailed_feedback": "specific actionable feedback referencing the candidate's explanation",
  "additional_weaknesses": ["gap 1", "gap 2"],
  "additional_strengths": ["strength 1", "strength 2"]
}}

Rules:
- overall_score: float 1.0-10.0. 7.5 = passing threshold (75%). Score honestly.
- Incomplete/vague explanations: 2-5. Partial coverage: 5-7. Solid understanding: 7-9. Expert: 9-10.
- Reference specific concepts the candidate mentioned or missed
- Focus on {focus} exam skill areas"""

        try:
            raw = await self.llm.complete_json(prompt, temperature=0.2, max_tokens=1500)
            result = safe_json(raw, default={})
            if not result or "insights" not in result:
                logger.warning("LLM returned unexpected structure; using fallback.")
                return self._fallback_llm_response(local_hints)
            return result
        except Exception as exc:
            logger.error("LLM analysis failed: %s: %s", type(exc).__name__, exc)
            return self._fallback_llm_response(local_hints)

    def _fallback_llm_response(self, local_hints: dict) -> dict:
        score = local_hints.get("overall_score", 5.0)
        return {
            "insights": (
                f"Heuristic readiness score: {score}/10. "
                "Passing threshold is 7.5/10 (75%). "
                "Focus on the prioritized study areas below."
            ),
            "detailed_feedback": (
                "Detailed LLM feedback is temporarily unavailable. "
                "Review the gap analysis for targeted study recommendations."
            ),
            "additional_weaknesses": [],
            "additional_strengths": []
        }

    def _local_analyze(self, transcript: str, metrics: dict, workflow: dict = {}) -> dict:
        """Heuristic cert readiness analysis."""
        words = transcript.lower().split() if transcript else []
        cert = workflow.get("focus", "AZ-204")

        coverage = self._concept_coverage(transcript, cert)
        depth = self._assess_depth(transcript)
        word_count = len(words)

        # Score components
        coverage_score = (coverage["covered"] / max(coverage["total"], 1)) * 10
        depth_score = depth
        length_score = min(10.0, word_count / 20)  # 200 words = full marks

        overall = round(coverage_score * 0.4 + depth_score * 0.4 + length_score * 0.2, 1)
        overall = min(overall, 10.0)

        strengths = []
        weaknesses = []

        if coverage_score >= 7.0:
            strengths.append(f"Good coverage of {cert} core concepts")
        else:
            weaknesses.append(f"Missing key {cert} concepts: {', '.join(coverage['missing'][:3])}")

        if depth >= 7.0:
            strengths.append("Explanation shows technical depth and understanding")
        else:
            weaknesses.append("Explanation is surface-level — add specific service names, limits, and use cases")

        if word_count >= 150:
            strengths.append("Sufficient detail in explanation")
        elif word_count < 50:
            weaknesses.append("Explanation too brief — aim for at least 150 words per concept")

        priority_ranking = self._rank_priorities(weaknesses, coverage_score, depth, word_count)

        return {
            "overall_score": overall,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "priority_ranking": priority_ranking,
            "metrics": {
                "concept_coverage_score": round(coverage_score, 1),
                "depth_score": round(depth_score, 1),
                "word_count": word_count,
                "concepts_covered": coverage["covered"],
                "concepts_total": coverage["total"],
                "missing_concepts": coverage["missing"],
                "readiness_score": overall,
            }
        }

    def _concept_coverage(self, transcript: str, cert: str) -> dict:
        """Check how many key cert concepts appear in the explanation."""
        if not transcript:
            return {"covered": 0, "total": 1, "missing": [], "found": []}
        lower = transcript.lower()
        keywords = CERT_KEYWORDS.get(cert, CERT_KEYWORDS["AZ-204"])
        found = [k for k in keywords if k in lower]
        missing = [k for k in keywords if k not in lower]
        return {
            "covered": len(found),
            "total": len(keywords),
            "found": found,
            "missing": missing
        }

    def _assess_depth(self, transcript: str) -> float:
        """Score technical depth based on presence of specific detail markers."""
        if not transcript:
            return 3.0
        lower = transcript.lower()
        depth_markers = [
            "because", "which means", "for example", "specifically", "the difference",
            "compared to", "use case", "when to use", "limit", "sla", "tier",
            "pricing", "partition", "replicate", "scale", "trigger", "binding",
            "authentication", "authorization", "token", "retry", "timeout"
        ]
        hits = sum(1 for m in depth_markers if m in lower)
        return min(10.0, 4.0 + hits * 0.5)

    def _rank_priorities(
        self,
        weaknesses: list,
        coverage_score: float,
        depth: float,
        word_count: int
    ) -> list:
        ranked = []

        if coverage_score < 6.0:
            ranked.append({
                "rank": 1,
                "area": "Concept coverage",
                "rationale": "Missing core exam topics — highest impact on pass rate",
                "difficulty": "medium",
                "time_to_improve": "3-5 days"
            })

        if depth < 6.0:
            ranked.append({
                "rank": len(ranked) + 1,
                "area": "Technical depth",
                "rationale": "Surface-level answers fail scenario-based exam questions",
                "difficulty": "medium",
                "time_to_improve": "1 week"
            })

        if word_count < 100:
            ranked.append({
                "rank": len(ranked) + 1,
                "area": "Explanation completeness",
                "rationale": "Brief answers miss partial credit opportunities",
                "difficulty": "low",
                "time_to_improve": "2-3 days"
            })

        return ranked

    def _merge(self, local: dict, llm: dict) -> dict:
        """Merge local heuristic with LLM analysis. LLM score takes precedence."""
        if not llm:
            return local

        llm_score = llm.get("overall_score")
        if isinstance(llm_score, (int, float)) and 1.0 <= float(llm_score) <= 10.0:
            final_score = round(float(llm_score), 1)
        else:
            final_score = local.get("overall_score", 5.0)

        return {
            **local,
            "overall_score": final_score,
            "heuristic_score": local.get("overall_score"),
            "llm_insights": llm.get("insights", ""),
            "detailed_feedback": llm.get("detailed_feedback", ""),
            "weaknesses": list(set(local.get("weaknesses", []) + llm.get("additional_weaknesses", []))),
            "strengths": list(set(local.get("strengths", []) + llm.get("additional_strengths", [])))
        }