"""
FastAPI application — main entry point.
Provides /ping, /auth/*, /stripe/*, /process-meeting, and /slack/* endpoints.
"""

import os
import json
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from app.config import ALLOWED_ORIGINS, ALLOWED_AUDIO_EXTENSIONS, ALLOWED_TEXT_EXTENSIONS, MAX_AUDIO_SIZE_MB, UPLOAD_DIR
from app.schemas import MeetingResponse
from app.agent import run_meeting_agent
from app.tools.transcribe import transcribe_audio
from app.tools.slack import send_to_slack, test_slack_webhook
from app.database import init_db, increment_meetings_used
from app.auth import router as auth_router, get_optional_user
from app.payments import router as payments_router

app = FastAPI(
    title="Meeting Intelligence Agent",
    description="Upload a meeting recording or transcript and get structured insights.",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ─────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(payments_router)

# ── Database initialization ──────────────────────────────────────
@app.on_event("startup")
async def startup():
    init_db()

# ── Health check ──────────────────────────────────────────────────
# ── In-memory Slack webhook store (per-session) ──────────────────
_slack_config = {"webhook_url": None}


class SlackWebhookRequest(BaseModel):
    """Request body for Slack webhook configuration."""
    webhook_url: str


@app.get("/ping")
async def ping():
    return {"status": "ok", "message": "Meeting Intelligence Agent is running"}


# ── Slack Integration Endpoints ───────────────────────────────────
@app.post("/slack/test")
async def slack_test(req: SlackWebhookRequest):
    """
    Send a test message to verify the Slack webhook URL works.
    Does NOT save the URL — use /slack/configure for that.
    """
    result = await test_slack_webhook(req.webhook_url)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"status": "ok", "message": "Test message sent to Slack successfully."}


@app.post("/slack/configure")
async def slack_configure(req: SlackWebhookRequest):
    """
    Save the Slack webhook URL for automatic posting on meeting analysis.
    Also sends a test message to verify connectivity.
    """
    result = await test_slack_webhook(req.webhook_url)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    _slack_config["webhook_url"] = req.webhook_url
    return {
        "status": "ok",
        "message": "Slack webhook configured and verified. Analyses will auto-post.",
    }


@app.delete("/slack/configure")
async def slack_disconnect():
    """Remove the saved Slack webhook URL."""
    _slack_config["webhook_url"] = None
    return {"status": "ok", "message": "Slack integration disconnected."}


@app.get("/slack/status")
async def slack_status():
    """Check whether Slack is currently connected."""
    connected = _slack_config["webhook_url"] is not None
    return {"connected": connected}


# ── Main endpoint ─────────────────────────────────────────────────
@app.post("/process-meeting", response_model=MeetingResponse)
async def process_meeting(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    summary_level: Optional[str] = Form("standard"),
    email_tone: Optional[str] = Form("professional"),
    roster: Optional[str] = Form(None),
    user: Optional[dict] = Depends(get_optional_user),
):
    """
    Accept either an uploaded file (audio or text) or pasted transcript text.
    Route through Whisper for audio, then run the LangChain agent pipeline.

    An optional `roster` (JSON array of {name, email, role}) lets the agent
    resolve recipient addresses and tailor each follow-up email by role.
    """

    transcript: str = ""
    was_audio: bool = False

    # ── Parse the optional attendee roster ────────────────────────
    roster_list: list[dict] = []
    if roster:
        try:
            parsed = json.loads(roster)
            if isinstance(parsed, list):
                roster_list = [
                    {
                        "name": str(m.get("name", "")).strip(),
                        "email": str(m.get("email", "")).strip(),
                        "role": str(m.get("role", "")).strip() or None,
                    }
                    for m in parsed
                    if isinstance(m, dict) and str(m.get("name", "")).strip()
                ]
        except (json.JSONDecodeError, AttributeError):
            raise HTTPException(
                status_code=400,
                detail="Invalid roster format. Expected a JSON array of {name, email, role}.",
            )

    # ── Validate that at least one input is provided ──────────────
    if file is None and (text is None or text.strip() == ""):
        raise HTTPException(
            status_code=400,
            detail="Provide either a file upload or transcript text.",
        )

    # ── Handle file upload ────────────────────────────────────────
    if file is not None:
        ext = os.path.splitext(file.filename or "")[1].lower()

        if ext in ALLOWED_AUDIO_EXTENSIONS:
            # Validate file size
            contents = await file.read()
            size_mb = len(contents) / (1024 * 1024)
            if size_mb > MAX_AUDIO_SIZE_MB:
                raise HTTPException(
                    status_code=413,
                    detail=f"Audio file exceeds {MAX_AUDIO_SIZE_MB}MB limit.",
                )

            # Save to disk for Whisper
            filename = f"{uuid.uuid4().hex}{ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(contents)

            try:
                transcript = transcribe_audio(filepath)
                was_audio = True
            finally:
                # Clean up temp file
                if os.path.exists(filepath):
                    os.remove(filepath)

        elif ext in ALLOWED_TEXT_EXTENSIONS:
            contents = await file.read()
            transcript = contents.decode("utf-8", errors="replace")

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {ext}. Accepted: {ALLOWED_AUDIO_EXTENSIONS | ALLOWED_TEXT_EXTENSIONS}",
            )

    # ── Handle pasted text ────────────────────────────────────────
    elif text is not None and text.strip():
        transcript = text.strip()

    if len(transcript.strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="Transcript is too short to analyse meaningfully.",
        )

    # ── Run the agent pipeline ────────────────────────────────────
    try:
        result = await run_meeting_agent(
            transcript=transcript,
            summary_level=summary_level,
            email_tone=email_tone,
            roster=roster_list,
        )
    except Exception as e:
        # Surface LLM provider failures (e.g. rate limits) as a clear 503
        # instead of an opaque 500, so the UI can show a useful message.
        message = str(e)
        if "RESOURCE_EXHAUSTED" in message or "429" in message:
            detail = (
                "The AI model is rate-limited right now (free-tier quota exceeded). "
                "Please wait a minute and try again, or add billing to your Google AI key."
            )
        else:
            detail = "The AI model failed to process this meeting. Please try again."
        raise HTTPException(status_code=503, detail=detail)

    # ── Track usage for authenticated users ─────────────────────────
    if user is not None:
        increment_meetings_used(user["id"])

    # ── Optionally post to Slack if configured ─────────────────────
    if _slack_config["webhook_url"]:
        await send_to_slack(
            webhook_url=_slack_config["webhook_url"],
            summary=result["summary"],
            action_items=result["action_items"],
            title="New Meeting Analysis",
        )

    return MeetingResponse(
        transcript=transcript if was_audio else None,
        summary=result["summary"],
        action_items=result["action_items"],
        draft_emails=result["draft_emails"],
    )
