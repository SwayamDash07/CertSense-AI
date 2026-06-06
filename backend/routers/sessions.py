"""Sessions router"""
from fastapi import APIRouter
router = APIRouter()

SESSION_STORE = {}

@router.get("/{user_id}")
async def get_sessions(user_id: str):
    return {"sessions": SESSION_STORE.get(user_id, [])}

@router.get("/{session_id}/result")
async def get_session_result(session_id: str):
    return {"session_id": session_id, "result": SESSION_STORE.get(session_id)}
