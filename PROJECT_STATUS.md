# StudyBuddy AI — Project Status

_Last updated: 2026-09-28_

Items are only marked COMPLETED after verification (tests, build, or a manual run).

## COMPLETED
- Repo structure, `.gitignore`, `CLAUDE.md`, `.env.example` files. Verified with `git check-ignore`
  (`.env`, `.env.local`, uploads, SQLite DB are ignored; only `.env.example` files are tracked).
- Backend clean install from pinned `requirements-dev.txt` into a fresh venv (Python 3.13.7).
- `GET /health`: pytest plus live curl.
- `POST /upload` with extension/MIME + magic-byte check, size limit (413), empty, corrupt, encrypted,
  and page-limit checks. UUID storage names, sanitized display filenames, SQLite metadata. Verified by
  pytest, live curl, and in-browser upload (valid PDF accepted, malformed PDF rejected with a friendly message).
- `POST /ask`: validation (doc_id format/existence, file presence, empty/too-long question), PDF sent as
  a base64 document block with citations enabled, citation parser, Anthropic error mapping, refusal
  handling, rate limiting. Verified by pytest (mocked Claude using real SDK types) and the browser E2E
  run against a stubbed Claude client.
- `POST /quiz`: strict-JSON prompt, Pydantic validation, one correction retry, clean 502 after a second
  failure, option shuffling. Verified by pytest and the browser E2E run.
- Frontend: upload (drag & drop, picker, progress, errors, replace), chat (Enter-to-send, duplicate
  guard, retry, citation chips), quiz (one question at a time, feedback, explanation, score, retry,
  new quiz, return to chat). Verified by Vitest (22 tests) and a manual Chrome run incl. 373px mobile width.
- Frontend `npm ci`, `lint` (oxlint, 0 warnings), `typecheck` (strict), `test`, `build`: all pass.
- Backend `pytest` (60 passed), `ruff check`, `ruff format --check`: all pass.
- Browser console during the E2E run: no errors or warnings. CORS verified cross-origin (5173 → 8000).
- Deployment config: `render.yaml` (backend), `frontend/vercel.json`. README deployment steps.
- Security audit: no keys or secrets in tracked files, no API key in the frontend, no filesystem paths in responses.
- **Live Claude integration (2026-09-28, real `ANTHROPIC_API_KEY`, `claude-haiku-4-5-20251001`)**, using a
  5-page lecture PDF where each fact lives on a known page:
  - `/health` reports `ai_configured: true`; `/upload` returns 5 pages.
  - `/ask` (HTTP 200, ~4s): the load-factor question was cited to p.4 (correct); the stack vs queue
    comparison cited stack claims to p.2 and queue claims to p.3 (correct); the off-topic Dijkstra
    question got "Your notes don't cover…" with no invented facts.
  - Raw API citations confirmed `page_location` with **exclusive** `end_page_number` (page 2 text arrives as
    start=2, end=3); the parser output `[2]` is correct.
  - Prompt caching confirmed: 9,286 document tokens read from cache on a follow-up question.
  - `/quiz` (HTTP 200, 6–8s): 3 of 3 generations returned exactly 5 valid questions (4 distinct options,
    answer in options, explanation) on the first attempt, with zero correction retries. Answers match the notes.
  - Chrome: upload → live answer with `p. 2` chips → live quiz → scored 2/5, matching the per-question
    verdicts exactly; no answers revealed before checking; no console errors.
  - The backend log shows all requests 200 with no warnings or errors, and the key value appears in neither
    the log, tracked files, nor the frontend source/build.

## CURRENTLY WORKING ON
- Nothing. Version 1 is complete and verified against the live Claude API.

## REMAINING
- Actually deploy to Render + Vercel (requires the user's accounts).
- Add screenshots / demo video / live URL to the README.

## BUGS
- None known.

## BLOCKERS
- None. (Deployment waits on the user's go-ahead and accounts, which is not a technical blocker.)

## TECHNICAL DEBT
- In-memory, per-process rate limiter (not shared across instances; resets on restart).
- Local-disk storage + SQLite are ephemeral on Render's free tier.
- Frontend upload limits (`VITE_MAX_PDF_SIZE_MB`, `VITE_MAX_QUESTION_LENGTH`, 100 pages) duplicate the
  backend values and must be kept in sync manually.
- Each question is answered independently (no multi-turn context).
- Answer quality: Haiku occasionally adds a short, uncited paraphrase between cited sentences (seen once:
  "more than 75% of your buckets filled", a loose restatement of load factor). Consider tightening the
  prompt so uncited elaboration is minimized or clearly marked, then re-verify live.

## MANUAL STEPS REQUIRED FROM USER
1. (Done) Real key added to `backend/.env` and verified live.
2. Create the Render service (Blueprint from `render.yaml`) and set `ANTHROPIC_API_KEY` and `ALLOWED_ORIGINS`.
3. Create the Vercel project (root `frontend`) and set `VITE_API_BASE_URL` to the Render URL.
4. Add the Vercel URL to Render's `ALLOWED_ORIGINS`, then redeploy.
5. Create a GitHub repo, push, and fill in the README placeholders.
