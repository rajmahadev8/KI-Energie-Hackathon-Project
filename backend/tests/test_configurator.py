from app.models import ProjectContext
from app.services.configurator import configure


def _ctx(**kw) -> ProjectContext:
    base = dict(state="NI", roof_azimuth_deg=180, roof_tilt_deg=30,
                roof_area_m2=55, annual_consumption_kwh=4500, measures=["pv"])
    base.update(kw)
    return ProjectContext(**base)


def test_roof_limit_and_variants():
    r = configure(_ctx(), "en")
    # 55 m2 * 0.19 kWp/m2 = 10.45 kWp -> ~24 modules @430Wp
    assert r.max_modules == 24
    assert 10.0 <= r.max_kwp <= 10.6
    assert r.variants
    # roof-max variant uses all modules
    roofmax = next(v for v in r.variants if v.id == "roof_max")
    assert roofmax.module_count == r.max_modules


def test_costs_are_in_realistic_eur_per_kwp_range():
    r = configure(_ctx(), "en")
    v = next(v for v in r.variants if v.id == "roof_max")
    assert v.total_low < v.total_high
    assert v.total_low == sum(c.cost_low for c in v.components)
    # turnkey residential PV ballpark ~1000–1900 €/kWp
    assert 900 <= v.eur_per_kwp_low <= 1900
    assert 1100 <= v.eur_per_kwp_high <= 2200


def test_smart_meter_only_above_7kwp():
    small = configure(_ctx(roof_area_m2=18), "en")   # ~3.4 kWp
    v_small = small.variants[0]
    assert v_small.kwp <= 7
    assert not any(c.key == "smart_meter" for c in v_small.components)
    big = next(v for v in configure(_ctx(), "en").variants if v.kwp > 7)
    assert any(c.key == "smart_meter" for c in big.components)


def test_yield_and_notes_present():
    r = configure(_ctx(), "de")
    v = r.variants[-1]
    assert v.annual_yield_kwh > 0
    assert v.self_sufficiency is not None
    assert v.notes  # conditional notes generated
    assert r.disclaimer and "kein verbindliches" in r.disclaimer.lower()


def test_planned_capacity_creates_variant():
    r = configure(_ctx(planned_pv_kwp=8.0), "en")
    assert any(v.id == "planned" for v in r.variants)
