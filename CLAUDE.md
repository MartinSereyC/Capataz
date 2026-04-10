@AGENTS.md

## Project Summary
Capataz: Chilean land parcel monitoring via satellite imagery. Upload land deed PDF → extract coordinates → view parcel on map with Sentinel-2 imagery over 6 months. All UI in Spanish.

## Tech Stack
| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Maps | Leaflet + react-leaflet + Geoman (manual draw) |
| Satellite | Copernicus Data Space / Sentinel Hub (sentinel-2-l2a) |
| Geo | proj4 (UTM↔WGS84) |
| PDF | pdf-parse |
| Styling | Tailwind CSS 4 |
| Testing | Vitest |

## File Index (src/)
**Pages:** app/page.tsx (upload), app/resultado/page.tsx (map view)
**API Routes:** app/api/parse-deed/route.ts, app/api/satellite-dates/route.ts, app/api/sentinel-token/route.ts, app/api/health/route.ts
**Map Components:** components/map/MapContainer.tsx, components/map/LeafletMap.tsx, components/map/ParcelPolygon.tsx, components/map/SatelliteLayer.tsx, components/map/ManualDraw.tsx
**Controls:** components/controls/TimeSlider.tsx, components/controls/ImageInfo.tsx
**Upload:** components/upload/UploadZone.tsx, components/upload/ProgressSteps.tsx
**Hooks:** hooks/useParcelUpload.ts, hooks/useSatelliteDates.ts
**Context:** context/ParcelContext.tsx
**Geo Lib:** lib/geo/utm-converter.ts, lib/geo/polygon-builder.ts, lib/geo/validation.ts
**PDF Lib:** lib/pdf/extract-text.ts, lib/pdf/parse-coordinates.ts
**Sentinel Lib:** lib/sentinel/auth.ts, lib/sentinel/dates.ts, lib/sentinel/mock.ts, lib/sentinel/process-layer.ts
**Config:** lib/constants.ts, lib/i18n/es.ts
**Types:** types/index.ts

## Architecture Decisions
- BBox convention: [minLng, minLat, maxLng, maxLat] (GeoJSON standard) everywhere. Leaflet conversion only at component level.
- Coordinate flow: PDF text → parseCoordinates() → UTM pairs → utmPairsToWGS84() → buildPolygon() → Parcel object
- Mock mode: MOCK_SENTINEL=true bypasses all Sentinel API calls with synthetic data
- State: React Context (ParcelContext) — no external state library
- i18n: Single es.ts file with all Spanish strings
- Chile-only: Coordinates validated against Chile bounds (lat -56 to -17, lng -76 to -66)

## Copernicus API Endpoints
- Token: https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token
- Catalog: https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search
- Process: https://sh.dataspace.copernicus.eu/api/v1/process
- Collection: sentinel-2-l2a
- Env vars: SENTINEL_HUB_CLIENT_ID, SENTINEL_HUB_CLIENT_SECRET, MOCK_SENTINEL

## Environment Variables
| Variable | Purpose |
|---|---|
| SENTINEL_HUB_CLIENT_ID | Copernicus OAuth2 client ID |
| SENTINEL_HUB_CLIENT_SECRET | Copernicus OAuth2 client secret |
| MOCK_SENTINEL | "true" to bypass real API calls |
