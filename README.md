# NovaMeet - Meeting Intelligence Agent

NovaMeet is an AI-powered meeting analysis tool. Upload a recording or paste a
transcript, and it returns a structured summary, a table of action items with
owners and deadlines, and personalized follow-up email drafts that are ready to
review and send.

The goal is to close the loop between a meeting and the work that follows it:
from raw audio or text, to who-owns-what, to addressed, role-aware emails that a
meeting administrator can review and send in one click.

## Live Demo

- Frontend: https://transcription-agent.vercel.app
- Backend: https://huggingface.co/spaces/kasarlasaivivek/novameet-backend-v2

## Features

- Audio transcription. Upload `.mp3`, `.wav`, `.m4a`, `.webm`, or `.ogg` files;
  audio is transcribed locally with OpenAI Whisper.
- Text input. Paste a transcript directly or upload `.txt`, `.vtt`, or `.srt`.
- Meeting summary. Five styles: standard briefing, comprehensive digest,
  executive bullet points, unresolved-issues brief, and timeline/sprint view.
- Action items. Structured extraction of owner, task, and deadline for every
  commitment mentioned.
- Attendee roster. Supply attendee names, emails, and roles up front. The agent
  normalizes owner names against the roster (so a first-name mention like
  "Sarah" resolves to "Sarah Jenkins"), attaches the correct email address to
  each draft, and tailors the email to the recipient's role.
- Follow-up emails. One personalized draft per owner, in one of five tones
  (professional, collaborative, direct, urgent, formal). Each draft is fully
  editable in the UI.
- Review and send. Each email card has a recipient/subject/body editor and a
  Review and Send button that opens the draft pre-filled in the user's mail
  client. Sending is always human-initiated; nothing is auto-sent.
- Accounts and billing. JWT-based authentication, per-user usage tracking, and
  optional Stripe subscription billing (Starter and Professional plans).
- Slack integration. Optionally auto-post each analysis to a Slack channel via
  an Incoming Webhook.

## How It Works

A single request to `/process-meeting` drives the whole pipeline.

1. Input routing. The endpoint accepts either an uploaded file or pasted text.
   Audio files are saved to a temporary location and transcribed with Whisper;
   text files and pasted transcripts are passed through directly. The temporary
   audio file is deleted after transcription.
2. Roster parsing. If an attendee roster is supplied (a JSON array of name,
   email, and role objects), it is parsed and sanitized. Malformed rosters are
   rejected with a clear error rather than failing mid-pipeline.
3. Agent pipeline. The transcript is processed in three focused LLM steps rather
   than one monolithic prompt, which keeps each step's reasoning targeted:
   - Summarize the meeting at the requested detail level.
   - Extract action items as structured JSON. The roster (names and roles) is
     passed as a hint so owner labels line up with real attendees.
   - Draft one follow-up email per unique owner. Each owner is matched to a
     roster entry (exact match first, then first-name/last-name token overlap).
     When matched, the draft uses the canonical name, is tailored to the role,
     and carries the resolved email address.
4. Usage tracking. For authenticated users, the meeting count is incremented.
5. Optional Slack post. If a webhook is configured, the summary and action items
   are posted to the channel.
6. Response. A single JSON object with the transcript (for audio inputs), the
   summary, the action items, and the draft emails.

If the language model is unavailable or rate-limited, the endpoint returns a
clear 503 with an actionable message instead of an opaque server error.

## Architecture

```
React UI (Vite)
  |
  |  POST /process-meeting  (multipart: file or text, summary_level,
  |                          email_tone, roster)
  v
FastAPI backend
  |
  +-- Input router ------ audio -> Whisper transcription
  |                       text  -> pass-through
  |
  +-- Roster parser ----- name / email / role normalization
  |
  +-- Agent pipeline (LangChain + Google Gemini)
  |       step 1: summarise
  |       step 2: extract action items (roster-aware)
  |       step 3: draft emails per owner (matched + role-tailored)
  |
  +-- Auth (JWT) -------- register / login / me
  +-- Billing (Stripe) -- checkout / portal / webhook
  +-- Slack ------------- test / configure / status
  +-- Persistence ------- SQLite (users, plans, usage)
  |
  v
JSON response -> rendered in the UI (summary, action table, editable
                 email cards with Review and Send)
```

