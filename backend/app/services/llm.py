"""Thin OpenRouter client (OpenAI-compatible). Cost-optimized Chinese models by default.

All calls degrade gracefully: on any error they raise LLMUnavailable, and callers fall back to
deterministic template answers / cached demo answers so the prototype never hard-fails in a demo.
"""
from __future__ import annotations

import base64
from pathlib import Path

from openai import OpenAI

from app.config import settings


class LLMUnavailable(RuntimeError):
    pass


_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if not settings.llm_enabled:
        raise LLMUnavailable("OPENROUTER_API_KEY not set")
    if _client is None:
        _client = OpenAI(base_url=settings.openrouter_base_url, api_key=settings.openrouter_api_key)
    return _client


def chat(system: str, user: str, *, json_mode: bool = False, temperature: float = 0.2) -> str:
    client = _get_client()
    kwargs: dict = {
        "model": settings.text_model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": temperature,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    try:
        resp = client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""
    except Exception as exc:  # noqa: BLE001
        raise LLMUnavailable(str(exc)) from exc


def vision(system: str, user: str, image_path: str | Path) -> str:
    client = _get_client()
    data = Path(image_path).read_bytes()
    b64 = base64.b64encode(data).decode()
    suffix = Path(image_path).suffix.lstrip(".").lower() or "jpeg"
    mime = "jpeg" if suffix in ("jpg", "jfif") else suffix
    try:
        resp = client.chat.completions.create(
            model=settings.vision_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": [
                    {"type": "text", "text": user},
                    {"type": "image_url", "image_url": {"url": f"data:image/{mime};base64,{b64}"}},
                ]},
            ],
            temperature=0.2,
        )
        return resp.choices[0].message.content or ""
    except Exception as exc:  # noqa: BLE001
        raise LLMUnavailable(str(exc)) from exc
