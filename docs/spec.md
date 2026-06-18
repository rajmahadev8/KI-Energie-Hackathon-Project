# Design / Spec (short version)

Full documentation: see [`../README.md`](../README.md). Pitch: [`demo-script.md`](demo-script.md).
Sources: [`sources.md`](sources.md).

## Core decisions
- **Structured knowledge base instead of raw RAG:** `KBRule` = statement + `applies_if` + source +
  validity flag (`valid`/`announced`/`expired`/`unclear`). YAML in `backend/app/knowledge/rules/`.
- **Deterministic retrieval:** `applies_if` is matched against `ProjectContext` and partitioned into
  `applicable` / `announced` / `outdated` → traceable, testable (Req 3).
- **LLM only for phrasing:** grounded generation exclusively over the selected rules,
  with citations; out-of-scope is openly flagged (anti-hallucination). Fallback: deterministic
  template answer + demo cache.
- **Vision = plausibility check**, never the authoritative kWp number (that comes from the roof area).
- **Cost-aware:** OpenRouter with DeepSeek (text) / Qwen-VL (vision).
- **Keyless geo:** Nominatim + postal-code→grid-operator (BS|Netz), Leaflet/OpenStreetMap.

## Data flow
`/context` (geocoding + grid operator + follow-up questions) → `/assess` (technical) + `/answer` (cited
assessment) → dashboard → `/vision/roof` (optional) → PDF one-pager (`/onepager`).

## Component responsibilities (backend)
- `geo.py` – address → lat/lon/postal code/federal state/grid operator
- `retrieval.py` – `applies_if` filter + follow-up question generation
- `answer.py` – grounded, cited answer (+ fallbacks)
- `assessment.py` – pure, tested technical calculation
- `vision.py` – roof estimate with uncertainties
- `ingest.py` – raw text → rule drafts (human review)
