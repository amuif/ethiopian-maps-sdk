# Ethiopian Maps SDK (Milestone 1 — Data Build Pipeline)

* **Author:** amuif (Ibrahim)
* **Date:** 2026-11-22

## Overview

A free, open-source geospatial platform and publishing pipeline for displaying vector maps of Ethiopia in web and mobile applications without proprietary API keys, central tracking, or paid SaaS dependencies. Milestone 1 establishes the core data build pipeline: converting OpenStreetMap data into standalone vector tiles (PMTiles v3) using Planetiler, extracting high-density city packages, generating pre-rendered Signed Distance Field (SDF) Ge'ez and Latin fontstacks, and publishing an Amharic-English bilingual MapLibre style JSON.

Map data is distributed as static single-file PMTiles archives queried directly via HTTP Range requests (`Accept-Ranges: bytes`) from developer-hosted static storage (e.g., Cloudflare R2, AWS S3, Nginx) or bundled directly into mobile app assets for offline use.

## Analysis

Synthesized across seven Goldfish review lenses (`egm-design`, `egm-codebase-details`, `egm-zoom-out`, `egm-comprehension`, `egm-implementation-readiness`, `egm-structural`, `egm-inventive-catalyst`):

### 1. Typography & Script Mechanics
* **SDF Counter-Space Degradation at Small Scales:** Ge'ez characters (e.g., ቁ, ቋ, ቯ, ቼ) feature dense interior loops and strokes. Below 11px on standard DPI screens, unbuffered raster glyphs blur together. SDF generation must use a 3px buffer and a 1.5px high-contrast halo casing (white casing on vector landuse; dark casing on satellite imagery) to maintain legibility.
* **Bilingual Fallback Cascade:**
  * Master label hierarchy: Primary text displays Amharic (`name:am` in Noto Sans Ethiopic Bold, 12–14px); secondary text displays English (`name:en` in Noto Sans Regular, 10px, stacked with `\n`).
  * Fallback cascade: When `name:am` is missing in OSM, fall back to `name:en`, then default `name`. When `name:en` matches `name:am`, suppress the redundant secondary line.
* **Targeted Unicode Pruning:** While the full Ge'ez Unicode script contains hundreds of characters, archaic liturgical marks and obsolete characters add unused payload. The glyph generator filters compilation strictly to active blocks:
  * Ethiopic Basic (`U+1200`–`U+137F`)
  * Ethiopic Supplement (`U+1380`–`U+139F`)
  * Ethiopic Extended (`U+2D80`–`U+2DDF`)
  * Ethiopic Extended-A (`U+AB00`–`U+AB2F`)
  * Basic Latin & Latin Extended (`U+0000`–`U+024F`)

### 2. Tile Generation & Data Architecture
* **Planetiler Memory Profile:** Building `ethiopia-latest.osm.pbf` (~180 MB) with Planetiler requires JVM tuning (`--nodemap-type=sparsearray`) to stay within standard 7–8 GB runner memory boundaries. Nationwide output to zoom level 14 yields a single `ethiopia.pmtiles` file (~200–320 MB).
* **City Slice Extraction:** Rather than re-parsing raw OSM data per city, the pipeline runs `pmtiles extract` on the master `ethiopia.pmtiles` using GeoJSON boundary polygons. Initial city slices:
  * Addis Ababa (including Sheger metropolitan perimeter) (~35 MB)
  * Dire Dawa (~15 MB)
  * Hawassa (~15 MB)
  * Bahir Dar & Gondar (~20 MB)
  * Mekelle (~15 MB)
  * Adama / Bishoftu (~18 MB)

### 3. Distribution, Hosting & Economics
* **Decentralized Static Storage:** Adopters avoid recurring USD software fees by uploading PMTiles archives to zero-egress or low-cost static buckets (Cloudflare R2, MinIO, or standard web servers). The client SDK issues standard HTTP 206 byte-range requests directly to the developer's bucket.
* **Offline Hybrid Boundary & Hot-Swapping:** Mobile applications embed lightweight city slices (e.g., Addis Ababa ~35 MB) directly in app assets (`pmtiles://file:///...`). To prevent map redraw flicker when a user pans outside the city bounds, the client SDK uses a composite protocol handler: it resolves tile requests from the local PMTiles archive if the tile exists within the city boundary; otherwise, it transparently issues HTTP byte-range requests to the remote `ethiopia.pmtiles` archive without tearing down or rebuilding the MapLibre map instance.
* **Public GitHub Release Mirrors:** The maintainer's scheduled CI build publishes compiled `.pmtiles` archives and glyph tarballs directly to GitHub Releases, providing free public download mirrors without running dedicated tile servers.
* **Hosting Validation Diagnostic:** Because missing CORS and byte-range headers (`Accept-Ranges: bytes`, `Content-Range`) are the primary source of deployment failure on self-hosted S3/R2/Nginx endpoints, the repository includes a standalone diagnostic tool (`check-pmtiles.html` / CLI test) to verify an adopter's URL before client integration.

