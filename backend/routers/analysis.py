"""
Analysis Router — REST endpoints for communication analysis.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
import uuid
import traceback

from models.schemas import AnalysisRequest, TranscriptRequest
from services.orchestrator import OrchestratorService
from agents.interviewer import InterviewerAgent

router = APIRouter()
orchestrator = OrchestratorService()
interviewer = InterviewerAgent()


# ── Existing endpoints (unchanged) ───────────────────────────────────────────

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
    audio_file: UploadFile = File(...)
):
    """Analyze an uploaded audio file using Whisper, then run the agent pipeline."""
    try:
        audio_data = await audio_file.read()
        session_id = str(uuid.uuid4())
        request = AnalysisRequest(
            session_id=session_id,
            user_id=user_id,
            goal=goal,
            audio_data=audio_data
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
            {"id": "interview", "name": "Interview Preparation", "description": "Master behavioral, situational, and technical interview questions", "icon": "briefcase", "color": "#6366F1"},
            {"id": "pitch",     "name": "Startup Pitch Practice",  "description": "Refine your pitch for investors, partners, and customers",       "icon": "rocket",    "color": "#F59E0B"},
            {"id": "english",   "name": "English Fluency",         "description": "Build natural fluency, vocabulary, and confident delivery",       "icon": "globe",     "color": "#10B981"},
        ]
    }


# ── Interview session endpoints ───────────────────────────────────────────────

class InterviewStartRequest(BaseModel):
    goal: str = "interview"
    max_rounds: int = 5


class InterviewNextRequest(BaseModel):
    goal: str = "interview"
    round_number: int                # the round number being requested (1-based)
    max_rounds: int = 5
    history: List[dict] = []         # [{question, answer}, ...]
    memory: dict = {}                # session memory, round-tripped from frontend


class InterviewFinalRequest(BaseModel):
    goal: str = "interview"
    history: List[dict]              # full completed history
    user_id: Optional[str] = None


@router.post("/interview/start")
async def interview_start(request: InterviewStartRequest):
    """
    Begin a new interview session.
    Returns the first question and initial memory.
    The frontend must store `memory` and send it back on every /next call.
    """
    try:
        result = await interviewer.start(
            goal=request.goal,
            max_rounds=request.max_rounds,
        )
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/interview/next")
async def interview_next(request: InterviewNextRequest):
    """
    Generate the next investigative question.
    The frontend sends back the memory it received from the previous call.
    The backend updates memory and returns the new state.
    """
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
    """
    Run the full multi-agent assessment over the completed interview history.
    Concatenates all answers into a single transcript for the existing pipeline.
    """
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