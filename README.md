# StudyBuddy AI

A study helper for your lecture notes. Upload a PDF, ask questions about it, and get answers with page numbers so you can check where the answer came from. You can also take a quick quiz to test yourself.

I made this because I wanted an easier way to study from my own class slides.

**Live demo:** https://studybuddy-ai-liart.vercel.app

> Note: the backend is on Render's free plan, so it goes to sleep when nobody is using it. The first load can take up to a minute. You'll see "Waking server…" at the top while it starts.

## Screenshots

**Ask questions and get answers with page citations**

<p>
  <img width="49%" alt="Asking a question" src="https://github.com/user-attachments/assets/69e1caef-d2c0-41c7-be35-3ddb4801b0d4" />
  <img width="49%" alt="Answer with page citations" src="https://github.com/user-attachments/assets/971b0677-f778-4639-a39f-401749e885e2" />
</p>

**Practice quiz with instant feedback**

<p>
  <img width="49%" alt="Quiz question answered correctly" src="https://github.com/user-attachments/assets/3c6c0eec-d6ad-4360-9a6b-935378697f53" />
  <img width="49%" alt="Quiz question with explanation" src="https://github.com/user-attachments/assets/3efbf329-ebf5-461f-ace5-b483d8ca8908" />
</p>

**See your score and what to review**

<p>
  <img width="60%" alt="Quiz score screen" src="https://github.com/user-attachments/assets/a79ea138-a51d-46db-8f21-3ddedddbc7e2" />
</p>

## Features

- Upload a lecture PDF (drag and drop or pick a file)
- Ask questions and get answers based only on your notes
- Every answer shows page numbers like `p. 4`, and you can click them to open the PDF at that page
- Ask follow-up questions like "explain that more simply"
- If your notes don't cover something, it tells you instead of making things up
- Take a 5-question multiple choice quiz with explanations and a final score
- Works on phone and laptop, with light and dark mode

## Built with

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI, SQLite
- **AI:** Claude API (Claude Haiku 4.5)
- **Hosting:** Vercel (frontend) and Render (backend)

## How it works

1. You upload a PDF. The backend checks that it's a real PDF and saves it.
2. When you ask a question, the backend sends the PDF and your question to Claude with citations turned on. Claude answers using only the PDF and tells us which pages it used.
3. For the quiz, Claude sends back the questions as JSON. The backend checks the format, and if something is wrong it asks Claude to fix it once.
4. The API key stays on the backend, so the browser never sees it.

## Run it locally

You'll need **Python 3.11+** and **Node 20+**.

**1. Clone the repo**
```bash
git clone https://github.com/Hridika356/studybuddy-ai.git
cd studybuddy-ai
```

**2. Start the backend**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # then add your ANTHROPIC_API_KEY in .env
uvicorn app.main:app --reload --port 8000
```

**3. Start the frontend** (in a new terminal)
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:5173 and you're good to go.

**Run the tests**
```bash
cd backend && pytest
cd frontend && npm test
```

## Environment variables

**Backend** (`backend/.env`)

| Name | What it's for |
| --- | --- |
| `ANTHROPIC_API_KEY` | Your Claude API key (required) |
| `ALLOWED_ORIGINS` | Frontend URL(s) allowed to call the API |
| `MAX_PDF_SIZE_MB` | Max upload size (default 10) |
| `MAX_PDF_PAGES` | Max pages (default 100) |

There are a few more options in `backend/.env.example`.

**Frontend** (`frontend/.env.local`)

| Name | What it's for |
| --- | --- |
| `VITE_API_BASE_URL` | Backend URL, like `http://localhost:8000` |

## Deployment

- **Backend (Render):** create a new Blueprint from this repo. It uses `render.yaml`. Add your `ANTHROPIC_API_KEY` and `ALLOWED_ORIGINS`.
- **Frontend (Vercel):** import the repo, set the root folder to `frontend`, and add `VITE_API_BASE_URL` with your Render URL.

## What I learned

- Claude's page citations use an "exclusive" end page, so page 2 comes back as 2 to 3. I had to handle that or every citation would show one extra page.
- Asking an AI for JSON doesn't always mean you get valid JSON, so it's worth checking it and having a backup plan.
- Prompt caching makes follow-up questions faster and cheaper because the PDF doesn't have to be processed again.
- Free hosting sleeps, so the app needs to handle slow starts nicely instead of just showing an error.

## Limitations

- Uploaded PDFs get deleted when the free Render server restarts, so you may need to upload again.
- PDFs are limited to 100 pages and 10 MB.
- Chat history clears when you refresh the page. There are no user accounts yet.
- Scanned PDFs (just images, no text) may give less accurate answers.

## Future ideas

- A built-in PDF viewer that highlights the exact sentence
- Show answers as they're being written (streaming)
- User accounts to save your PDFs
- Flashcards and support for multiple PDFs at once
