# Ethiopian Maps SDK (Milestone 1 — Data Build Pipeline)

*   **Author:** amuif (Ibrahim)
*   **Status:** Approved
*   **Date:** 2026-11-22

--------------------------------------------------------------------------------

## Overview

The Ethiopian Maps SDK is an open-source vector map publishing suite that allows software developers and organizations in Ethiopia to display detailed digital maps in web and mobile applications without proprietary API keys, usage quotas, tracking, or foreign currency billing. Milestone 1 constructs the automated data build pipeline: transforming raw OpenStreetMap (OSM) extracts into single-file vector tile archives (PMTiles v3) via Planetiler, compiling Signed Distance Field (SDF) glyph stacks for Ge'ez and Latin scripts, providing an Amharic-English bilingual MapLibre style JSON, and delivering a client adapter that hot-swaps between local offline city slices and remote nationwide data.

## The Problem

Software teams developing digital services in Ethiopia—such as fintech applications, logistics platforms, and ride-hailing services—face steep barriers when integrating digital maps:

1. **Foreign Exchange and Payment Barrier:** Commercial map providers (e.g., Google Maps Platform, Mapbox, Gebeta Maps) require payments in foreign currency (USD) tied to international credit cards. Stringent foreign exchange controls enforced by the National Bank of Ethiopia prevent most domestic businesses and individual developers from paying recurring SaaS fees.
2. **Network Bandwidth and Intermittent Connectivity:** Mobile data across Ethiopia is metered and frequently subject to network intermittency. Standard raster or multi-file vector map setups require downloading thousands of individual image or vector files, resulting in high latency, failed network requests, and heavy data consumption.
3. **Inadequate Ge'ez and Amharic Typography:** Most global map styles prioritize Latin scripts or render Amharic text with broken font fallbacks and unreadable glyph scaling. Map rendering engines require pre-compiled Signed Distance Field (SDF) font stacks to render Ge'ez syllabics legibly across screen densities.
4. **Maintenance Overhead of Active Tile Servers:** Existing self-hosted solutions require running continuous server processes (such as TileServer GL, Martin, or database instances) which demand server management, RAM, and hosting costs.

The proposed solution provides a static, zero-daemon architecture: OpenStreetMap data is compiled once into PMTiles archives. Client apps query these archives directly via HTTP 206 byte-range requests from low-cost or zero-egress static storage (e.g., Cloudflare R2, MinIO, Nginx) or load them directly from mobile device storage (`file:///`) for 100% offline navigation.

## Goals

*   **Goal 1: Fully Automated Data Pipeline**: Create an automated pipeline using Planetiler to ingest `ethiopia-latest.osm.pbf` and generate a single nationwide `ethiopia.pmtiles` archive (zoom 0–14) within standard GitHub Actions hardware limits (under 7 GB RAM, under 15 minutes execution).
*   **Goal 2: Pre-Extracted City Packages**: Generate independent, lightweight PMTiles extracts for major Ethiopian urban centers (Addis Ababa, Dire Dawa, Hawassa, Bahir Dar, Mekelle, Adama) under 45 MB each for offline mobile app bundling.
*   **Goal 3: Comprehensive Ge'ez SDF Fontstack**: Compile and distribute pre-rendered Protocol Buffer glyphs (`.pbf`) combining Noto Sans Ethiopic and Noto Sans Latin covering all active Ethiopic Unicode ranges.
*   **Goal 4: Bilingual Amharic/English MapLibre Style**: Deliver a valid MapLibre Style Spec v8 document featuring a dual-script label cascade (`name:am` -> `name:en` -> `name`) and cartographic hierarchy prioritizing Ethiopian transit corridors, administrative borders (Kebele, Woreda, Zone), and civic POIs.
*   **Goal 5: Flicker-Free Local/Remote Protocol Adapter**: Provide a client adapter for MapLibre that resolves tile queries against a local bundled city archive when within bounds, and transparently falls back to remote HTTP range requests when panning out, without map rebuilds.
*   **Goal 6: Self-Hosted Verification Tooling**: Include a standalone diagnostic utility (`check-pmtiles`) to validate that a developer's static storage bucket emits required CORS and byte-range headers (`Accept-Ranges: bytes`, `Content-Range`).

