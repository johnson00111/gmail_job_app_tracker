"""
llm/provider.py
LLM Provider abstraction layer.
Supports Gemini (cloud) with automatic fallback to Ollama (local).
Includes both blocking and streaming chat methods.
"""

from __future__ import annotations

import json
import os
import time
from abc import ABC, abstractmethod
from typing import Generator

import requests

from config import (
    LLM_NUM_PREDICT_ANALYZE,
    LLM_NUM_PREDICT_CHAT,
    LLM_TEMPERATURE,
    LLM_TIMEOUT_ANALYZE,
    LLM_TIMEOUT_CHAT,
    OLLAMA_CHAT_URL,
    OLLAMA_GENERATE_URL,
    OLLAMA_MODEL_ANALYZE,
    OLLAMA_MODEL_CHAT,
)

# ============================================================
# Gemini config
# ============================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("JT_GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"


# ============================================================
# Base class
# ============================================================
class LLMProvider(ABC):
    """Abstract base for LLM providers."""

    name: str = "base"

    @abstractmethod
    def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str | None:
        """Blocking prompt -> response. Used for email classification."""
        ...

    @abstractmethod
    def chat(self, messages: list[dict], **kwargs) -> str | None:
        """Blocking chat -> response."""
        ...

    @abstractmethod
    def chat_stream(self, messages: list[dict], **kwargs) -> Generator[str, None, None]:
        """Streaming chat -> yields text chunks."""
        ...


# ============================================================
# Ollama (local)
# ============================================================
class OllamaProvider(LLMProvider):
    """Local Ollama LLM. Always available, no API key needed."""

    name = "ollama"

    def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str | None:
        timeout = kwargs.get("timeout", LLM_TIMEOUT_ANALYZE)
        model = kwargs.get("model", OLLAMA_MODEL_ANALYZE)
        try:
            resp = requests.post(
                OLLAMA_GENERATE_URL,
                json={
                    "model": model,
                    "system": system_prompt,
                    "prompt": user_prompt,
                    "stream": False,
                    "options": {
                        "temperature": LLM_TEMPERATURE,
                        "num_predict": LLM_NUM_PREDICT_ANALYZE,
                    },
                },
                timeout=timeout,
            )
            resp.raise_for_status()
            return resp.json().get("response", "")
        except requests.exceptions.ConnectionError:
            print(f"    [{self.name}] Ollama not reachable. Is it running?")
            return None
        except requests.exceptions.Timeout:
            print(f"    [{self.name}] Ollama request timed out ({timeout}s)")
            return None
        except Exception as e:
            print(f"    [{self.name}] Ollama error: {e}")
            return None

    def chat(self, messages: list[dict], **kwargs) -> str | None:
        timeout = kwargs.get("timeout", LLM_TIMEOUT_CHAT)
        model = kwargs.get("model", OLLAMA_MODEL_CHAT)
        try:
            resp = requests.post(
                OLLAMA_CHAT_URL,
                json={
                    "model": model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": LLM_NUM_PREDICT_CHAT,
                    },
                },
                timeout=timeout,
            )
            resp.raise_for_status()
            return resp.json().get("message", {}).get("content", "")
        except Exception as e:
            print(f"    [{self.name}] Ollama chat error: {e}")
            return None

    def chat_stream(self, messages: list[dict], **kwargs) -> Generator[str, None, None]:
        """Stream tokens from Ollama chat endpoint."""
        model = kwargs.get("model", OLLAMA_MODEL_CHAT)
        try:
            resp = requests.post(
                OLLAMA_CHAT_URL,
                json={
                    "model": model,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": LLM_NUM_PREDICT_CHAT,
                    },
                },
                timeout=LLM_TIMEOUT_CHAT,
                stream=True,
            )
            resp.raise_for_status()
            for line in resp.iter_lines():
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                    token = chunk.get("message", {}).get("content", "")
                    if token:
                        yield token
                    if chunk.get("done"):
                        break
                except json.JSONDecodeError:
                    continue
        except Exception as e:
            print(f"    [{self.name}] Ollama stream error: {e}")


