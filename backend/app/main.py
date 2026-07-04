"""FastAPI entrypoint for the KI-PV-Assistent backend.

The knowledge base is loaded and validated once at startup so a malformed rule fails fast.
All endpoints are source-based and degrade gracefully without an LLM key.
"""
from __future__ import annotations

import shutil
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.knowledge.loader import load_rules
from app.models import (
    AnswerResponse,
    AssessmentResponse,
    ConfigureResponse,
    KBRule,
    ProjectContext,
    RoofVisionResponse,
)
from app.services.answer import answer_question
from app.services.assessment import assess
from app.services.configurator import configure
from app.services.geo import enrich_location
from app.services.logbook import save_answer
from app.services.retrieval import generate_clarifying_questions
from app.services.vision import analyze_roof

STATE: dict = {}
SAMPLE_ROOF = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "images" / "roof_drone.jpg"


@asynccontextmanager
async def lifespan(app: FastAPI):
    STATE["rules"] = load_rules()
    yield
    STATE.clear()


app = FastAPI(title="KI-PV-Assistent", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def rules() -> list[KBRule]:
    return STATE.get("rules") or load_rules()


# --- request models ---------------------------------------------------------
class ContextResponse(BaseModel):
    context: ProjectContext
    clarifying_questions: list


class AnswerRequest(BaseModel):
    question: str
    context: ProjectContext
    lang: str = "en"
    history: list[dict[str, str]] = Field(default_factory=list)


# --- routes -----------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "rules_loaded": len(rules()),
        "llm_enabled": settings.llm_enabled,
        "text_model": settings.text_model,
        "vision_model": settings.vision_model,
    }


@app.get("/rules")
def list_rules() -> list[KBRule]:
    """Expose the full structured knowledge base (transparency / source view)."""
    return rules()


@app.post("/context", response_model=ContextResponse)
def build_context(ctx: ProjectContext, lang: str = "en") -> ContextResponse:
    """Geocode + resolve grid operator/state, then list any still-needed clarifying questions."""
    if ctx.address or ctx.plz:
        loc = enrich_location(ctx.address, ctx.plz)
        ctx.lat = loc.get("lat") or ctx.lat
        ctx.lon = loc.get("lon") or ctx.lon
        ctx.plz = loc.get("plz") or ctx.plz
        ctx.state = loc.get("state") or ctx.state
        ctx.grid_operator = loc.get("grid_operator") or ctx.grid_operator
    return ContextResponse(context=ctx, clarifying_questions=generate_clarifying_questions(ctx, lang))


@app.post("/assess", response_model=AssessmentResponse)
def assessment(ctx: ProjectContext, lang: str = "en") -> AssessmentResponse:
    return assess(ctx, lang)


@app.post("/configure", response_model=ConfigureResponse)
def configure_pv(ctx: ProjectContext, lang: str = "en",
                 panel_wp: int | None = None, max_modules: int | None = None) -> ConfigureResponse:
    """PV configuration variants + per-component indicative cost (PV-core only).
    Optional panel_wp / max_modules align the variants to Google Solar's real panels."""
    return configure(ctx, lang, panel_wp, max_modules)


@app.post("/answer", response_model=AnswerResponse)
def answer(req: AnswerRequest) -> AnswerResponse:
    res = answer_question(req.question, req.context, rules(), req.lang, req.history)
    try:
        save_answer(req.question, req.context, req.lang, res)  # one timestamped log file per answer
    except Exception:  # logging must never break the response
        pass
    return res


@app.post("/vision/roof", response_model=RoofVisionResponse)
async def vision_roof(file: UploadFile | None = File(default=None)) -> RoofVisionResponse:
    """Analyze an uploaded roof image; if none provided, use the bundled sample drone image."""
    if file is not None:
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename or "img.jpg").suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            path = tmp.name
        try:
            return analyze_roof(path)
        finally:
            Path(path).unlink(missing_ok=True)
    if SAMPLE_ROOF.exists():
        return analyze_roof(SAMPLE_ROOF)
    return RoofVisionResponse(uncertainties=["Kein Bild übergeben und kein Beispielbild gefunden."])
