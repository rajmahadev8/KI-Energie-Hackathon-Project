"""Grounded, source-cited answer generation (bilingual EN/DE).

Design: retrieval is deterministic; the LLM only *phrases* an answer over the rules we already
selected, and is forbidden from using outside knowledge. If the LLM is unavailable, a deterministic
template answer (built from the same rules) is returned — so the output is always source-based and
the demo never hard-fails. Questions with no matching rule are reported as out-of-scope, never
answered from the model's own memory (anti-hallucination guarantee).
"""
from __future__ import annotations

import json
from pathlib import Path

from app.i18n import DISCLAIMER, norm, t
from app.models import AnswerResponse, Citation, KBRule, ProjectContext
from app.services.llm import LLMUnavailable, chat
from app.services.retrieval import generate_clarifying_questions, retrieve

_CACHE_PATH = Path(__file__).resolve().parent.parent / "demo" / "cached_answers.json"


def _system_prompt(lang: str) -> str:
    language = "German" if norm(lang) == "de" else "English"
    return (
        "You are a source-based assistant for decentralized energy projects (PV, battery storage, "
        "wallbox, heat pump) in Germany. "
        "\n\nOUT-OF-SCOPE RULE (set out_of_scope=true ONLY in this case): "
        "If the question has absolutely nothing to do with energy, solar power, PV systems, "
        "battery storage, wallbox, heat pump, electricity grid, metering, energy law, or renewable "
        "energy in Germany — for example pure math (2+2), general geography, cooking, sports — "
        "then set out_of_scope=true and return an empty answer and empty used_rule_ids. "
        "Any question that touches PV sizing, roof area, yield, cost, regulation, installation, "
        "feed-in, grid connection, or energy consumption is IN scope — answer it. "
        "\n\nFOR IN-SCOPE QUESTIONS: Answer using ONLY the RULES provided below as your primary "
        "source. Do not invent regulatory facts or tariff numbers. "
        "If the rules provide relevant background (e.g. capacity thresholds, sizing rules), use "
        "them. For technical estimates not directly in the rules (e.g. modules per m²), you may "
        "provide a standard rule-of-thumb and clearly label it as an estimate. "
        "Cite every statement drawn from a rule with its rule ID in square brackets, "
        "e.g. [eeg-feedin-teileinspeisung-2026h1]. Cite ONLY rules you actually used — list those "
        "IDs in used_rule_ids. If no rule covers the question, answer with general domain knowledge "
        "and set used_rule_ids to []. "
        "Clearly distinguish between currently valid, announced and outdated rules. "
        f"Write the answer in {language}, understandable for laypeople. Answer as JSON: "
        '{"answer": str, "used_rule_ids": [str], "out_of_scope": bool}.'
    )


def _summarize_context(ctx: ProjectContext, lang: str) -> str:
    de = norm(lang) == "de"
    bits = []
    if ctx.address or ctx.plz:
        bits.append(f"{'Standort' if de else 'Location'}: {ctx.address or ''} {ctx.plz or ''}".strip())
    if ctx.state:
        bits.append(f"{'Bundesland' if de else 'State'}: {ctx.state}")
    if ctx.grid_operator:
        bits.append(f"{'Netzbetreiber' if de else 'Grid operator'}: {ctx.grid_operator}")
    if ctx.building_type:
        bits.append(f"{'Gebäude' if de else 'Building'}: {ctx.building_type}")
    if ctx.planned_pv_kwp:
        bits.append(f"{'geplante PV' if de else 'planned PV'}: {ctx.planned_pv_kwp} kWp")
    if ctx.planned_wallbox_kw:
        bits.append(f"{'geplante Wallbox' if de else 'planned wallbox'}: {ctx.planned_wallbox_kw} kW")
    if ctx.planned_heatpump:
        bits.append("Wärmepumpe geplant" if de else "heat pump planned")
    if ctx.annual_consumption_kwh:
        bits.append(f"{'Verbrauch' if de else 'Consumption'}: {ctx.annual_consumption_kwh} kWh/a")
    if ctx.existing_pv:
        bits.append(
            f"{'Bestand-PV vorhanden' if de else 'Existing PV present'} "
            f"({'IBN' if de else 'commissioned'} {ctx.existing_pv_commissioning or ('unbekannt' if de else 'unknown')})"
        )
    return "; ".join(bits) or ("keine Angaben" if de else "no details provided")


