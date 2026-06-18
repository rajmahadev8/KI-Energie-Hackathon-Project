"""Deterministic retrieval: filter KB rules by project context.

This is what makes the assistant traceable instead of free-associating. Each rule's `applies_if`
conditions are matched against the ProjectContext. Results are partitioned by validity:
  - applicable: currently-valid rules that fit the project (and its commissioning date)
  - announced:  upcoming / under-discussion rules relevant to the project (heads-up)
  - outdated:   expired rules that are commonly confused as still valid (myth-busting)

The valid/announced/outdated split directly serves Requirement 3.
"""
from __future__ import annotations

from datetime import date

from app.i18n import t
from app.models import ClarifyingQuestion, KBRule, ProjectContext

# Reference commissioning date for a *newly planned* system (no existing system).
TODAY = date.today()


def _as_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _matches_categorical(rule: KBRule, ctx: ProjectContext) -> bool:
    a = rule.applies_if
    # measure: a measure-specific rule needs at least one overlapping selected measure.
    # If the user selected no measures, measure-specific rules do not apply (→ enables a clean
    # deterministic out-of-scope when the question has no project measures at all).
    if a.measure:
        if not (set(a.measure) & set(ctx.measures)):
            return False
    if a.state and ctx.state:
        if ctx.state not in a.state:
            return False
    if a.grid_operator and ctx.grid_operator:
        if ctx.grid_operator not in a.grid_operator:
            return False
    if a.building_type and ctx.building_type:
        if ctx.building_type not in a.building_type:
            return False
    if a.usage and ctx.usage:
        if ctx.usage not in a.usage:
            return False
    return True


def _capacity_ref(rule: KBRule, ctx: ProjectContext) -> float | None:
    if "wallbox" in (rule.applies_if.measure or []) or rule.topic == "wallbox":
        return ctx.planned_wallbox_kw
    return ctx.planned_pv_kwp


def _matches_quantitative(rule: KBRule, ctx: ProjectContext, ignore_dates: bool = False) -> bool:
    a = rule.applies_if
    cap = ctx.planned_pv_kwp
    if a.capacity_kwp_min is not None and cap is not None and cap < a.capacity_kwp_min:
        return False
    if a.capacity_kwp_max is not None and cap is not None and cap > a.capacity_kwp_max:
        return False
    wb = ctx.planned_wallbox_kw
    if a.wallbox_kw_min is not None and wb is not None and wb < a.wallbox_kw_min:
        return False
    if a.wallbox_kw_max is not None and wb is not None and wb > a.wallbox_kw_max:
        return False
    if not ignore_dates:
        ref = _as_date(ctx.existing_pv_commissioning) if a.requires_existing_pv else TODAY
        ca = _as_date(a.commissioning_after)
        cb = _as_date(a.commissioning_before)
        if ca and ref and ref < ca:
            return False
        if cb and ref and ref > cb:
            return False
        # requires existing PV but none given → cannot confirm applicability
        if a.requires_existing_pv and not ctx.existing_pv:
            return False
    return True


def retrieve(rules: list[KBRule], ctx: ProjectContext) -> dict[str, list[KBRule]]:
    applicable: list[KBRule] = []
    announced: list[KBRule] = []
    outdated: list[KBRule] = []
    for r in rules:
        if not _matches_categorical(r, ctx):
            continue
        if r.status == "valid":
            if _matches_quantitative(r, ctx):
                applicable.append(r)
        elif r.status == "unclear":
            applicable.append(r)
        elif r.status == "announced":
            if _matches_quantitative(r, ctx, ignore_dates=True):
                announced.append(r)
        elif r.status == "expired":
            if _matches_quantitative(r, ctx, ignore_dates=True):
                outdated.append(r)
    return {"applicable": applicable, "announced": announced, "outdated": outdated}


def generate_clarifying_questions(ctx: ProjectContext, lang: str = "en") -> list[ClarifyingQuestion]:
    """Ask only for decisive missing inputs (the 'I ask you' behavior). Bilingual."""
    q: list[ClarifyingQuestion] = []
    if not ctx.state and not ctx.address and not ctx.plz:
        q.append(ClarifyingQuestion(
            field="address",
            question=t(lang, "What is the address or postal code of the building?",
                       "Wie lautet die Adresse oder Postleitzahl des Gebäudes?"),
            why=t(lang, "Determines the state (building law) and the responsible grid operator.",
                  "Bestimmt Bundesland (Baurecht) und zuständigen Netzbetreiber."),
        ))
    if ctx.existing_pv and not ctx.existing_pv_commissioning:
        q.append(ClarifyingQuestion(
            field="existing_pv_commissioning",
            question=t(lang, "When was the existing PV system commissioned (date)?",
                       "Wann wurde die bestehende PV-Anlage in Betrieb genommen (Datum)?"),
            why=t(lang, "The rules on feed-in tariffs and controllability have changed several times — the date decides which ones apply.",
                  "Die Regeln zu Vergütung und Steuerbarkeit haben sich mehrfach geändert — das Datum entscheidet, welche gelten."),
        ))
    if "pv" in ctx.measures and ctx.planned_pv_kwp is None and ctx.roof_area_m2 is None:
        q.append(ClarifyingQuestion(
            field="roof_area_m2",
            question=t(lang, "How large is the usable roof area (m2), or what system size (kWp) is planned?",
                       "Wie groß ist die nutzbare Dachfläche (m²) bzw. welche Anlagengröße (kWp) ist geplant?"),
            why=t(lang, "Determines capacity, feed-in tariff tier, smart-meter requirement (>7 kW) and the 60% rule.",
                  "Bestimmt Leistung, Vergütungsstufe, Smart-Meter-Pflicht (>7 kW) und 60 %-Regel."),
        ))
    if "pv" in ctx.measures and ctx.annual_consumption_kwh is None:
        q.append(ClarifyingQuestion(
            field="annual_consumption_kwh",
            question=t(lang, "What is the annual electricity consumption (kWh)?",
                       "Wie hoch ist der jährliche Stromverbrauch (kWh)?"),
            why=t(lang, "Affects self-consumption, full vs. partial feed-in and the battery size.",
                  "Beeinflusst Eigenverbrauch, Voll- vs. Teileinspeisung und die Speichergröße."),
        ))
    if "wallbox" in ctx.measures and ctx.planned_wallbox_kw is None:
        q.append(ClarifyingQuestion(
            field="planned_wallbox_kw",
            question=t(lang, "What wallbox power is planned (e.g. 11 kW or 22 kW)?",
                       "Welche Wallbox-Leistung ist geplant (z. B. 11 kW oder 22 kW)?"),
            why=t(lang, "Up to 11 kW only registration is needed; above 11 kW approval from the grid operator is required.",
                  "Bis 11 kW nur Anmeldung, über 11 kW ist eine Genehmigung des Netzbetreibers nötig."),
        ))
    return q