## Non-Goals

*   **Non-Goal 1: Search and Geocoding Engines**: Decoupled from address search, reverse geocoding, and POI query backends (Nominatim / Photon).
*   **Non-Goal 2: Turn-by-Turn Routing**: Decoupled from road network graph solving and navigation engines (Valhalla / OSRM).
*   **Non-Goal 3: Central SaaS Tile Hosting or API Key Infrastructure**: The project maintainer will not operate multi-tenant tile servers, user registration systems, or billing gateways.
*   **Non-Goal 4: Real-Time Fleet Tracking and Live Traffic Overlays**: Dynamic GPS fleet aggregation and live congestion coloring are excluded from Milestone 1.
*   **Non-Goal 5: 3D Photogrammetric Mesh Models**: Aerial drone mesh models and Cesium 3D Tiles are deferred to future phases.

## Open Questions

*   **Question 1**: What is the optimal zoom level cutoff for the bundled city slices (e.g., z0–z14 vs z0–z15) to maintain file sizes under 40 MB while preserving detailed footpath and building footprint data?
*   **Question 2**: Which specific GeoJSON boundary definition should define the Addis Ababa metropolitan slice to ensure Sheger and the Bole Airport corridor are fully captured without including rural surrounding areas?

## Critical User Journeys (CUJs)

### CUJ 1: Developer Hosts Map on Zero-Egress Static Storage
*   **Given**: An Ethiopian software developer has an application needing map rendering and has provisioned a Cloudflare R2 bucket.
*   **When**: The developer downloads the published `ethiopia.pmtiles`, uploads it to R2, runs `check-pmtiles` to verify CORS headers, and initializes MapLibre GL with the custom PMTiles URL and bilingual style JSON.
*   **Then**: The map renders street-level vector data with Amharic and English labels, issuing standard HTTP byte-range requests for only the viewed tiles, incurring zero egress bandwidth fees.

### CUJ 2: Offline Mobile Delivery Application in Addis Ababa
*   **Given**: A delivery startup in Addis Ababa needs their mobile courier app to navigate within the city even during mobile internet outages.
*   **When**: The developer bundles `addis_ababa.pmtiles` directly into the mobile app's assets folder and initializes the SDK's composite protocol adapter pointing to the local file and a remote backup URL.
*   **Then**: Inside Addis Ababa, the map renders entirely from local device storage with zero network traffic. When a courier views delivery destinations outside the city bounds and has network connectivity, the map loads the national tiles over HTTP range requests without screen flicker.

--------------------------------------------------------------------------------

## Technical Plan (Architecture)

### 1. System Topology & Data Flow

The architecture operates strictly as a zero-daemon static publishing and consumption pipeline. The maintainer runs an automated build pipeline that converts OpenStreetMap source data into vector tile archives, font glyph chunks, and style definitions, and releases them as versioned assets. Adopters deploy these static assets to their own storage infrastructure and consume them via MapLibre GL.

```mermaid
flowchart TD
    subgraph Data_Pipeline [Data Build Pipeline]
        OSM[Geofabrik OSM PBF\nethiopia-latest.osm.pbf] --> PT[Planetiler Compiler\nOpenMapTiles Schema]
        PT --> PM_FULL[ethiopia.pmtiles\nZoom 0-14, ~250MB]
        PM_FULL --> SLICER[pmtiles extract\nGeoJSON City Polygons]
        SLICER --> CITIES[City PMTiles Slices\nAddis, Hawassa, etc. <45MB]
        
        TTF[Noto Sans Latin & Ethiopic TTFs] --> GLYPH_GEN[node-fontnik / fontmaker]
        GLYPH_GEN --> PBF_CHUNKS[SDF Glyphs\n/glyphs/{fontstack}/{range}.pbf]
        
        STYLE_SRC[Bilingual JSON & Sprites] --> STYLE_OUT[MapLibre style.json]
    end

    subgraph Distribution [Static Distribution Mirror]
        PM_FULL --> GHR[GitHub Releases\n& Adopter Static Storage R2/S3/Nginx]
        CITIES --> GHR
        PBF_CHUNKS --> GHR
        STYLE_OUT --> GHR
    end

    subgraph Client_App [Client Integration]
        GHR -.->|HTTP 206 Range Requests| ADAPTER[Composite PMTiles Adapter]
        LOCAL_BUNDLE[Local Bundled City PMTiles\ne.g. addis_ababa.pmtiles] --> ADAPTER
        ADAPTER --> MAPLIBRE[MapLibre GL JS / Native\nWeb, React Native, Flutter]
    end
```

