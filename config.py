"""
config.py
Centralized configuration for Gmail JobTracker.
All hardcoded values from other modules are collected here.
"""

from __future__ import annotations

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass
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

# Default: search from Aug 2025 onward
GMAIL_DEFAULT_AFTER = "2025/08/01"
GMAIL_DEFAULT_QUERY = f"{GMAIL_SEARCH_KEYWORDS} after:{GMAIL_DEFAULT_AFTER}"

GMAIL_DEFAULT_MAX_RESULTS = 100
GMAIL_BODY_MAX_LENGTH = 5000  # truncate email body to avoid huge DB rows

# ============================================================
# Email Type Classification
# ============================================================
# Email types that represent actual job applications (creates/updates application records)
# Add new types here when you add them to SYSTEM_PROMPT in prompts.py
JOB_EMAIL_TYPES = {
    "application_confirm",
    "rejection",
    "interview_invite",
    "offer",
    "action_needed",
    "linkedin_applied",
    "linkedin_rejected",
    "recruiter_outreach",
}

# Map email_type → application status
# Must cover all types in JOB_EMAIL_TYPES
EMAIL_TYPE_TO_STATUS = {
    "application_confirm": "applied",
    "rejection": "rejected",
    "interview_invite": "interview",
    "offer": "offer",
    "action_needed": "action_needed",
    "linkedin_applied": "applied",
    "linkedin_rejected": "rejected",
    "recruiter_outreach": "applied",
}

# ============================================================
# Ollama LLM
# ============================================================
OLLAMA_BASE_URL = os.getenv("JT_OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL_ANALYZE = os.getenv("JT_OLLAMA_MODEL_ANALYZE", "qwen2.5-coder:7b")
OLLAMA_MODEL_CHAT = os.getenv("JT_OLLAMA_MODEL_CHAT", "qwen3:8b")

# Derived endpoints (don't override these directly)
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"  # for analyzer
OLLAMA_CHAT_URL = f"{OLLAMA_BASE_URL}/api/chat"  # for chat endpoint

# LLM parameters
LLM_TEMPERATURE = 0.1  # low temp for consistent classification
LLM_NUM_PREDICT_ANALYZE = 1024  # max tokens for email analysis
LLM_NUM_PREDICT_CHAT = 2048  # max tokens for chat responses
LLM_TIMEOUT_ANALYZE = 120  # seconds, for single email analysis
LLM_TIMEOUT_CHAT = 180  # seconds, for interactive chat

# ============================================================
# Gemini (Cloud LLM — optional, fallback to Ollama if not set)
# ============================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("JT_GEMINI_MODEL", "gemini-2.5-flash")

# ============================================================
# FastAPI / CORS
# ============================================================
API_HOST = os.getenv("JT_API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("JT_API_PORT", "8000"))
CORS_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:4173",  # Vite preview
]

# ============================================================
# Auto-sync
# ============================================================
AUTO_SYNC_INTERVAL = int(os.getenv("JT_AUTO_SYNC_INTERVAL", "300"))  # seconds (5 min)
AUTO_SYNC_MAX = int(os.getenv("JT_AUTO_SYNC_MAX", "5"))  # max emails per cycle
