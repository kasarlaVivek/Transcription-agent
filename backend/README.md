---
title: NovaMeet Backend
emoji: 🎙️
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 8000
pinned: false
---

# NovaMeet Backend

FastAPI backend for NovaMeet: audio/text meeting transcription, summarization,
action-item extraction, and follow-up email drafting (LangChain + Google
Gemini, Whisper for transcription).

- API docs: `/docs`
- Health check: `/ping`

Configure secrets and variables in the Space's **Settings → Variables and
secrets**: `GOOGLE_API_KEY`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `FRONTEND_URL`,
`WHISPER_MODEL`, `MAX_AUDIO_SIZE_MB`, `JWT_EXPIRE_HOURS`, and (optional)
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`.
