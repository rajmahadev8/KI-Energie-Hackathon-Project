# Credits & third-party integrations

This prototype integrates work from two other KI-Hackathon Energie '26 repositories:

- **Google Solar building viewer** — `aditya-ladawa/solarPV`
  (https://github.com/aditya-ladawa/solarPV).
  Adapted: the Google Solar `buildingInsights:findClosest` route (geocoding + solar potential +
  mock fallback) → `frontend/app/api/solar/route.ts`, and the satellite/3D panel-overlay map logic
  → `frontend/components/SolarMap.tsx`.

- **PV chat widget** — `UtkarshMidha/KI-Energie-Hackathon-Project`
  (https://github.com/UtkarshMidha/KI-Energie-Hackathon-Project).
  Adapted: the floating chatbot → `frontend/components/ChatBot.tsx` (it reuses our existing
  `/answer` engine; no backend change).

External services/data: Google Solar API, Google Maps JavaScript API (incl. experimental Map3D),
Google Geocoding API; OpenStreetMap/Nominatim (keyless fallback); OpenRouter (LLM).
