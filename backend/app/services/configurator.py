"""PV system configurator (PV-core only).

From the roof + consumption it derives the physical limits (how many ~430 Wp modules fit → kWp),
then proposes several configuration variants (compact / recommended / roof-maximum, plus the user's
own kWp if given). For each variant it builds a per-component bill of materials with indicative
2026 price ranges and applies the regulatory conditional logic (smart meter > 7 kWp, feed-in tariff
tier, direct-marketing threshold, income-tax exemption ≤ 30 kWp).

Prices are ROUGH RANGES (see app/data/pv_components.yaml), explicitly NOT a binding offer — the
challenge forbids binding profitability calculations / real offers.
"""
from __future__ import annotations

from pathlib import Path

import yaml

from app.i18n import norm, t
from app.models import ConfigureResponse, ProjectContext, PVComponentLine, PVConfigVariant
from app.services.assessment import specific_yield

_CAT = yaml.safe_load((Path(__file__).resolve().parent.parent / "data" / "pv_components.yaml").read_text("utf-8"))
WP = _CAT["module"]["wp"]
AREA = _CAT["module"]["area_m2"]
KWP_PER_M2 = _CAT["module"]["kwp_per_m2_usable"]


def _modules_to_kwp(n: int) -> float:
    return round(n * WP / 1000, 2)


def _roof_max_modules(ctx: ProjectContext) -> int:
    if ctx.roof_area_m2:
        return max(1, int(ctx.roof_area_m2 * KWP_PER_M2 * 1000 / WP))
    if ctx.planned_pv_kwp:  # no roof area → allow at least the planned size
        return max(1, round(ctx.planned_pv_kwp * 1000 / WP))
    return 0


def _self_sufficiency(yield_kwh: int, ctx: ProjectContext) -> float | None:
    cons = ctx.annual_consumption_kwh
    if not cons or not yield_kwh:
        return None
    self_consumed = min(yield_kwh * 0.30, cons)  # PV without battery ≈ 30% self-consumption
    return round(self_consumed / cons, 2)


def _components_for(kwp: float, module_count: int, lang: str) -> tuple[list[PVComponentLine], int, int]:
    de = norm(lang) == "de"
    lines: list[PVComponentLine] = []
    lo_sum = hi_sum = 0
    for c in _CAT["components"]:
        if c.get("condition") == "kwp_gt_7" and kwp <= 7:
            continue  # smart meter only required above 7 kWp
        sizing = c["sizing"]
        if sizing == "per_kwp":
            qty, unit = round(kwp, 2), "kWp"
        elif sizing == "per_module":
            qty, unit = module_count, ("Modul" if de else "module")
        else:
            qty, unit = 1, ("pauschal" if de else "flat")
        lo = round(qty * c["low"]); hi = round(qty * c["high"])
        lo_sum += lo; hi_sum += hi
        lines.append(PVComponentLine(
            key=c["key"], label=(c["label_de"] if de else c["label"]),
            qty=qty, unit=unit, cost_low=lo, cost_high=hi, icon=c.get("icon"),
        ))
    return lines, lo_sum, hi_sum


def _notes(kwp: float, ctx: ProjectContext, lang: str) -> list[str]:
    n: list[str] = []
    if kwp > 7:
        n.append(t(lang, "Above 7 kWp an intelligent metering system (smart meter) is required (MsbG).",
                   "Über 7 kWp ist ein intelligentes Messsystem (Smart Meter) erforderlich (MsbG)."))
    else:
        n.append(t(lang, "Up to 7 kWp a conventional meter is usually sufficient.",
                   "Bis 7 kWp genügt in der Regel ein herkömmlicher Zähler."))
    if kwp <= 10:
        n.append(t(lang, "Feed-in tariff tier: up to 10 kWp (highest rate).",
                   "Vergütungsstufe: bis 10 kWp (höchster Satz)."))
    elif kwp <= 40:
        n.append(t(lang, "Feed-in tariff tier: the share from 10–40 kWp earns a lower rate.",
                   "Vergütungsstufe: der Anteil 10–40 kWp wird geringer vergütet."))
    if kwp <= 30:
        n.append(t(lang, "Up to 30 kWp the system is generally income-tax exempt (since 2023).",
                   "Bis 30 kWp ist die Anlage i. d. R. einkommensteuerbefreit (seit 2023)."))
    if kwp >= 25:
        n.append(t(lang, "From 25 kWp gradual mandatory direct marketing is announced.",
                   "Ab 25 kWp ist schrittweise eine Direktvermarktungspflicht angekündigt."))
    if ctx.shading in ("medium", "high"):
        n.append(t(lang, "Shading reported — actual yield may be lower; a shading analysis is recommended.",
                   "Verschattung gemeldet — realer Ertrag ggf. niedriger; Verschattungsanalyse empfohlen."))
    return n


