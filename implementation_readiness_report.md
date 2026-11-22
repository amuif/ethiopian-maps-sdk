# Implementation Readiness Test Report (Stage 9)

**Target:** `docs/designs/ethiopian_maps_sdk.md` (`lines 239..366`)  
**Standard:** `implementation-readiness-standard`  
**Report File:** `implementation_readiness_report.md`  

---

## Reviewer Status

| Reviewer | Lens | Status |
| :--- | :--- | :--- |
| `egm-implementation-readiness` | File Manifest, Actionability, CI & Verification Completeness | **completed** |
| `egm-codebase-details` | Technical Accuracy, Library Interoperability, Parameter Correctness | **completed** |
| `egm-style` | Structural Clarity, Consistency, Document Standards | **completed** |

---

## Executive Summary & Severity Breakdown

* 🔴 **Blocker:** 3 findings
* 🟡 **Major:** 5 findings
* 🟢 **Nit:** 4 findings
* **Total Findings:** 12 findings

---

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. Glyph Generator Tooling Inoperability (`@mapbox/glyph-pbf-composite` vs TTF Parsing) - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 283–286 (`glyphs/package.json` & `glyphs/build-glyphs.js`)
* **Discrepancy Description**: Target File #9 states that `build-glyphs.js` ingests source TrueType font files (`.ttf`) and generates Signed Distance Field (SDF) glyph stacks using `@mapbox/glyph-pbf-composite`. However, `@mapbox/glyph-pbf-composite` is solely a protocol buffer merging utility designed to combine two pre-existing SDF `.pbf` glyph buffers into a composite fontstack. It has no TTF parsing, FreeType rendering, or SDF rasterization capabilities.
* **Rationale & Recommendation**: A developer attempting to implement `build-glyphs.js` strictly using `@mapbox/glyph-pbf-composite` will find it impossible to process TTF files. The plan must explicitly mandate an SDF glyph rasterizer engine (such as `fontmaker` or an SDF rasterizer package) to render source TTFs into raw SDF glyph chunks, followed by `@mapbox/glyph-pbf-composite` to merge Latin and Ethiopic buffers into composite fontstacks.

### 2. Verification Plan Script & Framework Omissions in File Manifest - Severity: Blocker
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 241–334 (Target Files Manifest) and Lines 344–359 (Verification Plan §§ 2 & 4)
* **Discrepancy Description**: Section 345 mandates executing `node glyphs/test-coverage.js` to assert that all Unicode characters in the OSM PBF are present in the glyph ranges, and Section 353 mandates running an automated Playwright browser smoke test. However, neither `glyphs/test-coverage.js`, `playwright.config.ts`, `tests/smoke.spec.ts`, nor a root `package.json` (for Playwright dependencies and test runners) are listed in the Target Files to Create/Modify manifest.
* **Rationale & Recommendation**: Add `glyphs/test-coverage.js`, `playwright.config.ts`, `tests/smoke.spec.ts`, and root `package.json` to the Target Files Manifest, complete with their required dependencies.

### 3. Unicode Chunk Omission for Latin Extended-B and Typographical Punctuation - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 285–286 (Target File #9) & Lines 118–124 (Section 2.2)
* **Discrepancy Description**: The glyph compilation plan specifies generating chunks `0-255` and `256-511` to cover Latin Basic & Extended (`U+0000`–`U+024F`). However, codepoints `U+0200` to `U+024F` (Latin Extended-B) reside in chunk `512-767` (`0x0200 = 512`), meaning Latin Extended-B characters will not be compiled. Furthermore, chunk `8192-8447` (`U+2000`–`U+206F`, containing standard typographical punctuation such as curly quotes, en-dashes, em-dashes, and bullet points) is omitted entirely.
* **Rationale & Recommendation**: Update the target chunk array in `build-glyphs.js` to include `512-767` (`U+0200`–`U+02FF`) and `8192-8447` (`U+2000`–`U+20FF`).

### 4. `pmtiles extract` Single-Feature GeoJSON Input Incompatibility - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 273–276 (`pipeline/scripts/slice-cities.sh`)
* **Discrepancy Description**: Item 7 specifies parsing `pipeline/slices.json` using `jq` and executing `pmtiles extract ethiopia.pmtiles <city>.pmtiles --region=<geojson_polygon>` for each city feature. In the Protomaps `pmtiles` CLI, the `--region` argument accepts a file path to a single GeoJSON `Polygon` or `MultiPolygon` file; it does not parse inline GeoJSON strings or multi-feature `FeatureCollection` files directly.
* **Rationale & Recommendation**: The script specification must detail extracting each individual city geometry into a temporary file (e.g., `jq -c ".features[] | select(.properties.city == \"$city\").geometry" pipeline/slices.json > /tmp/$city.geojson`) and passing that file path to `pmtiles extract ethiopia.pmtiles dist/slices/$city.pmtiles --region=/tmp/$city.geojson`.

