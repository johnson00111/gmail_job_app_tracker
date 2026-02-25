"""
main.py
Gmail JobTracker — unified entry point.

Usage:
    python main.py                          # full pipeline: fetch → analyze → serve
    python main.py --serve                  # skip fetch/analyze, just start API server
    python main.py --sync                   # fetch + analyze only, no server
    python main.py --sync --after 2026/02/01 --before 2026/02/28
    python main.py --sync --after 2026/02/15 --max 50
"""

from __future__ import annotations

import argparse
import subprocess
import sys

from config import (
    API_HOST,
    API_PORT,
    GMAIL_DEFAULT_MAX_RESULTS,
    GMAIL_DEFAULT_QUERY,
    GMAIL_SEARCH_KEYWORDS,
)


def build_query(after: str = None, before: str = None) -> str:
    """
    Build Gmail search query with optional date filters.
    If neither after nor before is provided, returns the default query from config.
    Date format: YYYY/MM/DD (Gmail API format)
    """
    if not after and not before:
        return GMAIL_DEFAULT_QUERY

    parts = [GMAIL_SEARCH_KEYWORDS]
    if after:
        parts.append(f"after:{after}")
    if before:
        parts.append(f"before:{before}")

    return " ".join(parts)


def run_sync(query: str, max_results: int):
    """Fetch new emails from Gmail and analyze with Ollama."""
    from db.database import get_unanalyzed_emails, init_db
    from gmail.fetcher import fetch_emails
    from llm.analyzer import analyze_all

    print("=" * 60)
    print("  Gmail JobTracker — Sync Pipeline")
    print("=" * 60)

    # Step 0: Init DB
    init_db()

    # Step 1: Fetch emails
    print("\n[1/2] Fetching emails from Gmail...")
    print(f"       Query: {query}")
    print(f"       Max:   {max_results}")
    new_count, skip_count = fetch_emails(query=query, max_results=max_results)
    print(f"       → {new_count} new, {skip_count} skipped")

    # Step 2: Analyze
    unanalyzed = len(get_unanalyzed_emails())
    if unanalyzed > 0:
        print(f"\n[2/2] Analyzing {unanalyzed} emails with Ollama...")
        analyze_all()
    else:
        print("\n[2/2] No unanalyzed emails. Skipping.")

    print("\n✔ Sync complete.")


def run_server():
    """Start the FastAPI server via uvicorn."""
    print("=" * 60)
    print("  Gmail JobTracker — API Server")
    print(f"  http://{API_HOST}:{API_PORT}")
    print("=" * 60)

    subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "api.server:app",
            "--host",
            API_HOST,
            "--port",
            str(API_PORT),
            "--reload",
        ]
    )


def main():
    parser = argparse.ArgumentParser(
        description="Gmail JobTracker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python main.py                                   # full pipeline\n"
            "  python main.py --serve                           # API server only\n"
            "  python main.py --sync                            # fetch + analyze only\n"
            "  python main.py --sync --after 2026/02/01         # from Feb 1 onward\n"
            "  python main.py --sync --after 2026/02/01 --before 2026/02/28\n"
            "  python main.py --sync --after 2026/02/15 --max 50\n"
        ),
    )
    parser.add_argument(
        "--serve",
        action="store_true",
        help="Start API server only (skip fetch/analyze)",
    )
    parser.add_argument(
        "--sync",
        action="store_true",
        help="Fetch + analyze only (no server)",
    )
    parser.add_argument(
        "--after",
        help="Fetch emails after this date (YYYY/MM/DD)",
    )
    parser.add_argument(
        "--before",
        help="Fetch emails before this date (YYYY/MM/DD)",
    )
    parser.add_argument(
        "--max",
        type=int,
        default=GMAIL_DEFAULT_MAX_RESULTS,
        help=f"Max emails to fetch (default: {GMAIL_DEFAULT_MAX_RESULTS})",
    )
    args = parser.parse_args()

    query = build_query(after=args.after, before=args.before)

    if args.serve:
        run_server()
    elif args.sync:
        run_sync(query=query, max_results=args.max)
    else:
        # Full pipeline: sync then serve
        run_sync(query=query, max_results=args.max)
        print()
        run_server()


if __name__ == "__main__":
    main()