def _serialize_rules(buckets: dict[str, list[KBRule]], lang: str) -> str:
    label = {"applicable": "CURRENTLY VALID", "announced": "ANNOUNCED", "outdated": "OUTDATED"}
    lines: list[str] = []
    for key in ("applicable", "announced", "outdated"):
        for r in buckets[key]:
            loc = r.localized(lang)
            lines.append(
                f"[{r.id}] ({label[key]}) {loc['title']}\n  {loc['statement']}\n"
                f"  Source: {r.source.name} (as of {r.source.as_of}); Status: {r.status}"
            )
    return "\n".join(lines) if lines else "(no matching rules found)"


def _all_surfaced(buckets: dict[str, list[KBRule]]) -> list[KBRule]:
    return [r for key in ("applicable", "announced", "outdated") for r in buckets[key]]


def _citations(rules: list[KBRule]) -> list[Citation]:
    return [
        Citation(rule_id=r.id, source_name=r.source.name, url=r.source.url,
                 status=r.status, as_of=r.source.as_of)
        for r in rules
    ]


def _template_answer(ctx: ProjectContext, buckets: dict[str, list[KBRule]], lang: str) -> str:
    out: list[str] = []
    if buckets["applicable"]:
        out.append(t(lang, "**Currently valid for your project:**", "**Aktuell geltend für Ihr Projekt:**"))
        for r in buckets["applicable"]:
            out.append(f"- {r.localized(lang)['statement']} [{r.id}]")
    if buckets["announced"]:
        out.append(t(lang, "\n**Announced / in preparation (not yet authoritative):**",
                     "\n**Angekündigt / in Vorbereitung (noch nicht maßgeblich):**"))
        for r in buckets["announced"]:
            out.append(f"- {r.localized(lang)['statement']} [{r.id}]")
    if buckets["outdated"]:
        out.append(t(lang, "\n**Outdated (common misconception):**", "\n**Veraltet (häufiges Missverständnis):**"))
        for r in buckets["outdated"]:
            out.append(f"- {r.localized(lang)['statement']} [{r.id}]")
    if not any(buckets.values()):
        return t(lang,
                 "The knowledge base contains no matching rules for this question. Please have this "
                 "point reviewed by a qualified installer.",
                 "Zu dieser Frage liegen in der Wissensbasis keine passenden Regeln vor. Bitte lassen "
                 "Sie den Punkt von einem Fachbetrieb prüfen.")
    return "\n".join(out)


def answer_question(question: str, ctx: ProjectContext, rules: list[KBRule], lang: str = "en") -> AnswerResponse:
    buckets = retrieve(rules, ctx)
    surfaced = _all_surfaced(buckets)
    surfaced_by_id = {r.id: r for r in surfaced}
    clarifying = generate_clarifying_questions(ctx, lang)
    out_of_scope = not surfaced

    answer_text = ""
    cached = False
    cited_rules: list[KBRule] = []

    if surfaced:
        try:
            user = (
                f"QUESTION: {question}\n\n"
                f"PROJECT CONTEXT: {_summarize_context(ctx, lang)}\n\n"
                f"RULES:\n{_serialize_rules(buckets, lang)}"
            )
            raw = chat(_system_prompt(lang), user, json_mode=True)
            parsed = json.loads(raw)
            answer_text = parsed.get("answer", "").strip()
            out_of_scope = bool(parsed.get("out_of_scope", False))
            # Only surface rules the LLM actually cited — preserving surfaced order.
            used_ids: list[str] = parsed.get("used_rule_ids") or []
            cited_rules = [surfaced_by_id[rid] for rid in used_ids if rid in surfaced_by_id]
            # Fallback: if LLM returned no used_ids but answered, use all surfaced rules.
            if not cited_rules and not out_of_scope and answer_text:
                cited_rules = surfaced
        except (LLMUnavailable, json.JSONDecodeError, KeyError):
            cached_hit = _load_cached(question, lang)
            if cached_hit:
                answer_text, cached = cached_hit, True
            else:
                answer_text = _template_answer(ctx, buckets, lang)
            cited_rules = surfaced
    else:
        answer_text = _template_answer(ctx, buckets, lang)

    # When out_of_scope, return no citations (nothing was actually used).
    if out_of_scope:
        cited_rules = []

    return AnswerResponse(
        answer=answer_text or _template_answer(ctx, buckets, lang),
        citations=_citations(cited_rules),
        applicable_rules=surfaced,
        clarifying_questions=clarifying,
        out_of_scope=out_of_scope,
        cached=cached,
        disclaimer=DISCLAIMER[norm(lang)],
    )


def _load_cached(question: str, lang: str) -> str | None:
    try:
        cache = json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None
    key = question.strip().lower()
    want = norm(lang)
    for entry in cache.get("answers", []):
        if entry.get("lang", "en") != want:
            continue
        match = entry.get("match", "").lower()
        if match and (match in key or key in match):
            return entry.get("answer")
    return None
