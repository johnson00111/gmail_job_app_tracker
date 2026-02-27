"""
db/database.py
SQLite database initialization and CRUD operations for Gmail JobTracker.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime

from config import DB_PATH


# ============================================================
# Connection helper
# ============================================================
def get_conn(db_path=DB_PATH):
    """Get a SQLite connection with row_factory for dict-like access."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# ============================================================
# Schema initialization
# ============================================================
def init_db(db_path=DB_PATH):
    """Create all tables and views if they don't exist."""
    conn = get_conn(db_path)
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS emails (
            gmail_id    TEXT PRIMARY KEY,
            date        TEXT NOT NULL,
            sender      TEXT,
            recipient   TEXT,
            subject     TEXT,
            snippet     TEXT,
            body        TEXT,
            labels      TEXT,
            fetched_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS analyses (
            gmail_id      TEXT PRIMARY KEY,
            email_type    TEXT NOT NULL,
            company       TEXT,
            role          TEXT,
            status        TEXT,
            action_item   TEXT,
            deadline      TEXT,
            summary       TEXT,
            confidence    REAL,
            analyzed_at   TEXT NOT NULL,
            model_used    TEXT,
            FOREIGN KEY (gmail_id) REFERENCES emails(gmail_id)
        );

        CREATE TABLE IF NOT EXISTS applications (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            company         TEXT NOT NULL,
            role            TEXT NOT NULL,
            current_status  TEXT NOT NULL,
            first_seen      TEXT NOT NULL,
            last_updated    TEXT NOT NULL,
            action_item     TEXT,
            deadline        TEXT,
            notes           TEXT,
            UNIQUE(company, role)
        );

        CREATE TABLE IF NOT EXISTS application_emails (
            application_id  INTEGER NOT NULL,
            gmail_id        TEXT NOT NULL,
            PRIMARY KEY (application_id, gmail_id),
            FOREIGN KEY (application_id) REFERENCES applications(id),
            FOREIGN KEY (gmail_id) REFERENCES emails(gmail_id)
        );

        CREATE VIEW IF NOT EXISTS job_emails AS
        SELECT e.*, a.email_type, a.company, a.role, a.status, a.summary
        FROM emails e
        JOIN analyses a ON e.gmail_id = a.gmail_id
        WHERE a.email_type NOT IN (
            'security_code', 'newsletter', 'promotion', 'job_alert', 'other'
        );

        CREATE VIEW IF NOT EXISTS dashboard AS
        SELECT
            app.id,
            app.company,
            app.role,
            app.current_status,
            app.first_seen,
            app.last_updated,
            app.action_item,
            app.deadline,
            app.notes,
            COUNT(ae.gmail_id) AS email_count
        FROM applications app
        LEFT JOIN application_emails ae ON app.id = ae.application_id
        GROUP BY app.id;
    """)

    conn.commit()
    # Migration: add action_done column if not exists
    try:
        conn.execute(
            "ALTER TABLE applications ADD COLUMN action_done INTEGER NOT NULL DEFAULT 0"
        )
        conn.commit()
        print("  Migration: added action_done column")
    except Exception:
        pass  # column already exists

    # Migration: recreate dashboard view to include action_done
    conn.executescript("""
        DROP VIEW IF EXISTS dashboard;
        CREATE VIEW dashboard AS
        SELECT
            app.id,
            app.company,
            app.role,
            app.current_status,
            app.first_seen,
            app.last_updated,
            app.action_item,
            app.deadline,
            app.notes,
            app.action_done,
            COUNT(ae.gmail_id) AS email_count
        FROM applications app
        LEFT JOIN application_emails ae ON app.id = ae.application_id
        GROUP BY app.id;
    """)
    conn.close()
    print(f"Database initialized at {db_path}")


def toggle_action_done(app_id: int, db_path=DB_PATH) -> dict | None:
    """Toggle action_done for an application. Returns updated app or None."""
    conn = get_conn(db_path)
    conn.execute(
        "UPDATE applications SET action_done = 1 - action_done WHERE id = ?",
        (app_id,),
    )
    conn.commit()
    row = conn.execute(
        "SELECT id, action_done FROM applications WHERE id = ?", (app_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


# ============================================================
# Emails CRUD
# ============================================================
def insert_email(email: dict, db_path=DB_PATH) -> bool:
    """
    Insert a raw email into the emails table.
    Returns True if inserted, False if already exists (skip duplicate).
    """
    conn = get_conn(db_path)
    try:
        conn.execute(
            """INSERT INTO emails (gmail_id, date, sender, recipient, subject, snippet, body, labels, fetched_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                email["gmail_id"],
                email["date"],
                email.get("sender", ""),
                email.get("recipient", ""),
                email.get("subject", ""),
                email.get("snippet", ""),
                email.get("body", ""),
                email.get("labels", ""),
                datetime.now().isoformat(),
            ),
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def get_unanalyzed_emails(db_path=DB_PATH) -> list[dict]:
    """Get all emails that haven't been analyzed yet."""
    conn = get_conn(db_path)
    rows = conn.execute(
        """SELECT e.* FROM emails e
           LEFT JOIN analyses a ON e.gmail_id = a.gmail_id
           WHERE a.gmail_id IS NULL"""
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_emails(db_path=DB_PATH) -> list[dict]:
    """Get all emails."""
    conn = get_conn(db_path)
    rows = conn.execute("SELECT * FROM emails ORDER BY date DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ============================================================
# Analyses CRUD
# ============================================================
def insert_analysis(analysis: dict, db_path=DB_PATH) -> bool:
    """
    Insert an LLM analysis result.
    Returns True if inserted, False if already exists.
    """
    conn = get_conn(db_path)
    try:
        conn.execute(
            """INSERT INTO analyses
               (gmail_id, email_type, company, role, status, action_item, deadline, summary, confidence, analyzed_at, model_used)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                analysis["gmail_id"],
                analysis["email_type"],
                analysis.get("company"),
                analysis.get("role"),
                analysis.get("status"),
                analysis.get("action_item"),
                analysis.get("deadline"),
                analysis.get("summary"),
                analysis.get("confidence"),
                datetime.now().isoformat(),
                analysis.get("model_used", ""),
            ),
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def get_analysis(gmail_id: str, db_path=DB_PATH) -> dict | None:
    """Get analysis for a specific email."""
    conn = get_conn(db_path)
    row = conn.execute(
        "SELECT * FROM analyses WHERE gmail_id = ?", (gmail_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


# ============================================================
# Applications CRUD
# ============================================================
def upsert_application(app: dict, gmail_id: str, db_path=DB_PATH) -> int:
    """
    Insert or update an application record, and link the email.
    Returns the application id.

    Role handling:
      - If LLM returns a role → use it (already normalized by prompt)
      - If LLM returns null   → use "{company} General" as fallback
    """
    conn = get_conn(db_path)
    c = conn.cursor()

    company = app["company"]
    role = app.get("role") or f"{company} General"  # ← 改動：None → "{Company} General"

    existing = c.execute(
        "SELECT id, current_status FROM applications WHERE company = ? AND role = ?",
        (company, role),
    ).fetchone()

    email_date = c.execute(
        "SELECT date FROM emails WHERE gmail_id = ?", (gmail_id,)
    ).fetchone()
    date_str = email_date["date"] if email_date else datetime.now().isoformat()

    if existing:
        app_id = existing["id"]
        c.execute(
            """UPDATE applications
               SET current_status = ?,
                   last_updated = ?,
                   action_item = COALESCE(?, action_item),
                   deadline = COALESCE(?, deadline),
                   notes = COALESCE(?, notes)
               WHERE id = ?""",
            (
                app["status"],
                date_str,
                app.get("action_item"),
                app.get("deadline"),
                app.get("notes"),
                app_id,
            ),
        )
    else:
        c.execute(
            """INSERT INTO applications
               (company, role, current_status, first_seen, last_updated, action_item, deadline, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                company,
                role,
                app["status"],
                date_str,
                date_str,
                app.get("action_item"),
                app.get("deadline"),
                app.get("notes"),
            ),
        )
        app_id = c.lastrowid

    try:
        c.execute(
            "INSERT INTO application_emails (application_id, gmail_id) VALUES (?, ?)",
            (app_id, gmail_id),
        )
    except sqlite3.IntegrityError:
        pass

    conn.commit()
    conn.close()
    return app_id


def get_all_applications(db_path=DB_PATH) -> list[dict]:
    """Get all applications (dashboard view)."""
    conn = get_conn(db_path)
    rows = conn.execute("SELECT * FROM dashboard ORDER BY last_updated DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_application_emails(app_id: int, db_path=DB_PATH) -> list[dict]:
    """Get all emails linked to a specific application."""
    conn = get_conn(db_path)
    rows = conn.execute(
        """SELECT e.*, a.email_type, a.status, a.summary
           FROM application_emails ae
           JOIN emails e ON ae.gmail_id = e.gmail_id
           LEFT JOIN analyses a ON e.gmail_id = a.gmail_id
           WHERE ae.application_id = ?
           ORDER BY e.date DESC""",
        (app_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ============================================================
# Stats (for Dashboard)
# ============================================================
def get_stats(db_path=DB_PATH) -> dict:
    """Get aggregated stats for the dashboard."""
    conn = get_conn(db_path)

    total = conn.execute("SELECT COUNT(*) as n FROM applications").fetchone()["n"]

    counts = {}
    for status in ["applied", "rejected", "interview", "offer", "action_needed"]:
        row = conn.execute(
            "SELECT COUNT(*) as n FROM applications WHERE current_status = ?",
            (status,),
        ).fetchone()
        counts[status] = row["n"]

    conn.close()

    return {
        "total": total,
        "counts": counts,
        "interview_rate": round(
            (counts["interview"] + counts["action_needed"] + counts["offer"])
            / max(total, 1)
            * 100,
            1,
        ),
        "offer_rate": round(counts["offer"] / max(total, 1) * 100, 1),
        "rejection_rate": round(counts["rejected"] / max(total, 1) * 100, 1),
    }


def get_weekly_trend(db_path=DB_PATH) -> list[dict]:
    """Get application count grouped by week."""
    conn = get_conn(db_path)
    rows = conn.execute(
        """SELECT
               date(first_seen, 'weekday 0', '-6 days') AS week_start,
               COUNT(*) AS count
           FROM applications
           GROUP BY week_start
           ORDER BY week_start"""
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_role_breakdown(db_path=DB_PATH) -> list[dict]:
    """Get application count grouped by role."""
    conn = get_conn(db_path)
    rows = conn.execute(
        """SELECT role, COUNT(*) AS count
           FROM applications
           GROUP BY role
           ORDER BY count DESC"""
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ============================================================
# Job emails view (filtered)
# ============================================================
def get_job_emails(db_path=DB_PATH) -> list[dict]:
    """Get all job-related emails (noise filtered out)."""
    conn = get_conn(db_path)
    rows = conn.execute("SELECT * FROM job_emails ORDER BY date DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ============================================================
# Run this file directly to initialize the database
# ============================================================
if __name__ == "__main__":
    init_db()
    print("Tables created successfully.")
    print(f"Unanalyzed emails: {len(get_unanalyzed_emails())}")
    print(f"Applications: {len(get_all_applications())}")
    print(f"Stats: {get_stats()}")
