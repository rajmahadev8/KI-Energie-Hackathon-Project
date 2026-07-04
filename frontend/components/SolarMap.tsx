"use client";
// Google Solar satellite + panel overlay and 3D building view. The number of panels drawn is
// controlled by `panelCount` (driven by the configurator variant the user selects).
// Adapted from aditya-ladawa/solarPV (credited in README).
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import type { BuildingInsights, SolarLatLng } from "@/lib/types";

const MAP_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";
const RANGE_3D = 240;

function panelEnergyColor(energy: number, min: number, max: number) {
  const v = max === min ? 1 : Math.max(0, Math.min(1, (energy - min) / (max - min)));
  return `hsl(${205 - v * 165} 95% 55%)`;
}

export default function SolarMap({
  insights, location, panelCount, onPickPoint, lang = "de",
}: {
  insights: BuildingInsights | null;
  location?: SolarLatLng | null;
  panelCount: number;
  onPickPoint?: (lat: number, lng: number) => void;
  lang?: "de" | "en";
}) {
  const [viewMode, setViewMode] = useState<"panels" | "3d">("panels");
  const [ready, setReady] = useState(false);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const map3dElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map3dRef = useRef<any>(null);
  const polysRef = useRef<google.maps.Polygon[]>([]);
  const boundsRef = useRef<google.maps.Rectangle | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const panels3dRef = useRef<any[]>([]);
  const pickRef = useRef(onPickPoint);
  pickRef.current = onPickPoint;

  const maxPanels = insights?.solarPotential.solarPanels.length ?? 0;
  const selected = Math.min(panelCount, maxPanels);

  // --- init 2D map ---
  useEffect(() => {
    if (!MAP_KEY || !mapElRef.current || mapRef.current) return;
    setOptions({ key: MAP_KEY, v: "alpha", libraries: ["geometry"], mapIds: [MAP_ID] });
    Promise.all([importLibrary("maps"), importLibrary("geometry")]).then(([maps]) => {
      if (!mapElRef.current || mapRef.current) return;
      const map = new maps.Map(mapElRef.current, {
        center: { lat: location?.latitude ?? 52.2799, lng: location?.longitude ?? 10.5236 },
        zoom: 20, mapId: MAP_ID, mapTypeId: "satellite",
        tilt: 0, mapTypeControl: false, fullscreenControl: false, streetViewControl: false,
      });
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng && pickRef.current) pickRef.current(e.latLng.lat(), e.latLng.lng());
      });
      mapRef.current = map;
      setReady(true);
    }).catch(() => setReady(false));
  }, [location?.latitude, location?.longitude]);

  // --- init 3D map ---
  useEffect(() => {
    if (!MAP_KEY || !map3dElRef.current || map3dRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Promise.all([importLibrary("maps3d") as any, importLibrary("geometry")]).then(([maps3d]) => {
      if (!map3dElRef.current || map3dRef.current) return;
      const m3 = new maps3d.Map3DElement({
        center: { lat: location?.latitude ?? 52.2799, lng: location?.longitude ?? 10.5236, altitude: 0 },
        range: RANGE_3D, tilt: 67, mode: maps3d.MapMode.SATELLITE, mapId: MAP_ID, defaultUIHidden: true,
      });
      m3.style.height = "100%"; m3.style.width = "100%"; m3.style.display = "block";
      m3.addEventListener("gmp-click", (event: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pos = (event as any).position;
        if (pos && pickRef.current) pickRef.current(pos.lat, pos.lng);
      });
      map3dElRef.current.append(m3);
      map3dRef.current = m3;
    }).catch(() => { /* 3D unavailable → 2D only */ });
  }, [location?.latitude, location?.longitude]);

  // --- recenter on location change ---
  useEffect(() => {
    if (!location) return;
    mapRef.current?.setCenter({ lat: location.latitude, lng: location.longitude });
    mapRef.current?.setZoom(20);
    const m3 = map3dRef.current;
    if (m3) { m3.center = { lat: location.latitude, lng: location.longitude, altitude: 0 }; m3.range = RANGE_3D; m3.tilt = 67; }
  }, [location?.latitude, location?.longitude]);

  // --- draw 2D panels ---
  useEffect(() => {
    polysRef.current.forEach((p) => p.setMap(null));
    polysRef.current = [];
    boundsRef.current?.setMap(null);
    boundsRef.current = null;
    const map = mapRef.current;
    if (viewMode !== "panels" || !map || !insights || !google.maps?.geometry?.spherical) return;

    const { solarPanels, roofSegmentStats, panelWidthMeters, panelHeightMeters } = insights.solarPotential;
    const energies = solarPanels.map((p) => p.yearlyEnergyDcKwh);
    const minE = Math.min(...energies), maxE = Math.max(...energies);
    solarPanels.slice(0, selected).forEach((panel) => {
      const seg = roofSegmentStats[panel.segmentIndex] || roofSegmentStats[0];
      const hw = panelWidthMeters / 2, hh = panelHeightMeters / 2;
      const orient = panel.orientation === "PORTRAIT" ? 90 : 0;
      const az = seg?.azimuthDegrees || 0;
      const center = { lat: panel.center.latitude, lng: panel.center.longitude };
      const corners = [
        { x: hw, y: hh }, { x: hw, y: -hh }, { x: -hw, y: -hh }, { x: -hw, y: hh },
      ].map(({ x, y }) =>
        google.maps.geometry.spherical.computeOffset(center, Math.sqrt(x * x + y * y),
          Math.atan2(y, x) * (180 / Math.PI) + orient + az));
      polysRef.current.push(new google.maps.Polygon({
        paths: corners, strokeColor: "#f8fafc", strokeOpacity: 1, strokeWeight: 1,
        fillColor: panelEnergyColor(panel.yearlyEnergyDcKwh, minE, maxE), fillOpacity: 0.92, map,
      }));
    });
    if (insights.boundingBox) {
      boundsRef.current = new google.maps.Rectangle({
        bounds: {
          south: insights.boundingBox.sw.latitude, west: insights.boundingBox.sw.longitude,
          north: insights.boundingBox.ne.latitude, east: insights.boundingBox.ne.longitude,
        },
        strokeColor: "#facc15", strokeOpacity: 0.9, strokeWeight: 2, fillColor: "#facc15", fillOpacity: 0.06, map,
      });
      const b = boundsRef.current.getBounds();
      if (b) map.fitBounds(b, 70);
    }
  }, [insights, ready, selected, viewMode]);

  // --- draw 3D panels ---
  useEffect(() => {
    const m3 = map3dRef.current;
    panels3dRef.current.forEach((p) => p.remove());
    panels3dRef.current = [];
    if (!m3 || viewMode !== "3d" || !insights || !google.maps?.geometry?.spherical) return;
    const { solarPanels, roofSegmentStats, panelWidthMeters, panelHeightMeters } = insights.solarPotential;
    const energies = solarPanels.map((p) => p.yearlyEnergyDcKwh);
    const minE = Math.min(...energies), maxE = Math.max(...energies);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g3 = (google.maps as any).maps3d;
    solarPanels.slice(0, selected).forEach((panel, index) => {
      const seg = roofSegmentStats[panel.segmentIndex] || roofSegmentStats[0];
      const hw = (panel.orientation === "PORTRAIT" ? panelHeightMeters : panelWidthMeters) / 2;
      const hh = (panel.orientation === "PORTRAIT" ? panelWidthMeters : panelHeightMeters) / 2;
      const az = seg?.azimuthDegrees || 0;
      const center = { lat: panel.center.latitude, lng: panel.center.longitude };
      const altitude = 0.75 + index * 0.002;
      const path = [
        { x: hw, y: hh }, { x: hw, y: -hh }, { x: -hw, y: -hh }, { x: -hw, y: hh },
      ].map(({ x, y }) => {
        const along = google.maps.geometry.spherical.computeOffset(center, y, az);
        const corner = google.maps.geometry.spherical.computeOffset(along, x, az + 90);
        return { lat: corner.lat(), lng: corner.lng(), altitude };
      });
      const poly = new g3.Polygon3DElement({
        path, altitudeMode: g3.AltitudeMode.RELATIVE_TO_MESH,
        fillColor: panelEnergyColor(panel.yearlyEnergyDcKwh, minE, maxE),
        strokeColor: "#ecfeff", strokeWidth: 1.2, drawsOccludedSegments: false, geodesic: false, zIndex: index + 1,
      });
      panels3dRef.current.push(poly);
      m3.append(poly);
    });
  }, [insights, selected, viewMode]);

  if (!MAP_KEY) return null; // parent renders the Leaflet fallback

  const de = lang === "de";
  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-lg border border-slate-200 sm:h-[560px]">
      <div className={`absolute inset-0 ${viewMode === "panels" ? "z-10" : "z-0 opacity-0 pointer-events-none"}`} ref={mapElRef} />
      <div className={`absolute inset-0 ${viewMode === "3d" ? "z-10" : "z-0 opacity-0 pointer-events-none"}`} ref={map3dElRef} />
      <div className="absolute right-2 top-2 z-20 flex gap-1 rounded-lg bg-white/90 p-1 shadow">
        {(["panels", "3d"] as const).map((m) => (
          <button key={m} onClick={() => setViewMode(m)}
            className={`rounded px-2 py-1 text-xs font-medium ${viewMode === m ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {m === "panels" ? (de ? "Satellit" : "Satellite") : "3D"}
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 z-20 rounded bg-black/55 px-2 py-1 text-[10px] text-white">
        {selected}/{maxPanels} {de ? "Module" : "panels"} · {de ? "Klick aufs Dach zum Justieren" : "click roof to pinpoint"}
      </div>
    </div>
  );
}
