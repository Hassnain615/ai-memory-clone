# Memory Clone: your private second brain

Memory Clone is a full-stack AI personal memory platform. Upload PDFs, text files and notes. They are chunked, embedded and stored in your own private vector space. You can then chat with them using retrieval-augmented generation (RAG), and every answer cites the page it came from.

**Stack:** React 18 + Vite + Tailwind · FastAPI · ChromaDB · Sentence Transformers · Google Gemini or Hugging Face · PyPDF · SQLite · D3

---

## Features

| Area | What it does |
|---|---|
| **Accounts** | Sign up, log in, edit your profile, change your password, sign out everywhere, delete your account. JWT auth with PBKDF2-SHA256 password hashing. |
| **Memories** | Drag and drop PDF/TXT/Markdown files (several at once, with upload progress), or write and edit notes in the app. Processing runs in the background and the status updates live. |
| **Processing** | PyPDF page-aware extraction (PyMuPDF fallback if installed), sentence-aware chunking with overlap, Sentence Transformer embeddings, an automatic summary and topic tags for each document. |
| **Semantic search** | Search every passage by meaning, with a match score for each result. |
| **RAG chat** | Answers stream token by token, with numbered inline citations `[1]`. Click a citation to see the passage, page and relevance. Conversation history is saved, and conversations can be renamed or deleted. You can limit a chat to selected documents. |
| **Knowledge graph** | An interactive D3 force graph of documents and concepts. Links come from TF-IDF keywords and from **semantic similarity** between documents (mean chunk embeddings). Includes hover highlighting, search, filters, and a detail panel with links into chat. |
| **Insights** | An AI analysis of your whole memory: focus areas, patterns, connections, knowledge gaps and next steps. Results are saved and can be regenerated. Also includes a TF-IDF topic cloud that works without an LLM. |
| **Analytics** | Real usage numbers: documents, passages, words, questions, 14-day activity, most-cited sources, average retrieval relevance. |
| **Works offline-ish** | With no LLM key, chat still returns the most relevant passages (extractive mode) and summaries fall back to an extractive algorithm. |

### Security
- Every user has an **isolated Chroma collection**, and all SQL queries are scoped by `user_id`.
- Passwords are hashed with PBKDF2-SHA256 (390k iterations, per-user salt). Login errors don't reveal whether an email exists.
- JWTs carry a `token_version`, so changing your password or using "sign out everywhere" invalidates every old token.
- Rate limits on auth, chat, uploads and insights.
- Upload validation: extension allow-list, PDF magic-byte check, size limit, filename sanitisation, binary detection.
- CORS allow-list, security headers, and a generic 500 handler (no stack traces leak).
- No hard-coded secrets. If `SECRET_KEY` isn't set, a random one is generated and stored in `backend/data/` (gitignored).
- The React app renders model output as plain text and never uses `dangerouslySetInnerHTML`.

---

## Quick start

### 1. Backend (Python 3.10+)

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate    Mac/Linux: source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then edit .env and add your GEMINI_API_KEY
python main.py
```

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- The first start downloads the `all-MiniLM-L6-v2` embedding model (~90 MB).

Get a free Gemini key at https://aistudio.google.com/app/apikey. To use Hugging Face instead, set `LLM_PROVIDER=huggingface` and `HF_TOKEN`.

### 2. Frontend (Node 18+)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000, create an account and upload a document.

### Single-server production build

```bash
cd frontend && npm run build      # creates frontend/dist
cd ../backend && uvicorn main:app --host 0.0.0.0 --port 8000
```

FastAPI serves the built React app automatically when `frontend/dist` exists. Before you deploy, set `SECRET_KEY`, `ENV=production` and `CORS_ORIGINS`.

---

## Configuration (`backend/.env`)

| Variable | Default | Notes |
|---|---|---|
| `LLM_PROVIDER` | `gemini` | `gemini`, `huggingface` or `none` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | — / `gemini-2.5-flash-lite` | |
| `HF_TOKEN` / `HF_MODEL` | — / `meta-llama/Llama-3.1-8B-Instruct` | Any chat model on HF Inference |
| `EMBEDDING_PROVIDER` | `sentence-transformers` | or `gemini` |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Change it, then use **Settings → Rebuild search index** |
| `SECRET_KEY` | auto-generated | Required in production |
| `CORS_ORIGINS` | `http://localhost:3000,...` | Comma-separated |
| `MAX_UPLOAD_MB` | `20` | |
| `CHUNK_SIZE_WORDS` / `CHUNK_OVERLAP_WORDS` | `220` / `40` | |
| `RETRIEVAL_TOP_K` / `RETRIEVAL_MIN_SCORE` | `6` / `0.15` | |
| `RATE_LIMIT_AUTH` / `_CHAT` / `_UPLOAD` | `10` / `30` / `20` | requests per minute |

