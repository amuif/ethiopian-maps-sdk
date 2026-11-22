#!/usr/bin/env bash
set -euo pipefail

# Configuration
GEOFABRIK_BASE_URL="https://download.geofabrik.de/africa"
OSM_FILENAME="ethiopia-latest.osm.pbf"
MD5_FILENAME="${OSM_FILENAME}.md5"
OUTPUT_DIR="${1:-data}"

mkdir -p "${OUTPUT_DIR}"

echo "==> Fetching OpenStreetMap extract for Ethiopia from Geofabrik..."
echo "    Target directory: ${OUTPUT_DIR}"

# Download PBF with resume support
if [ -f "${OUTPUT_DIR}/${OSM_FILENAME}" ]; then
  echo "    Existing PBF file found. Checking for updates via curl -C -..."
  curl -L -C - -o "${OUTPUT_DIR}/${OSM_FILENAME}" "${GEOFABRIK_BASE_URL}/${OSM_FILENAME}"
else
  curl -L -o "${OUTPUT_DIR}/${OSM_FILENAME}" "${GEOFABRIK_BASE_URL}/${OSM_FILENAME}"
fi

# Download MD5 checksum
echo "==> Fetching MD5 checksum..."
curl -sL -o "${OUTPUT_DIR}/${MD5_FILENAME}" "${GEOFABRIK_BASE_URL}/${MD5_FILENAME}"

# Verify MD5
echo "==> Verifying MD5 checksum..."
cd "${OUTPUT_DIR}"
if command -v md5sum >/dev/null 2>&1; then
  md5sum -c "${MD5_FILENAME}"
elif command -v md5 >/dev/null 2>&1; then
  EXPECTED_MD5=$(awk '{print $1}' "${MD5_FILENAME}")
  ACTUAL_MD5=$(md5 -q "${OSM_FILENAME}")
  if [ "${EXPECTED_MD5}" != "${ACTUAL_MD5}" ]; then
    echo "ERROR: MD5 mismatch! Expected ${EXPECTED_MD5}, got ${ACTUAL_MD5}" >&2
    exit 1
  fi
  echo "${OSM_FILENAME}: OK"
else
  echo "WARNING: Neither md5sum nor md5 found on system. Checksum verification skipped." >&2
fi

echo "==> Successfully downloaded and verified ${OUTPUT_DIR}/${OSM_FILENAME}"
