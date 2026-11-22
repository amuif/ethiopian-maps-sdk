# Stage 5 Initial Zoom Out Report: Ethiopian Maps SDK

**Target:** `docs/designs/ethiopian_maps_sdk.md` (`lines 1..366`)  
**Standard:** `zoom-out-standard`  
**Mode:** `REVIEW`  

## Reviewer Status

| Reviewer | Status |
| :--- | :--- |
| `egm-zoom-out` | completed |
| `egm-inventive-catalyst` | completed |

## Severity Breakdown
* 🔴 **Blockers:** 2
* 🟡 **Majors:** 4
* 🟢 **Nits:** 2

---

## Prioritized Findings

### 1. Incompatible Client Abstraction for Mobile Ecosystems vs Web-Only TypeScript Protocol (Blocker)
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Section 2.4 (lines 151–183), Section 13–14 (lines 299–306), CUJ 2 (lines 53–57), Overview & Architecture (lines 11, 88–91)
* **Discrepancy:** The design establishes offline mobile navigation as a primary value proposition (CUJ 2, React Native/Flutter support, and embedding PMTiles into Android/iOS bundles). However, the planned composite adapter (`CompositePMTilesProtocol`, lines 154–183, `@ethiopiamaps/adapter`) is implemented strictly as a TypeScript web module depending on the `pmtiles` npm package and MapLibre GL JS's browser `addProtocol` API. MapLibre Native (the C++ core used by Android, iOS, Flutter `maplibre_gl`, and React Native) does not execute browser TypeScript protocol handlers or interface with npm packages.
* **Remediation:** Explicitly decouple web and native mobile integration architectures:
  1. Define `@ethiopiamaps/adapter` strictly as the MapLibre GL JS / Web / hybrid (Capacitor/WebView) protocol adapter.
  2. Specify the native mobile architecture for MapLibre Native: either deploying an embedded local HTTP micro-daemon (a lightweight local file server serving byte-ranges from local device storage), implementing native platform URL scheme handlers (`NSURLProtocol` on iOS / `WebViewAssetLoader` on Android), or utilizing MapLibre Native's custom tile provider interfaces.

### 2. Stacked Bilingual Label Collision Paradox Causes Severe Urban Label Dropouts (Blocker)
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Section 2.3 (lines 129–145), Target File 10 (lines 287–290)
* **Discrepancy:** The design uses MapLibre `["format"]` expressions to stack primary Amharic labels (`name:am`) directly above secondary English sub-labels (`name:en`) separated by a newline (`\n`). In MapLibre GL, the symbol layout engine computes a unified collision bounding box around the combined formatted text block. Stacking two lines of text roughly doubles the vertical collision footprint of every label. In dense Ethiopian urban commercial hubs (e.g., Merkato, Piazza, Stadium, Kazanchis in Addis Ababa), MapLibre's collision detection algorithm (`text-allow-overlap: false`, default) will suppress between 50% and 70% of surrounding street and POI labels compared to single-line rendering.
* **Remediation:** Apply zoom-dependent segmentation:
  1. Suppress secondary English labels at intermediate zoom levels (z10–z13), displaying primary Amharic only, and activate dual-line stacked labels only at street-level zooms (z14+).
  2. Decouple Amharic primary titles and English subtitles into two linked symbol layers, or configure `text-variable-anchor: ["top", "bottom", "left", "right"]` with `text-optional: true` on the secondary label chunk. This enables the MapLibre layout engine to reposition or drop only the English subtitle when space is constricted rather than dropping the entire landmark or street name.

### 3. Irregular GeoJSON Extract Slices Mismatched with Rectangular BBox Check in Composite Adapter (Major)
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Section 2.1 (lines 110–114), Section 2.4 (lines 157–178), Target Files 4 & 14 (lines 255–264, 303–306)
* **Discrepancy:** In Section 2.1, city extracts are generated via `pmtiles extract --region=slices/addis_ababa.geojson` using irregular GeoJSON boundary polygons (such as the Sheger metropolitan boundary and Bole corridor). However, in Section 2.4, the composite adapter evaluates tile presence using a rectangular bounding box: `isWithinBBox(z, x, y, this.localBBox)`. For coordinates located inside the rectangular bounding box but outside the irregular polygon, the adapter calls `this.localSource.getZxy(...)`. In the official `pmtiles` library, missing tiles resolve as `undefined` (they do not necessarily throw). The adapter will return `undefined` to MapLibre rather than falling through to `remoteSource`, leaving outer-fringe canvas tiles completely blank.
* **Remediation:** In `CompositePMTilesProtocol.tile`:
  1. Do not rely exclusively on coarse bounding box checks.
  2. Check the resolved return value of the local archive: `const localTile = await this.localSource.getZxy(z, x, y, abortController.signal); if (localTile) return localTile;`.
  3. If `localTile` is `undefined`, or if the fetch throws, catch and transparently fall through to `return await this.remoteSource.getZxy(z, x, y, abortController.signal);`.

