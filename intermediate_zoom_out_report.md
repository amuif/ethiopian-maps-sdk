# Stage 8 Intermediate Zoom Out Report: Ethiopian Maps SDK

**Target:** `docs/designs/ethiopian_maps_sdk.md` (`lines 1..366`)  
**Standard:** `zoom-out-standard`  
**Mode:** `REVIEW`  
**Reviewer:** `egm-zoom-out` (Stage 8 Multi-Lens Synthesis)  
**Deliverable Path:** `intermediate_zoom_out_report.md`

---

## Reviewer Status

| Reviewer | Status |
| :--- | :--- |
| `egm-zoom-out` | completed |

---

## Executive Summary & Strategic Synthesis

Stage 8 Intermediate Zoom Out evaluates the end-to-end design specification `docs/designs/ethiopian_maps_sdk.md` through three macro-architectural dimensions:
1. **Architectural Consistency:** Reconciling the zero-daemon publishing model with multi-platform client consumption, low-zoom continuous rendering, and protocol fallback mechanics.
2. **Scope Containment:** Safeguarding Milestone 1 delivery against creeping mobile native runtimes, broken font rasterization dependencies, and undeclared test harnesses.
3. **Ecosystem Sustainability:** Ensuring real-world viability within Ethiopia’s telecommunication constraints (metered cellular data, periodic connectivity outages, high latency), regional cultural-linguistic inclusivity (Ge'ez and Afaan Oromoo / Qubee), and low-cost adopter hosting.

### Severity Breakdown
* 🔴 **Blockers:** 3
* 🟡 **Majors:** 6
* 🟢 **Nits:** 4

---

## Prioritized Findings (Blockers -> Majors -> Nits)

### 1. Mobile Ecosystem Architectural Disconnect vs. Browser-Centric TypeScript Adapter - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 11, 53–57 (CUJ 2), 88–91 (Topology Diagram), 151–183 (Section 2.4), 299–306 (Target Files 13 & 14), 327–330 (Target File 19)
* **Discrepancy:** The design establishes offline mobile navigation as a core value proposition (CUJ 2, React Native / Flutter support in the topology diagram, and bundling PMTiles into Android/iOS app packages in Section 2.4 & File #19). However, the planned composite adapter (`CompositePMTilesProtocol`, package `@ethiopiamaps/adapter`) is implemented strictly as a TypeScript web module depending on the `pmtiles` npm package and MapLibre GL JS’s browser-only `maplibregl.addProtocol()` API. MapLibre Native—the C++ runtime engine that powers Android, iOS, React Native (`@maplibre/maplibre-react-native`), and Flutter (`maplibre_gl`)—does not run a Node/V8 JavaScript engine, cannot execute TypeScript protocol handlers, and does not support browser npm modules.
* **Remediation:**
  1. Formally define `@ethiopiamaps/adapter` as a client library for MapLibre GL JS (Web, Progressive Web Apps, Capacitor, and Cordova WebView shells).
  2. In Section 2.4 and `docs/offline-guide.md`, specify how MapLibre Native applications consume local slices and remote tiles (e.g. direct local file path loading for offline use, or an optional lightweight HTTP micro-daemon/platform URL interceptor for hybrid switching).

### 2. Dual-Script Label Collision Paradox Suppressing Dense Urban POIs - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 126–145 (Section 2.3), 287–290 (Target File 10)
* **Discrepancy:** Section 2.3 uses a MapLibre `["format"]` expression to stack primary Amharic labels directly above secondary English sub-labels separated by `"\n"`. In MapLibre GL’s text rendering engine, a formatted text block is treated as a single unified bounding box for collision detection. Stacking two lines of text roughly doubles the vertical collision box of every label. In dense Ethiopian commercial and administrative districts (e.g. Merkato, Piazza, Stadium, Kazanchis in Addis Ababa), MapLibre's collision engine (`text-allow-overlap: false`, default) will suppress 50% to 70% of surrounding street names and POIs. In addition, when `name:am` is absent, the fallback prints duplicate stacked text (`"Bole\nBole"`), and emits an unconditional trailing `"\n"`.
* **Remediation:**
  1. Decouple Amharic primary titles and English subtitles into two independent symbol layers in `styles/ethiopia-bilingual.json`, with `text-optional: true` on English subtitles so MapLibre hides only the subtitle when space is constricted rather than dropping the landmark.
  2. Configure English sub-labels to activate only at street-level zoom ($z \ge 14$), displaying single-line Amharic labels at regional/district levels ($z10-z13$).
  3. Replace the format expression with a strict conditional check (`["all", ["has", "name:am"], ["has", "name:en"], ["!=", ["get", "name:am"], ["get", "name:en"]]]`).

### 3. Broken Protocol Fallback Mechanics & Low-Zoom Void Dilemma - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 53–57 (CUJ 2), 151–183 (Section 2.4), 255–264 (Target File 4), 303–306 (Target File 14)
* **Discrepancy:**
  1. In Section 2.4, the method attempts to fall back to `remoteSource` via `try { await this.localSource.getZxy(...) } catch { ... }`. In the official PMTiles client specification, `getZxy()` returns `undefined` (or `null`) when a tile coordinate is not present in the archive directory—it does not throw an exception. The `catch` block is never entered; `undefined` is returned to MapLibre GL, causing missing tiles to render as transparent voids.
  2. City packages (`addis_ababa.pmtiles`) are sliced using spatial polygons. Low-zoom tiles ($z0-z8$) encompass large geographic expanses or the entire globe, so they spatially intersect `localBBox`. If low-zoom requests route to `localSource`, MapLibre renders Addis Ababa floating in an empty void. Conversely, if low-zoom tiles are routed to `remoteSource`, an offline courier app (CUJ 2) completely fails to render an initial map during cellular outages.
* **Remediation:**
  1. Configure the CI slicing workflow (`slice-cities.sh`) to merge national overview tiles ($z0-z8$) into every city extract ($< 2\text{ MB}$ addition).
  2. Explicitly inspect the return value of `localSource.getZxy()` and wrap the payload for MapLibre's `addProtocol`.

### 4. Tooling Incompatibility and File Manifest Gaps in SDF Fontstack Pipeline - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 74 (Mermaid Topology), 116–125 (Section 2.2), 283–286 (Target File 9), 344–347 (Verification Plan 2)
* **Discrepancy:** Line 74 specifies `node-fontnik / fontmaker`, while Target File 9 specifies `@mapbox/glyph-pbf-composite`. `@mapbox/glyph-pbf-composite` only merges pre-existing `.pbf` glyph chunks; it lacks any TrueType vector contour parser or SDF rasterization engine. Furthermore, `node-fontnik` is an unmaintained C++ Node addon that frequently fails compilation on modern Node.js versions. Additionally, `glyphs/test-coverage.js` is omitted from the Target Files manifest.
* **Remediation:** Specify a maintained glyph rasterizer (such as `@maplibre/fontmaker` or `sdf-glyph-foundry`), update the Mermaid diagram, and add `glyphs/test-coverage.js` to the Target Files list.

### 5. Cultural & Linguistic Omission: Exclusion of Afaan Oromoo (Qubee) Glyphs - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 118–125 (Section 2.2), 283–286 (Target File 9)
* **Discrepancy:** The SDF glyph compilation whitelist prunes Latin Extended-B (`U+0200`–`U+024F`, chunk `512-767.pbf`) and General Punctuation (`U+2000`–`U+206F`, chunk `8192-8447.pbf`). Afaan Oromoo (written in Latin Qubee), the official language of Oromia and most widely spoken language in Ethiopia, relies fundamentally on the modifier letter apostrophe or right single quote (`’` `U+2019` or `ʻ` `U+02BC`) to indicate glottal stop consonants (*hudhaa*), appearing in essential place names like *Finfinnee*, *Bishooftuu*, *Mootummaa*, and *Naannoo*. Excluding these chunks causes MapLibre to fire 404 network errors, resulting in broken typography across Oromia and Sheger.
* **Remediation:** Expand the SDF generation whitelist to include chunk `512-767.pbf` and chunk `8192-8447.pbf`.

### 6. CI Runner Resource Exhaustion Risk (JVM `-Xmx6g` on 7 GB GitHub Actions Runner) - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 101–109 (Section 2.1), 197–198 (NFR Performance), 243–246 (Target File 1)
* **Discrepancy:** Allocating a 6 GB heap on a 7 GB runner leaves less than 1 GB for JVM Metaspace, GC worker stacks, native C++ memory-mapped file buffers (`--storage=mmap`), and the host OS. Memory-mapped I/O operations will trigger Linux kernel Out-Of-Memory (OOM) killer terminations.
* **Remediation:** Lower `-Xmx` to `4g` (or `5g` maximum) in `pipeline/planetiler.properties`, `generate-tiles.sh`, and `.github/workflows/build-tiles.yml`.

### 7. GitHub Releases Misaligned as Live HTTP 206 Byte-Range Tile Server - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 80–85 (Topology), 315–318 (Target File 17), 360–363 (Verification Plan 5)
* **Discrepancy:** Requests to `github.com/.../releases/download/...` return an `HTTP 302 Found` redirect to an Amazon S3 pre-signed URL with short expiration TTLs. Rapid bursts of range requests trigger HTTP 429 throttling.
* **Remediation:** Re-scope GitHub Releases strictly as a versioned distribution repository for downloading immutable PMTiles archives. Serve live reference demo tiles from a genuine zero-egress static host (Cloudflare R2 or Pages).

### 8. Absence of Client-Side Caching and Offline Overzooming Resilience - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 151–183 (Section 2.4), 303–306 (Target File 14)
* **Discrepancy:** In the presence of intermittent 3G/4G connectivity, tiles streamed over mobile data are discarded from volatile memory when the viewport recycles, repeatedly consuming metered mobile data. If a user zooms into $z15$ while offline, the map renders a blank screen because the archive cuts off at $z14$.
* **Remediation:** Provide browser `CacheStorage` / IndexedDB caching in `@ethiopiamaps/adapter` and implement overzooming fallback in the adapter for $z \ge 15$.

### 9. Cartographic Asset Relocatability & Source Parameterization - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 126–150 (Section 2.3), 287–294 (Target Files 10 & 11)
* **Discrepancy:** Style JSON references to `sources`, `glyphs`, and `sprite` URLs require parameterization so adopters can host assets on their own domains without manual regex patching.
* **Remediation:** Provide a client helper function in `@ethiopiamaps/adapter`: `createBilingualStyle({ baseUrl, pmtilesUrl })` that dynamically configures URLs.

### 10. Minor Specification Nits
* **Preflight Testing:** Update `tools/check-pmtiles` to test `OPTIONS` preflight and `Access-Control-Allow-Headers: Range`. (Nit)
* **File Budget Alignment:** Harmonize city slice budget to `< 45 MB` across all sections. (Nit)
* **Missing Test Artifacts in Manifest:** Add `tests/smoke.spec.ts` and `playwright.config.ts` to Target Files. (Nit)
* **Ethiopic Extended-A Overhead:** Make chunk `43776-44031.pbf` on-demand based on corpus frequency. (Nit)
