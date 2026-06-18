# KI-PV-Assistent — Backend (FastAPI)

Source-based PV assistant. See the [root README](../README.md) for an overall overview, setup, and
architecture.

```bash
uv venv && uv pip install -e .
cp .env.example .env            # OPENROUTER_API_KEY
uv run uvicorn app.main:app --reload --port 8000
uv run pytest
```

Endpoints: `/health` `/rules` `/context` `/assess` `/answer` `/vision/roof`.