---

### 2. Subsystem Specifications

#### 2.1 Vector Tile Build Pipeline (`/pipeline`)
* **Core Engine:** Planetiler (Java 21). Converts OSM nodes, ways, and relations into Mapbox Vector Tiles (MVT) encoded within a single PMTiles v3 container.
* **Schema Definition:** OpenMapTiles profile optimized for Ethiopian geography. Layers include `water`, `waterway`, `landuse`, `landcover`, `boundary`, `transportation`, `building`, `place`, and `poi`.
* **Memory Management:** To ensure reliable execution inside standard continuous integration runners (such as GitHub Actions with 7 GB available RAM), the Java process is launched with strict memory caps and storage mappings:
  ```bash
  java -Xmx6g -XX:+UseG1GC -jar planetiler.jar \
    --osm-path=ethiopia-latest.osm.pbf \
    --nodemap-type=sparsearray \
    --storage=mmap \
    --maxzoom=14 \
    --output=ethiopia.pmtiles
  ```
* **Metropolitan City Slicing:** Rather than re-running Planetiler for each city, the pipeline uses the `pmtiles` CLI utility to extract spatial slices from the nationwide archive using GeoJSON bounding polygons:
  ```bash
  pmtiles extract ethiopia.pmtiles addis_ababa.pmtiles --region=slices/addis_ababa.geojson
  ```
  City slices retain identical tile coordinates, schema layers, and zoom resolutions as the master national file, eliminating any discrepancy between local and remote rendering.

#### 2.2 Ge'ez & Latin SDF Glyph Generator (`/glyphs`)
* **Font Stacks:** Merges `Noto Sans Regular` / `Noto Sans Bold` with `Noto Sans Ethiopic Regular` / `Noto Sans Ethiopic Bold`.
* **Active Unicode Range Filtering:** Prunes unused unicode blocks to minimize static storage and distribution overhead. Compiles only:
  * Latin Basic & Extended (`U+0000`–`U+024F` -> chunks `0-255.pbf`, `256-511.pbf`)
  * Ethiopic Basic (`U+1200`–`U+137F` -> chunks `4608-4863.pbf`, `4864-5119.pbf`)
  * Ethiopic Supplement (`U+1380`–`U+139F` -> chunk `4864-5119.pbf`)
  * Ethiopic Extended (`U+2D80`–`U+2DDF` -> chunk `11520-11775.pbf`)
  * Ethiopic Extended-A (`U+AB00`–`U+AB2F` -> chunk `43776-44031.pbf`)
* **Output Hierarchy:** Emitted to `/glyphs/{fontstack}/{start}-{end}.pbf`. Each chunk is a standard 256-glyph SDF protocol buffer rendered with a 3px buffer and 8-bit signed distance values.

#### 2.3 Bilingual MapLibre Style Specification (`/styles`)
* **Standard:** MapLibre Style Specification v8.
* **Dual-Language Formatting:** Utilizes MapLibre `["format"]` expressions to render primary Amharic labels stacked above secondary English sub-labels:
  ```json
  [
    "format",
    ["coalesce", ["get", "name:am"], ["get", "name:en"], ["get", "name"]],
    { "font-scale": 1.0 },
    "\n",
    {},
    [
      "case",
      ["==", ["get", "name:en"], ["coalesce", ["get", "name:am"], ""]],
      "",
      ["coalesce", ["get", "name:en"], ""]
    ],
    { "font-scale": 0.8, "text-color": "#555555" }
  ]
  ```
