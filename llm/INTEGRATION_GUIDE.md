# LLM Provider Integration Guide
# Gemini-first, automatic Ollama fallback

## 1. Add to config.py (after the Ollama LLM section)

```python
# ============================================================
# Gemini (Cloud LLM — optional, fallback to Ollama if not set)
# ============================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("JT_GEMINI_MODEL", "gemini-2.5-flash")
```

## 2. Create .env file (add to .gitignore)

```
GEMINI_API_KEY=your-api-key-here
```

Add to .gitignore:
```
.env
```

## 3. analyzer.py changes

### Update imports:
```python
# Remove:
import requests
from config import (
    ...
    OLLAMA_GENERATE_URL,
    OLLAMA_MODEL_ANALYZE,
)

# Add:
from llm.provider import llm
```

### Replace call_ollama() with call_llm():
```python
# ============== Old ==============
def call_ollama(email: dict) -> dict | None:
    ...

# ============== New ==============
def call_llm(email: dict) -> dict | None:
    """
    Send an email to LLM for analysis (Gemini-first, Ollama-fallback).
    Returns parsed JSON dict or None on failure.
    """
    raw = llm.generate(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=build_user_prompt(email),
    )
    if not raw:
        return None
    ...
```

### Update analyze_email() model_used:
```python
"model_used": llm.last_provider,   # tracks which provider was actually used
```

## 5. server.py changes

### Update imports:
```python
# Remove:
import httpx
from config import OLLAMA_CHAT_URL, OLLAMA_MODEL_CHAT, LLM_TIMEOUT_CHAT, LLM_NUM_PREDICT_CHAT

# Add:
from fastapi import FastAPI, HTTPException
from llm.provider import llm
```

### Replace chat endpoint:
```python
@app.post("/api/chat")
def api_chat(req: ChatRequest):
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
```

## 6. Install python-dotenv (optional, auto-loads .env)

```bash
pip install python-dotenv
```

Add to the top of config.py:
```python
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # .env not required, can use export instead
```

## 7. Testing

```bash
# With Gemini API key -> uses Gemini
export GEMINI_API_KEY="your-key-here"
python main.py --sync

# Without key -> uses Ollama automatically (same as before)
unset GEMINI_API_KEY
python main.py --sync
```

## 8. Updated project structure

```
llm/
  __init__.py
  provider.py      <- NEW: Provider abstraction layer
  prompts.py         (unchanged)
  analyzer.py        (now uses provider)
```

## 9. README section to add

```markdown
### LLM Provider

The system uses a pluggable LLM backend with automatic fallback:

1. **Gemini** (cloud) — higher accuracy, requires API key
2. **Ollama** (local) — zero cost, privacy-friendly, no API key needed

Set `GEMINI_API_KEY` environment variable to enable Gemini.
If not set or quota exceeded, the system falls back to Ollama automatically.
```