Frontend: set `VITE_API_URL` (see `frontend/.env.example`) only if the API is on a different origin.

---

## Architecture

```
backend/
├── main.py                     # app, middleware, routers, SPA serving
├── config.py                   # env-driven settings
├── database.py                 # SQLite schema (users, documents, conversations, messages, insights)
├── security.py                 # password hashing, JWT, rate limiter
├── deps.py                     # FastAPI auth / rate-limit dependencies
├── routers/                    # auth, documents (+search), chat (+conversations), insights (+analytics, graph)
└── services/
    ├── rag_service.py          # RAGService: per-user Chroma, retrieval, prompt, streaming answers
    ├── insights_service.py     # InsightsService: whole-memory AI analysis + topic cloud
    ├── document_service.py     # upload → extract → chunk → embed → summarise lifecycle
    ├── document_processor.py   # PyPDF extraction, chunking, TF-IDF, extractive summary
    ├── embeddings.py           # Sentence Transformers / Gemini embeddings
    ├── llm.py                  # Gemini / Hugging Face streaming LLM
    ├── chat_service.py         # conversation persistence + SSE stream
    ├── graph_service.py        # knowledge graph builder (keywords + semantic links)
    ├── analytics_service.py    # usage analytics
    └── container.py            # service singletons

frontend/src/
├── lib/          # api client (axios + SSE streaming), auth context, toasts, formatters
├── components/   # AppShell, Markdown renderer, Constellation hero, UI primitives
└── pages/        # Landing, AuthPage, Overview, Memories, Chat, Graph, Insights, Settings
```

**Storage:** ChromaDB holds the vectors (`backend/data/chroma_db`). SQLite holds accounts, document text and metadata, conversations and insights (`backend/data/memory_clone.db`). Keeping the raw text in SQLite is what makes document viewing, summaries and re-indexing possible.

### API (all under `/api`, Bearer auth except signup/login/health)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/signup`, `/auth/login` | Create account / sign in |
| GET/PATCH/DELETE | `/auth/me` | Profile / delete account |
| POST | `/auth/change-password`, `/auth/logout-all` | Security |
| GET | `/documents` | List documents |
| POST | `/documents/upload`, `/documents/note` | Add a file / note (processed in background) |
| GET/PATCH/DELETE | `/documents/{id}` | Detail with passages / rename or edit note / delete |
| POST | `/documents/{id}/summarize`, `/documents/reindex` | Regenerate summary / rebuild index |
| DELETE | `/documents` | Delete all memories |
| GET | `/search?q=` | Semantic search |
| POST | `/chat/stream` | Streaming RAG answer (SSE) |
| POST | `/chat` | Non-streaming RAG answer |
| GET/PATCH/DELETE | `/conversations[/{id}]` | Conversation history |
| GET/POST | `/insights/latest`, `/insights/generate`, `/insights/topics` | Insights |
| GET | `/analytics`, `/graph`, `/health` | Dashboard data |

---

## Upgrading from v1

v1 kept every user's data in one shared, unauthenticated `chroma_db` folder and used Gemini embeddings. v2 stores data per account under `backend/data/` with Sentence Transformer embeddings, so old v1 data isn't migrated. Create an account and upload your documents again. The old unauthenticated endpoints (`/upload/text`, `/upload/pdf`, `/memories`, `/analyze`) have been replaced by the authenticated `/api/...` routes above.
