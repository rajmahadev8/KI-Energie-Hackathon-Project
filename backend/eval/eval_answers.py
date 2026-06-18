"""Answer-correctness harness — grades the assistant's ANSWERS against the gold key.

Run (from backend/):
    uv run python -m eval.eval_answers              # grade live LLM answers
    uv run python -m eval.eval_answers --no-llm     # deterministic template path (reproducible)
    uv run python -m eval.eval_answers --judge       # + LLM-as-judge faithfulness check

Two layers of "correctness":
  1. FAITHFULNESS / GROUNDING (automated here): the answer only cites rules that were actually
     surfaced (no fabricated citations), cites the rules it must, never cites rules it must not,
     surfaces the required facts, and flags out-of-scope correctly. The 70% rule, if mentioned,
     must be framed as outdated. Optional --judge asks an LLM whether every claim is supported.
  2. FACT CORRECTNESS (human): the gold_facts are verified against primary sources (docs/sources.md).
     Run `git`/the UI and compare; the harness prints the gold facts so you can eyeball them.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from app.config import settings
from app.knowledge.loader import load_rules
from app.models import ProjectContext
from app.services.answer import answer_question

GOLD = json.loads((Path(__file__).resolve().parent / "gold_answers.json").read_text("utf-8"))
RULES = load_rules()
ALL_IDS = {r.id for r in RULES}
OUTDATED_MARKERS = ["no longer", "outdated", "not in force", "repealed", "abgeschafft",
                    "veraltet", "nicht mehr", "aufgehoben"]
CITE_RE = re.compile(r"\[([a-z0-9][a-z0-9-]+)\]")


def grade(case: dict) -> dict:
    res = answer_question(case["question"], ProjectContext(**case["context"]), RULES, case.get("lang", "en"))
    ans = res.answer
    low = ans.lower()
    cited = set(CITE_RE.findall(ans)) & ALL_IDS
    surfaced = {r.id for r in res.applicable_rules}
    clar_fields = {q.field for q in res.clarifying_questions}

    checks: dict[str, bool] = {}
    # grounding: never cite a rule that was not surfaced (no fabrication)
    checks["grounding"] = cited.issubset(surfaced)
    checks["out_of_scope"] = res.out_of_scope == case["expect_out_of_scope"]
    checks["must_cite"] = set(case.get("must_cite", [])).issubset(cited)
    checks["forbid_cite"] = not (set(case.get("forbid_cite", [])) & cited)
    exp = case.get("expect_cite", [])
    recall = len(cited & set(exp)) / len(exp) if exp else 1.0
    checks["citation_recall>=0.5"] = recall >= 0.5
    checks["required_facts"] = all(any(p.lower() in low for p in grp) for grp in case.get("require_phrases_any", []))
    if case.get("expect_clarifying_field"):
        checks["clarifying_question"] = case["expect_clarifying_field"] in clar_fields
    if case.get("seventy_must_be_outdated") and re.search(r"70\s?%|70-?prozent", low):
        checks["70%_framed_outdated"] = any(m in low for m in OUTDATED_MARKERS)

    return {"id": case["id"], "cached": res.cached, "checks": checks, "recall": recall,
            "cited": sorted(cited), "surfaced": sorted(surfaced), "answer": ans, "case": case}


def judge(answer: str, source_ids: set[str]) -> dict:
    """LLM-as-judge: is every factual claim supported by the SOURCE rules the answer drew from?
    Source rules = all rules surfaced/retrieved for this answer (not only the inline-bracketed ones),
    since that is the material the answer is grounded in."""
    from app.services.llm import LLMUnavailable, chat
    rules_txt = "\n".join(f"[{r.id}] {r.statement}" for r in RULES if r.id in source_ids) or "(none)"
    sys = ("You are a strict fact-checker. Given an ANSWER and the SOURCE RULES it cites, decide "
           "whether EVERY factual claim in the answer is supported by those rules. Do not use outside "
           "knowledge. Return JSON {\"supported\": bool, \"unsupported_claims\": [str]}.")
    try:
        raw = chat(sys, f"ANSWER:\n{answer}\n\nSOURCE RULES:\n{rules_txt}", json_mode=True)
        return json.loads(raw)
    except (LLMUnavailable, json.JSONDecodeError) as e:
        return {"supported": None, "unsupported_claims": [f"judge unavailable: {e}"]}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-llm", action="store_true", help="grade the deterministic template path")
    ap.add_argument("--judge", action="store_true", help="run LLM-as-judge faithfulness check")
    ap.add_argument("--show-answers", action="store_true")
    args = ap.parse_args()
    if args.no_llm:
        settings.openrouter_api_key = ""  # force template/fallback path

    print(f"Mode: {'deterministic template' if args.no_llm else 'live LLM'} ({settings.text_model})\n")
    all_pass = True
    for case in GOLD["cases"]:
        r = grade(case)
        ok = all(r["checks"].values())
        all_pass &= ok
        flag = "PASS" if ok else "FAIL"
        print(f"[{flag}] {r['id']}  (recall {r['recall']:.0%}{', cached' if r['cached'] else ''})")
        for name, val in r["checks"].items():
            print(f"        {'✓' if val else '✗'} {name}")
        if not ok:
            print(f"        cited={r['cited']}\n        surfaced={r['surfaced']}")
        if args.judge and not case["expect_out_of_scope"]:
            j = judge(r["answer"], set(r["surfaced"]) | set(r["cited"]))
            sup = j.get("supported")
            print(f"        judge.supported={sup}" + (f"  issues={j.get('unsupported_claims')}" if sup is False else ""))
        if args.show_answers:
            print("        ---\n        " + r["answer"].replace("\n", "\n        ") + "\n")

    print("\n--- GOLD FACTS (verify against primary sources — docs/sources.md) ---")
    for case in GOLD["cases"]:
        print(f"\n{case['id']}:")
        for gf in case["gold_facts"]:
            print(f"  • [{gf['rule']}] {gf['fact']}  (source: {gf['source']})")

    print(f"\n==== {'ALL CASES PASS' if all_pass else 'SOME CASES FAILED'} ====")
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
