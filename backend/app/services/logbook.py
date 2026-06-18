"""Persist every generated answer to its own timestamped JSON file under backend/logs/.

One file per answer, named with date + time (e.g. answer-20260617-185601-123456.json), so each run
is auditable: it captures the exact question, project context, the answer, its citations/sources,
the surfaced rules, validity, and whether the LLM or a fallback produced it.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from app.models import AnswerResponse, ProjectContext

LOG_DIR = Path(__file__).resolve().parent.parent.parent / "logs"  # backend/logs


def save_answer(question: str, context: ProjectContext, lang: str, response: AnswerResponse) -> str:
    LOG_DIR.mkdir(exist_ok=True)
    now = datetime.now()
    fname = f"answer-{now:%Y%m%d-%H%M%S-%f}.json"
    record = {
        "timestamp": now.isoformat(timespec="seconds"),
        "lang": lang,
        "question": question,
        "context": context.model_dump(exclude_none=True),
        "out_of_scope": response.out_of_scope,
        "cached": response.cached,
        "answer": response.answer,
        "citations": [c.model_dump() for c in response.citations],
        "applicable_rule_ids": [r.id for r in response.applicable_rules],
        "sources": [
            {"rule_id": r.id, "title": r.title, "status": r.status,
             "source_name": r.source.name, "url": r.source.url, "as_of": r.source.as_of}
            for r in response.applicable_rules
        ],
        "clarifying_questions": [q.model_dump() for q in response.clarifying_questions],
        "disclaimer": response.disclaimer,
    }
    path = LOG_DIR / fname
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(path)