### 4. GitHub Releases Is Structurally Unsuitable as a Direct HTTP 206 Byte-Range Tile Server (Major)
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Section 1 Topology (lines 80–85), CUJ 1 (lines 48–52), Implementation Plan 17 (lines 315–318), Verification Plan 5 (lines 360–362)
* **Discrepancy:** The architecture topology and implementation plan suggest serving map tiles directly from GitHub Releases via HTTP byte-range requests for reference demos (`examples/web-vanilla/index.html`) and verification tests. GitHub Releases assets are not designed as low-latency tile CDNs: download requests return HTTP 302 redirects to Amazon S3 pre-signed URLs on `objects.githubusercontent.com`. GitHub aggressively throttles (HTTP 429) clients issuing rapid bursts of byte-range requests, and redirect pre-signed query tokens expire quickly.
* **Remediation:** Clearly separate archive distribution from live tile consumption:
  1. Re-scope GitHub Releases strictly as a distribution mirror for manual or CI-based archive downloads (e.g. downloading `ethiopia.pmtiles` once).
  2. For the live reference demo (`examples/web-vanilla`) and CI smoke testing, host the master PMTiles file on a genuine zero-egress static storage bucket (e.g., Cloudflare Pages / Cloudflare R2 public bucket or an unthrottled static HTTP server) that natively supports CORS and persistent byte-range requests without HTTP 302 redirects.

### 5. Absence of Client-Side Persistent Caching and Resilient Offline Boundary Overzooming (Major)
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Section 2.4 (lines 151–183), Subsystem 2.4 (lines 303–306)
* **Discrepancy:** The composite adapter operates without a local persistence or caching layer for remote tiles. If a user on metered mobile data moves slightly beyond the city slice boundary, every tile request hits the remote endpoint. If network connectivity drops in transit, the map immediately renders black/gray voids. Furthermore, tiles streamed over mobile data are discarded from RAM when the browser/view recycles, forcing repetitive, costly downloads over metered Ethiopian networks.
* **Remediation:**
  1. Integrate an intermediate storage cache (using the browser `CacheStorage` / IndexedDB API in web, or an SQLite/file cache in mobile wrappers). When remote HTTP 206 requests succeed, persist the retrieved tile chunks locally.
  2. Implement an overzooming fallback: if the user zooms in to z15 or pans slightly outside the city extract while offline, allow the adapter to overzoom the nearest available parent tile (z13/z14) rather than returning a fatal blank tile error.

### 6. Visual Degradation from Uniform Halo Settings on Dual-Script Formatted Labels (Major)
* **Reviewer Lens:** `egm-zoom-out` / `egm-inventive-catalyst`
* **Affected Scope:** Section 2.3 (lines 142–145), Subsystem 2.3 (lines 287–290)
* **Discrepancy:** The design sets `text-halo-color: #FFFFFF` and `text-halo-width: 1.5` on the symbol layer while applying `font-scale: 0.8` and `text-color: #555555` to the secondary English chunk. In MapLibre GL, halo properties apply across all chunks of a `["format"]` string. A 1.5px white halo around a smaller, lighter gray (#555555) 8px Latin font bleeds into letterforms, degrades legibility, and blurs counter-spaces on mobile screens. Additionally, default line heights cause descenders of Ge'ez syllabics (e.g. ሯ, ቿ, ጀ) to collide with uppercase Latin ascenders.
* **Remediation:** In `styles/ethiopia-bilingual.json`:
  1. Explicitly declare `text-line-height: 1.25` or `1.3` to provide adequate baseline separation between Ge'ez and Latin scripts.
  2. Separate primary Amharic labels and secondary English subtitles into distinct symbol layers with calibrated halo widths (1.0px for secondary English, 1.5px for primary Amharic).

### 7. Omission of CORS Preflight (`OPTIONS`) and Cache-Control Diagnostics in Validation Utility (Nit)
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Section 2.5 (lines 184–192), Target Files 15 & 16 (lines 307–314)
* **Discrepancy:** The `check-pmtiles` utility validates `HEAD` and `GET (Range: bytes=0-1023)` requests, but omits CORS preflight `OPTIONS` testing. Because `Range` is not a CORS-safelisted request header, web browsers dispatch an `OPTIONS` preflight before fetching tiles. If a cloud storage bucket does not emit `Access-Control-Allow-Headers: Range` and `Access-Control-Max-Age`, the browser triggers an `OPTIONS` request for every single vector tile, doubling network round trips over high-latency 3G/4G cellular connections.
* **Remediation:** Enhance `tools/check-pmtiles/cli.sh` and `index.html` to execute an `OPTIONS` request validating:
  1. `Access-Control-Allow-Headers: Range`
  2. `Access-Control-Max-Age` (recommending $\ge$ 86400 seconds / 24 hours to eliminate duplicate preflight requests).

### 8. Suboptimal SDF Compilation for Sparse Ethiopic Extended-A Unicode Range (Nit)
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Section 2.2 (lines 118–125), Target File 9 (lines 283–286)
* **Discrepancy:** Section 2.2 specifies compiling chunk `43776-44031.pbf` for Ethiopic Extended-A (`U+AB00`–`U+AB2F`). This Unicode block contains only 48 code points (mostly regional linguistic archaic extensions), resulting in a 256-glyph SDF protocol buffer chunk that is over 80% empty and almost never referenced in OpenStreetMap Ethiopia tag data.
* **Remediation:** In `glyphs/test-coverage.js`, measure glyph frequency against `ethiopia-latest.osm.pbf`. If `U+AB00`–`U+AB2F` is unused, document that chunk `43776-44031.pbf` can be excluded from standard release bundles or compiled on-demand, reducing the glyph distribution footprint.
