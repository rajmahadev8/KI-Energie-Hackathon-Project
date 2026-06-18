from app.knowledge.loader import load_rules
from app.models import ProjectContext
from app.services.retrieval import generate_clarifying_questions, retrieve

RULES = load_rules()


def _braunschweig_pv() -> ProjectContext:
    return ProjectContext(
        address="Braunschweig", plz="38106", state="NI", grid_operator="BS|Netz",
        building_type="single_family", usage="residential",
        roof_area_m2=55, roof_azimuth_deg=180, roof_tilt_deg=30,
        annual_consumption_kwh=4500, planned_pv_kwp=9.5,
        measures=["pv"],
    )


def test_kb_has_validity_mix():
    statuses = {r.status for r in RULES}
    assert {"valid", "announced", "expired"} <= statuses  # Requirement 3 coverage


def test_pv_context_partitions_rules():
    res = retrieve(RULES, _braunschweig_pv())
    ids = {r.id for r in res["applicable"]}
    # currently-valid rules for a new Braunschweig SFH PV
    assert "eeg-feedin-teileinspeisung-2026h1" in ids
    assert "nbauo-pv-verfahrensfrei" in ids
    assert "mastr-registrierung-pflicht" in ids
    # smart meter required because 9.5 kWp > 7 kWp
    assert "msbg-smartmeter-pflicht" in ids
    # announced + outdated buckets are populated
    assert any(r.id == "eeg-feedin-degression-2026h2" for r in res["announced"])
    assert any(r.id == "eeg-70-prozent-regel-abgeschafft" for r in res["outdated"])


def test_small_pv_excludes_smartmeter_rule():
    ctx = _braunschweig_pv()
    ctx.planned_pv_kwp = 5.0  # below 7 kWp threshold
    ids = {r.id for r in retrieve(RULES, ctx)["applicable"]}
    assert "msbg-smartmeter-pflicht" not in ids


def test_direktvermarktung_only_for_large_systems():
    ctx = _braunschweig_pv()
    ctx.planned_pv_kwp = 9.5
    announced_ids = {r.id for r in retrieve(RULES, ctx)["announced"]}
    assert "direktvermarktung-ab-25kw-angekuendigt" not in announced_ids
    ctx.planned_pv_kwp = 30
    announced_ids = {r.id for r in retrieve(RULES, ctx)["announced"]}
    assert "direktvermarktung-ab-25kw-angekuendigt" in announced_ids


def test_wallbox_22kw_needs_approval_rule():
    ctx = _braunschweig_pv()
    ctx.measures = ["pv", "wallbox"]
    ctx.planned_wallbox_kw = 22
    ids = {r.id for r in retrieve(RULES, ctx)["applicable"]}
    assert "wallbox-anmeldung-genehmigung-schwelle" in ids
    assert "enwg-14a-steuerbare-verbrauchseinrichtungen" in ids


def test_clarifying_question_for_existing_pv_commissioning():
    ctx = ProjectContext(measures=["pv"], existing_pv=True, state="NI",
                         planned_pv_kwp=5, annual_consumption_kwh=4000)
    fields = {q.field for q in generate_clarifying_questions(ctx)}
    assert "existing_pv_commissioning" in fields  # the named 'Ich frage dich' behavior


def test_clarifying_question_for_missing_location():
    ctx = ProjectContext(measures=["pv"], planned_pv_kwp=5, annual_consumption_kwh=4000)
    fields = {q.field for q in generate_clarifying_questions(ctx)}
    assert "address" in fields