* **Halo & Text Contrast:** Configures `text-halo-color: #FFFFFF`, `text-halo-width: 1.5` on vector landuse, and dark charcoal halo `#1E1E1E` on satellite or night modes, guaranteeing legibility of dense Ge'ez syllabics.
* **National Cartographic Hierarchy:**
  * Corridors: Prominent line widths and casing for primary routes: A1 (Addis–Djibouti), A2 (Addis–Mekelle), A7 (Modjo–Hawassa), and expressways.
  * Boundaries: Layer definitions for administrative level 4 (Regions), level 6 (Zones), and levels 8/9 (Woredas/Kebeles).
  * Icons: Vector sprites for Orthodox churches (`poi-church`), Mosques (`poi-mosque`), Protestant churches (`poi-protestant`), Bus terminals (`transit-bus-intercity`), and traditional markets (`poi-market`).

#### 2.4 Composite Local/Remote PMTiles Adapter (`/adapter`)
* **Objective:** Allow client apps to bundle a lightweight city archive (e.g. `addis_ababa.pmtiles`) for offline navigation while transparently streaming nationwide tiles from a remote bucket when the user moves outside the city, without flickering or re-initializing MapLibre.
* **Protocol Registration:** Registers custom protocol `pmtiles-composite` with MapLibre GL:
  ```typescript
  import { Protocol } from 'pmtiles';

  export class CompositePMTilesProtocol {
    private localSource?: PMTiles;
    private remoteSource: PMTiles;
    private localBBox?: [number, number, number, number];

    constructor(options: { localUrl?: string; remoteUrl: string; localBBox?: [number, number, number, number] }) {
      this.remoteSource = new PMTiles(options.remoteUrl);
      if (options.localUrl) {
        this.localSource = new PMTiles(options.localUrl);
        this.localBBox = options.localBBox;
      }
    }

    tile = async (params: { url: string }, abortController: AbortController) => {
      const { z, x, y } = parseTileCoordinates(params.url);
      if (this.localSource && this.isWithinBBox(z, x, y, this.localBBox)) {
        try {
          return await this.localSource.getZxy(z, x, y, abortController.signal);
        } catch {
          // If tile missing from local archive, fall through to remote
        }
      }
      return await this.remoteSource.getZxy(z, x, y, abortController.signal);
    };
  }
  ```

#### 2.5 Hosting Endpoint Diagnostic Utility (`/tools/check-pmtiles`)
* **Purpose:** Validates that an adopter's static storage bucket or web server is properly configured to serve PMTiles before client integration.
* **Validation Checks:**
  1. `HEAD` request: Verifies `Accept-Ranges: bytes` header is present.
  2. Byte-Range `GET` request (`Range: bytes=0-1023`): Verifies `HTTP 206 Partial Content` status and `Content-Range: bytes 0-1023/<total>`.
  3. CORS Validation: Verifies `Access-Control-Allow-Origin: *` (or target domain) and `Access-Control-Expose-Headers` includes `Content-Range`.
* **Output:** CLI and single-file HTML interface providing pass/fail indicators and copy-paste remediation configuration blocks for Cloudflare R2, AWS S3, Nginx, Caddy, and Apache.

---

### 3. Non-Functional Requirements

* **Performance & Footprint:**
  * Build pipeline runs under 15 minutes on standard GitHub Actions runners.
  * JVM memory ceiling strictly constrained to $\le$ 6 GB.
  * City extract files remain under 45 MB each.
  * Tile response latency over standard CDN/R2 endpoints $\le$ 150 ms for cached byte-ranges.
* **Security & Privacy:**
  * Zero client tracking, zero telemetry collection, zero API key tokens embedded in client distributions.
  * All map tiles are open-source and free of proprietary binary blobs.
* **Reliability & Rollback:**
  * CI builds run automated `pmtiles verify` checks against generated archives to validate header offsets and directory tables before tagging releases.
  * Releases are immutable and versioned as `vYYYY.MM.DD`. Adopter applications pin to specific release tags or self-hosted URLs, making rollbacks instantaneous.

--------------------------------------------------------------------------------

## Alternatives Considered

### Alternative 1: Monolithic Docker Bundle (Martin + TileServer GL + Nominatim + Valhalla)
* **Pros**: Single Docker Compose command delivers tiles, address search, and turn-by-turn routing out of the box.
* **Cons**: Demands substantial server hardware (minimum 8–16 GB RAM), ongoing cloud hosting bills, and complex server management; fails completely for mobile applications requiring offline operation without a network connection.
* **Reason for Rejection**: *Rejected by author: Monolithic server deployment imposes recurring infrastructure costs and maintenance complexity, directly contradicting the zero-central-service objective. Decoupling search and routing preserves developer focus on an ultra-lightweight, zero-daemon static vector tile architecture that runs offline.*

