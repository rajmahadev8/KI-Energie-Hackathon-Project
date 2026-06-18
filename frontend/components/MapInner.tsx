"use client";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Circle, Tooltip as LTooltip } from "react-leaflet";

export default function MapInner({ lat, lon, label }: { lat: number; lon: number; label?: string }) {
  return (
    <MapContainer center={[lat, lon]} zoom={18} scrollWheelZoom={false} style={{ height: 260, width: "100%", borderRadius: 8 }}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle center={[lat, lon]} radius={18} pathOptions={{ color: "#0d9488", fillColor: "#0d9488", fillOpacity: 0.3 }}>
        {label && <LTooltip>{label}</LTooltip>}
      </Circle>
    </MapContainer>
  );
}
