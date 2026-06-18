# Demo script (pitch walkthrough, ~3–4 min)

**Story: from problem to prototype.**

## 0. Problem (20 s)
"Anyone planning PV, storage, a wallbox, or a heat pump drowns in contradictory information:
incomprehensible laws, outdated press, hallucinating chatbots, advertising platforms. The result:
systems don't get built – or are too small. We build **Empowerment statt Verunsicherung**."

## 1. Capture the project (30 s)
- Click **"Beispiel"** → single-family house **38106 Braunschweig**, PV 9.5 kWp, 22 kW wallbox,
  heat pump, 4,500 kWh/a.
- **"Analysieren"**.
- Show: address → automatically detected as **Niedersachsen + grid operator BS|Netz** (geocoding,
  without a Google key, OpenStreetMap only).

## 2. Source-based answer (60 s) — the core of the solution
- The AI answers **only on the basis of the structured knowledge base** and **cites every statement**
  (chips `§ regel-id`). Click a chip → jumps to the source with **legal status + "as of" date**.
- **Show Requirement 3:** "Rules at a glance" separates
  🟢 **Valid** / 🟡 **Announced** / 🔴 **Outdated**.
  - Valid: NBauO exempt from approval, MaStR obligation, §14a, feed-in tariff 7.78 ct.
  - Announced: reduction from 08/2026, EEG reform 2027.
  - Outdated: the famous **70% rule** – a myth, no longer in force.
- **Anti-hallucination:** a question outside the knowledge base → "not covered, please consult a specialist contractor".

## 3. Project specifics + follow-up questions (30 s)
- **22 kW wallbox** → note: **requires approval** (>11 kW) + §14a. At 11 kW only registration.
- PV 9.5 kWp > 7 kWp → **smart meter obligation**, otherwise 60% capping.
- If a detail is missing (e.g. commissioning date for an existing system), **the assistant asks specifically**.

## 4. Technical initial assessment (20 s)
- Suitability score, ~kWp, rough annual yield (~9,200 kWh), self-sufficiency. Clearly labeled as
  **orientation, not a forecast**.

## 5. AI roof potential analysis (20 s) — "wow"
- **"Beispiel-Dach analysieren"** → the vision model estimates a rough module count from the aerial image,
  **honest about uncertainties** (no substitute for on-site planning). Deliberately only a plausibility check.

## 6. Export (15 s)
- **"PDF-Onepager"** → address, measures, assessment, regulatory requirements with sources,
  open issues, next steps. Print/save as PDF.

## 7. Technology & scaling (30 s)
- **Structured, source-based knowledge base** + **deterministic matching** + LLM only for
  phrasing → traceable, not hallucinated.
- **AI ingestion** (`ingest.py`): from raw text, **rule drafts** are generated automatically → this is how the
  knowledge base scales (demo: balcony power plant rules). Cost-optimized via **OpenRouter with
  DeepSeek/Qwen** instead of expensive models.
- Offline-capable **demo cache**, in case the network fails during the pitch.

## Fallbacks
- Backend down? → one-pager/answers from cache; notice in the UI.
- LLM down? → deterministic template answer (still source-based).
