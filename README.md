# Gmail JobTracker

<p align="center">
  <img src="https://i.imgur.com/3ZOTxcn.png" alt="Gmail JobTracker Logo" width="200">
</p>

A full-stack application that automatically fetches job-related emails from Gmail, classifies them using a local LLM (Ollama), and presents insights through an interactive React dashboard.

---

## Architecture

```
Gmail API  -->  FastAPI Backend  -->  Ollama (qwen3:8b)  -->  SQLite
                     |
               React Dashboard
```

- **Backend:** FastAPI + SQLite + Ollama
- **Frontend:** React (Vite) with warm-orange glass UI theme
- **LLM:** Local Ollama running qwen3:8b for email classification and AI chat
- **Database:** SQLite with 4 tables (emails, analyses, applications, application_emails) and 2 views

---

## Features

- **Automated Email Fetching** -- Gmail API with configurable search queries, ATS sender matching (Greenhouse, Lever, Workday, etc.), and noise filtering
- **LLM-Powered Classification** -- 13 email types (application confirm, rejection, interview invite, offer, action needed, recruiter outreach, etc.)
- **Interactive Dashboard** -- Stats cards, Sankey funnel, weekly trend chart, role breakdown, and expandable application table
- **AI Chat Assistant** -- Chat with Ollama using your application data as context for personalized job search advice
- **Sync with Date Filters** -- Sync panel in the UI to specify date range and max emails before fetching
- **Action Items** -- Toggleable checklist with pending/completed sections for items that need your attention
- **Application Detail** -- Expandable rows showing original email subjects linked to each application

---

## Project Structure

```
gmail-jobtracker/
  config.py              # Centralized configuration (DB, Gmail, Ollama, CORS)
  main.py                # CLI entry point (--sync, --serve, --after, --before, --max)
  setup.sh               # One-time install script
  start.sh               # Launch backend + frontend together
  db/
    database.py           # SQLite schema, CRUD, migrations
  gmail/
    auth.py               # Google OAuth 2.0 (readonly scope)
    fetcher.py            # Fetch and store emails
  llm/
    prompts.py            # All prompts in one place (classification + chat)
    analyzer.py           # Ollama integration for email analysis
  api/
    server.py             # FastAPI endpoints
  frontend/
    src/
      App.jsx             # Main layout + sync panel + filters
      api/client.js       # API wrapper functions
      components/
        ui.jsx            # Shared UI primitives and theme constants
        StatsCards.jsx     # Animated stat cards
        SankeyFunnel.jsx   # SVG Sankey diagram
        WeeklyTrend.jsx    # Weekly bar chart
        ActionItems.jsx    # Toggleable action items + role breakdown
        ApplicationTable.jsx  # Expandable application table with email detail
        AiInsight.jsx      # Ollama chat interface
      styles/
        theme.css          # Light warm-orange theme + background orbs
```

---

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- Ollama installed with qwen3:8b model
- Google Cloud project with Gmail API enabled and OAuth credentials

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/gmail-jobtracker.git
cd gmail-jobtracker

# Place your Google OAuth credentials file in the project root
cp /path/to/credentials.json .

# Pull the Ollama model
ollama pull qwen3:8b

# Run setup (creates venv, installs Python + Node dependencies, runs checks)
chmod +x setup.sh start.sh
./setup.sh
```

### Run

```bash
# Start everything (backend + frontend)
./start.sh

# Or with sync first (fetch + analyze, then start)
./start.sh --sync

# Sync a specific date range
./start.sh --sync --after 2026/02/01 --before 2026/02/28 --max 200
```

Open http://localhost:5173 to view the dashboard.

### CLI Usage

```bash
# Full pipeline: fetch -> analyze -> start server
python main.py

# API server only (no fetch/analyze)
python main.py --serve

# Fetch + analyze only (no server)
python main.py --sync

# With date filters
python main.py --sync --after 2026/02/01 --before 2026/02/15 --max 50
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/applications | All applications (dashboard view) |
| GET | /api/applications/{id}/emails | Emails linked to an application |
| GET | /api/stats | Aggregated dashboard stats |
| GET | /api/weekly | Weekly application trend |
| GET | /api/roles | Applications by role |
| GET | /api/emails | All job-related emails |
| POST | /api/sync | Fetch + analyze with date filters |
| POST | /api/chat | AI chat with application context |
| POST | /api/analyze | Analyze unprocessed emails |
| PATCH | /api/applications/{id}/action-done | Toggle action item completion |

---

## Configuration

All settings are centralized in `config.py` with environment variable overrides:

| Variable | Env Override | Default |
|----------|-------------|---------|
| DB_PATH | JT_DB_PATH | tracker.db |
| OLLAMA_BASE_URL | JT_OLLAMA_URL | http://localhost:11434 |
| OLLAMA_MODEL | JT_OLLAMA_MODEL | qwen3:8b |
| API_HOST | JT_API_HOST | 0.0.0.0 |
| API_PORT | JT_API_PORT | 8000 |

---

## Prompt Engineering

All LLM prompts are consolidated in `llm/prompts.py` for easy iteration:

| Prompt | Purpose |
|--------|---------|
| SYSTEM_PROMPT | Email classification instructions and JSON schema |
| build_user_prompt() | Formats email content for classification |
| CHAT_SYSTEM_PROMPT | AI chat assistant persona and rules |
| build_chat_context() | Injects application data into chat context |

---

## Known Issues and Roadmap

### To Do

- Role normalization -- aggregate similar titles (e.g. "SWE Intern" and "Software Engineering Intern")
- Upsert matching improvement -- emails with role=None not merging correctly when company has multiple roles (revisit after role normalization)

### Not Planned

- Docker Compose
- CSV/PDF export

---

## Tech Stack

- **Frontend:** React 18, Vite, custom CSS (no UI framework)
- **Backend:** FastAPI, SQLite, Python 3.9
- **LLM:** Ollama (qwen3:8b) running locally
- **Auth:** Google OAuth 2.0 (gmail.readonly scope)

---

## License

MIT