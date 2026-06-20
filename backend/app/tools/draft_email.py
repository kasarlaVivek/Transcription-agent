"""
Draft email tool — generates a personalised follow-up email for one stakeholder.
"""

from langchain_core.tools import tool


@tool
def draft_email(owner: str, tasks: str, meeting_summary: str) -> str:
    """
    Draft a professional follow-up email for a specific meeting attendee.

    The email should:
    - Be addressed to the owner by name
    - Reference the meeting context briefly
    - List ONLY the action items assigned to this specific person
    - Include deadlines where available
    - Close with a professional sign-off
    - Be ready to send (the user will review before sending)

    Use a warm but professional tone. Keep it concise.

    Args:
        owner: Name of the person this email is addressed to.
        tasks: JSON string of action items assigned to this owner.
        meeting_summary: Brief context about the meeting.

    Returns:
        A complete email body string with subject line.
    """
    return f"Email for {owner}"
