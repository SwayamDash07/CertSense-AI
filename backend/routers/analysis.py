"""
Analysis Router — REST endpoints for communication analysis.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uuid, json, random
import traceback

from models.schemas import AnalysisRequest, TranscriptRequest
from services.orchestrator import OrchestratorService
from agents.interviewer import InterviewerAgent
from services.llm import LLM, safe_json

router = APIRouter()
orchestrator = OrchestratorService()
interviewer = InterviewerAgent()


# ══════════════════════════════════════════════════════════════════════════════
# ANALYZE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/transcript")
async def analyze_transcript(request: TranscriptRequest):
    """Analyze a text transcript through the full multi-agent pipeline."""
    try:
        analysis_request = AnalysisRequest(
            session_id=request.session_id,
            user_id=request.user_id,
            goal=request.goal,
            transcript=request.transcript,
            metadata=request.metadata
        )
        result = await orchestrator.run_analysis(analysis_request)
        return {"success": True, "result": result}
    except Exception as e:
        print("\n===== FULL ERROR =====")
        traceback.print_exc()
        print("======================\n")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/audio")
async def analyze_audio(
    goal: str = Form(...),
    user_id: Optional[str] = Form(None),
    audio_file: UploadFile = File(...),
):
    """Analyze an uploaded audio file using Whisper, then run the agent pipeline."""
    try:
        audio_data = await audio_file.read()
        session_id = str(uuid.uuid4())
        request = AnalysisRequest(
            session_id=session_id,
            user_id=user_id,
            goal=goal,
            audio_data=audio_data,
        )
        result = await orchestrator.run_analysis(request)
        return {"success": True, "session_id": session_id, "result": result}
    except Exception as e:
        print("\n===== FULL ERROR =====")
        traceback.print_exc()
        print("======================\n")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/goals")
async def get_goals():
    return {
        "goals": [
            {"id": "AZ-204", "name": "Azure Developer Associate",  "description": "Build and implement Azure solutions", "color": "#3b82f6"},
            {"id": "AZ-400", "name": "DevOps Engineer Expert",     "description": "Design and implement DevOps practices", "color": "#8b5cf6"},
            {"id": "DP-203", "name": "Data Engineer Associate",    "description": "Design and implement data solutions", "color": "#06b6d4"},
        ]
    }


# ══════════════════════════════════════════════════════════════════════════════
# INTERVIEW ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

class InterviewStartRequest(BaseModel):
    goal: str = "AZ-204"
    max_rounds: int = 5


class InterviewNextRequest(BaseModel):
    goal: str = "AZ-204"
    round_number: int
    max_rounds: int = 5
    history: List[dict] = []
    memory: dict = {}


class InterviewFinalRequest(BaseModel):
    goal: str = "AZ-204"
    history: List[dict]
    user_id: Optional[str] = None


@router.post("/interview/start")
async def interview_start(request: InterviewStartRequest):
    try:
        result = await interviewer.start(goal=request.goal, max_rounds=request.max_rounds)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/interview/next")
async def interview_next(request: InterviewNextRequest):
    try:
        result = await interviewer.next_question(
            goal=request.goal,
            round_number=request.round_number,
            history=request.history,
            memory=request.memory,
            max_rounds=request.max_rounds,
        )
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/interview/assess")
async def interview_assess(request: InterviewFinalRequest):
    try:
        full_transcript = "\n\n".join(
            f"Q: {turn.get('question', '')}\nA: {turn.get('answer', '')}"
            for turn in request.history
        )
        session_id = str(uuid.uuid4())
        analysis_request = AnalysisRequest(
            session_id=session_id,
            user_id=request.user_id or "demo-user",
            goal=request.goal,
            transcript=full_transcript,
            metadata={"source": "interview_session", "rounds": len(request.history)},
        )
        result = await orchestrator.run_analysis(analysis_request)
        result["interview_history"] = request.history
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# PRACTICE PAPER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

class PracticeGenerateRequest(BaseModel):
    goal: str = "AZ-204"
    question_count: int = 10
    difficulty: str = "mixed"


class PracticeSubmitRequest(BaseModel):
    goal: str = "AZ-204"
    questions: List[Dict[str, Any]]
    answers: Dict[str, Any]
    time_taken: int = 0
    time_up: bool = False


# ── Per-cert exam domains ─────────────────────────────────────────────────────
CERT_DOMAINS = {
    "AZ-204": [
        "Azure Functions (triggers, bindings, Durable Functions, hosting plans, cold starts)",
        "Azure App Service (deployment slots, scaling, authentication, custom domains)",
        "Azure Cosmos DB (consistency levels, partition keys, RU/s, APIs, indexing)",
        "Azure Blob Storage (tiers, lifecycle management, SAS tokens, versioning)",
        "Azure API Management (policies, products, subscriptions, backends, caching)",
        "Azure Key Vault (secrets, keys, certificates, managed identity access)",
        "Azure Service Bus (queues, topics, sessions, dead-letter, message lock)",
        "Azure Event Hub (partitions, consumer groups, capture, retention, throughput units)",
        "Azure Active Directory / Managed Identity (OAuth, RBAC, service principals)",
        "Azure Container Instances / Container Apps (deployment, scaling, ingress)",
        "Azure Cache for Redis (eviction policies, connection, clustering)",
        "Azure Monitor / Application Insights (logging, alerts, distributed tracing)",
    ],
    "AZ-400": [
        "Azure Pipelines (YAML, classic, stages, jobs, agents, approvals, gates)",
        "GitHub Actions (workflows, runners, secrets, environments, reusable workflows)",
        "Infrastructure as Code (Terraform, Bicep, ARM templates, state management)",
        "Release strategies (blue-green, canary, rolling, feature flags, ring deployments)",
        "Testing in DevOps (unit, integration, load, shift-left, test parallelism)",
        "Security scanning (SAST, DAST, dependency scanning, secret detection)",
        "Artifact management (Azure Artifacts, versioning, upstream sources, feed views)",
        "Monitoring and observability (Azure Monitor, Log Analytics, dashboards, SLOs)",
        "Source control (branching strategies, PR policies, GitFlow, trunk-based)",
        "Kubernetes and AKS (Helm, kubectl, rolling updates, pod disruption budgets)",
        "Compliance and governance (policy as code, audit logs, approval workflows)",
    ],
    "DP-203": [
        "Azure Data Factory (pipelines, linked services, datasets, triggers, mapping dataflows)",
        "Azure Synapse Analytics (dedicated pool, serverless pool, Spark, integration)",
        "Azure Databricks (clusters, notebooks, Delta Lake, jobs, Unity Catalog)",
        "Azure Data Lake Storage Gen2 (hierarchical namespace, ACLs, lifecycle)",
        "Azure Stream Analytics (inputs, outputs, windowing functions, late arrival)",
        "Azure Event Hubs (capture, partitions, consumer groups, Kafka compatibility)",
        "Delta Lake (ACID transactions, time travel, schema evolution, Z-ordering)",
        "Azure Cosmos DB for analytics (HTAP, Synapse Link, analytical store)",
        "Azure Purview (data catalog, lineage, classification, scanning)",
        "Data modeling (star schema, slowly changing dimensions, partitioning strategies)",
        "Performance optimization (distribution, indexing, caching, partition pruning)",
    ],
}

_GEN_PROMPT = """
You are a Microsoft Azure certification exam question writer.

