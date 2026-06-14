"""
Pydantic schemas for CertSense AI API.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class AnalysisRequest(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    goal: str = Field(..., description="AZ-204 | AZ-400 | DP-203")
    transcript: Optional[str] = None
    audio_data: Optional[bytes] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class AgentEvent(BaseModel):
    agent: str
    status: str
    data: Dict[str, Any]
    timestamp: Optional[str] = Field(default_factory=lambda: datetime.now().isoformat())


class AnalysisResult(BaseModel):
    session_id: Optional[str] = None
    goal: str
    overall_score: float
    communication_analysis: Dict[str, Any]
    study_plan: Dict[str, Any]
    assessment: Dict[str, Any]
    insights: Dict[str, Any]
    final_recommendation: str
    created_at: Optional[str] = Field(default_factory=lambda: datetime.now().isoformat())


class TranscriptRequest(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    goal: str
    transcript: str
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
