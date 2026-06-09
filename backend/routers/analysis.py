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

DIFFICULTY_MAP = {
    "easy":   ["recall", "comprehension"],
    "medium": ["application", "analysis"],
    "hard":   ["scenario"],
    "mixed":  ["recall", "comprehension", "application", "analysis", "scenario"],
}


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
        try:
            questions = json.loads(raw)
        except Exception:
            questions = safe_json(raw, default=[])
        if not isinstance(questions, list) or len(questions) == 0:
            raise ValueError("LLM returned no questions")
        # If LLM returned fewer than requested, retry once and merge
        if len(questions) < request.question_count:
            try:
                seed2 = random.sample(_SEEDS, min(4, len(_SEEDS)))
                prompt2 = _GEN_PROMPT.format(
                    count=request.question_count - len(questions),
                    cert=cert,
                    domains=domains_text,
                    difficulties=", ".join(difficulties),
                    seed=", ".join(seed2),
                )
                raw2 = await llm.complete_json(prompt2)
                extra = json.loads(raw2) if raw2 else []
                if isinstance(extra, list):
                    questions = (questions + extra)[:request.question_count]
            except Exception:
                pass
        questions = questions[:request.question_count]
    except Exception as e:
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
            {"id": 1, "difficulty": "recall", "question": "Which Azure Functions hosting plan provides the lowest cold start latency?", "skill_area": "Azure Functions", "options": ["Consumption plan", "Premium plan", "Dedicated (App Service) plan", "Docker container plan"], "correct_option": "B", "explanation": "The Premium plan keeps pre-warmed instances ready, eliminating cold starts. The Consumption plan spins up instances on demand, causing cold starts."},
            {"id": 2, "difficulty": "application", "question": "A solution requires globally distributed data with < 10ms reads. Which service fits best?", "skill_area": "Cosmos DB", "options": ["Azure SQL Database", "Azure Table Storage", "Azure Cosmos DB", "Azure Cache for Redis"], "correct_option": "C", "explanation": "Cosmos DB provides global distribution with multi-region reads and single-digit millisecond latency guarantees."},
            {"id": 3, "difficulty": "comprehension", "question": "What is the purpose of a Durable Function orchestrator?", "skill_area": "Azure Functions", "options": ["To handle HTTP triggers only", "To manage stateful workflows across multiple function calls", "To replace Azure Service Bus", "To cache function outputs"], "correct_option": "B", "explanation": "Durable Functions orchestrators coordinate stateful workflows, calling activity functions and managing state between calls without the developer managing checkpoints manually."},
            {"id": 4, "difficulty": "analysis", "question": "When should you choose Service Bus over Event Hub?", "skill_area": "Messaging", "options": ["When you need highest throughput ingestion", "When message ordering and dead-lettering are required", "When you need stream replay", "When cost is the only concern"], "correct_option": "B", "explanation": "Service Bus supports ordered delivery, dead-letter queues, and message sessions. Event Hub is optimised for high-throughput streaming and replay."},
            {"id": 5, "difficulty": "scenario", "question": "You need to process 50,000 IoT events/sec with replay capability. Which architecture is correct?", "skill_area": "Event-driven architecture", "options": ["Service Bus + Logic Apps", "Event Hub + Stream Analytics + ADLS", "Cosmos DB + Functions", "API Management + Functions"], "correct_option": "B", "explanation": "Event Hub handles massive ingestion with replay via retention. Stream Analytics processes the stream. ADLS stores raw events for replay and batch processing."},
            {"id": 6, "difficulty": "recall", "question": "Which Azure Blob Storage tier is optimised for data accessed less than once per month?", "skill_area": "Azure Blob Storage", "options": ["Hot tier", "Cool tier", "Cold tier", "Archive tier"], "correct_option": "C", "explanation": "The Cold tier is for data accessed less than once per month with lower storage cost than Cool but higher access cost. Archive is for data rarely accessed at all."},
            {"id": 7, "difficulty": "application", "question": "How should an Azure Function securely access a connection string without hardcoding it?", "skill_area": "Azure Key Vault", "options": ["Store it in appsettings.json", "Use a SAS token in the code", "Use Managed Identity to access Key Vault at runtime", "Encrypt it in source control"], "correct_option": "C", "explanation": "Managed Identity lets the Function authenticate to Key Vault without credentials in code. The identity is managed by Azure, removing secret rotation burden."},
            {"id": 8, "difficulty": "comprehension", "question": "What does a Cosmos DB partition key determine?", "skill_area": "Cosmos DB", "options": ["Replication region", "Physical data distribution and RU/s scaling", "Backup frequency", "Index policy"], "correct_option": "B", "explanation": "The partition key determines how data is distributed across physical partitions. A poor partition key causes hot partitions and throttling. A good one distributes load evenly."},
            {"id": 9, "difficulty": "analysis", "question": "You need to rate-limit API calls and apply transformation policies. Which service do you use?", "skill_area": "Azure API Management", "options": ["Azure Front Door", "Azure API Management", "Azure Application Gateway", "Azure Load Balancer"], "correct_option": "B", "explanation": "API Management provides policy-based request/response transformation, rate limiting, quotas, and authentication. Front Door and App Gateway handle routing and WAF, not policy execution."},
            {"id": 10, "difficulty": "scenario", "question": "An app needs to send messages that must be processed in order per customer. Which Service Bus feature handles this?", "skill_area": "Azure Service Bus", "options": ["Dead-letter queue", "Message sessions", "Topic subscriptions", "Scheduled delivery"], "correct_option": "B", "explanation": "Service Bus sessions enable ordered processing of related messages using a session ID. Each customer's messages share a session ID, ensuring in-order processing by a single consumer."},
            {"id": 11, "difficulty": "recall", "question": "Which Azure Container Apps feature automatically scales to zero when there is no traffic?", "skill_area": "Azure Container Instances / Container Apps", "options": ["KEDA scaling", "Manual scaling rules", "Dedicated plan scaling", "Azure Monitor autoscale"], "correct_option": "A", "explanation": "KEDA (Kubernetes-based Event Driven Autoscaler) in Container Apps enables scale-to-zero. The app consumes no compute resources when idle and scales up on incoming events or HTTP traffic."},
            {"id": 12, "difficulty": "application", "question": "What is the primary benefit of using Managed Identity over a service principal with a client secret?", "skill_area": "Azure Active Directory / Managed Identity", "options": ["Lower cost", "No credential rotation required", "Faster authentication", "Broader RBAC support"], "correct_option": "B", "explanation": "Managed Identity credentials are managed by Azure — no secret to store, rotate, or leak. Service principals require client secrets or certificates that expire and must be rotated manually."},
            {"id": 13, "difficulty": "comprehension", "question": "What does Azure Application Insights distributed tracing track?", "skill_area": "Azure Monitor / Application Insights", "options": ["Cost per resource", "Request flow across microservices end-to-end", "VM CPU utilisation", "Storage access patterns"], "correct_option": "B", "explanation": "Distributed tracing follows a request as it passes through multiple services, recording spans at each hop. This lets you identify latency bottlenecks and failure points across your entire microservices architecture."},
            {"id": 14, "difficulty": "scenario", "question": "Your Azure Cache for Redis frequently evicts keys under memory pressure. Which eviction policy preserves recently accessed keys longest?", "skill_area": "Azure Cache for Redis", "options": ["allkeys-lru", "volatile-lru", "allkeys-random", "noeviction"], "correct_option": "A", "explanation": "allkeys-lru evicts the least recently used keys across all keys, preserving recently accessed data. volatile-lru only considers keys with a TTL set, which may not include your important cached data."},
            {"id": 15, "difficulty": "analysis", "question": "When would you use Event Grid instead of Service Bus?", "skill_area": "Messaging", "options": ["When you need message sessions", "When you need reactive event routing to multiple subscribers", "When ordering is critical", "When processing large message payloads"], "correct_option": "B", "explanation": "Event Grid is a publish-subscribe routing service for reactive, fan-out event delivery. Service Bus is for reliable message queuing with ordering and delivery guarantees. Use Event Grid when multiple downstream handlers must react to the same event."},
        ],
        "AZ-400": [
            {"id": 1, "difficulty": "recall", "question": "What does 'shift-left' mean in DevOps?", "skill_area": "DevOps principles", "options": ["Moving deployments to the left region", "Running tests and security checks earlier in the pipeline", "Reducing pipeline stages", "Shifting responsibility to operations"], "correct_option": "B", "explanation": "Shift-left means moving testing, security scanning, and quality checks earlier in the development process to catch issues sooner and reduce cost of fixes."},
            {"id": 2, "difficulty": "application", "question": "Which deployment strategy allows instant rollback with zero downtime?", "skill_area": "Deployment strategies", "options": ["Rolling deployment", "Blue-green deployment", "Canary release", "Recreate deployment"], "correct_option": "B", "explanation": "Blue-green keeps the old environment live while the new one is deployed. Traffic switches instantly, and rollback is a single routing change."},
            {"id": 3, "difficulty": "comprehension", "question": "What is a pipeline artifact in Azure DevOps?", "skill_area": "Azure Pipelines", "options": ["A deployed environment", "A published build output passed between pipeline stages", "A YAML template", "A release gate"], "correct_option": "B", "explanation": "Pipeline artifacts are files produced by a build stage and passed to subsequent stages or release pipelines, ensuring consistent deployable units across environments."},
            {"id": 4, "difficulty": "analysis", "question": "You want to enforce that all PRs pass a security scan before merging. Where do you configure this in Azure DevOps?", "skill_area": "Source control", "options": ["Pipeline variables", "Branch policies", "Release gates", "Environment approvals"], "correct_option": "B", "explanation": "Branch policies in Azure Repos let you require status checks (including pipeline results) before a PR can complete. This enforces quality gates at the source control level."},
            {"id": 5, "difficulty": "scenario", "question": "A team wants to release to 5% of users first and monitor error rates before full rollout. Which strategy applies?", "skill_area": "Deployment strategies", "options": ["Blue-green deployment", "Recreate deployment", "Canary release", "Rolling deployment"], "correct_option": "C", "explanation": "Canary releases route a small percentage of traffic to the new version first. Metrics are monitored and the rollout continues or rolls back based on observed error rates and performance."},
            {"id": 6, "difficulty": "recall", "question": "What is the purpose of a service connection in Azure Pipelines?", "skill_area": "Azure Pipelines", "options": ["To connect pipeline agents to each other", "To store credentials for accessing external services like Azure or Docker Hub", "To define pipeline stages", "To cache build dependencies"], "correct_option": "B", "explanation": "Service connections store authentication details for external services. Pipelines use them to deploy to Azure subscriptions, push to container registries, or access other external systems without hardcoding credentials."},
            {"id": 7, "difficulty": "application", "question": "How do you share reusable pipeline logic across multiple Azure DevOps projects?", "skill_area": "Azure Pipelines", "options": ["Copy YAML files manually", "Use template references to a shared repository", "Export pipeline JSON", "Use Azure Artifacts"], "correct_option": "B", "explanation": "YAML pipeline templates stored in a shared repository can be referenced by pipelines in other projects using the resources.repositories block, enabling DRY reuse of jobs, steps, and stages."},
            {"id": 8, "difficulty": "comprehension", "question": "What does a release gate in Azure Pipelines do?", "skill_area": "Azure Pipelines", "options": ["Blocks a deployment until external conditions are met", "Approves code merges", "Scans for security vulnerabilities", "Caches pipeline outputs"], "correct_option": "A", "explanation": "Release gates automatically evaluate conditions before proceeding — such as querying an API, checking Azure Monitor alerts, or validating work item states. Deployment pauses until all gates pass."},
            {"id": 9, "difficulty": "analysis", "question": "Which branching strategy minimises merge conflicts in a large continuous delivery team?", "skill_area": "Source control", "options": ["GitFlow with long-lived feature branches", "Trunk-based development with short-lived feature branches", "Release branching only", "Environment-based branching"], "correct_option": "B", "explanation": "Trunk-based development keeps feature branches short-lived (hours to days) and merges frequently to main. This minimises divergence and merge conflicts, enabling true continuous integration."},
            {"id": 10, "difficulty": "scenario", "question": "Your pipeline must fail if a Docker image contains a critical CVE. Which type of tool should you integrate?", "skill_area": "Security scanning", "options": ["SAST tool", "Load testing tool", "Container image vulnerability scanner", "Code coverage tool"], "correct_option": "C", "explanation": "Container image vulnerability scanners (such as Trivy, Snyk, or Microsoft Defender for Containers) scan image layers for known CVEs. SAST scans source code, not built images."},
            {"id": 11, "difficulty": "recall", "question": "What is the purpose of feed views in Azure Artifacts?", "skill_area": "Artifact management", "options": ["To filter pipeline logs", "To promote packages through stages like prerelease and release", "To manage agent pools", "To version YAML pipelines"], "correct_option": "B", "explanation": "Feed views (like @prerelease and @release) let teams promote packages through maturity stages. Consumers pin to a view to receive only packages that have passed quality gates."},
            {"id": 12, "difficulty": "application", "question": "How should secrets be passed to a GitHub Actions workflow without exposing them in logs?", "skill_area": "GitHub Actions", "options": ["Hardcode them in the workflow YAML", "Store them as repository or environment secrets and reference with secrets context", "Pass them as workflow inputs", "Store them in a public config file"], "correct_option": "B", "explanation": "GitHub Actions secrets are stored encrypted and masked in logs. Reference them with ${{ secrets.MY_SECRET }}. Never hardcode secrets in YAML — they are visible in the repository history."},
            {"id": 13, "difficulty": "comprehension", "question": "What is the difference between a self-hosted and Microsoft-hosted agent in Azure Pipelines?", "skill_area": "Azure Pipelines", "options": ["Self-hosted agents are faster by default", "Microsoft-hosted agents are provisioned fresh per job; self-hosted agents persist state", "Self-hosted agents cannot run YAML pipelines", "Microsoft-hosted agents have no internet access"], "correct_option": "B", "explanation": "Microsoft-hosted agents are clean VMs provisioned per job and discarded after. Self-hosted agents persist between jobs, allowing caching, custom tools, and access to private networks."},
            {"id": 14, "difficulty": "scenario", "question": "Infrastructure changes must be reviewed before applying in production. Which IaC practice enforces this?", "skill_area": "Infrastructure as Code", "options": ["Running terraform apply locally", "Using terraform plan output as a PR artifact with required approval", "Disabling state locking", "Hardcoding environment values"], "correct_option": "B", "explanation": "Running terraform plan in CI and attaching the output to a PR lets reviewers see exactly what will change before approving. This enforces peer review of infrastructure changes the same way code reviews work."},
            {"id": 15, "difficulty": "analysis", "question": "What metric best indicates whether a team is truly practicing continuous integration?", "skill_area": "DevOps principles", "options": ["Number of pipeline stages", "Lead time for changes", "Integration frequency — how often code merges to main", "Number of open pull requests"], "correct_option": "C", "explanation": "CI is defined by frequent integration to the main branch — ideally multiple times per day. Long-lived feature branches that merge infrequently are a sign CI is not truly practiced, regardless of having a pipeline."},
        ],
        "DP-203": [
            {"id": 1, "difficulty": "recall", "question": "What is the key difference between a dedicated and serverless SQL pool in Synapse?", "skill_area": "Azure Synapse", "options": ["Dedicated uses columnar storage, serverless does not", "Dedicated provisions compute upfront, serverless bills per query", "Serverless supports more data formats", "Dedicated is always cheaper"], "correct_option": "B", "explanation": "Dedicated SQL pool pre-provisions DWUs and charges whether or not you query. Serverless SQL pool bills only for data scanned per query, ideal for ad-hoc analytics."},
            {"id": 2, "difficulty": "application", "question": "When should you use Delta Lake format over plain Parquet?", "skill_area": "Data Lake", "options": ["When you need lower storage cost", "When you need ACID transactions and schema evolution", "When you need faster reads only", "When working with streaming data only"], "correct_option": "B", "explanation": "Delta Lake adds ACID transactions, time travel, schema enforcement, and upsert capability on top of Parquet. Use it when your data lake needs transactional reliability and evolving schemas."},
            {"id": 3, "difficulty": "comprehension", "question": "What is the purpose of a tumbling window in Azure Stream Analytics?", "skill_area": "Azure Stream Analytics", "options": ["To buffer events indefinitely", "To aggregate events in fixed, non-overlapping time intervals", "To join two streams", "To filter null values"], "correct_option": "B", "explanation": "Tumbling windows divide a stream into fixed, non-overlapping segments. Each event belongs to exactly one window. Use them for time-based aggregations like counts or averages per minute."},
            {"id": 4, "difficulty": "analysis", "question": "Your ADF pipeline processes 10TB files daily and times out. What is the most likely fix?", "skill_area": "Azure Data Factory", "options": ["Increase pipeline timeout setting only", "Use a self-hosted IR with higher memory", "Enable partition-based parallel copy with appropriate degree of copy parallelism", "Switch to Logic Apps"], "correct_option": "C", "explanation": "Parallel copy with partitioning splits large files into chunks processed concurrently. This dramatically reduces copy duration for large datasets. A timeout increase alone does not improve throughput."},
            {"id": 5, "difficulty": "scenario", "question": "You need to query data in Azure Data Lake without moving it into a separate warehouse. Which Synapse feature handles this?", "skill_area": "Azure Synapse", "options": ["Dedicated SQL pool", "Synapse Link", "Serverless SQL pool with OPENROWSET", "Synapse Spark pool only"], "correct_option": "C", "explanation": "Serverless SQL pool with OPENROWSET queries files (Parquet, CSV, JSON, Delta) directly in ADLS Gen2 without ingestion. Data stays in the lake and you pay only for data scanned."},
            {"id": 6, "difficulty": "recall", "question": "What does the hierarchical namespace in ADLS Gen2 enable?", "skill_area": "Azure Data Lake Storage Gen2", "options": ["Automatic data encryption", "Directory-level ACLs and atomic rename operations", "Global replication", "Serverless query capability"], "correct_option": "B", "explanation": "The hierarchical namespace enables true directory semantics with POSIX-compliant ACLs at the folder and file level, and atomic rename/move operations — critical for big data workloads."},
            {"id": 7, "difficulty": "application", "question": "How do you implement slowly changing dimension Type 2 in a Synapse dedicated pool?", "skill_area": "Data modeling", "options": ["Update the existing row in place", "Delete and reinsert the row", "Add new row with new surrogate key, set end date on old row", "Use a separate audit table"], "correct_option": "C", "explanation": "SCD Type 2 preserves history by inserting a new row for each change and marking the old row with an end date or is_current flag. This allows point-in-time reporting against historical states."},
            {"id": 8, "difficulty": "comprehension", "question": "What is Synapse Link for Cosmos DB used for?", "skill_area": "Azure Cosmos DB for analytics", "options": ["Replicating Cosmos DB to another region", "Enabling no-ETL analytics on Cosmos DB operational data via Synapse", "Backing up Cosmos DB to ADLS", "Scaling Cosmos DB throughput automatically"], "correct_option": "B", "explanation": "Synapse Link creates an analytical store in Cosmos DB that Synapse Analytics can query directly with no ETL pipeline needed. Operational and analytical workloads are separated without impacting each other."},
            {"id": 9, "difficulty": "analysis", "question": "A Databricks job takes 4 hours on a standard cluster. The bottleneck is a wide transformation. What should you try first?", "skill_area": "Azure Databricks", "options": ["Increase driver node size only", "Repartition the DataFrame before the wide transformation to reduce shuffle", "Switch to serverless SQL pool", "Add more storage accounts"], "correct_option": "B", "explanation": "Wide transformations (joins, groupBy) trigger shuffles. Repartitioning to the right number of partitions before the shuffle reduces skew and optimises parallelism, which is the most impactful first step."},
            {"id": 10, "difficulty": "scenario", "question": "Stock trade events arrive out of order by up to 30 seconds. How do you handle late arrivals in Stream Analytics?", "skill_area": "Azure Stream Analytics", "options": ["Ignore late events", "Set the late arrival tolerance to 30 seconds in the job configuration", "Use a tumbling window with no tolerance", "Buffer all events in Service Bus first"], "correct_option": "B", "explanation": "Stream Analytics has a configurable late arrival policy. Setting it to 30 seconds tells the engine to wait up to 30 seconds for out-of-order events before closing a window, preventing data loss from late arrivals."},
            {"id": 11, "difficulty": "recall", "question": "What does Z-ordering in Delta Lake do?", "skill_area": "Delta Lake", "options": ["Encrypts data at rest", "Co-locates related data in the same files to speed up filter queries", "Compresses Parquet files", "Enforces schema on write"], "correct_option": "B", "explanation": "Z-ordering reorganises Delta table data so rows with similar values in the specified columns are stored together. This enables data skipping — fewer files are read when filtering on Z-ordered columns."},
            {"id": 12, "difficulty": "application", "question": "You need to ingest streaming data into ADLS Gen2 with guaranteed delivery and replay. Which service do you use?", "skill_area": "Azure Event Hubs", "options": ["Azure Service Bus", "Azure Event Hubs with Capture enabled", "Azure Queue Storage", "Azure Notification Hubs"], "correct_option": "B", "explanation": "Event Hubs with Capture automatically writes streaming events to ADLS Gen2 or Blob Storage in Avro/Parquet format, providing durable storage and replay capability for batch processing alongside real-time consumers."},
            {"id": 13, "difficulty": "comprehension", "question": "What is the purpose of Unity Catalog in Azure Databricks?", "skill_area": "Azure Databricks", "options": ["To manage cluster autoscaling", "To provide centralised data governance, access control, and lineage across workspaces", "To optimise Spark query plans", "To schedule notebook jobs"], "correct_option": "B", "explanation": "Unity Catalog is Databricks' unified governance layer. It provides fine-grained access control, data lineage tracking, and a centralised metastore shared across multiple Databricks workspaces in an account."},
            {"id": 14, "difficulty": "analysis", "question": "A dedicated SQL pool query is slow due to data skew on a hash-distributed table. What should you investigate first?", "skill_area": "Performance optimization", "options": ["Add more DWUs", "Check the distribution column — it may be causing uneven data spread across distributions", "Switch to round-robin distribution", "Disable result set caching"], "correct_option": "B", "explanation": "Hash distribution skew occurs when the distribution column has low cardinality or dominant values, concentrating data on few distributions. Changing the distribution column to one with higher cardinality distributes data more evenly."},
            {"id": 15, "difficulty": "scenario", "question": "A data catalog is needed to track data lineage and classify sensitive columns across ADLS and Synapse. Which service provides this?", "skill_area": "Azure Purview", "options": ["Azure Monitor", "Azure Purview (Microsoft Purview)", "Azure Policy", "Azure Synapse Analytics Studio"], "correct_option": "B", "explanation": "Microsoft Purview provides automated data discovery, sensitive data classification, end-to-end lineage tracking, and a unified data catalog across Azure data services, on-premises, and multi-cloud sources."},
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/practice/submit")
async def practice_submit(request: PracticeSubmitRequest):
    try:
        return await submit_practice_paper(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))