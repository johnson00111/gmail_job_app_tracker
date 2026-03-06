"""
api/server.py
FastAPI backend for Gmail JobTracker dashboard.
"""

from __future__ import annotations

import json
import threading
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import (
    AUTO_SYNC_INTERVAL,
    AUTO_SYNC_MAX,
    CORS_ORIGINS,
    GMAIL_DEFAULT_MAX_RESULTS,
    GMAIL_DEFAULT_QUERY,
    GMAIL_SEARCH_KEYWORDS,
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
    toggle_action_done,
    update_application_status,
)
from gmail.fetcher import fetch_emails
from llm.analyzer import analyze_all
from llm.prompts import build_chat_context
from llm.provider import llm

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
# Auto-sync background thread
# ============================================================
def auto_sync_loop():
    """Background thread: fetch + analyze every few minutes."""
    while True:
        time.sleep(AUTO_SYNC_INTERVAL)
        try:
            print(f"\n{'=' * 60}")
            print(
                f"  Auto-sync triggered (every {AUTO_SYNC_INTERVAL // 60}min, max {AUTO_SYNC_MAX})"
            )
            print(f"{'=' * 60}\n")
            new_count, skip_count = fetch_emails(
                query=GMAIL_DEFAULT_QUERY, max_results=AUTO_SYNC_MAX
            )
            unanalyzed = len(get_unanalyzed_emails())
            if unanalyzed > 0:
                analyze_all()
            print(
                f"  Auto-sync done: {new_count} new, {skip_count} skipped, {unanalyzed} analyzed\n"
            )
        except Exception as e:
            print(f"  Auto-sync error: {e}\n")


_sync_thread = threading.Thread(target=auto_sync_loop, daemon=True)
_sync_thread.start()


# ============================================================
# Helper: build Gmail query from date filters
# ============================================================
def build_query(after: str = None, before: str = None) -> str:
    """
    Build Gmail search query with optional date filters.
    Date format from frontend: YYYY-MM-DD -> converted to YYYY/MM/DD for Gmail.
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
# AI Chat endpoint — blocking (kept as fallback)
# ============================================================
class ChatRequest(BaseModel):
    message: str


@app.post("/api/chat")
def api_chat(req: ChatRequest):
    """Blocking chat endpoint. Returns full response at once."""
    apps = get_all_applications()
    stats = get_stats()
    context = build_chat_context(apps, stats)

    messages = [
        {"role": "system", "content": context},
        {"role": "user", "content": req.message},
    ]

    reply = llm.chat(messages)
    if reply is None:
        raise HTTPException(status_code=503, detail="LLM unavailable")

    return {
        "reply": reply,
        "provider": llm.last_provider,
    }


# ============================================================
# AI Chat endpoint — streaming (SSE)
# ============================================================
@app.post("/api/chat/stream")
def api_chat_stream(req: ChatRequest):
    """
    Streaming chat endpoint using Server-Sent Events.
    Sends chunks as: data: {"token": "...", "provider": "gemini"}\n\n
    Final event:     data: {"done": true}\n\n
    """
    apps = get_all_applications()
    stats = get_stats()
    context = build_chat_context(apps, stats)

    messages = [
        {"role": "system", "content": context},
        {"role": "user", "content": req.message},
    ]

    def event_generator():
        try:
            for token in llm.chat_stream(messages):
                payload = json.dumps(
                    {
                        "token": token,
                        "provider": llm.last_provider,
                    }
                )
                yield f"data: {payload}\n\n"
            # Signal completion
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            error_payload = json.dumps({"error": str(e)})
            yield f"data: {error_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


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


@app.patch("/api/applications/{app_id}/action-done")
def api_toggle_action_done(app_id: int):
    """Toggle action_done status for an application."""
    result = toggle_action_done(app_id)
    if not result:
        return {"error": "Application not found"}, 404
    return result


class StatusUpdateRequest(BaseModel):
    status: str


@app.patch("/api/applications/{app_id}/status")
def api_update_status(app_id: int, req: StatusUpdateRequest):
    """Update application status manually."""
    valid = {"applied", "rejected", "interview", "offer", "action_needed"}
    if req.status not in valid:
        return {"error": f"Invalid status. Must be one of: {valid}"}, 400
    result = update_application_status(app_id, req.status)
    if not result:
        return {"error": "Application not found"}, 404
    return result
