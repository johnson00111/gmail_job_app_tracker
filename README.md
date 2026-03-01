# Gmail JobTracker

<p align="center">
  <img src="https://i.imgur.com/TABZwfh.jpeg" alt="Gmail JobTracker Logo" width="500">
</p>

A full-stack application that automatically fetches job-related emails from Gmail, classifies them using local LLMs (Ollama), and presents insights through an interactive React dashboard.

<p align="center">
  <img src="docs/screenshot-1.png" alt="Gmail JobTracker — Dashboard Overview" width="600">
  <br><br>
  <img src="docs/screenshot-2.png" alt="Gmail JobTracker — Application Table" width="600">
</p>

---

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Customization Guide](#customization-guide)
  - [Configuration](#configuration)
  - [Gmail Search Query](#gmail-search-query)
  - [LLM Prompts](#llm-prompts)
- [Known Issues and Roadmap](#known-issues-and-roadmap)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Architecture

```
Gmail API  -->  FastAPI Backend  -->  Ollama (dual model)  -->  SQLite
                     |
               React Dashboard
```

- **Backend:** FastAPI + SQLite + Ollama
- **Frontend:** React (Vite) with warm-orange glass UI theme
- **LLM:** Local Ollama with dual-model setup -- qwen2.5-coder:7b for email classification, qwen3:8b for AI chat
- **Database:** SQLite with 4 tables (emails, analyses, applications, application_emails) and 2 views

---

## Features

- **Automated Email Fetching** -- Gmail API with configurable search queries, ATS sender matching (Greenhouse, Lever, Workday, etc.), and noise filtering
- **LLM-Powered Classification** -- 13 email types (application confirm, rejection, interview invite, offer, action needed, recruiter outreach, etc.) with role normalization that standardizes job titles and levels across emails
- **Interactive Dashboard** -- Stats cards, Sankey funnel, trend chart (day/3-day/week/month granularity), role breakdown, and expandable application table
- **AI Chat Assistant** -- Chat with Ollama using your application data as context for personalized job search advice
- **Sync with Date Filters** -- Sync panel in the UI to specify date range and max emails before fetching
- **Action Items** -- Toggleable checklist with pending/completed sections, shows all applications with actions regardless of status (interview, action needed, etc.), checkable from both the Action Items card and the application table
- **Application Detail** -- Expandable rows showing original email subjects linked to each application
- **Manual Status Override** -- Click any status badge in the application table to change it via dropdown (applied, interview, offer, action needed, rejected)
- **Sortable Columns and Search** -- Sort by date, company, role, or status (ascending/descending), search by company or role, filter by action item presence
- **Smart Role Handling** -- LLM prompt normalizes job titles (e.g. "SWE" to "Software Engineer") and levels (e.g. "New Grad" to "Entry Level"). When no role is detected, the system uses "{Company} General" as a fallback to keep same-company emails grouped

---

## Project Structure

```
gmail-jobtracker/
  credentials.json       # Required. See "Step 4: Create OAuth Client ID" below for how to obtain this file.
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
    prompts.py            # All LLM prompts in one place (classification + chat)
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
        Trend.jsx          # Trend chart with granularity toggle
        ActionItems.jsx    # Toggleable action items + role breakdown
        ApplicationTable.jsx  # Sortable, searchable table with status dropdown and action checkboxes
        AiInsight.jsx      # Ollama chat interface
      styles/
        theme.css          # Light warm-orange theme + background orbs
```

---

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- Ollama installed with two models: qwen2.5-coder:7b (classification) and qwen3:8b (chat)
- Google Cloud project with Gmail API enabled and OAuth credentials

### 1. Setup

```bash
git clone https://github.com/johnson00111/gmail_job_app_tracker.git
cd gmail_job_app_tracker
```
### 2. Ollama Setup

This project uses [Ollama](https://ollama.com/) to run local LLMs for email classification and AI chat. Two models are required, totaling approximately 9GB of disk space.

#### Step 1: Installation

1. Go to [ollama.com](https://ollama.com/) and download the installer for your OS
2. **macOS:** Open the downloaded `.dmg` file and drag Ollama into the **Applications** folder, then launch it from Applications (a small icon will appear in the menu bar)
3. **Windows / Linux:** Follow the installer instructions on the Ollama website

#### Step 2: Pull the Required Models

Once Ollama is running, open a terminal and pull the two models:

```bash
# Pull the Ollama models
ollama pull qwen2.5-coder:7b    # For email classification
ollama pull qwen3:8b             # For AI chat assistant
```

> **Note:** The models are managed by Ollama and stored in its own directory (`~/.ollama/` on macOS/Linux). You do not need to place any model files in the project folder.

### 3. Google OAuth Credentials Setup

This project requires a Google OAuth 2.0 credentials file (`credentials.json`) to access the Gmail API. Follow the steps below to create one. It's completely free — no billing account or credit card required.

#### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project selector at the top and select **New Project**
3. Enter a project name (e.g. `JobTracker`) and click **Create**

#### Step 2: Enable the Gmail API

1. In your project, navigate to **APIs & Services → Library**
2. Search for **Gmail API** and click on it
3. Click **Enable**

#### Step 3: Configure the OAuth Consent Screen

1. Navigate to **Google Auth Platform → Branding**
2. Fill in the following fields:
   - **App name** — any name you like (e.g. `JobTracker`)
   - **User support email** — your email address
   - **Developer contact email** — your email address
3. Click **Save**

#### Step 4: Create OAuth Client ID

1. Click **Create OAuth Client**
2. Set **Application type** to **Desktop app**
3. Enter any name (e.g. `JobTracker Client`) — this is just for your reference
4. Click **Create**
5. Click **Download JSON** to download the credentials file

#### Step 5: Add Credentials to the Project

1. Rename the downloaded file to `credentials.json`
2. Move it to the project root directory (gmail_job_app_tracker/), at the same level as main.py and config.py

macOS / Linux:
```bash
# Place your Google OAuth credentials file in the project root
mv ~/Downloads/client_secret_XXXXX.json ~/path/to/gmail_job_app_tracker/credentials.json
```
Windows:
Rename the downloaded file to credentials.json in File Explorer, then drag it into the `gmail_job_app_tracker` folder.

```bash
# Place your Google OAuth credentials file in the project root
cp /path/to/downloaded-file.json /path/to/gmail_job_app_tracker/credentials.json
```

> **Note:** On the first run, the app will open your browser for Google sign-in and authorization. After granting access, a `token.json` file will be generated automatically — you won't need to authorize again for future runs.

### 4. Keep Setting up

```bash
# Run setup (creates venv, installs Python + Node dependencies, runs checks)
chmod +x setup.sh start.sh
./setup.sh
```

---

## Usage

### Start Everything

```bash
# Start backend + frontend
./start.sh

# Start with sync first (fetch + analyze, then start)
./start.sh --sync

# Sync a specific date range, then start
./start.sh --sync --after 2026/02/01 --before 2026/02/28 --max 200
```

Open http://localhost:5173 to view the dashboard.

### Command Line Interface

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

### Sync from the UI

Click the **Sync Now** button in the dashboard header to open the sync panel. You can specify a date range (After / Before) and max number of emails before starting. Progress is logged in the terminal, and a result banner appears in the UI when complete.

### Troubleshooting

##### `OSError: [Errno 48] Address already in use`

A previous process is still occupying the port. Kill it and restart:

```bash
kill -9 $(lsof -ti :8000) 2>/dev/null
kill -9 $(lsof -ti :8080) 2>/dev/null
./start.sh --sync
```

##### `403 access_denied` — "App has not completed Google verification"

Your Gmail address is not added as a test user. Go to [Google Cloud Console](https://console.cloud.google.com/):

1. Navigate to **Google Auth Platform → Audience**
2. Under **Test users**, click **Add users**
3. Add your Gmail address and save

Then delete the failed token and retry:

```bash
rm -f token.json
./start.sh --sync
```

##### `HttpError 403` — "Gmail API has not been used in project … or it is disabled"

The Gmail API is not enabled in your Google Cloud project.

1. Go to **APIs & Services → Library** in [Google Cloud Console](https://console.cloud.google.com/)
2. Search for **Gmail API** and click **Enable**
3. Wait 1–2 minutes for it to propagate, then retry

##### `ModuleNotFoundError: No module named 'httpx'` (or other missing modules)

A Python dependency is missing. Install it inside the virtual environment:

```bash
source venv/bin/activate
pip install httpx
```

Replace `httpx` with whatever module name is shown in the error. **Do not** `pip install config` — the `config` module in this project refers to the local `config.py` file, not a PyPI package.

##### `ModuleNotFoundError: No module named 'config'`

This happens when running scripts directly (e.g. `python3 gmail/auth.py`). Always run the project from the root directory using:

```bash
python3 main.py --serve
# or
./start.sh --sync
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
| PATCH | /api/applications/{id}/status | Manually update application status |

---

## Customization Guide

This project is designed so you can tune its behavior without touching application logic. There are three levels of customization, each with a dedicated config file.

### Configuration

General settings live in `config.py` with environment variable overrides for deployment flexibility:

| Variable | Env Override | Default |
|----------|-------------|---------|
| DB_PATH | JT_DB_PATH | tracker.db |
| OLLAMA_BASE_URL | JT_OLLAMA_URL | http://localhost:11434 |
| OLLAMA_MODEL_ANALYZE | JT_OLLAMA_MODEL_ANALYZE | qwen2.5-coder:7b |
| OLLAMA_MODEL_CHAT | JT_OLLAMA_MODEL_CHAT | qwen3:8b |
| API_HOST | JT_API_HOST | 0.0.0.0 |
| API_PORT | JT_API_PORT | 8000 |

---

### Gmail Search Query

If you're missing job-related emails, the search query is the first place to look. It lives in `config.py` under `GMAIL_SEARCH_KEYWORDS`.

**How it works:**

The query uses Gmail search syntax and combines three strategies:

1. **Keyword matching (full-body search)** -- catches emails mentioning application, interview, offer, etc.
2. **ATS sender matching** -- catches emails from common applicant tracking systems (Greenhouse, Lever, Workday, etc.) regardless of content
3. **Noise exclusion** -- filters out security codes, password resets, newsletters

**Common adjustments:**

| Scenario | What to change |
|----------|---------------|
| Missing emails from a specific ATS | Add the sender domain to the `from:(...)` block |
| Missing emails with unusual subjects | Add keywords to the main keyword block |
| Too many false positives | Add terms to the exclusion block `-{subject:(...)}` |
| Want to search a different date range | Change `GMAIL_DEFAULT_AFTER` in config.py, or use `--after` flag |

**Example -- adding a new ATS provider:**

```python
# In config.py, find GMAIL_SEARCH_KEYWORDS and add to the from:() block:
"OR from:(greenhouse OR lever OR workday OR ashby OR smartrecruiters "
"OR hackerrank OR indeed OR breezy OR icims OR taleo)"
#                                       ^^^^^^^^^^^^^^^^ added
```

**Tip:** If you're unsure what to add, ask Gemini (which has Gmail integration) to analyze your inbox and suggest patterns.

---

### LLM Prompts

All LLM behavior is controlled through a single file: `llm/prompts.py`. This is the only file you need to edit when tuning classification accuracy or chat quality.

| Prompt | What it controls | When to change |
|--------|-----------------|----------------|
| `SYSTEM_PROMPT` | Email classification -- what types to detect, JSON output schema, classification rules, role normalization mappings | LLM misclassifies emails, role names are inconsistent, or extraction quality is poor |
| `build_user_prompt()` | How email content is formatted before sending to LLM | You want to include more/fewer email fields, or change truncation length |
| `CHAT_SYSTEM_PROMPT` | AI Chat persona -- tone, response length, behavior rules | You want the chat assistant to respond differently |
| `build_chat_context()` | What application data is injected into chat context | You want the assistant to know about different metrics |

**Role normalization** is handled in `SYSTEM_PROMPT` with two layers of mapping:

- **Title mapping** -- abbreviations to full names (e.g. "SDE" to "Software Engineer", "ML Engineer" to "Machine Learning Engineer")
- **Level mapping** -- various seniority terms to standardized levels (e.g. "New Grad", "Early Career", "Junior" all map to "Entry Level"; "Internship", "Co-op" map to "Intern")

To add custom mappings, edit the role normalization rules in the `SYSTEM_PROMPT` section of `llm/prompts.py`.

**Example -- improving role extraction:**

If the LLM frequently returns `role: null` for application confirmation emails, add a hint to `SYSTEM_PROMPT`:

```python
# In llm/prompts.py, add to the Rules section:
"""
Rules:
- ...existing rules...
- For application_confirm emails, look for the role in the subject line,
  email body, and any "position" or "role" mentions. If the role is not
  explicitly stated, infer it from context (e.g. "Thank you for applying
  to our Engineering team" -> role could be "Software Engineer").
"""
```

**Example -- changing chat behavior:**

To make the AI assistant more detailed or change its focus:

```python
# In llm/prompts.py, edit CHAT_SYSTEM_PROMPT:
CHAT_SYSTEM_PROMPT = """You are a helpful job search assistant for a graduate student.
Focus on actionable next steps and prioritization.
When analyzing the application data, highlight patterns such as:
- Which companies are most responsive
- What roles have the highest interview rate
- Time-sensitive deadlines or follow-ups
Keep responses under 200 words."""
```

**Testing prompt changes:**

After editing prompts, you don't need to re-fetch emails. Just re-analyze:

```bash
# Delete existing analyses and applications to re-run with new prompts
python -c "
from db.database import get_conn
conn = get_conn()
conn.execute('DELETE FROM application_emails')
conn.execute('DELETE FROM applications')
conn.execute('DELETE FROM analyses')
conn.commit()
conn.close()
print('Cleared. Run sync to re-analyze.')
"

# Re-analyze all emails with updated prompts
python main.py --sync
```

---

## Known Issues and Roadmap

### Known Issues

- start.sh requires pressing Ctrl+C twice to fully stop
- Python 3.9 shows FutureWarning from google-auth and urllib3 NotOpenSSLWarning (functional, upgrade Python to fix)
- If manual sync and auto-sync run simultaneously, duplicate processing may occur (unlikely in practice)

### Roadmap

- Application delete -- remove misclassified or unwanted application records from the dashboard

---

## Tech Stack

- **Frontend:** React 18, Vite, custom CSS (no UI framework)
- **Backend:** FastAPI, SQLite, Python 3.9
- **LLM:** Ollama (qwen2.5-coder:7b for classification, qwen3:8b for chat) running locally
- **Auth:** Google OAuth 2.0 (gmail.readonly scope)

---

## License

MIT