### Alternative 2: Tilemaker (C++) for Tile Generation
* **Pros**: Single compiled C++ executable with zero Java Virtual Machine (JVM) dependency.
* **Cons**: Substantially slower compilation times (30–60 minutes vs <5 minutes for Planetiler on regional extracts); higher memory volatility when parsing complex relation geometries in OpenStreetMap.
* **Reason for Rejection**: *Rejected by author: Planetiler compiles OpenMapTiles schemas 10x faster than Tilemaker and operates reliably within standard GitHub Actions runner memory boundaries (under 7 GB RAM) using memory-mapped sparse arrays.*

### Alternative 3: Runtime MapLibre Style Source Toggling
* **Pros**: Relies purely on standard MapLibre style JSON declarations without authoring a custom client JavaScript/TypeScript protocol adapter.
* **Cons**: Toggling the vector tile source URL dynamically when the map viewport moves beyond city boundaries forces MapLibre to destroy and recreate the tile cache, causing jarring visual canvas flickering, black screen frames, and dropped render cycles.
* **Reason for Rejection**: *Rejected by author: Modifying style sources at runtime causes unacceptable canvas tearing and poor developer ergonomics. A composite PMTiles protocol adapter intercepts tile requests at the network layer, resolving tiles locally or streaming them remotely with zero visual interruption.*

### Alternative 4: Algorithmic Phonetic Transliteration for Missing Amharic Tags
* **Pros**: Automatically synthesizes Amharic labels for secondary roads and towns that only contain Latin `name:en` tags in OpenStreetMap.
* **Cons**: Rule-based English-to-Amharic phonetic transliteration without a verified geographic gazetteer frequently generates linguistically absurd, inaccurate, or culturally improper Amharic spellings; introduces brittle algorithmic overhead into the tile build pipeline.
* **Reason for Rejection**: *Rejected by author: Automated transliteration produces frequent spelling inaccuracies for Ethiopian place names. A deterministic style-layer fallback cascade (`name:am` -> `name:en` -> `name`) is vastly superior to displaying mangled Amharic labels.*

### Alternative 5: Proprietary Font Stacks
* **Pros**: Allows unique commercial branding and stylized typography.
* **Cons**: Imposes licensing restrictions, lacks complete coverage of Ethiopic Unicode Extension blocks (U+2D80–U+2DDF, U+AB00–U+AB2F), and introduces cross-platform font rendering inconsistencies.
* **Reason for Rejection**: *Rejected by author: Google Noto Sans and Noto Sans Ethiopic provide full, standard-compliant Unicode coverage under the Open Font License (OFL), guaranteeing open distribution and consistent rendering across web, iOS, and Android.*

--------------------------------------------------------------------------------

## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. `.github/workflows/build-tiles.yml` (Create)
* **Type / Scope**: CI/CD Automation Workflow
* **Proposed Changes**: Defines a scheduled weekly GitHub Actions job (`schedule: cron '0 2 * * 0'`) and manual dispatch trigger. Installs Java 21, fetches `ethiopia-latest.osm.pbf` from Geofabrik, invokes Planetiler with memory caps (`-Xmx6g`), verifies archive integrity using `pmtiles verify`, slices metropolitan city extracts using `slices.json`, and attaches artifacts to a GitHub Release tagged `vYYYY.MM.DD`.

#### 2. `.github/workflows/build-glyphs.yml` (Create)
* **Type / Scope**: CI/CD Automation Workflow
* **Proposed Changes**: Defines a GitHub Actions job triggered on font changes or manual dispatch. Sets up Node.js 20, builds Ge'ez and Latin SDF `.pbf` glyph files, validates that all active Unicode blocks are generated, packages glyphs into a tarball, and publishes to GitHub Pages and release assets.

#### 3. `pipeline/planetiler.properties` (Create)
* **Type / Scope**: Data Pipeline Configuration
* **Proposed Changes**: Configures Planetiler runtime options: OpenMapTiles profile selection, zoom level limits (`minzoom=0`, `maxzoom=14`), JVM sparse array node mapping (`nodemap-type=sparsearray`), and spatial bounding box boundaries for Ethiopia (`min_lon=32.99`, `min_lat=3.40`, `max_lon=47.98`, `max_lat=14.89`).

