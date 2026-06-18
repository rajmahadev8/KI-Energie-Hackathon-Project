"""Load and validate the structured knowledge base from YAML.

All rules live in app/knowledge/rules/*.yaml. Each file holds a list of rule dicts. We validate
every rule against the KBRule schema at load time, so a malformed or incomplete rule fails fast.
"""
from __future__ import annotations

from pathlib import Path

import yaml

from app.models import KBRule

RULES_DIR = Path(__file__).resolve().parent / "rules"


def load_rules(rules_dir: Path | None = None) -> list[KBRule]:
    rules_dir = rules_dir or RULES_DIR
    rules: list[KBRule] = []
    seen_ids: set[str] = set()
    for path in sorted(rules_dir.glob("*.yaml")):
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or []
        if not isinstance(raw, list):
            raise ValueError(f"{path.name}: expected a list of rules, got {type(raw).__name__}")
        for entry in raw:
            rule = KBRule.model_validate(entry)
            if rule.id in seen_ids:
                raise ValueError(f"Duplicate rule id: {rule.id} (in {path.name})")
            seen_ids.add(rule.id)
            rules.append(rule)
    return rules
