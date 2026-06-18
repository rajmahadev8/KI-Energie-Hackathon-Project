"""Geocoding (Nominatim, keyless) + PLZ → grid-operator / state resolution.

No Google key required. Nominatim is used for address → lat/lon/PLZ; the grid operator and
Bundesland are resolved from a local PLZ-prefix table (prototype coverage, Braunschweig in focus).
"""
from __future__ import annotations

from pathlib import Path

import httpx
import yaml

_DATA = Path(__file__).resolve().parent.parent / "data" / "grid_operators.yaml"
_OPERATORS = yaml.safe_load(_DATA.read_text(encoding="utf-8"))

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# German Bundesland name (Nominatim) → code used in the knowledge base.
STATE_NAME_TO_CODE = {
    "Niedersachsen": "NI", "Bremen": "HB", "Hamburg": "HH", "Berlin": "BE",
    "Nordrhein-Westfalen": "NW", "Baden-Württemberg": "BW", "Bayern": "BY",
    "Hessen": "HE", "Rheinland-Pfalz": "RP", "Saarland": "SL", "Sachsen": "SN",
    "Sachsen-Anhalt": "ST", "Thüringen": "TH", "Brandenburg": "BB",
    "Mecklenburg-Vorpommern": "MV", "Schleswig-Holstein": "SH",
}


def resolve_plz(plz: str | None) -> dict:
    """Map a German postal code to {grid_operator, state, state_name, region} via prefix table."""
    if not plz:
        return dict(_OPERATORS["default"])
    plz = str(plz).strip()
    # try longest prefix first (3 then 2 digits)
    for n in (3, 2):
        hit = _OPERATORS["prefixes"].get(plz[:n])
        if hit:
            return dict(hit)
    return dict(_OPERATORS["default"])


def geocode(address: str) -> dict | None:
    """Address → {lat, lon, plz, display_name}. Returns None on failure (caller falls back)."""
    try:
        resp = httpx.get(
            NOMINATIM_URL,
            params={"q": address, "format": "jsonv2", "addressdetails": 1, "limit": 1, "countrycodes": "de"},
            headers={"User-Agent": "KI-PV-Assistent/0.1 (hackathon prototype)"},
            timeout=8.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None
        item = data[0]
        addr = item.get("address", {})
        return {
            "lat": float(item["lat"]),
            "lon": float(item["lon"]),
            "plz": addr.get("postcode"),
            "state": STATE_NAME_TO_CODE.get(addr.get("state", "")),
            "city": addr.get("city") or addr.get("town") or addr.get("village"),
            "display_name": item.get("display_name"),
        }
    except Exception:
        return None


def enrich_location(address: str | None, plz: str | None = None) -> dict:
    """Combine geocoding + operator/state resolution into one dict for ProjectContext."""
    out: dict = {"lat": None, "lon": None, "plz": plz, "state": None, "display_name": None}
    geo_state = None
    geo_city = None
    if address:
        geo = geocode(address)
        if geo:
            out.update(geo)
            plz = geo.get("plz") or plz
            geo_state = geo.get("state")
            geo_city = geo.get("city")
    resolved = resolve_plz(plz)
    out.update(resolved)
    out["plz"] = plz
    # prefer PLZ-resolved state/operator; fall back to geocoded Bundesland; Braunschweig → BS|Netz
    if not out.get("state"):
        out["state"] = geo_state
    if (not out.get("grid_operator") or "bitte bestätigen" in str(out.get("grid_operator"))) and geo_city == "Braunschweig":
        out["grid_operator"] = "BS|Netz"
    return out