Stack: React (Vite), FastAPI, LangChain, OpenAI Whisper, Google Gemini
(`gemini-2.0-flash`), SQLite, and Docker. Authentication uses JWT with bcrypt
password hashing; billing uses Stripe Checkout, the customer portal, and
webhooks.

### Backend layout

```
backend/app/
  main.py        FastAPI app, routes, /process-meeting orchestration
  agent.py       LangChain agent pipeline (summarise, extract, draft, match)
  auth.py        JWT auth: register, login, current-user dependencies
  payments.py    Stripe checkout, portal, and webhook handling
  database.py    SQLite layer (users, plans, Stripe IDs, usage)
  config.py      Environment-driven configuration and constants
  schemas.py     Pydantic request/response models
  tools/         transcribe (Whisper), summarise, extract, draft_email, slack
```

### Frontend layout

```
frontend/src/
  App.jsx                 Top-level app: tabs, auth, theme, submission flow
  api/client.js           Axios client and API functions (JWT interceptor)
  components/
    UploadZone.jsx        File/text input plus the attendee roster editor
    ResultPanel.jsx       Tabbed results: summary, actions, emails, transcript
    ActionTable.jsx       Action item table (owner, task, deadline)
    EmailCard.jsx         Editable draft with Review and Send (mailto)
    AuthModal.jsx         Sign in / register modal
```

## Development

### Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- A Google AI Studio API key (free tier available)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
```

Create `backend/.env` from the provided template and fill in your values:

```bash
cp .env.example .env
```

Required and optional settings (see `backend/.env.example`):

```env
GOOGLE_API_KEY=your_key_here
WHISPER_MODEL=base
MAX_AUDIO_SIZE_MB=50
ALLOWED_ORIGINS=http://localhost:5173
JWT_SECRET=change-this-to-a-long-random-string
JWT_EXPIRE_HOURS=24
# Stripe is optional; leave blank to disable billing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
FRONTEND_URL=http://localhost:5173
```

Run the API:

```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev client talks to the backend at
http://localhost:8000 by default; override with `VITE_API_URL` if needed.

### Docker (both services)

```bash
docker-compose up --build
```

Frontend: http://localhost:3000. Backend: http://localhost:8000/docs.

## API

| Endpoint | Method | Description |
|---|---|---|
| `/ping` | GET | Health check |
| `/process-meeting` | POST | Process a meeting (multipart form) |
| `/auth/register` | POST | Create an account |
| `/auth/login` | POST | Log in and receive a JWT |
| `/auth/me` | GET | Current user profile |
| `/stripe/create-checkout` | POST | Start a Stripe checkout session |
| `/stripe/create-portal` | POST | Open the Stripe customer portal |
| `/stripe/webhook` | POST | Stripe event webhook |
| `/slack/test` | POST | Send a test message to a webhook URL |
| `/slack/configure` | POST/DELETE | Save or remove the Slack webhook |
| `/slack/status` | GET | Whether Slack is connected |

### `/process-meeting` form fields

- `file` - an audio or text file (optional if `text` is provided)
- `text` - a pasted transcript (optional if `file` is provided)
- `summary_level` - one of `standard`, `detailed`, `bullet`, `unresolved`,
  `timeline`
- `email_tone` - one of `professional`, `collaborative`, `direct`, `urgent`,
  `formal`
- `roster` - optional JSON array of attendees, for example:

```json
[
  {"name": "Sarah Jenkins", "email": "sarah@acme.com", "role": "Product Designer"},
  {"name": "David Chen", "email": "david@acme.com", "role": "DevOps Lead"}
]
```

### Response shape

```json
{
  "transcript": "...",
  "summary": "...",
  "action_items": [
    {"owner": "David Chen", "task": "Migrate production cluster", "deadline": "July 10"}
  ],
  "draft_emails": [
    {
      "to": "David Chen",
      "to_email": "david@acme.com",
      "role": "DevOps Lead",
      "subject": "Action Required",
      "body": "Hi David, ..."
    }
  ]
}
```

Interactive API documentation is available at http://localhost:8000/docs.

## Notes

- Secrets and local data (`.env`, the SQLite database, uploads, virtualenv, and
  `node_modules`) are excluded from version control via `.gitignore`. Use
  `backend/.env.example` as the configuration reference.
- The free Gemini tier is rate-limited. If you hit a quota error, wait and retry
  or attach billing to your Google AI key.
