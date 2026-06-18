"""Pydantic schemas: the structured knowledge base + project context + API I/O.

The KBRule is the centerpiece: every regulatory statement carries its source, legal/version
status, and a validity flag (valid / announced / expired / unclear). This is what makes answers
traceable and lets the assistant distinguish currently-valid vs announced vs outdated rules.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

# --- vocabularies -----------------------------------------------------------
Topic = Literal[
    "pv", "battery", "wallbox", "heatpump",
    "grid", "metering", "funding", "building_law", "general",
]
Status = Literal["valid", "announced", "expired", "unclear"]
SourceType = Literal["law", "regulation", "tar", "grid_operator", "funding", "faq", "standard"]
BuildingType = Literal["single_family", "two_family", "multi_family", "commercial"]
Usage = Literal["residential", "commercial", "mixed"]


# --- knowledge base ---------------------------------------------------------
class Source(BaseModel):
    name: str
    url: Optional[str] = None
    type: SourceType = "faq"
    legal_status: Optional[str] = None  # e.g. "current version", "ministerial draft"
    as_of: Optional[str] = None         # the date the content reflects
    retrieved: Optional[str] = None     # when we last checked the source


class AppliesIf(BaseModel):
    """Conditions matched against ProjectContext. All optional — absent = no constraint."""
    measure: Optional[list[Topic]] = None
    capacity_kwp_min: Optional[float] = None
    capacity_kwp_max: Optional[float] = None
    wallbox_kw_min: Optional[float] = None
    wallbox_kw_max: Optional[float] = None
    building_type: Optional[list[BuildingType]] = None
    usage: Optional[list[Usage]] = None
    state: Optional[list[str]] = None          # e.g. ["NI"]
    grid_operator: Optional[list[str]] = None  # e.g. ["BS|Netz"]
    commissioning_after: Optional[str] = None  # ISO date — for existing-system branches
    commissioning_before: Optional[str] = None
    requires_existing_pv: Optional[bool] = None


class KBRule(BaseModel):
    id: str
    topic: Topic
    title: str
    statement: str
    status: Status
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    applies_if: AppliesIf = Field(default_factory=AppliesIf)
    value: dict[str, Any] = Field(default_factory=dict)
    uncertainties: list[str] = Field(default_factory=list)
    review_needed: Optional[str] = None
    source: Source
    tags: list[str] = Field(default_factory=list)

    # German translations (fields are English by default; _de fall back to English if missing)
    title_de: Optional[str] = None
    statement_de: Optional[str] = None
    uncertainties_de: list[str] = Field(default_factory=list)
    review_needed_de: Optional[str] = None

    def localized(self, lang: str = "en") -> dict[str, Any]:
        """Return {title, statement, uncertainties, review_needed} in the requested language."""
        if (lang or "en").lower().startswith("de"):
            return {
                "title": self.title_de or self.title,
                "statement": self.statement_de or self.statement,
                "uncertainties": self.uncertainties_de or self.uncertainties,
                "review_needed": self.review_needed_de or self.review_needed,
            }
        return {
            "title": self.title,
            "statement": self.statement,
            "uncertainties": self.uncertainties,
            "review_needed": self.review_needed,
        }


# --- project context (user input) ------------------------------------------
class ProjectContext(BaseModel):
    # location
    address: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    plz: Optional[str] = None
    state: Optional[str] = None          # ISO-like code, e.g. "NI" for Niedersachsen
    grid_operator: Optional[str] = None

    # building
    building_type: Optional[BuildingType] = None
    usage: Usage = "residential"
    roof_area_m2: Optional[float] = None
    roof_azimuth_deg: Optional[float] = None   # 180 = south
    roof_tilt_deg: Optional[float] = None
    shading: Optional[Literal["none", "low", "medium", "high"]] = None

    # consumption
    annual_consumption_kwh: Optional[float] = None
    ev_annual_kwh: Optional[float] = None
    heat_demand_kwh: Optional[float] = None

    # measures the user is considering
    measures: list[Topic] = Field(default_factory=list)  # subset of pv/battery/wallbox/heatpump
    planned_pv_kwp: Optional[float] = None
    planned_battery_kwh: Optional[float] = None
    planned_wallbox_kw: Optional[float] = None
    planned_heatpump: Optional[bool] = None

    # existing system (drives the expansion branch + clarifying questions)
    existing_pv: bool = False
    existing_pv_kwp: Optional[float] = None
    existing_pv_commissioning: Optional[str] = None  # ISO date


# --- API responses ----------------------------------------------------------
class ClarifyingQuestion(BaseModel):
    field: str
    question: str
    why: str


class Citation(BaseModel):
    rule_id: str
    source_name: str
    url: Optional[str] = None
    status: Status
    as_of: Optional[str] = None


class AnswerResponse(BaseModel):
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    applicable_rules: list[KBRule] = Field(default_factory=list)
    clarifying_questions: list[ClarifyingQuestion] = Field(default_factory=list)
    out_of_scope: bool = False
    cached: bool = False
    disclaimer: str = (
        "This information is a source-based orientation and is not legally binding. "
        "The relevant original sources and a review by a specialist company are authoritative."
    )


class AssessmentResponse(BaseModel):
    pv_kwp: Optional[float] = None
    annual_yield_kwh: Optional[float] = None
    specific_yield_kwh_per_kwp: Optional[float] = None
    self_consumption_share: Optional[float] = None
    autarky_share: Optional[float] = None
    recommended_battery_kwh: Optional[float] = None
    suitability: Literal["good", "moderate", "limited", "unknown"] = "unknown"
    score: int = 0  # 0..100
    notes: list[str] = Field(default_factory=list)
    open_points: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    installer_questions: list[str] = Field(default_factory=list)


class PVComponentLine(BaseModel):
    key: str
    label: str
    qty: float
    unit: str  # "kWp" | "Modul" | "pauschal"
    cost_low: int
    cost_high: int
    icon: Optional[str] = None
    note: Optional[str] = None


class PVConfigVariant(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    module_count: int
    kwp: float
    annual_yield_kwh: int
    self_sufficiency: Optional[float] = None
    components: list[PVComponentLine] = Field(default_factory=list)
    total_low: int = 0
    total_high: int = 0
    eur_per_kwp_low: int = 0
    eur_per_kwp_high: int = 0
    notes: list[str] = Field(default_factory=list)


class ConfigureResponse(BaseModel):
    max_modules: int
    max_kwp: float
    module_wp: int
    variants: list[PVConfigVariant] = Field(default_factory=list)
    price_basis: str = ""
    disclaimer: str = ""


class RoofVisionResponse(BaseModel):
    estimated_modules: Optional[int] = None
    estimated_kwp: Optional[float] = None
    usable_area_note: Optional[str] = None
    assumptions: list[str] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    raw: Optional[str] = None
    is_cross_check: bool = True  # never the authoritative capacity number
