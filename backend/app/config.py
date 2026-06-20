"""
Configuration module — loads environment variables and defines constants.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Google Gemini / LLM (free tier) ──────────────────────────────
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
LLM_MODEL = "gemini-2.0-flash"

# ── Whisper ───────────────────────────────────────────────────────
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
MAX_AUDIO_SIZE_MB = int(os.getenv("MAX_AUDIO_SIZE_MB", "50"))

# ── CORS ──────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

# ── File handling ─────────────────────────────────────────────────
ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".ogg"}
ALLOWED_TEXT_EXTENSIONS = {".txt", ".vtt", ".srt"}
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── JWT Authentication ────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "novameet-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

# ── Stripe ────────────────────────────────────────────────────────
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRO_PRICE_ID = os.getenv("STRIPE_PRO_PRICE_ID", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ── Database ──────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "novameet.db")
