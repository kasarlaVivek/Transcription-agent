"""
Whisper transcription wrapper.
Uses OpenAI's open-source Whisper model for local audio → text conversion.
"""

import whisper
from app.config import WHISPER_MODEL

# Load the model once at module level (cached across requests)
_model = None


def _get_model():
    """Lazy-load the Whisper model to avoid startup cost if unused."""
    global _model
    if _model is None:
        _model = whisper.load_model(WHISPER_MODEL)
    return _model


def transcribe_audio(filepath: str) -> str:
    """
    Transcribe an audio file to text using Whisper.

    Args:
        filepath: Absolute path to the audio file on disk.

    Returns:
        The full transcript as a plain string.
    """
    model = _get_model()
    result = model.transcribe(filepath, fp16=False)
    return result["text"].strip()
