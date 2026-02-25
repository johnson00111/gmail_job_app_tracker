"""
api/server.py
FastAPI backend for Gmail JobTracker dashboard.
"""

from __future__ import annotations

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import (
    CORS_ORIGINS,
    GMAIL_DEFAULT_MAX_RESULTS,
    GMAIL_DEFAULT_QUERY,
    GMAIL_SEARCH_KEYWORDS,
    LLM_NUM_PREDICT_CHAT,
    LLM_TIMEOUT_CHAT,
    OLLAMA_CHAT_URL,
    OLLAMA_MODEL,
)
from db.database import (
    get_all_applications,
    get_application_emails,
    get_job_emails,
    get_role_breakdown,
    get_stats,
    get_unanalyzed_emails,
    get_weekly_trend,
    init_db,
)
from gmail.fetcher import fetch_emails
from llm.analyzer import analyze_all
from llm.prompts import build_chat_context

# Initialize
init_db()
app = FastAPI(title="Gmail JobTracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Helper: build Gmail query from date filters
# ============================================================
def build_query(after: str = None, before: str = None) -> str:
    """
    Build Gmail search query with optional date filters.
    Date format from frontend: YYYY-MM-DD → converted to YYYY/MM/DD for Gmail.
    """
    if not after and not before:
        return GMAIL_DEFAULT_QUERY

    parts = [GMAIL_SEARCH_KEYWORDS]
    if after:
        parts.append(f"after:{after.replace('-', '/')}")
    if before:
        parts.append(f"before:{before.replace('-', '/')}")

    return " ".join(parts)


# ============================================================
# Dashboard endpoints
# ============================================================
@app.get("/api/stats")
def api_stats():
    """Aggregated stats for dashboard cards."""
    return get_stats()


@app.get("/api/applications")
def api_applications():
    """All applications for the table."""
    return get_all_applications()


@app.get("/api/applications/{app_id}/emails")
def api_application_emails(app_id: int):
    """All emails linked to a specific application."""
    return get_application_emails(app_id)


@app.get("/api/weekly")
def api_weekly():
    """Weekly application trend."""
    return get_weekly_trend()


@app.get("/api/roles")
def api_roles():
    """Application count by role."""
    return get_role_breakdown()


@app.get("/api/emails")
def api_emails():
    """All job-related emails (filtered)."""
    return get_job_emails()


# ============================================================
# AI Chat endpoint
# ============================================================
class ChatRequest(BaseModel):
    message: str


@app.post("/api/chat")
def api_chat(req: ChatRequest):
    """Chat with Ollama using application data as context."""
    apps = get_all_applications()
    stats = get_stats()
    context = build_chat_context(apps, stats)

    try:
        resp = httpx.post(
            OLLAMA_CHAT_URL,
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": context},
                    {"role": "user", "content": req.message},
                ],
                "stream": False,
                "options": {"num_predict": LLM_NUM_PREDICT_CHAT},
            },
            timeout=LLM_TIMEOUT_CHAT,
        )
        resp.raise_for_status()
        data = resp.json()
        reply = data.get("message", {}).get("content", "No response from model.")
        return {"reply": reply}
    except httpx.ConnectError:
        return {
            "reply": "⚠️ Cannot connect to Ollama. Make sure it's running on localhost:11434."
        }
    except Exception as e:
        return {"reply": f"⚠️ Error: {str(e)}"}


# ============================================================
# Sync & Analyze endpoints
# ============================================================
class SyncRequest(BaseModel):
    after: str = None  # YYYY-MM-DD
    before: str = None  # YYYY-MM-DD
    max_results: int = GMAIL_DEFAULT_MAX_RESULTS


@app.post("/api/sync")
def api_sync(req: SyncRequest):
    """Fetch new emails from Gmail and analyze them."""
    query = build_query(after=req.after, before=req.before)

    print(f"\n{'=' * 60}")
    print("  Sync triggered from UI")
    print(f"  Query:  {query}")
    print(f"  Max:    {req.max_results}")
    print(f"{'=' * 60}\n")

    # Step 1: Fetch
    new_count, skip_count = fetch_emails(query=query, max_results=req.max_results)

    # Step 2: Analyze new ones
    unanalyzed = len(get_unanalyzed_emails())
    analyzed = 0
    if unanalyzed > 0:
        analyze_all()
        analyzed = unanalyzed

    return {
        "new_emails": new_count,
        "skipped": skip_count,
        "analyzed": analyzed,
        "query": query,
    }


@app.post("/api/analyze")
def api_analyze():
    """Analyze any unanalyzed emails in the database."""
    unanalyzed = len(get_unanalyzed_emails())
    if unanalyzed == 0:
        return {"message": "No unanalyzed emails", "analyzed": 0}
    analyze_all()
    return {"analyzed": unanalyzed}
