"""
Pydantic v2 schemas for request validation and response serialisation.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ── Response models ───────────────────────────────────────────────

class ActionItem(BaseModel):
    """A single action item extracted from the meeting."""
    owner: str = Field(..., description="Person responsible for the task")
    task: str = Field(..., description="Description of the action item")
    deadline: str = Field(..., description="Due date or timeframe for the task")


class DraftEmail(BaseModel):
    """A personalised follow-up email draft for one stakeholder."""
    to: str = Field(..., description="Recipient name")
    to_email: Optional[str] = Field(
        None, description="Resolved recipient email address (from the roster, if matched)"
    )
    role: Optional[str] = Field(
        None, description="Recipient's role (from the roster, if matched)"
    )
    subject: str = Field(..., description="Email subject line")
    body: str = Field(..., description="Full email body text")


class RosterMember(BaseModel):
    """A meeting attendee supplied by the user: name, email, and role."""
    name: str = Field(..., description="Attendee's full name")
    email: str = Field(..., description="Attendee's email address")
    role: Optional[str] = Field(None, description="Attendee's role / title")


class MeetingResponse(BaseModel):
    """Complete structured output from the agent pipeline."""
    transcript: Optional[str] = Field(
        None, description="Raw transcript (returned when audio was transcribed)"
    )
    summary: str = Field(..., description="Meeting summary with key decisions and context")
    action_items: list[ActionItem] = Field(
        default_factory=list, description="Extracted action items"
    )
    draft_emails: list[DraftEmail] = Field(
        default_factory=list, description="Personalised follow-up email drafts"
    )


# ── Request models ────────────────────────────────────────────────

class TextInput(BaseModel):
    """Used when the user pastes transcript text directly."""
    text: str = Field(..., min_length=20, description="Meeting transcript text")
