# Evaluation Guide — How to verify the KI-PV-Assistent is correct

A practical, copy-paste checklist to confirm the prototype actually does what it claims:
**source-based, project-specific, validity-aware, bilingual, and not hallucinated.**

> Conventions: backend runs on `http://localhost:8000`, frontend on `http://localhost:3000`.
> Sample inputs live in [`test-inputs.json`](test-inputs.json); sources in [`sources.md`](sources.md).

---

## 0. Start the system

```bash
# Backend (terminal 1)
cd backend
uv venv && uv pip install -e .          # first time only
cp .env.example .env                     # put your OPENROUTER_API_KEY (or it's in ~/.bashrc)
uv run uvicorn app.main:app --reload --port 8000

# Frontend (terminal 2)
cd frontend
npm install                              # first time only
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev                              # http://localhost:3000  (use dev, see Troubleshooting)
```

Sanity check:
```bash
curl -s localhost:8000/health
# expect: {"status":"ok","rules_loaded":20,"llm_enabled":true,"text_model":"deepseek/...","vision_model":"qwen/..."}
```
- `rules_loaded: 20` → the knowledge base loaded & validated.
- `llm_enabled: true` → OpenRouter key is picked up. (If `false`, everything still works via deterministic fallbacks.)

---

## 1. Automated checks (fastest signal)

```bash
cd backend && uv run pytest -v
# expect: 25 passed
```
What the tests prove:
- **Retrieval** picks the right rules per project and the valid/announced/outdated split (Req 3).
- **Assessment** math (capacity, yield, autarky, score, shading penalty) is correct.
- **Anti-hallucination**: a no-measure question yields **0 rules + out_of_scope** (no fabrication).
- **Bilingual**: rules, clarifying questions, assessment text, disclaimer differ DE vs EN.
- **Geo**: PLZ 38106 → BS|Netz / Niedersachsen.

---

## 1b. Answer-correctness harness — grade the answers (THE key check)

This is how you evaluate whether the **answers themselves are correct**. Correctness has two layers:

**A) Faithfulness / grounding (automated)** — the answer only cites rules that were surfaced (no
fabricated citations), cites the rules it must, never cites rules it must not, surfaces the required
facts, frames the 70%-rule as outdated, and handles out-of-scope. A **gold key** lives in
`backend/eval/gold_answers.json`.

```bash
cd backend
uv run python -m eval.eval_answers --no-llm     # deterministic baseline (reproducible) → all PASS
uv run python -m eval.eval_answers              # grade the LIVE LLM answers
uv run python -m eval.eval_answers --judge       # + LLM-as-judge: is every claim supported by its sources?
uv run python -m eval.eval_answers --show-answers  # also print the full answers to read
```
Each case prints PASS/FAIL with per-check ticks and citation recall; the run exits non-zero if any
case fails. `--judge` adds `judge.supported=true/false` (a second model checks every claim against
the cited rule texts) — a strong automated signal that the answer did not add unsupported claims.

**B) Fact correctness (human, §9 below)** — the harness prints the `gold_facts`, each tied to a
primary source. The system can only be as correct as its knowledge base, so confirm a sample of
those facts against the primary sources. Faithful answer (A) + correct KB (B) = correct answer.

> **Prefer to check answers entirely by hand?** See [`manual-answer-check.md`](manual-answer-check.md)
> — a no-scripts, click-and-verify guide with a worked line-by-line audit of the demo answer and a
> blank verification template.

---

## 2. Knowledge base is structured & source-cited (Challenge §1, §2)

```bash
curl -s localhost:8000/rules | python3 -c "
import sys,json,collections
r=json.load(sys.stdin)
print('rules:',len(r))
print('status mix:',dict(collections.Counter(x['status'] for x in r)))
print('every rule has a source+date:', all(x['source']['name'] and x['source']['as_of'] for x in r))
print('every rule bilingual:', all(x.get('statement_de') and x.get('title_de') for x in r))
"
# expect: rules: 20 | status mix has valid+announced+expired | sources True | bilingual True
```
✅ This shows the AI works from a **structured base with sources and version dates**, not free text.

---

## 3. The three mandatory requirements

### Requirement 1 — source-based answer with citations
```bash
curl -s -X POST localhost:8000/answer -H 'Content-Type: application/json' -d '{
  "lang":"en","question":"May I install PV and a 22 kW wallbox?",
  "context":{"address":"38106 Braunschweig","building_type":"single_family",
             "planned_pv_kwp":9.5,"measures":["pv","wallbox"],"planned_wallbox_kw":22}
}' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['answer']);print();print('CITATIONS:',[c['rule_id'] for c in d['citations']])"
```
✅ Check: the answer text contains **`[rule-id]` citations**, and every claim maps to a rule in
`CITATIONS`. No statement should appear without a source.

