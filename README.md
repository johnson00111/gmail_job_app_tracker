# Gmail JobTracker

<p align="center">
  <img src="https://i.imgur.com/3ZOTxcn.png" alt="Gmail JobTracker Logo" width="180" />
</p>

**Gmail x Ollama -- Automated job application tracking and insights**

Gmail JobTracker automatically fetches job-related emails from Gmail, classifies them using a local LLM (Ollama), and presents everything in a React dashboard with AI-powered insights.

---

## Features

- **Gmail Integration** -- OAuth2 readonly access to fetch job-related emails automatically
- **LLM Classification** -- Local Ollama (qwen3:8b) analyzes and categorizes 13 types of job emails
- **Interactive Dashboard** -- Amber-themed glass UI with animated stats, SVG Sankey funnel, weekly trend bars
- **AI Chat** -- Ask questions about your applications, powered by Ollama with full application context
- **Smart Filtering** -- Filter by company, role, time range (7D / 30D / custom)
- **Expandable Table** -- Click any application to see AI-generated summaries
- **Action Items** -- Surface urgent to-dos like OA deadlines and interview scheduling

---

## Architecture

```
React (Vite)  <-->  FastAPI  <-->  SQLite + Ollama (qwen3:8b)
                                       |
                                   Gmail API
```

| Layer    | Tech                | Purpose                          |
|----------|---------------------|----------------------------------|
| Frontend | React + Vite        | Dashboard UI                     |
| Backend  | FastAPI             | REST API                         |
| Database | SQLite              | Email and application storage    |
| LLM      | Ollama (qwen3:8b)   | Email classification + AI chat   |
| Email    | Gmail API (readonly) | Fetch job emails                |

---

## Project Structure

```
gmail-jobtracker/
├── api/
│   └── server.py                   # FastAPI endpoints
├── db/
│   └── database.py                 # SQLite schema + CRUD
├── gmail/
│   ├── auth.py                     # Gmail OAuth2 authentication
│   └── fetcher.py                  # Fetch and store emails
├── llm/
│   ├── prompts.py                  # LLM prompt templates
│   └── analyzer.py                 # Ollama classification pipeline
├── frontend/
│   ├── src/
│   │   ├── api/client.js           # API fetch wrapper
│   │   ├── components/
│   │   │   ├── ui.jsx              # Shared: GlassCard, AnimNum, constants
│   │   │   ├── StatsCards.jsx      # 4 animated stat cards
│   │   │   ├── SankeyFunnel.jsx    # SVG Sankey flow diagram
│   │   │   ├── WeeklyTrend.jsx     # Bar chart with hover effects
│   │   │   ├── ActionItems.jsx     # Urgent items + By Role breakdown
│   │   │   ├── ApplicationTable.jsx  # Expandable application table
│   │   │   └── AiInsight.jsx       # Ollama chat interface
│   │   ├── styles/theme.css        # Light amber theme
│   │   ├── App.jsx                 # Main layout, filters, data fetching
│   │   └── main.jsx
│   └── package.json
├── requirements.txt
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- Ollama installed with the `qwen3:8b` model (https://ollama.ai/)
- Gmail API credentials (`credentials.json`)

---

### 1. Clone and Setup Backend

```bash
git clone https://github.com/YOUR_USERNAME/gmail-jobtracker.git
cd gmail-jobtracker

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

### 2. Gmail API Setup

1. Go to Google Cloud Console (https://console.cloud.google.com/)
2. Create a project, then enable the Gmail API
3. Create OAuth 2.0 credentials and download as `credentials.json`
4. Place `credentials.json` in the project root

---

### 3. Pull Ollama Model

```bash
ollama pull qwen3:8b
```

---

### 4. Setup Frontend

```bash
cd frontend
npm install
```

---

### 5. Run Everything

Terminal 1 -- Ollama (if not already running):

```bash
ollama serve
```

Terminal 2 -- FastAPI backend:

```bash
cd gmail-jobtracker
source venv/bin/activate
uvicorn api.server:app --reload --port 8000
```

Terminal 3 -- React frontend:

```bash
cd gmail-jobtracker/frontend
npm run dev
```

Open http://localhost:5173

---

### 6. First Sync

Click "Sync Now" in the dashboard, or manually:

```bash
# Fetch emails from Gmail
python3 -m gmail.fetcher

# Analyze with LLM
python3 -m llm.analyzer
```

---

## Screenshots

<!-- TODO: Add screenshots -->

---

## Known Issues and Roadmap

### Known Issues

- **Role normalization** -- Similar role titles (e.g. "Software Engineering Intern", "SWE Intern", "Software Engineer Intern") are not aggregated. Needs NLP-based or rule-based role grouping.

- **Timestamps use crawl time** -- `first_seen` and `last_updated` currently store the time emails were processed, not the actual email received date (`internalDate` from Gmail API). Weekly Trend and sorting are affected.

- **Action Items not dismissible** -- No way to mark action items as completed from the dashboard.

- **Application detail lacks email subject** -- The expanded table row should show the original email subject line for easy reference back to Gmail.

### Roadmap

- Fix timestamps to use Gmail `internalDate`
- Add role normalization (group similar titles)
- Add "Mark as done" for action items
- Show email subjects in application detail view
- Add `config.py` for centralized settings
- Add `main.py` pipeline entry point
- Docker Compose for one-command setup
- Export to CSV / PDF

---

## Tech Details

- **Python**: 3.9 (uses `from __future__ import annotations`)
- **Gmail API**: `gmail.readonly` scope -- cannot modify or delete emails
- **Ollama**: Runs locally on `localhost:11434`
- **Database**: SQLite with 4 tables (`emails`, `analyses`, `applications`, `application_emails`) and 2 views (`job_emails`, `dashboard`)

---

## Privacy

All data stays local. Emails are processed by a local LLM -- nothing is sent to external APIs.

The following files are excluded from version control:

- `credentials.json` -- Google OAuth credentials
- `token.json` -- Gmail access token
- `tracker.db` -- SQLite database with email data
- `data/` -- Raw email exports

---

## License

MIT