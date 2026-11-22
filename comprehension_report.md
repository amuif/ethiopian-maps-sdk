## 1. Paraphrase of Feature Specification (FeatureRange)

### What this proposes
[ethiopian_maps_sdk.md#L1-L238](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L1-L238) proposes Milestone 1 of an open-source, zero-daemon vector map publishing pipeline and client integration kit tailored for Ethiopian developers. It compiles OpenStreetMap data into a single nationwide PMTiles v3 archive using Planetiler, slices out lightweight offline packages (<45 MB) for major Ethiopian cities, builds a pruned Signed Distance Field (SDF) glyph stack for Latin and Ge'ez scripts, and provides an Amharic-English bilingual MapLibre style document. Consumers host these static files on low-cost or zero-egress static web storage (such as Cloudflare R2 or MinIO) and query them via HTTP 206 byte-range requests or local storage using a custom client adapter that hot-swaps between offline city slices and remote nationwide data without visual canvas tearing.

### How the existing system works, per this document
According to the document, digital mapping in Ethiopia currently relies on commercial SaaS providers (such as Google Maps Platform, Mapbox, or Gebeta Maps) or self-hosted dynamic tile servers (TileServer GL, Martin). Commercial providers require recurring foreign currency (USD) payments via international credit cards that local organizations cannot pay due to National Bank of Ethiopia foreign exchange restrictions, while metered, intermittent mobile networks struggle to download thousands of individual raster or vector files. Self-hosted servers require continuous daemon execution, databases, and heavy cloud infrastructure, and existing client-side map style URL toggling causes jarring canvas flashing and dropped render frames when users navigate outside city boundaries.

---

## 2. Paraphrase of Detailed Implementation (DetailedRange)

### What this proposes
[ethiopian_maps_sdk.md#L239-L366](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L239-L366) defines twenty target files to create across GitHub Actions CI/CD workflows, Planetiler configuration profiles, spatial slice definitions, shell scripts, font assets, cartographic styles, a TypeScript adapter library (`@ethiopiamaps/adapter`), diagnostic utilities (`check-pmtiles`), examples, and guides. It establishes automated weekly pipelines to fetch upstream OpenStreetMap data, compile nationwide PMTiles under a 6 GB JVM heap ceiling, slice metropolitan extracts using `pmtiles` and `jq`, and generate Latin/Ge'ez font chunks. Finally, it lays out a five-step verification plan validating archive integrity via `pmtiles verify`, verifying character glyph coverage, confirming MapLibre style compliance, conducting Playwright browser smoke tests, and running diagnostic self-tests.

### How the existing system works, per this document
The target repository currently lacks automated build workflows, configuration profiles, cartographic styles, and client consumption libraries. The document details how the planned scripts directly invoke CLI tools (`planetiler.jar`, `pmtiles`, `jq`) and npm packages to transition from raw upstream OpenStreetMap PBF downloads and TrueType fonts to distributed PMTiles archives and `.pbf` glyph chunks. The target environment relies on GitHub Actions runners constrained to 7 GB RAM, standard web servers/object stores capable of partial content responses, and MapLibre clients consuming static range requests without dynamic server processes.

---

## 3. Findings (Undefined Terms, Comprehension Gaps, Ambiguities)

### Finding 1: Tooling Discrepancy for TTF-to-SDF Font Generation
* **Severity**: Major
* **Affected Scope**: [ethiopian_maps_sdk.md#L74](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L74) vs. [ethiopian_maps_sdk.md#L283-L286](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L283-L286)
* **Discrepancy Description & Rationale**:
  The architecture diagram in line 74 designates `node-fontnik / fontmaker` as the SDF glyph generator (`GLYPH_GEN`). However, Section 241 (File #9, `glyphs/build-glyphs.js`) specifies generating SDF glyph stacks via `@mapbox/glyph-pbf-composite`. `@mapbox/glyph-pbf-composite` is strictly a utility for merging already-rendered protocol buffer glyph chunks; it does not parse `.ttf` vector contours or rasterize Signed Distance Fields. A developer following the implementation spec will not be able to generate `.pbf` glyphs from the raw TrueType fonts in `glyphs/fonts/` using only `@mapbox/glyph-pbf-composite`. The design must specify what rasterization engine or CLI tool (e.g. `node-fontnik`, `tiny-sdf`, or a fontnik wrapper) generates the initial `.pbf` glyph chunks before composition.

### Finding 2: Verification Plan Test Scripts Omitted from Target Files Manifest
* **Severity**: Major
* **Affected Scope**: [ethiopian_maps_sdk.md#L241-L334](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L241-L334) vs. [ethiopian_maps_sdk.md#L344-L360](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L344-L360)
* **Discrepancy Description & Rationale**:
  The Verification Plan defines two automated test scripts that are missing from Section 241 ("Target Files to Create/Modify"):
  1. `glyphs/test-coverage.js` (line 345): Required to assert that all Unicode characters in `ethiopia-latest.osm.pbf` exist in compiled glyph chunks, but omitted from the file manifest under `glyphs/`.
  2. Playwright Automated Test Script (line 353): The browser smoke test specifies running Playwright to validate map load times, tile requests, and remote panning fallback, but no Playwright test file, test configuration, or package dependency is listed in the target files list.

### Finding 3: Architecture Conflates MapLibre Native and MapLibre GL JS Protocol Adapters
* **Severity**: Major
* **Affected Scope**: [ethiopian_maps_sdk.md#L88-L90](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L88-L90), [ethiopian_maps_sdk.md#L154-L181](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L154-L181), [ethiopian_maps_sdk.md#L300-L306](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L300-L306), [ethiopian_maps_sdk.md#L327-L330](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L327-L330)
* **Discrepancy Description & Rationale**:
  Line 90 claims client integration support across "MapLibre GL JS / Native (Web, React Native, Flutter)", and File #19 (`docs/offline-guide.md`) describes embedding archives in mobile apps and registering file paths with "MapLibre Native". However, the adapter implemented in Section 2.4 and File #14 is a TypeScript package (`@ethiopiamaps/adapter`) calling `maplibregl.addProtocol()`. MapLibre Native (iOS/Android/Flutter) does not use JavaScript/TypeScript protocol handlers or execute MapLibre GL JS extensions. The design does not explain how mobile developers using MapLibre Native will achieve composite local/remote switching, or whether `@ethiopiamaps/adapter` is strictly a web and React Native/WebView library.

### Finding 4: Code Implementation Gaps in `CompositePMTilesProtocol`
* **Severity**: Major
* **Affected Scope**: [ethiopian_maps_sdk.md#L154-L181](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L154-L181)
* **Discrepancy Description & Rationale**:
  The reference snippet for `CompositePMTilesProtocol` leaves critical runtime mechanics undefined:
  1. `import { Protocol } from 'pmtiles';` is declared, but `Protocol` is never used; instead, `new PMTiles(url)` is called without importing `PMTiles`.
  2. `parseTileCoordinates(params.url)` and `this.isWithinBBox(z, x, y, this.localBBox)` are invoked without definition, import, or explanation. Converting tile coordinates `(z, x, y)` to an intersection check against a geographic bounding box `[minLon, minLat, maxLon, maxLat]` requires geometric projection or tile math that is not documented.
  3. The constructor accepts `localUrl?: string`. When loaded in web browsers, accessing local files via `file:///` URLs is prevented by browser security sandboxes, while loading from browser `File`/`Blob` handles requires a `FileSource` object from the `pmtiles` library rather than a string URL.

### Finding 5: Inconsistent City Extract Maximum File Size Target
* **Severity**: Nit
* **Affected Scope**: [ethiopian_maps_sdk.md#L27](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L27), [ethiopian_maps_sdk.md#L43](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L43), [ethiopian_maps_sdk.md#L199](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L199), [ethiopian_maps_sdk.md#L342](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L342)
* **Discrepancy Description & Rationale**:
  Goal 2 (line 27), NFRs (line 199), and Verification Plan (line 342) state that city extracts must be "under 45 MB each". However, Open Question 1 (line 43) asks how to maintain file sizes "under 40 MB". The size ceiling should be reconciled across all sections.

### Finding 6: Discrepancy Between Slice Sourcing CLI and File Manifest
* **Severity**: Nit
* **Affected Scope**: [ethiopian_maps_sdk.md#L112](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L112) vs. [ethiopian_maps_sdk.md#L255-L263](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L255-L263) and [ethiopian_maps_sdk.md#L273-L276](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L273-L276)
* **Discrepancy Description & Rationale**:
  Section 2.1 (line 112) illustrates slicing via `--region=slices/addis_ababa.geojson`. In contrast, Section 241 (File #4 and File #7) defines a single GeoJSON FeatureCollection `pipeline/slices.json` parsed via `jq`. Additionally, Goal 2 lists six single urban centers ("Addis Ababa, Dire Dawa, Hawassa, Bahir Dar, Mekelle, Adama"), whereas File #4 pairs them as "Bahir Dar & Gondar" and "Adama / Bishoftu" without explaining whether these are generated as single combined extracts or separate slice files.

### Finding 7: Undefined External Source and Administrative Geographic Terms
* **Severity**: Nit
* **Affected Scope**: [ethiopian_maps_sdk.md#L44](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L44), [ethiopian_maps_sdk.md#L69](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L69), [ethiopian_maps_sdk.md#L245](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L245), [ethiopian_maps_sdk.md#L258](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L258)
* **Discrepancy Description & Rationale**:
  - "Geofabrik" is referenced as the download origin for `ethiopia-latest.osm.pbf` without definition or link (https://download.geofabrik.de) for readers unfamiliar with OpenStreetMap ecosystem mirror providers.
  - "Sheger" is referenced as an urban fringe area to include within Addis Ababa boundaries without explaining that it refers to the newly formed administrative city/zone surrounding Addis Ababa.

### Finding 8: Missing Installation Specifications for `pmtiles` CLI
* **Severity**: Nit
* **Affected Scope**: [ethiopian_maps_sdk.md#L110-L113](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L110-L113), [ethiopian_maps_sdk.md#L245](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L245), [ethiopian_maps_sdk.md#L271-L275](file:///mnt/Data/work/Map/docs/designs/ethiopian_maps_sdk.md#L271-L275)
* **Discrepancy Description & Rationale**:
  The CI workflows and shell build scripts call the `pmtiles` command-line executable (`pmtiles extract`, `pmtiles verify`), but neither `.github/workflows/build-tiles.yml` nor `generate-tiles.sh` explains how the `pmtiles` binary is retrieved or installed (e.g., via Go, GitHub binary release download, or npm).
