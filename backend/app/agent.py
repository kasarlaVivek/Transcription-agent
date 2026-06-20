"""
LangChain agent orchestrator — the agentic core of the system.

Uses a multi-step tool-calling loop with Google Gemini as the LLM backbone.
The agent receives a meeting transcript and autonomously decides which
tools to call, inspects results, and loops until output is complete.
"""

import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from app.config import GOOGLE_API_KEY, LLM_MODEL


async def run_meeting_agent(
    transcript: str,
    summary_level: str = "standard",
    email_tone: str = "professional",
    roster: list[dict] | None = None,
) -> dict:
    """
    Run the full meeting analysis pipeline using Gemini as a reasoning engine.

    Instead of a single monolithic prompt, we use a multi-step approach:
    1. Summarise the meeting
    2. Extract action items
    3. Draft follow-up emails for each unique owner

    Each step is a separate LLM call with a focused prompt, allowing the
    agent to reason about completeness at each stage.

    Args:
        transcript: The full meeting transcript text.
        summary_level: Detail level of the summary.
        email_tone: Tone style of the emails.
        roster: Optional list of attendees ({name, email, role}) supplied by
            the user. Used to normalise owner names, resolve recipient email
            addresses, and tailor each email to the person's role.

    Returns:
        Dictionary with keys: summary, action_items, draft_emails
    """

    roster = roster or []

    llm = ChatGoogleGenerativeAI(
        model=LLM_MODEL,
        google_api_key=GOOGLE_API_KEY,
        max_output_tokens=4096,
        temperature=0.3,
    )

    # ── Step 1: Summarise the meeting ─────────────────────────────
    summary = await _summarise(llm, transcript, summary_level)

    # ── Step 2: Extract action items (roster names guide owner labels) ─
    action_items = await _extract_action_items(llm, transcript, roster)

    # ── Step 3: Draft emails per owner ────────────────────────────
    # Group action items by owner
    owners: dict[str, list[dict]] = {}
    for item in action_items:
        owner = item["owner"]
        if owner not in owners:
            owners[owner] = []
        owners[owner].append(item)

    draft_emails = []
    for owner, tasks in owners.items():
        member = _match_roster(owner, roster)
        email = await _draft_email(llm, owner, tasks, summary, email_tone, member)
        draft_emails.append(email)

    return {
        "summary": summary,
        "action_items": action_items,
        "draft_emails": draft_emails,
    }


def _match_roster(owner: str, roster: list[dict]) -> dict | None:
    """
    Find the roster entry that best matches an action-item owner name.

    Matching is case-insensitive and tolerant of first-name-only references
    (e.g. owner "Sarah" matches roster member "Sarah Jenkins"). Returns the
    matched member dict ({name, email, role}) or None if no confident match.
    """
    if not owner or not roster:
        return None

    target = owner.strip().lower()

    # Exact full-name match first.
    for member in roster:
        if member.get("name", "").strip().lower() == target:
            return member

    # Token-overlap match (first name, last name, or partial).
    target_tokens = set(target.split())
    for member in roster:
        name_tokens = set(member.get("name", "").strip().lower().split())
        if target_tokens & name_tokens:
            return member

    return None


async def _summarise(llm: ChatGoogleGenerativeAI, transcript: str, summary_level: str = "standard") -> str:
    """Step 1: Generate a meeting summary based on detail level."""

    level_instruction = "Write in professional tone, 3-5 paragraphs. Do NOT list action items here — those will be extracted separately."
    if summary_level == "detailed":
        level_instruction = "Provide a Comprehensive Digest. Write an in-depth, thorough analysis of the meeting context, background discussions, and details. Do NOT list action items here."
    elif summary_level == "bullet":
        level_instruction = "Provide Executive Keynotes. Write the summary strictly as high-impact bullet points. Focus on direct takeaways, key decisions, and critical outcomes. Do NOT list action items here."
    elif summary_level == "unresolved":
        level_instruction = "Provide an Unresolved Issues Brief. Focus specifically on open questions, points of debate, unresolved decisions, and next-step friction. Do NOT list action items here."
    elif summary_level == "timeline":
        level_instruction = "Provide a Timeline & Sprint Brief. Organize the summary Chronologically or by phase/sprint deadlines discussed. Do NOT list action items here."

    messages = [
        SystemMessage(content=(
            "You are a meeting analyst. Your job is to produce a clear, structured "
            "summary of the meeting transcript provided. Focus on:\n"
            "- Key decisions made\n"
            "- Important discussion points\n"
            "- Overall context and outcomes\n"
            "- Any unresolved issues or open questions\n\n"
            f"{level_instruction}"
        )),
        HumanMessage(content=f"Here is the meeting transcript:\n\n{transcript}"),
    ]

    response = await llm.ainvoke(messages)
    return response.content.strip()


