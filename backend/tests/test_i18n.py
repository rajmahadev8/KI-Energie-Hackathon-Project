"""Bilingual (EN/DE) behavior — runs offline (deterministic template path)."""
from app.knowledge.loader import load_rules
from app.models import ProjectContext
from app.services.answer import answer_question
from app.services.assessment import assess
from app.services.retrieval import generate_clarifying_questions

RULES = load_rules()


def _ctx() -> ProjectContext:
    return ProjectContext(
        plz="38106", state="NI", grid_operator="BS|Netz", building_type="single_family",
        planned_pv_kwp=9.5, annual_consumption_kwh=4500, measures=["pv", "wallbox"],
        planned_wallbox_kw=22,
    )


def test_kb_rules_have_german_translations():
    missing = [r.id for r in RULES if not r.statement_de or not r.title_de]
    assert not missing, f"rules missing German: {missing}"


def test_rule_localized_switches_language():
    rule = next(r for r in RULES if r.id == "nbauo-pv-verfahrensfrei")
    assert rule.localized("en")["statement"] != rule.localized("de")["statement"]
    assert "Niedersachsen" in rule.localized("de")["statement"] or "NBauO" in rule.localized("de")["title"]


def test_assess_is_bilingual():
    en = assess(_ctx(), "en")
    de = assess(_ctx(), "de")
    assert en.next_steps != de.next_steps
    assert any("Fachbetrieb" in s or "Förderung" in s or "Dachfläche" in s for s in de.next_steps)
    assert any("specialist" in s or "funding" in s.lower() or "roof" in s.lower() for s in en.next_steps)


def test_clarifying_questions_bilingual():
    ctx = ProjectContext(measures=["pv"], planned_pv_kwp=5)  # missing address + consumption
    de = generate_clarifying_questions(ctx, "de")
    en = generate_clarifying_questions(ctx, "en")
    assert de and en
    assert any("Adresse" in q.question or "Postleitzahl" in q.question for q in de)
    assert any("address" in q.question.lower() for q in en)


def test_answer_template_and_disclaimer_bilingual():
    de = answer_question("Welche Regeln gelten?", _ctx(), RULES, "de")
    en = answer_question("Which rules apply?", _ctx(), RULES, "en")
    assert "nicht rechtsverbindlich" in de.disclaimer
    assert "not legally binding" in en.disclaimer
    # offline template uses German headers/statements for de
    assert "Aktuell geltend" in de.answer
    assert "Currently valid" in en.answer