### Requirement 2 — project-specific (inputs change the output)
Run `/assess` twice and compare:
```bash
# South roof
curl -s -X POST 'localhost:8000/assess?lang=en' -H 'Content-Type: application/json' \
  -d '{"state":"NI","roof_azimuth_deg":180,"roof_tilt_deg":30,"planned_pv_kwp":9.5,"measures":["pv"]}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('south:',d['suitability'],d['score'],d['annual_yield_kwh'])"
# North roof (only azimuth changed)
curl -s -X POST 'localhost:8000/assess?lang=en' -H 'Content-Type: application/json' \
  -d '{"state":"NI","roof_azimuth_deg":0,"roof_tilt_deg":30,"planned_pv_kwp":9.5,"measures":["pv"]}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('north:',d['suitability'],d['score'],d['annual_yield_kwh'])"
```
✅ Check: the **north roof scores lower** and yields less → the output genuinely depends on inputs.
Also: `/context` for "38106 Braunschweig" must resolve **state NI + grid operator BS|Netz**.

### Requirement 3 — valid vs announced vs outdated
In the `/answer` JSON (or the UI "Rules at a glance"), confirm all three buckets appear:
- **valid**: e.g. `nbauo-pv-verfahrensfrei`, `mastr-registrierung-pflicht`, `eeg-feedin-teileinspeisung-2026h1`
- **announced**: `eeg-feedin-degression-2026h2` (Aug-2026 cut), `eeg-reform-2027-feedin-angekuendigt`
- **outdated**: `eeg-70-prozent-regel-abgeschafft` (the 70% myth)
```bash
curl -s localhost:8000/rules | python3 -c "import sys,json;[print(x['status'].upper().ljust(10),x['id']) for x in json.load(sys.stdin)]" | sort
```

---

## 4. Anti-hallucination (the core promise)

```bash
curl -s -X POST localhost:8000/answer -H 'Content-Type: application/json' -d '{
  "lang":"en","question":"What garden insurance do I need for a trampoline?",
  "context":{"usage":"residential","measures":[]}
}' | python3 -c "import sys,json;d=json.load(sys.stdin);print('out_of_scope:',d['out_of_scope'],'rules:',len(d['applicable_rules']));print(d['answer'])"
# expect: out_of_scope: True  rules: 0  → "...no matching rules... please have this reviewed by a qualified installer."
```
✅ The system **refuses to invent** an answer outside its knowledge base.

Bonus (offline proof): stop the LLM by emptying the key and re-run any `/answer` — you still get a
**source-based template answer** (degraded, but never hallucinated).

---

## 5. Bilingual (DE ⇄ EN)

```bash
for L in de en; do
  echo "== $L =="; curl -s -X POST "localhost:8000/assess?lang=$L" -H 'Content-Type: application/json' \
   -d '{"state":"NI","planned_pv_kwp":9.5,"measures":["pv"]}' \
   | python3 -c "import sys,json;print(json.load(sys.stdin)['next_steps'][0])"
done
# expect: German step for de, English step for en
```
In the UI: use the **DE/EN toggle** (top-right) → all labels, the answer, rules, and the one-pager switch language.

---

## 6. Technical assessment plausibility

```bash
curl -s -X POST 'localhost:8000/assess?lang=en' -H 'Content-Type: application/json' \
 -d '{"state":"NI","roof_azimuth_deg":180,"roof_tilt_deg":30,"planned_pv_kwp":9.5,"annual_consumption_kwh":4500,"measures":["pv","battery"],"planned_battery_kwh":8}' \
 | python3 -m json.tool
```
✅ Sanity-check the numbers: ~9.5 kWp × ~950–1000 kWh/kWp ≈ **~9,000–9,500 kWh/yr** in Niedersachsen;
autarky higher *with* battery than without; score 0–100; `installer_questions` and `next_steps` present.

---

## 7. Vision roof analysis (the "wow", honest by design)

```bash
curl -s --max-time 120 -X POST localhost:8000/vision/roof | python3 -m json.tool
# expect: estimated_modules, estimated_kwp, AND a populated "uncertainties" list
```
✅ Check it returns an estimate **and** explicit uncertainties (it must NOT present itself as exact).
In the UI: "AI roof potential analysis" → "Analyze example roof".

---

## 8. Frontend walkthrough (click-by-click)

