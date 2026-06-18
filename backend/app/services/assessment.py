"""Deterministic technical pre-assessment (no LLM). Pure functions, fully unit-tested.

This is an *initial orientation*, not an exact yield forecast. It estimates PV capacity, rough
annual generation, self-consumption/autarky, a sensible battery size, a suitability score, and
concrete next steps / questions for the installer.
"""
from __future__ import annotations

from pathlib import Path

import yaml

from app.i18n import t
from app.models import AssessmentResponse, ProjectContext

_YF = yaml.safe_load((Path(__file__).resolve().parent.parent / "data" / "yield_factors.yaml").read_text("utf-8"))


def _factor(table: list[dict], value: float | None, default: float = 0.9) -> float:
    if value is None:
        return default
    for row in table:
        if row["from"] <= value < row["to"]:
            return row["factor"]
    return default


def specific_yield(state: str | None, azimuth: float | None, tilt: float | None) -> float:
    base = _YF["specific_yield_base_kwh_per_kwp"].get(state or "", _YF["specific_yield_base_kwh_per_kwp"]["default"])
    az = _factor(_YF["azimuth_factor"], azimuth if azimuth is not None else 180, 0.85)
    ti = _factor(_YF["tilt_factor"], tilt if tilt is not None else 30, 0.92)
    return round(base * az * ti)


def pv_capacity_kwp(ctx: ProjectContext) -> float | None:
    if ctx.planned_pv_kwp:
        return round(ctx.planned_pv_kwp, 2)
    if ctx.roof_area_m2:
        return round(ctx.roof_area_m2 * _YF["kwp_per_m2_usable"], 2)
    return None


def _total_consumption(ctx: ProjectContext) -> float | None:
    parts = [ctx.annual_consumption_kwh, ctx.ev_annual_kwh]
    if ctx.heat_demand_kwh:
        parts.append(ctx.heat_demand_kwh / 3.0)  # rough heat-pump COP
    vals = [p for p in parts if p]
    return round(sum(vals)) if vals else None


def _suitability(yf: float) -> tuple[str, int]:
    # yf relative to a good Braunschweig south roof (~970)
    if yf >= 920:
        return "good", 90
    if yf >= 820:
        return "moderate", 70
    if yf >= 700:
        return "limited", 50
    return "limited", 35


def assess(ctx: ProjectContext, lang: str = "en") -> AssessmentResponse:
    res = AssessmentResponse()
    kwp = pv_capacity_kwp(ctx)
    yf = specific_yield(ctx.state, ctx.roof_azimuth_deg, ctx.roof_tilt_deg)
    res.pv_kwp = kwp
    res.specific_yield_kwh_per_kwp = yf

    if kwp:
        res.annual_yield_kwh = round(kwp * yf)
        res.recommended_battery_kwh = round(min(kwp, (_total_consumption(ctx) or kwp * 1000) / 1000), 1)

    total_cons = _total_consumption(ctx)
    if res.annual_yield_kwh and total_cons:
        has_batt = bool(ctx.planned_battery_kwh) or "battery" in ctx.measures
        sc_rate = 0.65 if has_batt else 0.30
        self_consumed = min(res.annual_yield_kwh * sc_rate, total_cons)
        res.self_consumption_share = round(self_consumed / res.annual_yield_kwh, 2)
        res.autarky_share = round(self_consumed / total_cons, 2)

    suit, base_score = _suitability(yf)
    res.suitability = suit if kwp else "unknown"
    res.score = base_score if kwp else 0
    if ctx.shading in ("medium", "high"):
        res.score = max(0, res.score - (10 if ctx.shading == "medium" else 25))
        res.notes.append(t(lang,
            "Shading reported — yield may drop significantly; a shading analysis is recommended.",
            "Verschattung gemeldet — Ertrag kann deutlich sinken; eine Verschattungsanalyse wird empfohlen."))

    # notes
    if kwp:
        res.notes.append(t(lang,
            f"Estimated capacity ~{kwp} kWp, rough annual yield ~{res.annual_yield_kwh} kWh "
            f"(specific yield {yf} kWh/kWp). These values are an initial orientation, not a forecast.",
            f"Geschätzte Leistung ~{kwp} kWp, grober Jahresertrag ~{res.annual_yield_kwh} kWh "
            f"(spez. Ertrag {yf} kWh/kWp). Werte sind eine erste Orientierung, keine Prognose."))
    if ctx.roof_azimuth_deg is not None and not (135 <= ctx.roof_azimuth_deg <= 225):
        res.notes.append(t(lang,
            "Roof is not south-facing — east/west can still be worthwhile (more even generation).",
            "Dach nicht süd-orientiert — Ost/West kann dennoch sinnvoll sein (gleichmäßigere Erzeugung)."))

    # open points
    res.open_points = [
        t(lang, "Actual grid connection capacity at the house connection",
          "Konkrete Netzanschlusskapazität am Hausanschluss"),
        t(lang, "Desired metering concept (self-consumption, §14a EnWG meter)",
          "Gewünschtes Messkonzept (Eigenverbrauch, § 14a-Zähler)"),
        t(lang, "Structural load / roof condition for module mounting",
          "Statik / Dachzustand für die Modulmontage"),
    ]
    if "wallbox" in ctx.measures and (ctx.planned_wallbox_kw or 0) > 11:
        res.open_points.append(t(lang, "Approval of the >11 kW Wallbox from the grid operator",
                                 "Genehmigung der >11-kW-Wallbox beim Netzbetreiber"))

    # next steps (prioritized)
    res.next_steps = [
        t(lang, "Have the roof area, orientation and shading inspected on site",
          "Dachfläche, Ausrichtung und Verschattung vor Ort prüfen lassen"),
        t(lang, "Obtain and compare 2-3 quotes from specialist companies",
          "2–3 Angebote von Fachbetrieben einholen und vergleichen"),
        t(lang, "Clarify grid registration and metering concept with the grid operator",
          "Netzanmeldung und Messkonzept mit dem Netzbetreiber klären"),
        t(lang, "Apply for funding (e.g. KfW 270) before placing the order",
          "Förderung (z. B. KfW 270) vor Auftragsvergabe beantragen"),
    ]

    # questions to ask the installer (user-centric, requested in the challenge)
    res.installer_questions = [
        t(lang, "How many kWp realistically fit on my roof (after structural load, clearances, shading)?",
          "Welche kWp passen realistisch auf mein Dach (nach Statik, Abständen, Verschattung)?"),
        t(lang, "Do you recommend partial or full feed-in for my consumption profile?",
          "Empfehlen Sie Teil- oder Volleinspeisung für mein Verbrauchsprofil?"),
        t(lang, "Which battery storage is economically sensible for my consumption?",
          "Welcher Speicher ist für meinen Verbrauch wirtschaftlich sinnvoll?"),
        t(lang, "Do you handle grid registration, MaStR registration and the commissioning report?",
          "Übernehmen Sie Netzanmeldung, MaStR-Registrierung und Inbetriebnahmeprotokoll?"),
        t(lang, "How do you implement the §14a EnWG control (wallbox/heat pump) and the metering concept?",
          "Wie setzen Sie die § 14a-Steuerung (Wallbox/Wärmepumpe) und das Messkonzept um?"),
    ]
    return res
