# Ethiopian Maps SDK

An open-source, sovereign, and decentralized geospatial platform and publishing pipeline engineered specifically for the Ethiopian developer and institutional ecosystem.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Build Tiles](https://github.com/amuif/ethiopian-maps-sdk/actions/workflows/build-tiles.yml/badge.svg)](.github/workflows/build-tiles.yml)
[![MapLibre](https://img.shields.io/badge/Renderer-MapLibre_GL-brightgreen.svg)](https://maplibre.org/)

---

## The Vision & Core Pillars

1. **Zero Foreign Exchange (USD) Dependency:** Commercial map providers (Google Maps, Mapbox) charge recurring USD fees requiring international credit cards unavailable to 95% of domestic startups. This project distributes vector maps as static single-file **PMTiles (v3)** archives with **zero API keys, zero central service, and zero usage billing**.
2. **First-Class Ge'ez & Bilingual Typography:** Native rendering of Ge'ez syllabics alongside Latin script via pre-compiled Signed Distance Field (SDF) protocol buffers, coupled with an Amharic-first fallback cascade (`name:am` -> `name:en` -> `name`).
3. **Decentralized "Bring Your Own Bucket" (BYOB):** Deploy `ethiopia.pmtiles` to any low-cost, zero-egress static storage (Cloudflare R2, MinIO, or standard Nginx). Client apps query tiles directly using HTTP 206 Byte-Range requests (`Range: bytes=...`).
4. **Offline Mobile Operability:** Bundle lightweight metropolitan slices (< 45 MB) directly into Android, iOS, and Flutter apps for 100% disconnected offline navigation.

---

## Architectural Topology

```text
OpenStreetMap Data (Geofabrik)
       │
       ▼
Planetiler Engine (Java 21, OpenMapTiles Schema)
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
ethiopia.pmtiles (Nationwide, z0-z14)   pmtiles extract (GeoJSON Polygons)
       │                                 │
       ▼                                 ▼
Static Hosting (Cloudflare R2 / Nginx)  City Slices (Addis, Hawassa, etc. <45MB)
       │                                 │
       └────────────────┬────────────────┘
                        ▼
           @ethiopiamaps/adapter
          (Composite PMTiles Protocol)
                        │
                        ▼
       MapLibre GL (Web, React Native, Flutter, Android, iOS)
```

---

## Available Metropolitan Extracts

In addition to the nationwide `ethiopia.pmtiles` archive, the pipeline automatically compiles discrete city slices under 45 MB:

| Extract Package | Region / City | Description | Target Size |
| :--- | :--- | :--- | :---: |
| `addis_ababa.pmtiles` | Addis Ababa & Sheger | Capital metropolitan perimeter, Bole Airport, Sheger fringe | ~35 MB |
| `dire_dawa.pmtiles` | Dire Dawa | Chartered city & Eastern logistics corridor | ~15 MB |
| `hawassa.pmtiles` | Hawassa | Southern industrial & lakefront economic zone | ~15 MB |
| `bahir_dar.pmtiles` | Bahir Dar | Lake Tana southern shore & regional commercial hub | ~18 MB |
| `gondar.pmtiles` | Gondar | Historical cultural center & Northern commercial hub | ~15 MB |
| `mekelle.pmtiles` | Mekelle | Tigray regional hub & transit junctions | ~15 MB |
| `adama.pmtiles` | Adama & Bishoftu | Industrial expressway corridor & Nazret commercial center | ~20 MB |

---

## Quickstart (React)

```bash
# 1. Start the local development server (Node.js, zero Python required)
pnpm install && pnpm start
```

Or embed the React component directly in your React application:

```jsx
import React, { useState } from 'react';
import EthiopiaMap, { CITIES } from './EthiopiaMap';

export default function App() {
  const [city, setCity] = useState('addis_ababa');

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <EthiopiaMap
        styleType="bilingual"
        selectedCity={city}
      />
    </div>
  );
}
```

---

## Repository Structure

```
ethiopian-maps-sdk/
├── .github/workflows/
│   ├── build-tiles.yml          # Automated weekly tile pipeline
│   └── build-glyphs.yml         # Font generation & release workflow
├── pipeline/
│   ├── planetiler.properties    # OpenMapTiles tuning & memory caps
│   ├── slices.json              # GeoJSON boundaries for Ethiopian cities
│   └── scripts/
│       ├── fetch-osm.sh         # Geofabrik OSM downloader & checksum verifier
│       ├── generate-tiles.sh    # Planetiler execution script
│       └── slice-cities.sh      # Spatial city extraction script
├── glyphs/
│   ├── fonts/                   # Noto Sans Ethiopic & Latin source TTFs (OFL)
│   ├── build-glyphs.js          # SDF Protocol Buffer generator
│   └── test-coverage.js         # Unicode character coverage assertion test
├── styles/
│   ├── ethiopia-bilingual.json  # Master bilingual style (Amharic + English)
│   ├── ethiopia-amharic.json    # Amharic-only style for civic applications
│   └── sprites/                 # POI vector/raster sprites (churches, mosques)
├── adapter/
│   ├── src/index.ts             # Composite local/remote PMTiles adapter
│   ├── package.json             # @ethiopiamaps/adapter package definition
│   └── tsconfig.json            # TypeScript build configuration
├── react-native/
│   ├── src/index.tsx            # <EthiopiaMap> for @maplibre/maplibre-react-native
│   └── src/style.ts             # Style builder for remote or file:// archives
├── services/                    # @ethiopiamaps/services: search & routing clients
├── stack/
│   └── docker-compose.yml       # Tiles + Nominatim search + Valhalla routing
├── tools/
│   └── check-pmtiles/
│       ├── cli.sh               # Terminal CORS & byte-range validator
│       └── index.html           # Web diagnostic interface
├── examples/
│   ├── web-react/               # Modern React map viewer application
│   ├── expo/                    # Expo (React Native) dev-build demo
│   └── web-vanilla/             # Minimal vanilla HTML/JS reference
└── docs/
    ├── hosting-guide.md         # Deployment on Cloudflare R2, S3, Nginx, MinIO
    ├── offline-guide.md         # Mobile offline embedding (Android, iOS, Flutter)
    └── designs/
        └── ethiopian_maps_sdk.md # Approved technical design document
```

---

## Validating Your Storage Endpoint

To verify that your Cloudflare R2 bucket or Nginx server emits the necessary CORS and byte-range headers (`HTTP 206`, `Accept-Ranges: bytes`, `Content-Range`):

```bash
bash tools/check-pmtiles/cli.sh https://tiles.yourdomain.et/ethiopia.pmtiles
```

---

## Documentation

* [Self-Hosting Guide](docs/hosting-guide.md): Deploying on Cloudflare R2, AWS S3, Nginx, and MinIO.
* [Mobile Offline Guide](docs/offline-guide.md): Bundling PMTiles into Android, iOS, Flutter and React Native.
* [3D Buildings & Terrain](docs/3d-guide.md): Extruded buildings and Copernicus terrain on web and React Native.
* [Self-Hosted Stack](docs/stack-guide.md): One-command Docker bundle for tiles, search and routing, plus the `@ethiopiamaps/services` client.
* [Design Document](docs/designs/ethiopian_maps_sdk.md): Approved technical specification.

---

## Licensing

* **Source Code:** [MIT License](LICENSE)
* **Map Data:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).
* **Typography:** [Noto Sans & Noto Sans Ethiopic](glyphs/fonts/OFL.txt) licensed under the [SIL Open Font License (OFL)](http://scripts.sil.org/OFL).
