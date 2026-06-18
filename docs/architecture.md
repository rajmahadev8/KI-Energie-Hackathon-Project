# System Architecture — KI-PV-Assistent

Source-based AI PV assistant: a **structured, cited knowledge base** + **deterministic retrieval**
+ **LLM only for phrasing** → traceable answers (not hallucinated), bilingual (DE/EN).

## High-level architecture

```mermaid
flowchart TB
    user([User / Homeowner])

    subgraph FE["Frontend — Next.js 16 (TypeScript, Tailwind)"]
        toggle[DE/EN language toggle]
        form[Intake form + measure selector]
        dash[Dashboard: answer · sources · traffic-lights<br/>house diagram · map · assessment · next steps]
        onepager[PDF one-pager route]
    end

    subgraph BE["Backend — FastAPI (Python, uv)"]
        ctx["/context — geocode + grid operator + clarifying Qs"]
        assess["/assess — deterministic technical assessment"]
        ans["/answer — grounded, cited answer"]
        vision["/vision/roof — roof cross-check"]
        rules_ep["/rules — expose knowledge base"]

        subgraph SVC["Services"]
            geo[geo.py]
            retrieval["retrieval.py<br/>applies_if filter →<br/>valid / announced / outdated"]
            answer_svc["answer.py<br/>grounded generation<br/>+ template/cache fallback"]
            assessment[assessment.py<br/>pure, tested calc]
            vision_svc[vision.py]
            ingest["ingest.py<br/>(offline: text → draft rules)"]
        end

        subgraph KB["Knowledge base (YAML, bilingual)"]
            rules[(rules/*.yaml<br/>statement + source +<br/>validity flag + _de)]
            data[(grid_operators.yaml<br/>yield_factors.yaml)]
            cache[(demo/cached_answers.json)]
        end
    end

    subgraph EXT["External (keyless where possible)"]
        nominatim[Nominatim / OpenStreetMap<br/>geocoding + map tiles]
        openrouter[OpenRouter<br/>DeepSeek text · Qwen-VL vision]
    end

    user --> FE
    toggle -. lang .-> ctx & assess & ans
    form --> ctx
    dash --> assess
    dash --> ans
    dash --> vision
    dash --> rules_ep
    onepager -. sessionStorage .- dash

    ctx --> geo --> nominatim
    geo --> data
    ans --> retrieval --> rules
    ans --> answer_svc --> openrouter
    answer_svc -. fallback .-> cache
    assess --> assessment --> data
    vision --> vision_svc --> openrouter
    rules_ep --> rules
    ingest --> openrouter
    ingest -. drafts for review .-> rules
```

## Request flow (the core "Analyze" action)

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant API as FastAPI
    participant R as retrieval.py (deterministic)
    participant KB as Knowledge base
    participant LLM as OpenRouter (DeepSeek)

    U->>FE: Fill project + pick measures + Analyze (lang=de/en)
    FE->>API: POST /context (address, lang)
    API->>API: geocode → state + grid operator (BS|Netz)
    API-->>FE: context + clarifying questions
    par Technical assessment
        FE->>API: POST /assess (context, lang)
        API-->>FE: capacity, yield, autarky, score, next steps
    and Source-based answer
        FE->>API: POST /answer (question, context, lang)
        API->>R: filter rules by applies_if
        R->>KB: load rules (valid/announced/outdated)
        R-->>API: applicable rule set
        API->>LLM: phrase answer using ONLY these rules (cite ids)
        LLM-->>API: grounded answer + used_rule_ids
        Note over API: LLM down? → template/cache fallback (still source-based)
        API-->>FE: answer + citations + validity flags + disclaimer
    end
    FE-->>U: Dashboard (answer, sources w/ "as of" dates, traffic-lights, assessment)
    opt Export
        U->>FE: PDF one-pager (print → PDF)
    end
```

## Why this design
- **Deterministic retrieval** (not the LLM) decides *which* rules apply → reproducible, testable, and
  the basis for the valid / announced / outdated distinction (Requirement 3).
- **LLM is grounded**: it phrases only over the retrieved rules and cites them; out-of-scope
  questions are flagged, never invented (anti-hallucination).
- **Graceful degradation**: no LLM key → deterministic template answer; network failure → demo cache.
- **Keyless geo**: Nominatim + OpenStreetMap, no Google key required.
- **Bilingual**: `lang` flows from the UI toggle through every endpoint; rules carry `_de` fields.

See [`spec.md`](spec.md) for component responsibilities and [`sources.md`](sources.md) for provenance.