### 5. Ambiguous Metropolitan Extract Definitions & Undefined Slice Artifact Names - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 255–264 (`pipeline/slices.json`) & Line 27 (Goal 2)
* **Discrepancy Description**: Item 4 lists "4. Bahir Dar & Gondar" and "6. Adama / Bishoftu" as compound entries, whereas Goal 2 (line 27) lists "Bahir Dar" and "Adama" as discrete city packages. Gondar is ~175 km north of Bahir Dar across Lake Tana; grouping them into a single bounding box captures large rural/water expanses and risks violating the <45 MB size constraint. Furthermore, the plan fails to define the exact generated artifact filenames.
* **Rationale & Recommendation**: Disambiguate the feature manifest into separate city extract definitions with deterministic artifact filenames: `addis_ababa.pmtiles`, `dire_dawa.pmtiles`, `hawassa.pmtiles`, `bahir_dar.pmtiles`, `gondar.pmtiles`, `mekelle.pmtiles`, and `adama.pmtiles`.

### 6. CI/CD Workflow Prerequisites, Disk Space, and Tag Collision Unhandled - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 243–250 (`.github/workflows/build-tiles.yml` & `build-glyphs.yml`)
* **Discrepancy Description**: The CI workflow specifications omit several operational prerequisites:
  1. No installation step is provided for the `pmtiles` CLI utility or `jq` on `ubuntu-latest`.
  2. Standard GitHub Actions runners provide ~14 GB of free storage. A Planetiler run with memory-mapped storage and city slices can exhaust disk space without an explicit pre-build runner cleanup step.
  3. Release creation and Pages deployment require explicit GitHub token permissions (`permissions: contents: write` and `permissions: pages: write, id-token: write`).
  4. Multiple manual runs or retries on the same date will fail when attempting to recreate release tag `vYYYY.MM.DD` unless `--clobber` is configured.
* **Rationale & Recommendation**: Detail the runner setup steps: install `pmtiles` CLI from GitHub Releases, configure runner permissions, add a disk cleanup step, and specify release upload idempotency flags (`gh release upload --clobber`).

### 7. Composite PMTiles Protocol Header & Metadata Interception Omitted - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 303–306 (`adapter/src/index.ts`) & Lines 157–181 (Section 2.4)
* **Discrepancy Description**: The TypeScript implementation plan only details intercepting tile coordinate requests `(z, x, y)`. When MapLibre GL initializes a vector tile source, the PMTiles protocol first requests the archive's root metadata and header (`header.json`). If the adapter routes metadata requests to the local city slice, MapLibre will constrain viewport bounds, layer definitions, and max zoom levels to the city slice, failing when panning to remote areas.
* **Rationale & Recommendation**: Update the adapter specification to state that `CompositePMTilesProtocol` must intercept header and metadata requests and resolve them against the remote nationwide archive, while routing tile requests `(z, x, y)` based on spatial bounding box and local tile presence checks.

### 8. Incomplete Scope in Style Specification Conformance Verification - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 348–351 (Verification Plan § 3)
* **Discrepancy Description**: Target Files Manifest creates two distinct style specifications: `styles/ethiopia-bilingual.json` (Target 10) and `styles/ethiopia-amharic.json` (Target 11). However, Verification Plan § 3 only runs validation against `ethiopia-bilingual.json`.
* **Rationale & Recommendation**: Expand Verification Plan § 3 to validate both style artifacts: `npx @maplibre/maplibre-gl-style-spec validate styles/ethiopia-bilingual.json && npx @maplibre/maplibre-gl-style-spec validate styles/ethiopia-amharic.json`.

### 9. Minor Implementation Nits
* **Planetiler Bounding Box Key:** Change bounding box property in `pipeline/planetiler.properties` to `bounds=32.99,3.40,47.98,14.89` instead of split keys. (Nit)
* **Pinned Versions:** Explicitly document Geofabrik download URL and pin `PLANETILER_VERSION=0.8.2`. (Nit)
* **Peer Dependencies:** Declare `maplibre-gl` and `pmtiles` as `peerDependencies` in `adapter/package.json`. (Nit)
* **Asset Licensing & Sprites:** Add `glyphs/fonts/OFL.txt` and `styles/sprites/src/` to the Target Files Manifest. (Nit)