#### 4. `pipeline/slices.json` (Create)
* **Type / Scope**: Spatial Data Configuration
* **Proposed Changes**: GeoJSON FeatureCollection defining exact bounding polygons for the six metropolitan city extracts:
  1. Addis Ababa (including Sheger urban fringe and airport corridor)
  2. Dire Dawa
  3. Hawassa
  4. Bahir Dar & Gondar
  5. Mekelle
  6. Adama / Bishoftu

#### 5. `pipeline/scripts/fetch-osm.sh` (Create)
* **Type / Scope**: Shell Build Script
* **Proposed Changes**: Downloads `ethiopia-latest.osm.pbf` and `ethiopia-latest.osm.pbf.md5` from Geofabrik, verifies MD5 checksum integrity, and halts with actionable error messaging if network transmission fails.

#### 6. `pipeline/scripts/generate-tiles.sh` (Create)
* **Type / Scope**: Shell Build Script
* **Proposed Changes**: Downloads the pinned Planetiler release JAR and executes the tile build with `--storage=mmap` and `--nodemap-type=sparsearray`, outputting `ethiopia.pmtiles`. Runs `pmtiles verify ethiopia.pmtiles` upon completion.

#### 7. `pipeline/scripts/slice-cities.sh` (Create)
* **Type / Scope**: Shell Build Script
* **Proposed Changes**: Parses `pipeline/slices.json` using `jq` and runs `pmtiles extract ethiopia.pmtiles <city>.pmtiles --region=<geojson_polygon>` for each city feature, generating individual city PMTiles archives.

#### 8. `glyphs/fonts/` (Create)
* **Type / Scope**: Font Source Assets (OFL)
* **Proposed Changes**: Bundles open-source TrueType font sources:
  * `NotoSans-Regular.ttf` & `NotoSans-Bold.ttf`
  * `NotoSansEthiopic-Regular.ttf` & `NotoSansEthiopic-Bold.ttf`

#### 9. `glyphs/package.json` & `glyphs/build-glyphs.js` (Create)
* **Type / Scope**: Node.js Script & Dependencies
* **Proposed Changes**: Script ingesting source TTFs and generating Signed Distance Field (SDF) glyph stacks via `@mapbox/glyph-pbf-composite`. Filters generation strictly to active Latin and Ethiopic ranges (chunks `0-255`, `256-511`, `4608-4863`, `4864-5119`, `11520-11775`, `43776-44031`), writing outputs to `/glyphs/dist/{fontstack}/{start}-{end}.pbf`.

#### 10. `styles/ethiopia-bilingual.json` (Create)
* **Type / Scope**: MapLibre Style Specification v8
* **Proposed Changes**: The primary cartographic style. Configures vector sources pointing to PMTiles, background landuse/water styling, elevated road casing for Ethiopian trunk routes (A1–A8), Kebele/Woreda/Zone boundary styling, and `["format"]` text expressions rendering Amharic primary labels above English secondary labels with white/charcoal halos.

#### 11. `styles/ethiopia-amharic.json` (Create)
* **Type / Scope**: MapLibre Style Specification v8
* **Proposed Changes**: Single-script Amharic style variant tailored for domestic civic and public-sector applications where English sub-labels are not required.

#### 12. `styles/sprites/` (Create)
* **Type / Scope**: Icon Vector & Raster Sprites
* **Proposed Changes**: `sprite.png`, `sprite.json`, `sprite@2x.png`, and `sprite@2x.json` defining custom map icons for Ethiopian religious landmarks (churches, mosques), inter-city bus hubs, and market areas.

#### 13. `adapter/package.json` & `adapter/tsconfig.json` (Create)
* **Type / Scope**: TypeScript Library Project
* **Proposed Changes**: Configures the `@ethiopiamaps/adapter` client library package, setting dependencies on `maplibre-gl` and `pmtiles`, configuring ES module exports and TypeScript compilation targets.