Certification: {cert}
Exam domains you MUST draw questions from (do not go outside these):
{domains}

Difficulty filter: {difficulties}
Use only the difficulty levels listed above.

Number of questions to generate: {count}
Random variation seed (use these concepts to vary your questions each call): {seed}

Rules:
- Every question MUST be directly relevant to the {cert} exam domains listed above
- Every question MUST have exactly 4 options (A, B, C, D)
- Exactly one option is correct
- Distribute questions across different domains — do not cluster all questions in one area
- Vary question style: some test recall, some test scenario judgment, some test service comparison
- Wrong options must be plausible — not obviously incorrect
- Questions must feel like real exam questions, not documentation summaries

For each question return a JSON object with these exact keys:
  id (int, 1-based),
  difficulty (string matching the filter),
  question (string),
  skill_area (string, name of the domain from the list above),
  options (list of exactly 4 strings, no letter prefix),
  correct_option (string: "A" or "B" or "C" or "D"),
  explanation (string, 2-3 sentences: why the correct answer is right and why the top wrong option is wrong)

Return a JSON array only. No prose, no markdown fences, no code blocks.
""".strip()

_SCORE_PROMPT = """
You are scoring a practice exam for {cert} certification.

Questions and user answers (JSON):
{qa_json}

For each question where the user gave a text answer (not MCQ), evaluate if the answer is correct.
Return a JSON array with one object per question:
  {{ "index": int, "is_correct": bool, "score_note": "brief note" }}

