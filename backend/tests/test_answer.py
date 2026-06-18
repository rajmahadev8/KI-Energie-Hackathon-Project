"""Answer-engine tests run WITHOUT an LLM key, so they exercise the deterministic fallback path
(template answers + out-of-scope handling) — the anti-hallucination guarantee."""
from app.knowledge.loader import load_rules
from app.models import ProjectContext
from app.services.answer import answer_question

RULES = load_rules()


def _ctx() -> ProjectContext:
    return ProjectContext(
        plz="38106", state="NI", grid_operator="BS|Netz", building_type="single_family",
        planned_pv_kwp=9.5, annual_consumption_kwh=4500, measures=["pv", "wallbox"],
        planned_wallbox_kw=22, planned_heatpump=True,
    )


def test_in_scope_answer_has_citations_and_rules():
    res = answer_question("Darf ich PV und eine Wallbox installieren?", _ctx(), RULES)
    assert not res.out_of_scope
    assert res.applicable_rules
    assert res.citations
    # template fallback embeds rule ids as [id] markers
    assert "[wallbox-anmeldung-genehmigung-schwelle]" in res.answer


def test_out_of_scope_question_is_not_hallucinated():
    # No measures selected → measure-specific rules do not apply → nothing surfaces (deterministic).
    res = answer_question(
        "What garden insurance do I need for a trampoline?",
        ProjectContext(measures=[], usage="residential"), RULES, "en",
    )
    # The key guarantee: nothing surfaced → flagged out_of_scope and an installer recommended,
    # NOT a fabricated answer.
    assert not res.applicable_rules
    assert res.out_of_scope
    assert "installer" in res.answer


def test_answer_always_carries_disclaimer():
    res = answer_question("PV?", _ctx(), RULES)
    assert "not legally binding" in res.disclaimer
