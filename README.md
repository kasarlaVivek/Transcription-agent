# Meeting Intelligence Agent

AI-powered meeting analysis — upload a recording or paste a transcript and get structured summaries, action items, and follow-up email drafts.

## Architecture

```
React UI → POST /process-meeting → Input Router → Whisper (audio) / Pass-through (text)
  → LangChain Agent → Tool Loop (summarise → extract → draft emails) → JSON Response
```

**Stack:** React (Vite) · FastAPI · LangChain · OpenAI Whisper · Google Gemini (free) · Docker

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- A [Google AI Studio API key](https://aistudio.google.com/apikey) (free)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

Create `backend/.env`:
```env
GOOGLE_API_KEY=your_key_here
WHISPER_MODEL=base
MAX_AUDIO_SIZE_MB=50
ALLOWED_ORIGINS=http://localhost:5173
```

Run:
```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Docker (both services)

```bash
docker-compose up --build
```

Frontend: http://localhost:3000 · Backend: http://localhost:8000/docs

## Features

- **Audio transcription** — Upload .mp3, .wav, .m4a files → Whisper transcribes locally
- **Text input** — Paste transcript or upload .txt / .vtt files
- **Meeting summary** — Key decisions, context, and outcomes
- **Action items** — Structured table with owner, task, and deadline
- **Draft emails** — Personalised follow-up per stakeholder (review before sending)
- **Copy to clipboard** — One-click copy on each email draft

## API

| Endpoint | Method | Description |
|---|---|---|
| `/ping` | GET | Health check |
| `/process-meeting` | POST | Process meeting (multipart: `file` or `text` field) |

Interactive docs: http://localhost:8000/docs