async def _extract_action_items(
    llm: ChatGoogleGenerativeAI,
    transcript: str,
    roster: list[dict] | None = None,
) -> list[dict]:
    """Step 2: Extract structured action items from the transcript."""

    roster_hint = ""
    if roster:
        attendees = "; ".join(
            f"{m.get('name', '').strip()}"
            + (f" ({m['role'].strip()})" if m.get("role") else "")
            for m in roster if m.get("name")
        )
        if attendees:
            roster_hint = (
                "\n\nKnown attendees (use these EXACT names for the \"owner\" field "
                "when an action item belongs to one of them, even if the transcript "
                f"refers to them by first name only):\n{attendees}"
            )

    messages = [
        SystemMessage(content=(
            "You are a meeting analyst specialising in action item extraction. "
            "Analyse the transcript and extract EVERY action item, commitment, "
            "assignment, or follow-up mentioned.\n\n"
            "Return a JSON array where each element has exactly these fields:\n"
            '- "owner": person responsible (use their name as stated in the transcript)\n'
            '- "task": clear, specific description of what needs to be done\n'
            '- "deadline": due date or timeframe (use "Not specified" if none given)\n\n'
            "Be thorough. Return ONLY valid JSON — no markdown fences, no extra text."
            f"{roster_hint}"
        )),
        HumanMessage(content=f"Here is the meeting transcript:\n\n{transcript}"),
    ]

    response = await llm.ainvoke(messages)
    raw = response.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        raw = raw.strip()

    try:
        items = json.loads(raw)
        if not isinstance(items, list):
            items = [items]
    except json.JSONDecodeError:
        # Fallback: try to find JSON array in the response
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start != -1 and end > start:
            items = json.loads(raw[start:end])
        else:
            items = []

    # Validate each item has required fields
    validated = []
    for item in items:
        validated.append({
            "owner": item.get("owner", "Unassigned"),
            "task": item.get("task", ""),
            "deadline": item.get("deadline", "Not specified"),
        })

    return validated


async def _draft_email(
    llm: ChatGoogleGenerativeAI,
    owner: str,
    tasks: list[dict],
    summary: str,
    email_tone: str = "professional",
    member: dict | None = None,
) -> dict:
    """Step 3: Draft a follow-up email for one specific owner with customized tone."""

    tasks_text = "\n".join(
        f"- {t['task']} (Deadline: {t['deadline']})" for t in tasks
    )

    # Prefer the roster's canonical name/role when we matched the owner.
    recipient_name = (member.get("name") if member else None) or owner
    recipient_role = member.get("role") if member else None
    recipient_email = member.get("email") if member else None

    role_instruction = ""
    if recipient_role:
        role_instruction = (
            f"\nThe recipient's role is: {recipient_role}. Tailor the framing and "
            "level of detail to suit someone in this role."
        )

    tone_instruction = "Use a warm but professional and crisp tone."
    if email_tone == "collaborative":
        tone_instruction = "Use a highly collaborative, friendly, warm, and encouraging tone. Focus on team alignment."
    elif email_tone == "direct":
        tone_instruction = "Use a direct, action-oriented, and extremely concise tone. Focus strictly on deliverables without conversational fluff."
    elif email_tone == "urgent":
        tone_instruction = "Use an urgent, high-priority, action-oriented tone emphasizing tight deadlines and immediate accountability."
    elif email_tone == "formal":
        tone_instruction = "Use a highly formal executive tone suitable for corporate C-suite report follow-up."

    messages = [
        SystemMessage(content=(
            "You are a professional email drafter. Write a follow-up email for a "
            "meeting attendee listing their specific action items.\n\n"
            "Guidelines:\n"
            "- Address the person by name\n"
            "- Briefly reference the meeting context (1-2 sentences)\n"
            "- List ONLY their assigned action items with deadlines\n"
            f"- {tone_instruction}"
            f"{role_instruction}\n"
            "- Keep it concise and actionable\n"
            "- End with a professional sign-off\n\n"
            "Return your response in this exact JSON format:\n"
            '{"subject": "...", "body": "..."}\n\n'
            "Return ONLY valid JSON — no markdown fences, no extra text."
        )),
        HumanMessage(content=(
            f"Meeting summary: {summary}\n\n"
            f"Recipient: {recipient_name}"
            + (f" ({recipient_role})" if recipient_role else "")
            + f"\n\nTheir action items:\n{tasks_text}"
        )),
    ]

    response = await llm.ainvoke(messages)
    raw = response.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        raw = raw.strip()

    try:
        email_data = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: try to find JSON object in the response
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            email_data = json.loads(raw[start:end])
        else:
            email_data = {
                "subject": f"Meeting Follow-up — Action Items for {recipient_name}",
                "body": f"Hi {recipient_name},\n\nFollowing up on our meeting. Here are your action items:\n\n{tasks_text}\n\nPlease let me know if you have any questions.\n\nBest regards",
            }

    return {
        "to": recipient_name,
        "to_email": recipient_email,
        "role": recipient_role,
        "subject": email_data.get("subject", f"Meeting Follow-up for {recipient_name}"),
        "body": email_data.get("body", ""),
    }
