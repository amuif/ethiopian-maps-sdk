# Critic Review: Ethiopian Maps SDK (Milestone 1 — Data Build Pipeline)

**Target:** `docs/designs/ethiopian_maps_sdk.md` (`lines 1..238`)  
**Standards:** `feature-spec-standard`

## Reviewer Status

| Reviewer | Status |
| :--- | :--- |
| `egm-design` | completed |
| `egm-structural` | completed |
| `egm-style` | completed |

---

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. Broken Tile Fallback in Composite Adapter via `getZxy` Silent Return - Severity: Blocker
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 170–181 (Section 2.4, Subsystem Specifications)
* **Discrepancy Description**: The `CompositePMTilesProtocol.tile` method attempts to fall back to `this.remoteSource` inside a `try...catch` block around `this.localSource.getZxy(...)`. In the official PMTiles client specification and JavaScript implementation, `getZxy()` returns `undefined` (or `null`) when a tile is missing from an archive index—it does not throw an exception (errors are thrown only on corrupted headers or I/O failure). Consequently, `catch` is never executed; the method returns `undefined` directly to MapLibre GL, treating the tile as missing/blank and completely failing to fetch from `remoteSource`.
* **Rationale & Recommendation**: Explicitly verify whether `localSource.getZxy()` returned a value before falling back to `remoteSource`, and return the tile wrapped in the structure expected by MapLibre's `addProtocol`:
  ```typescript
  tile = async (params: { url: string }, abortController: AbortController) => {
    const { z, x, y } = parseTileCoordinates(params.url);
    if (this.localSource && this.isWithinBBox(z, x, y, this.localBBox)) {
      const localTile = await this.localSource.getZxy(z, x, y, abortController.signal);
      if (localTile) {
        return { data: localTile.data };
      }
    }
    const remoteTile = await this.remoteSource.getZxy(z, x, y, abortController.signal);
    return remoteTile ? { data: remoteTile.data } : undefined;
  };
  ```

---

### 2. Spatial Bounding Box Evaluation & Low-Zoom Void / Offline Dilemma - Severity: Blocker
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 171–178 (Section 2.4, Subsystem Specifications) & Lines 53–57 (CUJ 2)
* **Discrepancy Description**: The routing condition `this.isWithinBBox(z, x, y, this.localBBox)` creates a critical rendering failure at low zoom levels ($z \le 8$). Because tile $(0,0,0)$ and low-zoom tiles encompass large regions or the entire planet, they spatially intersect `localBBox`. However, because `addis_ababa.pmtiles` is created via polygon extract (`pmtiles extract --region`), it only contains features inside Addis Ababa. If low-zoom tiles are served from `localSource`, MapLibre renders Addis Ababa as an isolated island in an empty void. Conversely, if `isWithinBBox` requires strict spatial containment (`tileBBox inside localBBox`), low-zoom tiles will route to `remoteSource`, breaking CUJ 2's core guarantee that the app functions offline during internet outages.
* **Rationale & Recommendation**: Establish an explicit zoom threshold policy:
  1. Have the build pipeline include national overview tiles ($z0-z8$) inside every city extract package (adding $<2\text{ MB}$ to file size).
  2. In the adapter, define an explicit zoom partition:
     ```typescript
     // For z < 9, use national baseline; for z >= 9, evaluate city bounding box
     if (z >= 9 && this.localSource && this.isWithinBBox(z, x, y, this.localBBox)) { ... }
     ```

---

### 3. Bilingual MapLibre Format Expression Label Duplication & Trailing Newline Distortion - Severity: Blocker
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 129–144 (Section 2.3, Bilingual MapLibre Style Specification)
* **Discrepancy Description**: The MapLibre `format` expression suffers from two severe bugs:
  1. **Label Duplication**: When a feature has `name:en = "Bole"` but no `name:am`, the primary expression resolves to `name:en` ("Bole"). In the secondary expression, `["==", ["get", "name:en"], ["coalesce", ["get", "name:am"], ""]]` evaluates `"Bole" == ""` (false). Thus, the secondary line also prints `"Bole"`, resulting in stacked duplicate text (`"Bole\nBole"`).
  2. **Unconditional Newline**: The string `"\n"` is placed as an unconditional section in the format array. When `name:en` is missing or matches `name:am`, the secondary block evaluates to `""`, but the trailing newline `"\n"` is still emitted, breaking vertical anchoring (`text-anchor: center`) and rendering off-center labels.
* **Rationale & Recommendation**: Replace the static format block with a conditional case expression that only inserts `"\n"` and the sub-label when both `name:am` and `name:en` are present and distinct:
  ```json
  [
    "case",
    [
      "all",
      ["has", "name:am"],
      ["has", "name:en"],
      ["!=", ["get", "name:am"], ["get", "name:en"]]
    ],
    [
      "format",
      ["get", "name:am"], { "font-scale": 1.0 },
      "\n", {},
      ["get", "name:en"], { "font-scale": 0.8, "text-color": "#555555" }
    ],
    [
      "format",
      ["coalesce", ["get", "name:am"], ["get", "name:en"], ["get", "name"]],
      { "font-scale": 1.0 }
    ]
  ]
  ```

---

### 4. Missing CORS Preflight Header `Access-Control-Allow-Headers: Range` in Tooling - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 184–191 (Section 2.5, Hosting Endpoint Diagnostic Utility)
* **Discrepancy Description**: The diagnostic utility checks `Accept-Ranges: bytes`, `HTTP 206`, and `Access-Control-Expose-Headers: Content-Range`. However, browsers executing cross-origin `fetch` requests with a `Range` header initiate a CORS preflight `OPTIONS` request. If the static storage bucket (Cloudflare R2, AWS S3, MinIO) does not explicitly return `Access-Control-Allow-Headers: Range`, the browser blocks the request before any byte-range tile request can be dispatched.
* **Rationale & Recommendation**: Add validation for `Access-Control-Allow-Headers: Range` on preflight `OPTIONS` requests in `tools/check-pmtiles` and include this directive in the copy-paste CORS templates.

