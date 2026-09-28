# CLAUDE.md — StudyBuddy AI

Guidance for Claude Code sessions working in this repository.

## What this is
StudyBuddy AI lets a student upload a lecture PDF, ask questions answered **only** from that PDF with
page citations, and take a 5-question multiple-choice quiz generated from it. No user accounts (V1).

## Architecture
```
React (Vite, TS)  --HTTP/JSON-->  FastAPI backend  --> SQLite (document metadata only)
                                        |          --> local disk: backend/uploads/<doc_id>.pdf
                                        +--------> Anthropic Claude API (key lives ONLY here)
```
- The PDF is sent to Claude as a base64 `document` content block with `citations: {enabled: true}`.
  Claude returns text blocks carrying `page_location` citations; `services/citation_parser.py`
  turns them into `{"parts": [{"text", "pages"}]}`.
- The quiz is requested as strict JSON, validated with Pydantic (`schemas/quiz.py`), and retried
  once with a correction message if invalid (`services/quiz_parser.py`, `services/claude_service.py`).
- No vector DB / RAG: the whole PDF is sent per request (prompt caching on the document block reduces
  repeat cost).

## Stack
- Backend: Python 3.11+ (tested on 3.13), FastAPI, Uvicorn, Pydantic v2, python-multipart, python-dotenv,
  anthropic SDK, pypdf (PDF validation + page count). Stdlib `sqlite3` behind a repository class.
- Frontend: React 19 + Vite 8 + TypeScript (strict), plain CSS (CSS variables, light/dark), oxlint,
  Vitest + Testing Library.
- Hosting: backend on Render (`render.yaml`), frontend on Vercel (`frontend/vercel.json`).

## Directory structure
```
backend/
  app/
    main.py            app factory, CORS, error handlers, router wiring
    config.py          Settings (all env vars read here, nowhere else)
    errors.py          AppError + consistent {"error": {"code","message"}} responses
    models/            plain dataclasses (Document)
    schemas/           Pydantic request/response models (ask, quiz, document, common)
    db/                sqlite connection + DocumentRepository (only place with SQL)
    services/          storage_service, document_service, claude_service, citation_parser, quiz_parser
    routes/            health, documents (/upload), ask, quiz — thin handlers only
    utils/             rate_limit (in-memory sliding window), pdf helpers
  tests/               pytest; Anthropic client is always mocked
frontend/
  src/
    components/        AppHeader, UploadCard, DocumentBar, ChatPanel, ChatMessageView, CitationChip,
                       QuizPanel, QuizQuestionCard, QuizResults, Icons, Spinner
    pages/             StudyPage (top-level state)
    services/api.ts    ALL backend calls go through here
    types/             api.ts mirrors backend schemas; app.ts holds UI state types
    utils/             page ranges, file validation, buildHistory (follow-up context)
```

## Commands
```bash
# backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
pytest -q
ruff check .

# frontend
cd frontend && npm install
npm run dev          # http://localhost:5173
npm run lint         # oxlint --deny-warnings
npm run typecheck
npm test             # vitest run
npm run build
```

## Conventions
- Route handlers stay thin: validate via schemas, call a service, return a schema.
- No SQL outside `app/db/`. No Anthropic calls outside `app/services/claude_service.py`.
- Raise `AppError(code, message, status)` for expected failures; never return stack traces.
- Frontend: no raw `fetch` in components; use `src/services/api.ts`. Plain React state, no Redux.
- Keep frontend `types/` in sync with backend `schemas/`.

## API conventions
- `GET /health` → `{"status": "ok"}`
- `POST /upload` (multipart `file`) → `{"doc_id", "filename", "page_count"}`
- `POST /ask` `{"doc_id","question","history"?: [{"question","answer"}] (max 4, each 1–4000 chars)}`
  → `{"parts": [{"text","pages": [int]}]}`. History becomes alternating user/assistant turns; the
  document block leads only the first user turn (keeps the cached prefix stable).
- `POST /quiz` `{"doc_id"}` → `{"questions": [{"question","options"[4],"correct_answer","explanation"}]}`
- Errors: `{"error": {"code": "snake_case_code", "message": "Human readable"}}` with proper HTTP status.
- Never expose filesystem paths or stored filenames.

## Security rules
- `ANTHROPIC_API_KEY` only in backend env (`backend/.env`, gitignored). Never in frontend, logs, responses.
- Never hardcode keys, never commit `.env`. Only `.env.example` files are tracked.
- Stored filename = generated `doc_id` + `.pdf`; the original filename is metadata only.
- `doc_id` is validated as a UUID hex before any filesystem access.

## Testing
- Local sandboxed sessions: binding/connecting to localhost ports and pip/npm network access may need the
  sandbox relaxed; use a session-local npm cache (`npm_config_cache=$TMPDIR/npm-cache`) if ~/.npm is not writable.
- Backend: `cd backend && pytest -q` (mocks Claude; no network, no cost).
- Frontend: `npm run lint && npm run typecheck && npm test && npm run build`.

## Deployment
- Render (`render.yaml` Blueprint): root `backend`, build `pip install -r requirements.txt`,
  start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`,
  `FORWARDED_ALLOW_IPS=*` (so rate limiting sees real client IPs behind Render's proxy).
- Vercel: root `frontend`, build `npm run build`, output `dist`, env `VITE_API_BASE_URL`.

## Known limitations (V1)
- Render free-tier disk is ephemeral: uploads + SQLite vanish on restart/redeploy.
- Rate limiting is in-memory per process (resets on restart, not shared across instances).
- Whole PDF is sent each request; max 100 pages (Haiku 4.5 PDF limit) and `MAX_PDF_SIZE_MB`.
- Chat history is per browser session only; follow-ups see only the last 4 answered turns
  (`config.maxHistoryTurns` in the frontend, `MAX_HISTORY_TURNS` in `schemas/ask.py`; keep in sync).
