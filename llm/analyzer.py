"""
llm/analyzer.py
Analyze emails using local Ollama LLM and store results in database.
"""

from __future__ import annotations

import json

import requests

from config import (
    EMAIL_TYPE_TO_STATUS,
    JOB_EMAIL_TYPES,
    LLM_NUM_PREDICT_ANALYZE,
    LLM_TEMPERATURE,
    LLM_TIMEOUT_ANALYZE,
    OLLAMA_GENERATE_URL,
    OLLAMA_MODEL_ANALYZE,
)
from db.database import (
    get_unanalyzed_emails,
    insert_analysis,
    upsert_application,
)
from llm.prompts import SYSTEM_PROMPT, build_user_prompt


def call_ollama(email: dict) -> dict | None:
    """
    Send an email to Ollama for analysis.
    Returns parsed JSON dict or None on failure.
    """
    user_prompt = build_user_prompt(email)

    try:
        resp = requests.post(
            OLLAMA_GENERATE_URL,
            json={
                "model": OLLAMA_MODEL_ANALYZE,
                "prompt": user_prompt,
                "system": SYSTEM_PROMPT,
                "stream": False,
                "options": {
                    "temperature": LLM_TEMPERATURE,
                    "num_predict": LLM_NUM_PREDICT_ANALYZE,
                },
            },
            timeout=LLM_TIMEOUT_ANALYZE,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "")

        # Clean up: strip markdown fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        raw = raw.strip()

        # Find JSON object in response
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            print(f"    No JSON found in response: {raw[:100]}")
            return None

        return json.loads(raw[start:end])

    except requests.exceptions.ConnectionError:
        print("    ERROR: Cannot connect to Ollama. Is it running? (ollama serve)")
        return None
    except requests.exceptions.Timeout:
        print("    ERROR: Ollama request timed out")
        return None
    except json.JSONDecodeError as e:
        print(f"    ERROR: Failed to parse JSON: {e}")
        print(f"    Raw response: {raw[:200]}")
        return None
    except Exception as e:
        print(f"    ERROR: {e}")
        return None


def analyze_email(email: dict) -> dict | None:
    """
    Analyze a single email: call LLM, store analysis, update application.
    Returns the analysis dict or None on failure.
    """
    result = call_ollama(email)
    if not result:
        return None

    analysis = {
        "gmail_id": email["gmail_id"],
        "email_type": result.get("email_type", "other"),
        "company": result.get("company"),
        "role": result.get("role"),
        "status": result.get("status"),
        "action_item": result.get("action_item"),
        "deadline": result.get("deadline"),
        "summary": result.get("summary"),
        "confidence": result.get("confidence"),
        "model_used": OLLAMA_MODEL_ANALYZE,
    }
    insert_analysis(analysis)

    email_type = result.get("email_type", "other")
    if email_type in JOB_EMAIL_TYPES and result.get("company"):
        status = EMAIL_TYPE_TO_STATUS.get(email_type, "applied")
        upsert_application(
            {
                "company": result["company"],
                "role": result.get("role"),  # ← 改動：傳 None，由 upsert 處理
                "status": status,
                "action_item": result.get("action_item"),
                "deadline": result.get("deadline"),
                "notes": result.get("summary"),
            },
            gmail_id=email["gmail_id"],
        )

    return analysis


def analyze_all():
    """Analyze all unanalyzed emails in the database."""
    emails = get_unanalyzed_emails()
    total = len(emails)

    if total == 0:
        print("No unanalyzed emails found.")
        return

    print(f"Analyzing {total} emails with {OLLAMA_MODEL_ANALYZE}...\n")

    success = 0
    fail = 0

    for i, email in enumerate(emails, 1):
        subject = (email.get("subject") or "")[:60]
        print(f"[{i}/{total}] {subject}...")

        result = analyze_email(email)

        if result:
            t = result.get("email_type", "?")
            c = result.get("company") or ""
            s = result.get("status") or ""
            print(f"    → {t} | {c} | {s}")
            success += 1
        else:
            print("    → FAILED")
            fail += 1

    print(f"\nDone. {success} analyzed, {fail} failed.")


if __name__ == "__main__":
    analyze_all()
