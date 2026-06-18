from app.services.geo import resolve_plz


def test_braunschweig_plz_maps_to_bsnetz():
    r = resolve_plz("38106")
    assert r["grid_operator"] == "BS|Netz"
    assert r["state"] == "NI"


def test_unknown_plz_returns_default():
    r = resolve_plz("99999")
    assert r["grid_operator"]  # has a sensible default
    assert r.get("state") is None


def test_none_plz_returns_default():
    r = resolve_plz(None)
    assert "grid_operator" in r
