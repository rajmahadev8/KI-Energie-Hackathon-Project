"""Live smoke test for the OpenRouter LLM path. Run manually:
    .venv/bin/python -m scripts.smoke_llm
Requires OPENROUTER_API_KEY in the environment or backend/.env."""
from app.config import settings
from app.knowledge.loader import load_rules
from app.models import ProjectContext
from app.services.answer import answer_question

print("LLM enabled:", settings.llm_enabled, "| text model:", settings.text_model)
ctx = ProjectContext(
    plz="38106", state="NI", grid_operator="BS|Netz", building_type="single_family",
    planned_pv_kwp=9.5, annual_consumption_kwh=4500, measures=["pv", "wallbox"],
    planned_wallbox_kw=22, planned_heatpump=True,
)
res = answer_question(
    "Darf ich auf meinem Einfamilienhaus eine PV-Anlage und eine 22-kW-Wallbox installieren?",
    ctx, load_rules(),
)
print("\n--- ANSWER (cached=%s, out_of_scope=%s) ---" % (res.cached, res.out_of_scope))
print(res.answer)
print("\n--- CITATIONS ---")
for c in res.citations:
    print(f"  [{c.rule_id}] {c.status} — {c.source_name}")
