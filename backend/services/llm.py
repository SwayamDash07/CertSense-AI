"""
Provider-agnostic LLM service for CertSense AI.

Usage in every agent:
    from services.llm import LLM
    self.llm = LLM()
    text = await self.llm.complete("your prompt")
    text = await self.llm.chat(system="...", user="...")

Supported providers (set via MODEL_PROVIDER env var):
    gemini      — Google Gemini (default, free tier)
    openai      — OpenAI
    openrouter  — OpenRouter
    groq        — Groq

Required .env:
    MODEL_PROVIDER=gemini
    MODEL_NAME=gemini-2.5-flash
    GEMINI_API_KEY=

To switch provider later, change MODEL_PROVIDER in .env only.
No agent code needs to change.
"""

import os
import json
import logging
import asyncio
from typing import Optional
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

# ── Read config once at import time ──────────────────────────────────────────

_PROVIDER = os.getenv("MODEL_PROVIDER", "gemini").lower().strip()
_MODEL    = os.getenv("MODEL_NAME", "gemini-2.5-flash").strip()


# ── Provider implementations ──────────────────────────────────────────────────

async def _gemini_call(
    system: Optional[str],
    user: str,
    temperature: float,
    max_tokens: int,
) -> str:
    """Call Google Gemini via the google-genai SDK (pip install google-genai)."""
    import google.genai as genai
    from google.genai import types

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in environment.")

    client = genai.Client(api_key=api_key)

    # Combine system + user into a single user turn when system prompt exists
    # (Gemini supports system_instruction separately)
    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        system_instruction=system if system else None,
    )

    response = await asyncio.to_thread(
        client.models.generate_content,
        model=_MODEL,
        contents=user,
        config=config,
    )
    text = response.text or ""
    return text.strip()


async def _openai_call(
    system: Optional[str],
    user: str,
    temperature: float,
    max_tokens: int,
) -> str:
    """Call OpenAI (or any OpenAI-compatible endpoint)."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(
        api_key=os.getenv("OPENAI_API_KEY", ""),
        base_url=os.getenv("OPENAI_BASE_URL", None),  # override for OpenRouter/Groq
    )
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})

    resp = await client.chat.completions.create(
        model=_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content.strip()


async def _openrouter_call(
    system: Optional[str],
    user: str,
    temperature: float,
    max_tokens: int,
) -> str:
    """Call OpenRouter (OpenAI-compatible, set OPENAI_BASE_URL=https://openrouter.ai/api/v1)."""
    os.environ.setdefault("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    os.environ.setdefault("OPENAI_API_KEY", os.getenv("OPENROUTER_API_KEY", ""))
    return await _openai_call(system, user, temperature, max_tokens)


async def _groq_call(
    system: Optional[str],
    user: str,
    temperature: float,
    max_tokens: int,
) -> str:
    """Call Groq (OpenAI-compatible)."""
    os.environ.setdefault("OPENAI_BASE_URL", "https://api.groq.com/openai/v1")
    os.environ.setdefault("OPENAI_API_KEY", os.getenv("GROQ_API_KEY", ""))
    return await _openai_call(system, user, temperature, max_tokens)


_PROVIDERS = {
    "gemini":     _gemini_call,
    "openai":     _openai_call,
    "openrouter": _openrouter_call,
    "groq":       _groq_call,
}


# ── Public LLM class ──────────────────────────────────────────────────────────

class LLM:
    """
    Provider-agnostic LLM client.
    Instantiate once per agent: self.llm = LLM()

    Methods:
        complete(prompt, *, temperature, max_tokens) -> str
            Single-turn completion. System prompt = None.

        chat(user, *, system, temperature, max_tokens) -> str
            Chat-style call with optional system prompt.

        complete_json(prompt, *, system, temperature, max_tokens) -> str
            Same as chat() but strips markdown fences before returning.
            Callers still do json.loads() — this just makes it safer.
    """

    def __init__(self) -> None:
        if _PROVIDER not in _PROVIDERS:
            raise ValueError(
                f"Unknown MODEL_PROVIDER={_PROVIDER!r}. "
                f"Valid options: {list(_PROVIDERS)}"
            )
        self._call = _PROVIDERS[_PROVIDER]
        logger.debug("LLM initialised: provider=%s model=%s", _PROVIDER, _MODEL)

    async def complete(
        self,
        prompt: str,
        *,
        temperature: float = 0.4,
        max_tokens: int = 1500,
    ) -> str:
        """Single-turn completion (no system prompt)."""
        return await self._invoke(system=None, user=prompt, temperature=temperature, max_tokens=max_tokens)

    async def chat(
        self,
        user: str,
        *,
        system: Optional[str] = None,
        temperature: float = 0.4,
        max_tokens: int = 1500,
    ) -> str:
        """Chat-style call with optional system prompt."""
        return await self._invoke(system=system, user=user, temperature=temperature, max_tokens=max_tokens)

    async def complete_json(
        self,
        prompt: str,
        *,
        system: Optional[str] = None,
        temperature: float = 0.4,
        max_tokens: int = 1500,
    ) -> str:
        """
        Call the LLM and strip markdown fences from the response.
        Returns a clean string ready for json.loads().
        """
        raw = await self._invoke(system=system, user=prompt, temperature=temperature, max_tokens=max_tokens)
        return _strip_fences(raw)

    async def _invoke(
        self,
        system: Optional[str],
        user: str,
        temperature: float,
        max_tokens: int,
        retries: int = 2,
    ) -> str:
        last_err: Exception = RuntimeError("LLM call failed before first attempt")
        for attempt in range(1, retries + 2):
            try:
                result = await self._call(system, user, temperature, max_tokens)
                return result
            except Exception as exc:
                last_err = exc
                logger.warning(
                    "LLM call failed (attempt %d/%d): %s: %s",
                    attempt, retries + 1, type(exc).__name__, exc,
                )
                if attempt <= retries:
                    await asyncio.sleep(1.5 * attempt)
        logger.error("LLM call gave up after %d attempts: %s", retries + 1, last_err)
        raise last_err


# ── Utility ───────────────────────────────────────────────────────────────────

def _strip_fences(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` wrappers from model output."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # drop first line (```json or ```) and last line (```)
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner).strip()
    return text


def safe_json(raw: str, default: dict) -> dict:
    """
    Parse JSON from LLM output with one retry after stripping fences.
    Returns `default` on failure.
    """
    for attempt, text in enumerate([raw, _strip_fences(raw)], 1):
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            logger.warning("JSON parse failed (attempt %d): %s", attempt, exc)
    logger.error("Could not parse JSON from LLM output: %r", raw[:200])
    return default