# ============================================================
# Gemini (cloud)
# ============================================================
class GeminiProvider(LLMProvider):
    """Google Gemini API. Requires GEMINI_API_KEY env var."""

    name = "gemini"

    def __init__(self):
        self.api_key = GEMINI_API_KEY
        self.model = GEMINI_MODEL
        self._quota_exhausted = False
        self._quota_reset_time = 0

    @property
    def available(self) -> bool:
        """Check if Gemini is configured and not rate-limited."""
        if not self.api_key:
            return False
        if self._quota_exhausted and time.time() < self._quota_reset_time:
            return False
        if self._quota_exhausted and time.time() >= self._quota_reset_time:
            self._quota_exhausted = False
        return True

    def _mark_quota_exhausted(self, retry_after: int = 60):
        """Mark Gemini as temporarily unavailable."""
        self._quota_exhausted = True
        self._quota_reset_time = time.time() + retry_after
        print(f"    [{self.name}] Quota exhausted. Falling back for {retry_after}s.")

    def _build_contents(self, messages: list[dict]) -> list[dict]:
        """Convert OpenAI-style messages to Gemini format."""
        contents = []
        system_text = ""

        for msg in messages:
            role = msg["role"]
            content = msg["content"]

            if role == "system":
                system_text = content + "\n\n"
                continue

            gemini_role = "user" if role == "user" else "model"

            if system_text and gemini_role == "user":
                content = system_text + content
                system_text = ""

            contents.append(
                {
                    "role": gemini_role,
                    "parts": [{"text": content}],
                }
            )

        return contents

    def _call_api(self, contents: list[dict], **kwargs) -> str | None:
        """Blocking Gemini API call. Returns text or None."""
        url = f"{GEMINI_API_URL}/{self.model}:generateContent?key={self.api_key}"
        timeout = kwargs.get("timeout", LLM_TIMEOUT_ANALYZE)

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": kwargs.get("temperature", LLM_TEMPERATURE),
                "maxOutputTokens": kwargs.get("max_tokens", LLM_NUM_PREDICT_ANALYZE),
            },
        }

        try:
            resp = requests.post(url, json=payload, timeout=timeout)

            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 60))
                self._mark_quota_exhausted(retry_after)
                return None
            if resp.status_code == 403:
                print(f"    [{self.name}] API key invalid or quota exceeded.")
                self._mark_quota_exhausted(300)
                return None

            resp.raise_for_status()
            data = resp.json()

            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "")

            print(f"    [{self.name}] Empty response from Gemini.")
            return None

        except requests.exceptions.Timeout:
            print(f"    [{self.name}] Gemini request timed out ({timeout}s)")
            return None
        except Exception as e:
            print(f"    [{self.name}] Gemini error: {e}")
            return None

    def _stream_api(self, contents: list[dict], **kwargs) -> Generator[str, None, None]:
        """Streaming Gemini API call. Yields text chunks."""
        url = (
            f"{GEMINI_API_URL}/{self.model}:streamGenerateContent"
            f"?alt=sse&key={self.api_key}"
        )

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": kwargs.get("temperature", 0.7),
                "maxOutputTokens": kwargs.get("max_tokens", LLM_NUM_PREDICT_CHAT),
            },
        }

        try:
            resp = requests.post(
                url, json=payload, timeout=LLM_TIMEOUT_CHAT, stream=True
            )

            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 60))
                self._mark_quota_exhausted(retry_after)
                return
            if resp.status_code == 403:
                print(f"    [{self.name}] API key invalid or quota exceeded.")
                self._mark_quota_exhausted(300)
                return

            resp.raise_for_status()
            resp.encoding = "utf-8"

            for line in resp.iter_lines(decode_unicode=True):
                if not line or not line.startswith("data: "):
                    continue
                json_str = line[6:]
                if json_str.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(json_str)
                    candidates = chunk.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            text = parts[0].get("text", "")
                            if text:
                                yield text
                except json.JSONDecodeError:
                    continue

        except requests.exceptions.Timeout:
            print(f"    [{self.name}] Gemini stream timed out")
        except Exception as e:
            print(f"    [{self.name}] Gemini stream error: {e}")

    def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str | None:
        if not self.available:
            return None
        contents = [
            {
                "role": "user",
                "parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}],
            }
        ]
        return self._call_api(contents, **kwargs)

    def chat(self, messages: list[dict], **kwargs) -> str | None:
        if not self.available:
            return None
        contents = self._build_contents(messages)
        return self._call_api(
            contents,
            temperature=0.7,
            max_tokens=kwargs.get("max_tokens", LLM_NUM_PREDICT_CHAT),
            timeout=kwargs.get("timeout", LLM_TIMEOUT_CHAT),
        )

    def chat_stream(self, messages: list[dict], **kwargs) -> Generator[str, None, None]:
        if not self.available:
            return
        contents = self._build_contents(messages)
        yield from self._stream_api(
            contents,
            max_tokens=kwargs.get("max_tokens", LLM_NUM_PREDICT_CHAT),
        )


# ============================================================
# Smart Provider (Gemini-first, Ollama-fallback)
# ============================================================
class SmartProvider(LLMProvider):
    """
    Tries Gemini first, falls back to Ollama if:
    - Gemini API key not set
    - Quota exhausted (429)
    - Any Gemini error
    """

    name = "smart"

    def __init__(self):
        self.gemini = GeminiProvider()
        self.ollama = OllamaProvider()
        self._last_provider = "none"

    @property
    def last_provider(self) -> str:
        """Which provider handled the last request."""
        return self._last_provider

    def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str | None:
        if self.gemini.available:
            result = self.gemini.generate(system_prompt, user_prompt, **kwargs)
            if result is not None:
                self._last_provider = self.gemini.name
                return result
            print("    [smart] Gemini failed, falling back to Ollama...")

        result = self.ollama.generate(system_prompt, user_prompt, **kwargs)
        if result is not None:
            self._last_provider = self.ollama.name
        return result

    def chat(self, messages: list[dict], **kwargs) -> str | None:
        if self.gemini.available:
            result = self.gemini.chat(messages, **kwargs)
            if result is not None:
                self._last_provider = self.gemini.name
                return result
            print("    [smart] Gemini chat failed, falling back to Ollama...")

        result = self.ollama.chat(messages, **kwargs)
        if result is not None:
            self._last_provider = self.ollama.name
        return result

    def chat_stream(self, messages: list[dict], **kwargs) -> Generator[str, None, None]:
        """
        Stream from Gemini first. If no tokens arrive, fall back to Ollama.
        """
        if self.gemini.available:
            got_tokens = False
            try:
                for token in self.gemini.chat_stream(messages, **kwargs):
                    got_tokens = True
                    self._last_provider = self.gemini.name
                    yield token
                if got_tokens:
                    return
            except Exception:
                pass
            print("    [smart] Gemini stream failed, falling back to Ollama...")

        self._last_provider = self.ollama.name
        yield from self.ollama.chat_stream(messages, **kwargs)


# ============================================================
# Singleton instance
# ============================================================
llm = SmartProvider()
