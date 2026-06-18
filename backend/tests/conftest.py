"""Force the unit suite to run offline (no live LLM calls) so tests are deterministic and fast.
The deterministic template path is itself source-based, so this still exercises real behavior.
Live LLM is verified separately via scripts/smoke_llm.py."""
import pytest

from app.config import settings


@pytest.fixture(autouse=True)
def _offline(monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "", raising=False)