#### 14. `adapter/src/index.ts` (Create)
* **Type / Scope**: TypeScript Implementation
* **Proposed Changes**: Implements `CompositePMTilesProtocol` class. Implements logic to check if requested tile coordinates `(z, x, y)` intersect the local city bounding box; fetches from local `File` or `Blob` if present, otherwise transparently issues an HTTP range request to the remote nationwide URL. Provides helper function `registerCompositeProtocol(maplibregl, options)`.

#### 15. `tools/check-pmtiles/index.html` (Create)
* **Type / Scope**: Web Client Diagnostic Tool
* **Proposed Changes**: Single-page browser diagnostic testbench. Accepts a developer's PMTiles URL, makes HEAD and byte-range GET requests (`Range: bytes=0-1023`), tests CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Expose-Headers`), and displays green/red status badges with copy-paste remediation instructions for common cloud storage providers.

#### 16. `tools/check-pmtiles/cli.sh` (Create)
* **Type / Scope**: CLI Diagnostic Script
* **Proposed Changes**: Portable Bash/curl script that tests a remote URL for `Accept-Ranges: bytes`, `HTTP/1.1 206 Partial Content`, and `Content-Range`, printing diagnostic pass/fail messages to the terminal.

#### 17. `examples/web-vanilla/index.html` (Create)
* **Type / Scope**: Reference Web Integration
* **Proposed Changes**: Complete, self-contained HTML page loading MapLibre GL JS, registering the composite protocol, and rendering the bilingual map style using Addis Ababa city tiles locally with remote streaming fallback.

#### 18. `docs/hosting-guide.md` (Create)
* **Type / Scope**: Documentation
* **Proposed Changes**: Practical deployment instructions and copy-paste configuration snippets for:
  * Cloudflare R2 (zero egress fees, CORS JSON policy)
  * AWS S3 (Bucket CORS policy, byte-range handling)
  * Nginx / Caddy / Apache (reverse proxy and static range headers)
  * MinIO (local self-hosted S3-compatible deployment)

#### 19. `docs/offline-guide.md` (Create)
* **Type / Scope**: Documentation
* **Proposed Changes**: Guide detailing how mobile developers embed `addis_ababa.pmtiles` directly into Android `assets/`, iOS application bundles, or Flutter asset manifests, and register the local file path with MapLibre Native.

#### 20. `README.md` (Create/Update)
* **Type / Scope**: Repository Documentation
* **Proposed Changes**: Monorepo root README containing project overview, quickstart instructions, repository architecture diagram, sample code, and links to the latest GitHub Releases.

---

### Verification Plan

#### 1. Pipeline & Archive Integrity
* **Validation Command:** `pmtiles verify ethiopia.pmtiles`
* **Success Criteria:** Zero directory corruption errors; valid header offsets; zoom levels present from z0 through z14.
* **City Slice Validation:** Run `pmtiles verify` against each generated city slice; verify each slice is under 45 MB in size.

#### 2. Glyph Coverage Testing
* **Validation Script:** Run automated assertion script `node glyphs/test-coverage.js` verifying that all Unicode character codes present in `ethiopia-latest.osm.pbf` exist in the compiled `.pbf` ranges.
* **Success Criteria:** Zero missing character glyph warnings.

#### 3. MapLibre Style Specification Conformance
* **Validation Command:** `pnpm exec gl-style-validate styles/ethiopia-bilingual.json`
* **Success Criteria:** Exit code 0; zero style syntax errors or unsupported format expressions.

#### 4. End-to-End Browser Smoke Test
* **Test Driver:** Playwright automated test script loading `examples/web-vanilla/index.html`.
* **Assertions:**
  1. Map loads to `load` event within 2.5 seconds.
  2. Bounding box coordinates around Addis Ababa (`[38.74, 9.01]`) render vector road networks and bilingual labels.
  3. Network inspection confirms zero failed tile requests (HTTP status 200 or 206 only).
  4. Panning map outside Addis Ababa bounds triggers remote range requests without JavaScript errors.

#### 5. Diagnostic Tool Self-Test
* **Test Command:** Execute `tools/check-pmtiles/cli.sh` against a sample GitHub Releases PMTiles asset and a simulated invalid server (missing CORS).
* **Success Criteria:** Accurately reports pass for valid byte-range endpoint and fail with actionable instructions for misconfigured endpoint.

--------------------------------------------------------------------------------

*Drafted with EGM*
