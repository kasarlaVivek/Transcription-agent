"""
Extract tool — pulls structured action items from a meeting transcript.
"""

from langchain_core.tools import tool


@tool
def extract_action_items(transcript: str) -> str:
    """
    Analyse a meeting transcript and extract every action item mentioned.
    Return a JSON array where each element has exactly three fields:
      - "owner": the person responsible (use their name as mentioned in the transcript)
      - "task": a clear, specific description of what needs to be done
      - "deadline": the due date or timeframe mentioned (use "Not specified" if none given)

    Be thorough — capture every commitment, assignment, or follow-up mentioned.
    Return ONLY the JSON array, no additional text.

    Args:
        transcript: The full meeting transcript text.

    Returns:
        A JSON string containing an array of action item objects.
    """
    return transcript
