import type { BuildingInsights, ProjectContext, SolarResponse } from "./types";

/** Fetch Google Solar building insights for an address or a clicked lat/lng. */
export async function fetchSolar(
  q: { address?: string; lat?: number; lng?: number; biasLat?: number; biasLng?: number },
): Promise<SolarResponse> {
  const p = new URLSearchParams();
  if (q.address) p.set("address", q.address);
  if (q.lat != null && q.lng != null) {
    p.set("lat", q.lat.toFixed(7));
    p.set("lng", q.lng.toFixed(7));
  }
  if (q.biasLat != null && q.biasLng != null) {
    p.set("biasLat", String(q.biasLat));
    p.set("biasLng", String(q.biasLng));
  }
  const res = await fetch(`/api/solar?${p.toString()}`);
  return res.json();
}

/** Largest roof segment by plausible size proxy (use the one most panels sit on). */
function dominantSegmentIndex(insights: BuildingInsights): number {
  const counts = new Map<number, number>();
  for (const panel of insights.solarPotential.solarPanels) {
    counts.set(panel.segmentIndex, (counts.get(panel.segmentIndex) ?? 0) + 1);
  }
  let best = 0, bestN = -1;
  for (const [seg, n] of counts) if (n > bestN) { best = seg; bestN = n; }
  return best;
}

/** Derive overridable form fields from Google Solar insights (augment, not replace). */
export function contextFromInsights(insights: BuildingInsights): Partial<ProjectContext> {
  const sp = insights.solarPotential;
  const seg = sp.roofSegmentStats[dominantSegmentIndex(insights)] ?? sp.roofSegmentStats[0];
  const maxKwp = Math.round((sp.maxArrayPanelsCount * sp.panelCapacityWatts) / 10) / 100; // kWp, 2 dp
  // Usable array area (what panels actually fit), not the whole-roof area — keeps capacity realistic.
  const usableArea = sp.maxArrayAreaMeters2 ?? sp.wholeRoofStats?.areaMeters2;
  return {
    roof_azimuth_deg: seg ? Math.round(seg.azimuthDegrees) : undefined,
    roof_tilt_deg: seg ? Math.round(seg.pitchDegrees) : undefined,
    roof_area_m2: usableArea ? Math.round(usableArea) : undefined,
    planned_pv_kwp: maxKwp || undefined,
  };
}
