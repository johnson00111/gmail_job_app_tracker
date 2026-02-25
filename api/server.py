"""
api/server.py
FastAPI backend for Gmail JobTracker dashboard.
"""

from __future__ import annotations

import httpx
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

# Initialize
init_db()
app = FastAPI(title="Gmail JobTracker API", version="1.0.0")

# Allow React dev server (localhost:5173) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Ollama config
# ============================================================
OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "qwen3:8b"


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
    # Build context from current application stats
    apps = get_all_applications()
    stats = get_stats()

    # Summarize for context
    status_counts = {}
    companies = set()
    roles = set()
    for a in apps:
        s = a.get("current_status", "unknown")
        status_counts[s] = status_counts.get(s, 0) + 1
        if a.get("company"):
            companies.add(a["company"])
        if a.get("role"):
            roles.add(a["role"])

    context = (
        f"You are a helpful job search assistant for a graduate student. "
        f"Here is their current application data:\n"
        f"- Total applications: {len(apps)}\n"
        f"- Status breakdown: {status_counts}\n"
        f"- Companies: {', '.join(sorted(companies)[:20])}"
        f"{'...' if len(companies) > 20 else ''}\n"
        f"- Roles: {', '.join(sorted(roles)[:15])}"
        f"{'...' if len(roles) > 15 else ''}\n"
        f"- Stats: {stats}\n\n"
        f"Give concise, actionable advice. Keep responses under 150 words. "
        f"Be encouraging but realistic."
    )

    try:
        resp = httpx.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": context},
                    {"role": "user", "content": req.message},
                ],
                "stream": False,
                "options": {"num_predict": 300},
            },
            timeout=180.0,
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
@app.post("/api/sync")
def api_sync(
    query: str = Query(
        default="subject:(application OR applied OR interview OR offer OR reject OR thank) after:2026/02/01",
        description="Gmail search query",
    ),
    max_results: int = Query(default=100, description="Max emails to fetch"),
):
    """Fetch new emails from Gmail and analyze them."""
    # Step 1: Fetch
    new_count, skip_count = fetch_emails(query=query, max_results=max_results)
    # Step 2: Analyze new ones
    unanalyzed = len(get_unanalyzed_emails())
    if unanalyzed > 0:
        analyze_all()
    return {
        "new_emails": new_count,
        "skipped": skip_count,
        "analyzed": unanalyzed,
    }


@app.post("/api/analyze")
def api_analyze():
    """Analyze any unanalyzed emails in the database."""
    unanalyzed = len(get_unanalyzed_emails())
    if unanalyzed == 0:
        return {"message": "No unanalyzed emails", "analyzed": 0}
    analyze_all()
    return {"analyzed": unanalyzed}
