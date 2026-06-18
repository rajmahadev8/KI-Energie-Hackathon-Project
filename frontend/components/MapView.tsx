"use client";
import dynamic from "next/dynamic";

// Leaflet touches `window`, so the map is client-only (ssr: false inside a client component).
const MapInner = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => <div className="h-[260px] w-full animate-pulse rounded-lg bg-slate-100" />,
});

export function MapView({ lat, lon, label }: { lat?: number | null; lon?: number | null; label?: string }) {
  if (lat == null || lon == null) {
    return <div className="flex h-[120px] items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-400">Adresse eingeben für die Kartenansicht</div>;
  }
  return <MapInner lat={lat} lon={lon} label={label} />;
}
