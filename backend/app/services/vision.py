"""AI roof analysis (vision) — an explicitly *uncertain cross-check*, never the authoritative
capacity number. Mirrors the honesty of the Plankton ideas deck (a flat-angle photo can't give a
reliable module count). The deterministic area-based assessment remains the headline figure.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from app.models import RoofVisionResponse
from app.services.llm import LLMUnavailable, vision

SYSTEM = (
    "You are a PV planning assistant. Roughly estimate how many standard PV modules (~1.75 m x 1.13 m, "
    "approx. 430 Wp) fit on the VISIBLE roof area in the image. Account for clearances to the ridge, "
    "eaves and verge, as well as roof windows/chimneys/dormers. Be honest about uncertainties "
    "(perspective, roof sides not visible, shallow camera angle). Answer in English, ONLY as JSON: "
    '{"estimated_modules": int, "estimated_kwp": float, "usable_area_note": str, '
    '"assumptions": [str], "uncertainties": [str]}.'
)
USER = "About how many PV modules fit on this roof? Give a rough, honest estimate with uncertainties."


def _extract_json(text: str) -> dict | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return None
    return None


def analyze_roof(image_path: str | Path) -> RoofVisionResponse:
    try:
        raw = vision(SYSTEM, USER, image_path)
    except LLMUnavailable as exc:
        return RoofVisionResponse(
            uncertainties=[f"Vision analysis not available ({exc}). Please enter the roof area manually."],
            raw=None,
        )
    data = _extract_json(raw)
    if not data:
        return RoofVisionResponse(raw=raw, uncertainties=["The response could not be parsed into a structured result."])
    return RoofVisionResponse(
        estimated_modules=data.get("estimated_modules"),
        estimated_kwp=data.get("estimated_kwp"),
        usable_area_note=data.get("usable_area_note"),
        assumptions=data.get("assumptions", []),
        uncertainties=(data.get("uncertainties", []) or []) + [
            "Only a rough AI estimate from a photo — does not replace on-site planning (structural load, shading, measurements)."
        ],
        raw=raw,
    )
