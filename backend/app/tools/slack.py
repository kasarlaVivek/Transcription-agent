"""
Slack Incoming Webhook integration.

Sends formatted meeting analysis results to a Slack channel
via an Incoming Webhook URL configured by the user.
"""

import httpx
import logging

logger = logging.getLogger(__name__)


def _format_action_items(action_items: list[dict]) -> str:
    """Format action items into a readable Slack list."""
    if not action_items:
        return "_No action items extracted._"

    lines = []
    for item in action_items:
        owner = item.get("owner", "Unassigned")
        task = item.get("task", "—")
        deadline = item.get("deadline", "No deadline")
        lines.append(f"• *{owner}* → {task}  _(Due: {deadline})_")
    return "\n".join(lines)


def _build_slack_blocks(summary: str, action_items: list[dict], title: str = "Meeting Analysis") -> dict:
    """
    Build a Slack Block Kit payload for rich formatting.
    Uses sections, dividers, and context blocks for a professional look.
    """
    action_text = _format_action_items(action_items)

    # Truncate summary if it exceeds Slack's 3000-char block limit
    if len(summary) > 2800:
        summary = summary[:2800] + "…"

    payload = {
        "text": f"📋 {title} — New meeting analysis available",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"📋 {title}",
                    "emoji": True,
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Meeting Summary*\n\n{summary}",
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Action Items*\n\n{action_text}",
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "Sent by *NovaMeet.ai* — AI Meeting Intelligence Agent",
                    }
                ]
            }
        ]
    }
    return payload


async def send_to_slack(
    webhook_url: str,
    summary: str,
    action_items: list[dict],
    title: str = "Meeting Analysis",
) -> dict:
    """
    Post meeting analysis to a Slack channel via Incoming Webhook.

    Args:
        webhook_url: Slack Incoming Webhook URL
        summary: The generated meeting summary text
        action_items: List of extracted action item dicts
        title: Optional title for the Slack message header

    Returns:
        dict with 'success' bool and optional 'error' message
    """
    if not webhook_url or not webhook_url.startswith("https://hooks.slack.com/"):
        return {
            "success": False,
            "error": "Invalid Slack webhook URL. Must start with https://hooks.slack.com/",
        }

    payload = _build_slack_blocks(summary, action_items, title)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(webhook_url, json=payload)

            if response.status_code == 200 and response.text == "ok":
                logger.info("Successfully sent meeting analysis to Slack.")
                return {"success": True}
            else:
                logger.warning(
                    "Slack webhook returned status %d: %s",
                    response.status_code,
                    response.text,
                )
                return {
                    "success": False,
                    "error": f"Slack returned HTTP {response.status_code}: {response.text}",
                }

    except httpx.TimeoutException:
        return {"success": False, "error": "Slack webhook request timed out."}
    except httpx.RequestError as exc:
        return {"success": False, "error": f"Connection error: {str(exc)}"}


async def test_slack_webhook(webhook_url: str) -> dict:
    """
    Send a simple test message to validate the webhook URL works.

    Returns:
        dict with 'success' bool and optional 'error' message
    """
    if not webhook_url or not webhook_url.startswith("https://hooks.slack.com/"):
        return {
            "success": False,
            "error": "Invalid Slack webhook URL. Must start with https://hooks.slack.com/",
        }

    test_payload = {
        "text": "✅ NovaMeet.ai connection test successful!",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "✅ *NovaMeet.ai — Connection Test Successful*\n\nYour Slack integration is configured correctly. Meeting analyses will be posted to this channel automatically.",
                }
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(webhook_url, json=test_payload)

            if response.status_code == 200 and response.text == "ok":
                return {"success": True}
            else:
                return {
                    "success": False,
                    "error": f"Slack returned HTTP {response.status_code}: {response.text}",
                }

    except httpx.TimeoutException:
        return {"success": False, "error": "Slack webhook request timed out."}
    except httpx.RequestError as exc:
        return {"success": False, "error": f"Connection error: {str(exc)}"}
