"""
config.py
Centralized configuration for Gmail JobTracker.
All hardcoded values from other modules are collected here.
"""

from __future__ import annotations

import os

# ============================================================
# Database
# ============================================================
DB_PATH = os.getenv("JT_DB_PATH", "tracker.db")

# ============================================================
# Gmail API
# ============================================================
GMAIL_CREDENTIALS_PATH = os.getenv("JT_GMAIL_CREDENTIALS", "credentials.json")
GMAIL_TOKEN_PATH = os.getenv("JT_GMAIL_TOKEN", "token.json")
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
GMAIL_OAUTH_PORT = 8080

# Search keywords (full-body search, no subject: prefix for high recall)
# LLM handles false-positive filtering downstream
GMAIL_SEARCH_KEYWORDS = (
    "{(application OR applied OR interview OR offer OR reject OR thank "
    'OR "submission" OR "received your" OR "candidacy" OR "next steps" '
    'OR "confirmation" OR "coding challenge" OR "assessment" '
    'OR "position" OR "opportunity" OR "interest in") '
    "OR from:(greenhouse OR lever OR workday OR ashby OR smartrecruiters "
    "OR hackerrank OR indeed OR breezy)} "
    '-{subject:("job alert" OR "security code" OR "password" '
    'OR "verify" OR "account" OR "newsletter")}'
)

# Default: search from Feb 2026 onward
GMAIL_DEFAULT_AFTER = "2026/02/01"
GMAIL_DEFAULT_QUERY = f"{GMAIL_SEARCH_KEYWORDS} after:{GMAIL_DEFAULT_AFTER}"

GMAIL_DEFAULT_MAX_RESULTS = 100
GMAIL_BODY_MAX_LENGTH = 5000  # truncate email body to avoid huge DB rows

# ============================================================
# Ollama LLM
# ============================================================
OLLAMA_BASE_URL = os.getenv("JT_OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("JT_OLLAMA_MODEL", "qwen3:8b")

# Derived endpoints (don't override these directly)
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"  # for analyzer
OLLAMA_CHAT_URL = f"{OLLAMA_BASE_URL}/api/chat"  # for chat endpoint

# LLM parameters
LLM_TEMPERATURE = 0.1  # low temp for consistent classification
LLM_NUM_PREDICT_ANALYZE = 512  # max tokens for email analysis
LLM_NUM_PREDICT_CHAT = 300  # max tokens for chat responses
LLM_TIMEOUT_ANALYZE = 120  # seconds, for single email analysis
LLM_TIMEOUT_CHAT = 180  # seconds, for interactive chat

# ============================================================
# FastAPI / CORS
# ============================================================
API_HOST = os.getenv("JT_API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("JT_API_PORT", "8000"))
CORS_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:4173",  # Vite preview
]
