# 🌱 KI-PV-Assistent — *Empowerment statt Verunsicherung (empowerment instead of uncertainty)*

> **KI-Hackathon Energie '26 · Challenge 3 (Plankton PV — „Energiewende von unten" (grassroots energy transition))**
>
> An **independent, source-based** AI assistant that brings together current regulations, funding,
> and building and site data into an **understandable, traceable initial assessment** for
> decentralized energy projects (PV, storage, wallbox, heat pump) — **better than a
> (potentially hallucinated) AI answer**.

---

## The Problem

Anyone planning a PV system, a storage battery, a wallbox, or a heat pump faces contradictory
information: incomprehensible legal texts, outdated or speculative press coverage, hallucinating
chatbots, and advertising-driven platforms. The result (according to Plankton PV): **systems don't
get built at all – or are kept profit-optimized and too small.** Reliable information is hard to find.

## The Idea

**Reliable, source-based knowledge base  ➕  project context  ➡️  deeply, but not
overwhelmingly informed users.**

The key is a **structured knowledge base**: every rule is a record with **source,
legal/version status, and a validity flag** (`valid` / `announced` / `outdated` /
`unclear`). A deterministic match against the project context decides **which** rules
apply; the LLM **phrases** the answer exclusively from those rules and **cites every
statement**. Questions outside the knowledge base are openly marked as "not covered" rather than
made up.

---

## Features (and how they fulfill the challenge)

| Feature | Challenge | Jury criterion |
|---|---|---|
| Structured, source-based knowledge base with validity flags | §1, **Req 3** | Technology / validation |
| Source-based answers with citations + source panel + "as of" date | §2, **Req 1** | Technology / problem understanding |
| Capture project context + **proactive follow-up questions** + project-specific matching | §3, **Req 2** | User focus |
| Deterministic technical initial assessment (tested) | §4 | Validation |
| Dashboard: form, measures, **object-centric house graphic**, map, checklist, score, next steps | §7 | Maturity / presentation |
| **AI ingestion** (raw text → rule drafts) | §1 | Technology / scaling |
| **"Questions for the specialist contractor"** | Task | User focus |
| AI roof potential analysis (vision, as a plausibility check) | Extension | Technology (wow) |
| PDF one-pager export | §8 | Maturity |
| Tooltips + persistent "not legally binding" notice | §6 | User focus |

**Concrete example context:** single-family house in **Braunschweig**, grid operator **BS|Netz**,
building law **Niedersachsen (NBauO)**.

---

## Architecture

```
                    ┌─────────────────────────────┐
   User\*      ───▶ │   Next.js Dashboard (DE)     │   Map: Leaflet + OpenStreetMap (no key)
                    │  Form · Answer · Sources     │
                    └───────────────┬─────────────┘
                                    │ REST (JSON)
                    ┌───────────────▼─────────────┐
                    │      FastAPI Backend         │
                    │                              │
   Address ───────▶ │  geo  (Nominatim → NI/BS|Netz)│
                    │  retrieval (applies_if filter)│◀── Knowledge base: rules/*.yaml
   Question ──────▶ │  answer  (LLM, sources only)  │     (source, as of, valid/announced/outdated)
   Building data ─▶ │  assessment (deterministic)   │
   Roof photo ────▶ │  vision  (plausibility check) │── LLM via OpenRouter (DeepSeek / Qwen-VL)
                    │  ingest  (text → rule drafts) │
                    └─────────────────────────────┘
```

**Principle:** Retrieval is **deterministic** (traceable, testable). The LLM **only phrases**
answers over already-selected rules and may not use external knowledge → no hallucination. Without
an LLM key, the backend delivers deterministic template answers; on network errors, a demo cache kicks in.

---

## Tech stack

- **Frontend:** Next.js 16 (App Router, TypeScript, Tailwind v4), Leaflet/OpenStreetMap.
- **Backend:** Python FastAPI, managed with **uv**; Pydantic schemas; YAML knowledge base.
- **LLM:** **OpenRouter** (OpenAI-compatible). Cost-optimized with **Chinese Models**:
  - Text/answers + ingestion: `deepseek/deepseek-v4-flash`
  - Vision (roof analysis): `qwen/qwen3-vl-32b-instruct`