def configure(ctx: ProjectContext, lang: str = "en",
              panel_wp: int | None = None, max_modules: int | None = None) -> ConfigureResponse:
    """When `panel_wp` / `max_modules` are given (e.g. from Google Solar building insights), the
    variants are aligned to the real panel capacity and the real number of roof panel positions, so
    each variant's module count maps 1:1 to the panels drawn on the satellite/3D map."""
    de = norm(lang) == "de"
    wp = panel_wp if (panel_wp and panel_wp > 0) else WP

    def m2k(n: int) -> float:
        return round(n * wp / 1000, 2)

    max_mods = max_modules if (max_modules and max_modules > 0) else _roof_max_modules(ctx)
    resp = ConfigureResponse(
        max_modules=max_mods, max_kwp=m2k(max_mods), module_wp=wp,
        price_basis=t(lang,
                      f"Indicative 2026 German price ranges (per component), {_CAT['as_of']}.",
                      f"Indikative Preisspannen 2026 (DE, je Komponente), Stand {_CAT['as_of']}."),
        disclaimer=t(lang,
                     "Rough estimate, NOT a binding offer and not a profitability calculation. "
                     "Actual prices depend on product, roof and installer.",
                     "Grobe Schätzung, KEIN verbindliches Angebot und keine Wirtschaftlichkeitsberechnung. "
                     "Tatsächliche Preise hängen von Produkt, Dach und Fachbetrieb ab."),
    )
    if max_mods <= 0:
        return resp

    yf = specific_yield(ctx.state, ctx.roof_azimuth_deg, ctx.roof_tilt_deg)

    # candidate target module counts (deduped, ascending)
    targets: dict[int, tuple[str, str, str]] = {}
    cons = ctx.annual_consumption_kwh
    if cons:  # compact ≈ 1 kWp per 1000 kWh
        compact = min(max_mods, max(4, round((cons / 1000) * 1000 / wp)))
        targets.setdefault(compact, ("compact", t(lang, "Compact (demand-oriented)", "Kompakt (bedarfsnah)"),
                                     t(lang, "Roughly sized to your consumption.", "Grob an Ihrem Verbrauch orientiert.")))
    recommended = max(1, min(max_mods, round(max_mods * 0.9)))
    targets.setdefault(recommended, ("recommended", t(lang, "Recommended", "Empfohlen"),
                                     t(lang, "Uses most of the roof while keeping margins.",
                                       "Nutzt den Großteil des Daches mit Sicherheitsabständen.")))
    targets.setdefault(max_mods, ("roof_max", t(lang, "Roof maximum", "Dachmaximum"),
                                  t(lang, "Maximum modules that fit on the roof.",
                                    "Maximale Modulzahl, die auf das Dach passt.")))
    if ctx.planned_pv_kwp:
        pm = max(1, min(max_mods, round(ctx.planned_pv_kwp * 1000 / wp)))
        targets.setdefault(pm, ("planned", t(lang, "Your plan", "Ihre Planung"),
                                t(lang, "Based on the capacity you entered.", "Basierend auf Ihrer Eingabe.")))

    for count in sorted(targets):
        vid, name, desc = targets[count]
        kwp = m2k(count)
        yield_kwh = round(kwp * yf)
        comps, lo, hi = _components_for(kwp, count, lang)
        resp.variants.append(PVConfigVariant(
            id=vid, name=name, description=desc, module_count=count, kwp=kwp,
            annual_yield_kwh=yield_kwh, self_sufficiency=_self_sufficiency(yield_kwh, ctx),
            components=comps, total_low=lo, total_high=hi,
            eur_per_kwp_low=round(lo / kwp), eur_per_kwp_high=round(hi / kwp),
            notes=_notes(kwp, ctx, lang),
        ))
    return resp