---

### 5. Exclusion of Latin Extended-B and General Punctuation Glyphs for Afaan Oromoo (Qubee) - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 118–124 (Section 2.2, Ge'ez & Latin SDF Glyph Generator)
* **Discrepancy Description**: The glyph compilation whitelist covers Latin Basic/Extended (`0-511`) and select Ethiopic blocks, but completely prunes Latin Extended-B (`U+0200`–`U+024F`, chunk `512-767.pbf`) and General Punctuation (`U+2000`–`U+206F`, chunk `8192-8447.pbf`). Afaan Oromoo (written in Latin Qubee orthography), widely used across Oromia and Addis Ababa/Finfinnee, relies extensively on the modifier letter apostrophe or right single quote (`’` `U+2019` or `ʻ` `U+02BC`) for glottal stop consonants (e.g., *Finfinnee*, *Bishooftuu*, *Mootummaa*). Pruning these blocks causes MapLibre to emit 404 errors and fail rendering place names.
* **Rationale & Recommendation**: Expand glyph compilation ranges to include chunk `512-767.pbf` and chunk `8192-8447.pbf`.

---

### 6. JVM Memory Ceiling Over-Allocation on Standard CI Runners - Severity: Major
* **Reviewer Lens:** `egm-design` / `egm-structural`
* **Affected Scope:** Lines 101–109 (Section 2.1) & Line 198 (Section 3, Non-Functional Requirements)
* **Discrepancy Description**: Planetiler is launched with `-Xmx6g` on standard GitHub Actions runners with a hard 7 GB RAM limit. Setting a 6 GB heap leaves less than 1 GB for off-heap allocations, Metaspace, G1GC overhead, and OS page cache buffers used by `--storage=mmap`. This configuration is vulnerable to unpredictable termination by the Linux Out-Of-Memory (OOM) killer.
* **Rationale & Recommendation**: Lower `-Xmx` to `4g` or `5g`. Planetiler easily compiles a regional extract like Ethiopia (~130 MB PBF) in under 3 GB of heap, providing safe headroom for CI runner stability.

---

### 7. File Size Budget Contradiction Across Goals and Requirements - Severity: Major
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Line 27 (Goal 2), Line 43 (Open Question 1), Line 199 (Section 3, NFR)
* **Discrepancy Description**: Goal 2 (line 27) and NFR (line 199) define the maximum city slice archive size as **under 45 MB**. In contrast, Open Question 1 (line 43) states: *"to maintain file sizes under 40 MB while preserving detailed footpath and building footprint data"*.
* **Rationale & Recommendation**: Harmonize the file size target across all sections to `< 45 MB` to eliminate conflicting acceptance criteria.

---

### 8. Unspecified Style Asset Relocation & Source Parameterization - Severity: Major
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 126–150 (Section 2.3) & Lines 80–85 (Topology)
* **Discrepancy Description**: The specification states that `styles/ethiopia-bilingual.json` is published as a release asset for deployment on adopter-managed static storage (R2/S3). However, the document does not specify how the style references its vector `sources`, `glyphs`, and `sprite` URLs. If absolute URLs are used, self-hosters cannot achieve zero-dependency deployment without manual regex patching of the JSON file.
* **Rationale & Recommendation**: Define how style URLs are resolved—either through relative paths, placeholder templates (`{tileserver_url}`), or a client helper function in `@ethiopiamaps/adapter` (e.g. `createBilingualStyle({ baseUrl })`).

---

### 9. Tooling Discrepancy Between Topology Diagram and Subsystem Spec - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 74 (Mermaid Topology) vs Line 116 (Section 2.2)
* **Discrepancy Description**: Line 74 of the Mermaid diagram labels the glyph generator as `node-fontnik / fontmaker`, whereas Section 2.2 and Section 4 describe modern Node.js tooling (`@mapbox/glyph-pbf-composite`). `node-fontnik` is a deprecated native C++ module with high failure rates on modern Node versions.
* **Rationale & Recommendation**: Update line 74 in the Mermaid diagram to `GLYPH_GEN[@mapbox/glyph-pbf-composite]` for consistency.

---

### 10. Underspecified Coordinate Axis Ordering for `localBBox` - Severity: Nit
* **Reviewer Lens:** `egm-style` / `egm-structural`
* **Affected Scope:** Lines 160–162 (Section 2.4, Subsystem Specifications)
* **Discrepancy Description**: The TypeScript interface defines `localBBox?: [number, number, number, number]` without documenting axis ordering. Geospatial libraries frequently vary between `[minLon, minLat, maxLon, maxLat]` (GeoJSON/WSEN) and `[minLat, minLon, maxLat, maxLon]` (Leaflet).
* **Rationale & Recommendation**: Explicitly document tuple ordering as `[west, south, east, north]` (or define a typed bounding box interface).

---

### 11. Inconsistent Linguistic and Script Nomenclature - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 11, 19, 28, 116–124
* **Discrepancy Description**: The document uses "Ge'ez", "Ethiopic", and "Amharic" interchangeably when describing typography, Unicode blocks, and languages.
* **Rationale & Recommendation**: Standardize technical nomenclature: use "Ge'ez script" (or Fidel) for the writing system, "Ethiopic" for Unicode blocks and font stack definitions (`Noto Sans Ethiopic`), and "Amharic" specifically for language code tags (`name:am`).
