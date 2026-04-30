# 🧠 AI Memory Clone — Your Second Brain

A hackathon-ready RAG-powered web app that lets you upload notes & PDFs and chat with an AI that knows your personal knowledge base.

**Stack:** React + Vite + Tailwind · FastAPI · Google Gemini 1.5 Flash · ChromaDB · PyMuPDF

---

## 🚀 Quick Start (15 minutes)

### Step 1 — Get a FREE Gemini API Key

1. Go to: https://aistudio.google.com/app/apikey
2. Click **"Create API Key"**
3. Copy it
## Setup
Create backend/.env and add:
GEMINI_API_KEY=your_gemini_key_here
---

### Step 2 — Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set your API key
# Edit .env file:
# GEMINI_API_KEY=your_key_here

# Run the backend
python main.py
```

Backend runs at: **http://localhost:8000**
API docs at: **http://localhost:8000/docs**

---

### Step 3 — Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:3000**

---

## 🎯 Demo Flow (for judges)

1. **Upload** — Paste some notes or drop a PDF in the sidebar
2. **Chat** — Ask "What should I focus on?" or "Summarize my knowledge"
3. **Graph** — Click the Graph tab to see your knowledge visualized
4. **Insights** — Click "Analyze My Brain" for deep pattern analysis

---

## 📁 Project Structure

```
ai-memory-clone/
├── backend/
│   ├── main.py                  # FastAPI app + routes
│   ├── requirements.txt
│   ├── .env                     # GEMINI_API_KEY goes here
│   └── services/
│       ├── rag_service.py       # ChromaDB + Gemini embeddings + chat
│       └── insights_service.py  # Brain analysis feature
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Root layout + tabs
│   │   ├── api.js               # Axios API calls
│   │   └── components/
│   │       ├── Sidebar.jsx      # Upload + memory list
│   │       ├── Chat.jsx         # RAG chat interface
│   │       ├── GraphView.jsx    # D3 knowledge graph
│   │       └── InsightsPanel.jsx # Brain analysis
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
└── README.md
```

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload/text` | Upload a text note |
| POST | `/upload/pdf` | Upload a PDF file |
| POST | `/chat` | RAG chat message |
| GET | `/memories` | List all stored sources |
| POST | `/analyze` | Generate brain insights |
| GET | `/graph` | Get knowledge graph data |
| DELETE | `/memories/clear` | Clear all memories |

---

## 💡 Features

- **RAG Chat** — Answers grounded in your uploaded data
- **Semantic Search** — Gemini embeddings + ChromaDB cosine similarity
- **Knowledge Graph** — D3.js interactive visualization of topics
- **Brain Analysis** — AI-powered pattern detection and suggestions
- **PDF + Text Upload** — Drag & drop or paste
- **Persistent Memory** — ChromaDB stores data locally between sessions

---

## 🆓 Free Tier Limits (Gemini)

- 15 requests/minute
- 1,500 requests/day
- Plenty for a hackathon demo!

---

## 🏆 Hackathon Tips

- Upload 2-3 sample PDFs before the demo
- Pre-generate the graph so it's ready to show
- Click "Analyze My Brain" live — it's the most impressive feature
- Show the source citations in chat responses
