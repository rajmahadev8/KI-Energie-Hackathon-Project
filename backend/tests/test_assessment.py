from app.models import ProjectContext
from app.services.assessment import assess, pv_capacity_kwp, specific_yield


def test_pv_capacity_from_planned():
    assert pv_capacity_kwp(ProjectContext(planned_pv_kwp=9.5)) == 9.5


def test_pv_capacity_from_roof_area():
    # 55 m2 * 0.19 kwp/m2 = 10.45
    assert pv_capacity_kwp(ProjectContext(roof_area_m2=55)) == 10.45


def test_specific_yield_south_vs_north():
    south = specific_yield("NI", 180, 30)
    north = specific_yield("NI", 0, 30)
    assert south > north
    assert 900 <= south <= 1000  # Braunschweig south roof ballpark


def test_assess_braunschweig_south_roof_is_good():
    ctx = ProjectContext(state="NI", roof_azimuth_deg=180, roof_tilt_deg=30,
                         planned_pv_kwp=9.5, annual_consumption_kwh=4500, measures=["pv"])
    res = assess(ctx)
    assert res.suitability == "good"
    assert res.annual_yield_kwh and res.annual_yield_kwh > 8000
    assert res.installer_questions and res.next_steps
    assert 0 < res.score <= 100


def test_battery_raises_self_consumption():
    base = ProjectContext(state="NI", roof_azimuth_deg=180, roof_tilt_deg=30,
                          planned_pv_kwp=9.5, annual_consumption_kwh=4500, measures=["pv"])
    withb = base.model_copy(update={"measures": ["pv", "battery"], "planned_battery_kwh": 8})
    assert assess(withb).autarky_share > assess(base).autarky_share


def test_shading_reduces_score():
    sunny = ProjectContext(state="NI", roof_azimuth_deg=180, roof_tilt_deg=30, planned_pv_kwp=9.5, measures=["pv"])
    shaded = sunny.model_copy(update={"shading": "high"})
    assert assess(shaded).score < assess(sunny).score


def test_large_wallbox_adds_open_point():
    ctx = ProjectContext(state="NI", planned_pv_kwp=9.5, measures=["pv", "wallbox"], planned_wallbox_kw=22)
    assert any("Wallbox" in p for p in assess(ctx).open_points)
