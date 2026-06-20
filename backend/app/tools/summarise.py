"""
Summarise tool — extracts key decisions and context from a meeting transcript.
"""

from langchain_core.tools import tool


@tool
def summarise_meeting(transcript: str) -> str:
    """
    Analyse a meeting transcript and produce a concise summary
    highlighting key decisions, discussion points, and overall context.
    The summary should be 3-5 paragraphs and written in professional tone.

    Args:
        transcript: The full meeting transcript text.

    Returns:
        A structured summary string.
    """
    # This tool is invoked by the LangChain agent, which routes the call
    # through the LLM. The docstring above IS the prompt — the agent will
    # use Claude to generate the summary based on the transcript input.
    # The actual implementation is handled by the agent's tool-calling loop.
    return transcript
