// Types mirroring the FastAPI backend models.

export type Topic =
  | "pv" | "battery" | "wallbox" | "heatpump"
  | "grid" | "metering" | "funding" | "building_law" | "general";
export type Status = "valid" | "announced" | "expired" | "unclear";
export type BuildingType = "single_family" | "two_family" | "multi_family" | "commercial";

export interface Source {
  name: string;
  url?: string | null;
  type: string;
  legal_status?: string | null;
  as_of?: string | null;
  retrieved?: string | null;
}

export interface KBRule {
  id: string;
  topic: Topic;
  title: string;
  statement: string;
  status: Status;
  valid_from?: string | null;
  valid_until?: string | null;
  value: Record<string, unknown>;
  uncertainties: string[];
  review_needed?: string | null;
  title_de?: string;
  statement_de?: string;
  uncertainties_de?: string[];
  review_needed_de?: string | null;
  source: Source;
  tags: string[];
}

export interface ProjectContext {
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
  plz?: string | null;
  state?: string | null;
  grid_operator?: string | null;
  building_type?: BuildingType | null;
  usage?: "residential" | "commercial" | "mixed";
  roof_area_m2?: number | null;
  roof_azimuth_deg?: number | null;
  roof_tilt_deg?: number | null;
  shading?: "none" | "low" | "medium" | "high" | null;
  annual_consumption_kwh?: number | null;
  ev_annual_kwh?: number | null;
  heat_demand_kwh?: number | null;
  measures: Topic[];
  planned_pv_kwp?: number | null;
  planned_battery_kwh?: number | null;
  planned_wallbox_kw?: number | null;
  planned_heatpump?: boolean | null;
  existing_pv?: boolean;
  existing_pv_kwp?: number | null;
  existing_pv_commissioning?: string | null;
}

export interface ClarifyingQuestion { field: string; question: string; why: string; }
export interface Citation { rule_id: string; source_name: string; url?: string | null; status: Status; as_of?: string | null; }

export interface AnswerResponse {
  answer: string;
  citations: Citation[];
  applicable_rules: KBRule[];
  clarifying_questions: ClarifyingQuestion[];
  out_of_scope: boolean;
  cached: boolean;
  disclaimer: string;
}

export interface AssessmentResponse {
  pv_kwp?: number | null;
  annual_yield_kwh?: number | null;
  specific_yield_kwh_per_kwp?: number | null;
  self_consumption_share?: number | null;
  autarky_share?: number | null;
  recommended_battery_kwh?: number | null;
  suitability: "good" | "moderate" | "limited" | "unknown";
  score: number;
  notes: string[];
  open_points: string[];
  next_steps: string[];
  installer_questions: string[];
}

export interface ContextResponse { context: ProjectContext; clarifying_questions: ClarifyingQuestion[]; }

// --- Google Solar (building insights) ---
export interface SolarLatLng { latitude: number; longitude: number; }
export interface RoofSegment {
  pitchDegrees: number;
  azimuthDegrees: number;
  center: SolarLatLng;
  planeHeightAtCenterMeters: number;
}
export interface SolarPanel {
  center: SolarLatLng;
  orientation: "LANDSCAPE" | "PORTRAIT";
  segmentIndex: number;
  yearlyEnergyDcKwh: number;
}
export interface BuildingInsights {
  center: SolarLatLng;
  boundingBox?: { sw: SolarLatLng; ne: SolarLatLng };
  postalCode?: string;
  administrativeArea?: string;
  regionCode?: string;
  imageryQuality?: "HIGH" | "MEDIUM" | "BASE";
  solarPotential: {
    maxArrayPanelsCount: number;
    panelCapacityWatts: number;
    panelHeightMeters: number;
    panelWidthMeters: number;
    maxSunshineHoursPerYear: number;
    maxArrayAreaMeters2: number;
    wholeRoofStats?: { areaMeters2: number; sunshineQuantiles: number[]; groundAreaMeters2: number };
    roofSegmentStats: RoofSegment[];
    solarPanels: SolarPanel[];
    solarPanelConfigs?: { panelsCount: number; yearlyEnergyDcKwh: number }[];
  };
}
export interface SolarResponse {
  address: string;
  formattedAddress: string;
  location: SolarLatLng;
  insights: BuildingInsights | null;
  solarError?: string;
  mock: boolean;
  error?: string;
}

export interface PVComponentLine {
  key: string;
  label: string;
  qty: number;
  unit: string;
  cost_low: number;
  cost_high: number;
  icon?: string | null;
  note?: string | null;
}

export interface PVConfigVariant {
  id: string;
  name: string;
  description?: string | null;
  module_count: number;
  kwp: number;
  annual_yield_kwh: number;
  self_sufficiency?: number | null;
  components: PVComponentLine[];
  total_low: number;
  total_high: number;
  eur_per_kwp_low: number;
  eur_per_kwp_high: number;
  notes: string[];
}

export interface ConfigureResponse {
  max_modules: number;
  max_kwp: number;
  module_wp: number;
  variants: PVConfigVariant[];
  price_basis: string;
  disclaimer: string;
}

export interface RoofVisionResponse {
  estimated_modules?: number | null;
  estimated_kwp?: number | null;
  usable_area_note?: string | null;
  assumptions: string[];
  uncertainties: string[];
  raw?: string | null;
  is_cross_check: boolean;
}
