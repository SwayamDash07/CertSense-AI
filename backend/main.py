"""
CertSense AI - FastAPI Backend
Multi-agent communication coaching platform
Built for Microsoft Agents League Hackathon (Reasoning Agents Track)
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import json
import asyncio
from typing import Optional

from routers import analysis, sessions, progress
from services.orchestrator import OrchestratorService

app = FastAPI(
    title="CertSense AI",
    description="Multi-agent communication coaching platform powered by Microsoft Foundry",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(progress.router, prefix="/api/progress", tags=["Progress"])

@app.get("/")
async def root():
    return {"message": "CertSense AI - Multi-Agent Communication Coach", "status": "active"}

@app.get("/health")
async def health():
    return {"status": "healthy", "agents": ["orchestrator", "coach", "study_plan", "assessment", "insights"]}

@app.websocket("/ws/analysis/{session_id}")
async def websocket_analysis(websocket: WebSocket, session_id: str):
    """
    Real-time analysis websocket — streams agent thinking steps to the client.
    Each agent broadcasts its intermediate reasoning as it runs.
    """
    await websocket.accept()
    orchestrator = OrchestratorService()
    try:
        while True:
            data = await websocket.receive_json()
            async for event in orchestrator.stream_analysis(data, session_id):
                await websocket.send_json(event)
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