### 4. Cartographic Visual Hierarchy for Ethiopia
* **Priority Road Corridors:** Elevated styling contrast for national freight corridors (Addis–Djibouti expressway, Modjo–Hawassa, trunk routes A1–A8) visible from low zoom levels (z5–z7).
* **Administrative Boundaries:** Explicit layer definitions for Kebele, Woreda, and Zone borders to match local civic and logistics boundary models.
* **Civic Landmark POIs:** Custom vector styling and iconography for essential community landmarks: places of worship (Orthodox churches, mosques, Protestant churches), central inter-city bus stations (Autobus Tera, regional terminals), and open-air markets.

## Goals vs. Non-Goals

* **In-Scope Goals (Milestone 1):**
  * Automated GitHub Actions pipeline to ingest `ethiopia-latest.osm.pbf` and output `ethiopia.pmtiles` via Planetiler.
  * Secondary polygon extraction pipeline producing standalone city slices (Addis Ababa, Dire Dawa, Hawassa, Bahir Dar, Mekelle, Adama).
  * Node/CLI glyph compilation pipeline generating static `.pbf` fontstacks (Noto Sans Ethiopic + Noto Sans Latin).
  * MapLibre style JSON implementing the Amharic/English bilingual label cascade (`name:am` -> `name:en` -> `name`) and Ethiopian cartographic hierarchy.
  * Client-side hot-swapping PMTiles protocol adapter bridging local city archives and remote national archives without map reload flicker.
  * Standalone hosting diagnostic tool (`check-pmtiles.html` / CLI) to validate remote CORS, `Accept-Ranges`, and `Content-Range` headers.
  * Static reference demo (HTML/JS) running on GitHub Pages using byte-range requests against GitHub Releases.
  * Documentation for server CORS setup (R2, S3, Nginx) and mobile offline asset embedding.
* **Out-of-Scope Non-Goals (Explicitly Decoupled):**
  * Search, geocoding, and reverse geocoding engines (Photon / Nominatim) — deferred to separate project.
  * Turn-by-turn routing graph solvers (Valhalla / OSRM) — deferred to separate project.
  * Central hosted tile server infrastructure, API key management, or commercial billing tiers.
  * Live GPS fleet tracking and dynamic traffic speed overlays.
  * 3D photogrammetric mesh models.

## Alternatives Weighed

* **Integrated Full-Stack Server vs Decoupled Static Pipeline:** Rejected bundling tile generation, search, and routing into a single monolithic server container. Decoupling search and routing eliminates operational infrastructure complexity and lets developers deploy static files without active daemon processes.
* **Tilemaker vs Planetiler:** Rejected Tilemaker in favor of Planetiler. Planetiler executes builds in under 5 minutes on standard hardware and provides robust OpenMapTiles schema support.
* **Dynamic MapLibre Multi-Source Switching vs GeoJSON Extraction:** Rejected attempting real-time coordinate-based layer swaps between local and remote sources in style rules. Selected `pmtiles extract` for city slicing, allowing identical coordinate projections and standard client loading.
* **Proprietary Font Rendering vs Noto Sans Merged Stack:** Rejected custom fonts. Selected Google Noto Sans + Noto Sans Ethiopic under Open Font License (OFL) to guarantee complete Unicode coverage and open distribution.

## Key Decisions & Staging for Next Steps

* **Repository Structure:** Monorepo containing:
  * `/pipeline`: Planetiler configurations, scripts, and GeoJSON city bounding polygons.
  * `/glyphs`: Source Noto fonts and PBF range generation scripts.
  * `/styles`: Master bilingual style JSON, Amharic-only style, and icon sprites.
  * `/adapter`: Composite PMTiles protocol handler supporting seamless local/remote hot-swapping.
  * `/tools`: `check-pmtiles` diagnostic tool.
  * `/examples`: Minimal Web testbench and mobile offline setup guide.
* **Resolved Policy on Missing Amharic Tags:** Adopted pure style-layer fallback cascade (`name:am` -> `name:en` -> `name`). Runtime phonetic transliteration is rejected for Milestone 1 to avoid ungrounded linguistic inaccuracies and compilation bloat.
* **Resolved Client Switching Architecture:** Adopted composite PMTiles adapter resolving tile queries against the local file first before transparently falling back to remote HTTP range requests.
