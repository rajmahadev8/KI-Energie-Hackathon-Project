"""AI-assisted knowledge-base ingestion.

Turns a raw regulatory text / FAQ page into *candidate* structured KB rules (matching the KBRule
schema) for HUMAN VERIFICATION. This demonstrates that the assistant can *process regulations* into
the structured base (not hand-typed answers) and is the scalability story: point it at more sources
to grow coverage. Output is never auto-merged — a human reviews drafts before they enter rules/.

CLI:
    .venv/bin/python -m app.services.ingest path/to/source.txt --topic pv \
        --source-name "EEG 2023 § 48" --url "https://..." --as-of 2026-01-01
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.services.llm import LLMUnavailable, chat

SYSTEM = (
    "You are an extractor for a structured knowledge base on German energy regulations. "
    "Read the source text and extract the distinct, clearly delimited individual rules it contains as JSON. "
    "Do not invent anything. If a value/status is uncertain, set status='unclear' and describe the "
    "uncertainty. Output in English, ONLY as JSON: {\"candidates\": [ {\"id\": str(kebab-case), \"topic\": "
    "\"pv|battery|wallbox|heatpump|grid|metering|funding|building_law\", \"title\": str, "
    "\"statement\": str(layperson-friendly), \"status\": \"valid|announced|expired|unclear\", "
    "\"valid_from\": str|null, \"uncertainties\": [str], \"review_needed\": str|null } ] }."
)


def ingest_text(text: str, topic_hint: str | None = None) -> list[dict]:
    user = (f"TOPIC HINT: {topic_hint}\n\n" if topic_hint else "") + f"SOURCE TEXT:\n{text[:8000]}"
    raw = chat(SYSTEM, user, json_mode=True, temperature=0.0)
    data = json.loads(raw)
    return data.get("candidates", [])


def _attach_source(candidates: list[dict], name: str, url: str | None, as_of: str | None, stype: str) -> list[dict]:
    for c in candidates:
        c.setdefault("value", {})
        c.setdefault("tags", [])
        c["source"] = {
            "name": name, "url": url, "type": stype,
            "legal_status": "to verify", "as_of": as_of, "retrieved": None,
        }
        c["_needs_human_review"] = True
    return candidates


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="AI-assisted KB ingestion (produces DRAFT rules for review)")
    p.add_argument("source_file")
    p.add_argument("--topic", default=None)
    p.add_argument("--source-name", required=True)
    p.add_argument("--url", default=None)
    p.add_argument("--as-of", default=None)
    p.add_argument("--source-type", default="law")
    args = p.parse_args(argv)

    text = Path(args.source_file).read_text(encoding="utf-8")
    try:
        candidates = ingest_text(text, args.topic)
    except (LLMUnavailable, json.JSONDecodeError) as exc:
        print(f"Ingestion failed: {exc}", file=sys.stderr)
        return 1
    out = _attach_source(candidates, args.source_name, args.url, args.as_of, args.source_type)
    print("# DRAFT rules — please review professionally before adding them to rules/*.yaml\n")
    import yaml
    print(yaml.safe_dump(out, allow_unicode=True, sort_keys=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