1. Open `http://localhost:3000` → page is **styled** (cards, teal buttons, small icons). If it looks
   unstyled, see Troubleshooting.
2. Top-right **DE/EN** toggle works.
3. Click **Example / Beispiel** → form fills with the Braunschweig case.
4. Click **Analyze / Analysieren** → within a few seconds you get:
   - **Initial technical assessment** (score gauge + capacity/yield/autarky) and detected **BS|Netz**.
   - **Source-based assessment** with inline `§ rule-id` chips → click a chip → it scrolls to the
     **Sources** panel and highlights the rule (with link + "As of" date).
   - **Rules at a glance** with 🟢 valid / 🟡 announced / 🔴 outdated badges.
   - **System overview** (house diagram, selected components highlighted) + **map** (your address).
   - **Next steps** + **Questions for the installer**.
5. Click **PDF one-pager** → new tab → **Print / Save as PDF**.
6. Toggle to existing-PV ("Bestehende PV-Anlage erweitern") without a date → after Analyze, a
   **follow-up question** asks for the commissioning date.

---

## 9. Fact-check the legal content (most important for a "source-based" tool)

Spot-check a few rules against the **primary sources** (all listed in [`sources.md`](sources.md)).
This is what separates this tool from a hallucinating chatbot — so verify a sample:

| Claim in the app | Verify at | What to confirm |
|---|---|---|
| Feed-in tariff 7.78 ct/kWh (≤10 kWp, surplus, Feb–Jul 2026) | bundesnetzagentur.de (EEG Fördersätze) | current rate for the commissioning window |
| Wallbox >11 kW needs approval | NAV §19 / VDE-AR-N 4100 | registration ≤11 kW vs approval above |
| §14a EnWG applies >4.2 kW (since 2024) | gesetze-im-internet.de/enwg §14a | scope + reduced grid fee |
| Dach-PV verfahrensfrei + PV-Pflicht | NBauO §32a (NI-VORIS) | Niedersachsen building law |
| MaStR registration within 1 month | marktstammdatenregister.de | deadline |

✅ Each rule in the UI shows its **source name, link, legal status, and "As of" date**, plus
**uncertainties** where values are stichtagsabhängig (e.g. tariffs). The tool is labelled
**not legally binding** throughout — that is correct and intended.

---

## 10. Jury-criteria scorecard

| Jury criterion | How to verify | Where |
|---|---|---|
| Problem understanding & user-centricity | Clarifying questions, installer questions, plain-language + tooltips, disclaimer | UI + §3, §8 here |
| Prototype maturity (core features demoable) | Full flow works end-to-end | §8 here |
| Technical implementation (meaningful AI, clean code, **Git+README**) | grounded answers, vision, ingestion; `git log`; README | §3, §4, §7 + repo |
| Validation & feasibility (data/tests/sim) | `uv run pytest` (25), test-inputs scenarios | §1 here |
| Presentation (problem→prototype journey) | `docs/demo-script.md`, `docs/architecture.md` | docs/ |

Also confirm the open-source basics: `git log --oneline` (clear history), `README.md` present,
no secrets committed (`git ls-files | grep -i env` → only `.env.example`).

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| UI loads but **unstyled** (huge icons, no layout) | stale `next start` build (CSS chunk 404/500) | `cd frontend && rm -rf .next && npm run build && npm run start` — or just use `npm run dev` while iterating |
| `Backend nicht erreichbar` / fetch errors in UI | backend not running on :8000 | start uvicorn (see §0); check `NEXT_PUBLIC_API_URL` |
| `llm_enabled: false` | no `OPENROUTER_API_KEY` | set it in `backend/.env`; until then deterministic fallback answers are used |
| Answer says "from cache" | live LLM call failed → demo cache served | check key/network; cache keeps the demo alive |
| Grid operator = "local distribution grid operator (please confirm)" | PLZ outside the prototype's sample table | expected — only a few regions are mapped (Braunschweig in focus) |

---

## 12. Final checklist

- [ ] `curl /health` → 20 rules, llm_enabled
- [ ] `uv run pytest` → 25 passed
- [ ] `/answer` returns citations for every claim (Req 1)
- [ ] North vs south `/assess` differ; address → NI + BS|Netz (Req 2)
- [ ] valid / announced / outdated all present (Req 3)
- [ ] trampoline question → out_of_scope, 0 rules (anti-hallucination)
- [ ] DE/EN toggle changes everything
- [ ] vision returns estimate + uncertainties
- [ ] PDF one-pager exports
- [ ] spot-checked ≥3 rules against primary sources (§9)
- [ ] `README.md` present, clean `git log`, no secrets committed
