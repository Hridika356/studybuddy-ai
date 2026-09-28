# StudyBuddy AI — Project Status

_Last updated: 2026-09-28_

Items are only marked COMPLETED after verification (tests, build, or a manual run).

## COMPLETED
- (none yet)

## CURRENTLY WORKING ON
- Phase A/B: project setup (tracking files, gitignore, backend + frontend scaffolding)

## REMAINING
- Backend foundation: config, SQLite repository, upload service, /health, /upload
- Claude Q&A: claude_service, citation parser, /ask
- Quiz: /quiz with Pydantic validation and one correction retry
- Frontend: upload, chat, citation chips, quiz UI, API client
- Tests: backend pytest, frontend lint/typecheck/build/component tests
- Integration run, deployment config, README, final audit

## BUGS
- (none known)

## BLOCKERS
- No `ANTHROPIC_API_KEY` in the environment. Real Claude API calls cannot be verified; Claude-dependent code is tested with mocks.

## TECHNICAL DEBT
- (none yet)

## MANUAL STEPS REQUIRED FROM USER
- Provide `ANTHROPIC_API_KEY` in `backend/.env` to verify real Claude calls.