Return a JSON array only. No prose, no markdown fences.
""".strip()

# Random seeds so questions vary each generation
_SEEDS = [
    "cold start latency", "eventual consistency", "idempotency", "retry policies",
    "SLA guarantees", "cost optimisation", "regional failover", "RBAC boundaries",
    "data sovereignty", "throughput units", "partition keys", "connection pooling",
    "blue-green rollout", "feature flags", "canary releases", "observability",
]


async def generate_practice_paper(request: PracticeGenerateRequest):
    llm = LLM()
    difficulties = DIFFICULTY_MAP.get(request.difficulty, DIFFICULTY_MAP["mixed"])
    seed = random.sample(_SEEDS, min(4, len(_SEEDS)))

    cert = request.goal.upper()
    domains = CERT_DOMAINS.get(cert, CERT_DOMAINS["AZ-204"])
    domains_text = "\n".join(f"- {d}" for d in domains)

    prompt = _GEN_PROMPT.format(
        count=request.question_count,
        cert=cert,
        domains=domains_text,
        difficulties=", ".join(difficulties),
        seed=", ".join(seed),
    )

    try:
        raw = await llm.complete_json(prompt)
        questions = safe_json(raw, default=None)
        if not isinstance(questions, list) or len(questions) == 0:
            raise ValueError("LLM returned no questions")
        # Trim to requested count just in case
        questions = questions[:request.question_count]
    except Exception as e:
        # Fallback question bank
        questions = _fallback_questions(cert, request.question_count, difficulties)

    return {"questions": questions, "count": len(questions), "difficulty": request.difficulty}


async def submit_practice_paper(request: PracticeSubmitRequest):
    correct = 0
    reviewed = []
    gaps = set()

    for i, q in enumerate(request.questions):
        user_ans = request.answers.get(str(i))
        correct_opt = q.get("correct_option", "A")
        is_mcq = bool(q.get("options"))

        if is_mcq:
            is_correct = (user_ans == correct_opt) if user_ans else False
        else:
            # For open text answers score generously if non-empty and reasonably long
            is_correct = bool(user_ans and len(str(user_ans).strip()) > 30)

        if not is_correct and q.get("skill_area"):
            gaps.add(q["skill_area"])

        # Map option letter back to text
        options = q.get("options", [])
        opt_map = {chr(65 + j): opt for j, opt in enumerate(options)}
        correct_text = opt_map.get(correct_opt, correct_opt)
        user_text = opt_map.get(user_ans, user_ans) if is_mcq else user_ans

        reviewed.append({
            "index": i,
            "question": q.get("question", ""),
            "difficulty": q.get("difficulty", "application"),
            "skill_area": q.get("skill_area", ""),
            "your_answer": user_text or "(unanswered)",
            "correct_answer": correct_text if not is_correct else None,
            "is_correct": is_correct,
            "explanation": q.get("explanation", ""),
        })

        if is_correct:
            correct += 1

    total = len(request.questions)
    score_pct = round((correct / total) * 100) if total else 0
    passed = score_pct >= 70

    summary = (
        f"Scored {correct}/{total} ({score_pct}%). "
        + ("Above the 70% pass threshold. " if passed else "Below the 70% pass threshold. ")
        + (f"Focus on: {', '.join(list(gaps)[:3])}." if gaps else "Strong coverage across all areas.")
    )

    return {
        "score_pct": score_pct,
        "correct": correct,
        "total": total,
        "passed": passed,
        "summary": summary,
        "gaps": list(gaps),
        "reviewed": reviewed,
        "time_up": request.time_up,
        "time_taken": request.time_taken,
    }


# ── Fallback question bank (used if LLM unavailable) ─────────────────────────

def _fallback_questions(cert: str, count: int, difficulties: list) -> list:
    bank = {
        "AZ-204": [
            {"id": 1, "difficulty": "recall", "question": "Which Azure Functions hosting plan provides the lowest cold start latency?", "skill_area": "Azure Functions", "options": ["Consumption plan", "Premium plan", "Dedicated (App Service) plan", "Docker container plan"], "correct_option": "B", "explanation": "The Premium plan keeps pre-warmed instances ready, eliminating cold starts. The Consumption plan spins up instances on demand, causing cold starts. The Dedicated plan avoids cold starts too but Premium is specifically designed for this."},
            {"id": 2, "difficulty": "application", "question": "A solution requires globally distributed data with < 10ms reads. Which service fits best?", "skill_area": "Cosmos DB", "options": ["Azure SQL Database", "Azure Table Storage", "Azure Cosmos DB", "Azure Cache for Redis"], "correct_option": "C", "explanation": "Cosmos DB provides global distribution with multi-region reads and single-digit millisecond latency guarantees. SQL Database does not offer native global distribution at that latency level."},
            {"id": 3, "difficulty": "comprehension", "question": "What is the purpose of a Durable Function orchestrator?", "skill_area": "Azure Functions", "options": ["To handle HTTP triggers only", "To manage stateful workflows across multiple function calls", "To replace Azure Service Bus", "To cache function outputs"], "correct_option": "B", "explanation": "Durable Functions orchestrators coordinate stateful workflows, calling activity functions and managing state between calls without the developer managing checkpoints manually."},
            {"id": 4, "difficulty": "analysis", "question": "When should you choose Service Bus over Event Hub?", "skill_area": "Messaging", "options": ["When you need highest throughput ingestion", "When message ordering and dead-lettering are required", "When you need stream replay", "When cost is the only concern"], "correct_option": "B", "explanation": "Service Bus supports ordered delivery, dead-letter queues, and message sessions — ideal for enterprise messaging. Event Hub is optimised for high-throughput event streaming and replay, not transactional messaging."},
            {"id": 5, "difficulty": "scenario", "question": "You need to process 50,000 IoT events/sec with replay capability. Which architecture is correct?", "skill_area": "Event-driven architecture", "options": ["Service Bus + Logic Apps", "Event Hub + Stream Analytics + ADLS", "Cosmos DB + Functions", "API Management + Functions"], "correct_option": "B", "explanation": "Event Hub handles massive ingestion with replay via retention. Stream Analytics processes the stream in real time. ADLS stores the raw events for replay and batch processing."},
        ],
        "AZ-400": [
            {"id": 1, "difficulty": "recall", "question": "What does 'shift-left' mean in DevOps?", "skill_area": "DevOps principles", "options": ["Moving deployments to the left region", "Running tests and security checks earlier in the pipeline", "Reducing pipeline stages", "Shifting responsibility to operations"], "correct_option": "B", "explanation": "Shift-left means moving testing, security scanning, and quality checks earlier (leftward on the timeline) in the development process to catch issues sooner and reduce cost of fixes."},
            {"id": 2, "difficulty": "application", "question": "Which deployment strategy allows instant rollback with zero downtime?", "skill_area": "Deployment strategies", "options": ["Rolling deployment", "Blue-green deployment", "Canary release", "Recreate deployment"], "correct_option": "B", "explanation": "Blue-green keeps the old environment live while the new one is deployed. Traffic switches instantly, and rollback is a single routing change. Rolling and canary are gradual and harder to instantly revert."},
            {"id": 3, "difficulty": "comprehension", "question": "What is a pipeline artifact in Azure DevOps?", "skill_area": "Azure Pipelines", "options": ["A deployed environment", "A published build output passed between pipeline stages", "A YAML template", "A release gate"], "correct_option": "B", "explanation": "Pipeline artifacts are files produced by a build stage and passed to subsequent stages or release pipelines, ensuring consistent deployable units across environments."},
        ],
        "DP-203": [
            {"id": 1, "difficulty": "recall", "question": "What is the key difference between a dedicated and serverless SQL pool in Synapse?", "skill_area": "Azure Synapse", "options": ["Dedicated uses columnar storage, serverless does not", "Dedicated provisions compute upfront, serverless bills per query", "Serverless supports more data formats", "Dedicated is always cheaper"], "correct_option": "B", "explanation": "Dedicated SQL pool pre-provisions DWUs and charges whether or not you query. Serverless SQL pool bills only for data scanned per query, making it cost-effective for ad-hoc analytics."},
            {"id": 2, "difficulty": "application", "question": "When should you use Delta Lake format over plain Parquet?", "skill_area": "Data Lake", "options": ["When you need lower storage cost", "When you need ACID transactions and schema evolution", "When you need faster reads only", "When working with streaming data only"], "correct_option": "B", "explanation": "Delta Lake adds ACID transactions, time travel, schema enforcement, and upsert capability on top of Parquet. Use it when your data lake needs transactional reliability and evolving schemas."},
        ],
    }
    qs = bank.get(cert, bank["AZ-204"])
    random.shuffle(qs)
    return qs[:count]


@router.post("/practice/generate")
async def practice_generate(request: PracticeGenerateRequest):
    try:
        return await generate_practice_paper(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/practice/submit")
async def practice_submit(request: PracticeSubmitRequest):
    try:
        return await submit_practice_paper(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))