- **Geodata:** Nominatim (geocoding) + postal-code→grid-operator table — **without a Google key**.
- **Bilingual (DE/EN):** language toggle in the UI (default German); answers, rules, assessment, and the one-pager are all rendered in the selected language.

---

## Repo structure

```
backend/   FastAPI: app/knowledge (rules/*.yaml + loader), app/services
           (geo, retrieval, answer, assessment, vision, ingest, llm), tests/ (pytest)
frontend/  Next.js dashboard + /onepager print page, components/, lib/
docs/      challenge/ (task), architecture.md (system diagrams), spec.md,
           sources.md (provenance log), demo-script.md, test-inputs.json (sample scenarios)
```

See [`docs/architecture.md`](docs/architecture.md) for the system + request-flow diagrams,
[`docs/test-inputs.json`](docs/test-inputs.json) for ready-to-use test scenarios, and
[`docs/evaluation-guide.md`](docs/evaluation-guide.md) for a step-by-step guide to verify
everything is correct (requirements, anti-hallucination, bilingual, fact-checking sources).
To **check the answers by hand**, see [`docs/manual-answer-check.md`](docs/manual-answer-check.md)
(no scripts — a worked line-by-line audit + a blank verification template).

---

## Setup & start

### 1) Backend (port 8000)
```bash
cd backend
uv venv && uv pip install -e .          # Python-Umgebung + Abhängigkeiten
cp .env.example .env                    # OPENROUTER_API_KEY eintragen (oder aus ~/.bashrc)
uv run uvicorn app.main:app --reload --port 8000
```
> Without `OPENROUTER_API_KEY`, everything keeps working (deterministic answers + demo cache).

### 2) Frontend (port 3000)
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev      # http://localhost:3000
```

### Tests
```bash
cd backend && uv run pytest          # 20 Tests: Retrieval, Geo, Assessment, Antwort/Anti-Halluzination
```

### AI ingestion (extend the knowledge base)
```bash
cd backend
uv run python -m app.services.ingest ../docs/ingestion_sample.txt \
  --topic pv --source-name "Solarpaket I (2024)" --url "https://..." --as-of 2024-05-16
# → Regel-Entwürfe (DRAFT) zur fachlichen Prüfung, bevor sie in rules/*.yaml übernommen werden
```

---

## How the mandatory requirements are met

- **Req 1 – source-based answer:** example Braunschweig/BS|Netz → every statement with rule ID +
  source + legal status (source panel, "as of" date).
- **Req 2 – user input → project-specific:** the intake form feeds `ProjectContext`; the
  `applies_if` filter + the technical calculation derive project-specific statements.
- **Req 3 – valid vs. announced vs. outdated:** validity flag per rule; traffic-light display
  (e.g. feed-in tariff *valid*, reduction 08/2026 *announced*, 70% rule *outdated*).

## Meaningful use of AI (jury criterion 3)
1. **Grounded generation** – the LLM phrases answers only from verified sources, with citations, without external knowledge.
2. **Vision** – rough roof potential analysis from a photo (deliberately as a plausibility check, with uncertainties).
3. **Ingestion** – the LLM structures raw texts into rule drafts (scaling the knowledge base).

---

## Limits / "Not part of the challenge"
No legal advice, no complete professional planning, no binding economic feasibility, no
live grid-connection processes, no real installation quotes, no nationwide
grid-operator coverage. Numeric values (e.g. tariff rates) depend on the effective date and must be
verified before a decision (see [`docs/sources.md`](docs/sources.md)).

## Outlook
More grid operators & federal states, an automated ingestion crawler with diff/review workflow,
integration of the Google Solar API / solar cadastre, structured tendering to specialist contractors,
adaptive level of detail per user.

---

*Prototype for the KI-Hackathon Energie '26. Source-based orientation, **not legally binding**.*
