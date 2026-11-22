#!/usr/bin/env bash
set -euo pipefail

MASTER_PMTILES="${1:-dist/ethiopia.pmtiles}"
OUTPUT_DIR="${2:-dist/slices}"
SLICES_JSON="pipeline/slices.json"
TMP_DIR="/tmp/ethiomap_slices"

if [ ! -f "${MASTER_PMTILES}" ]; then
  echo "ERROR: Master PMTiles file not found at ${MASTER_PMTILES}" >&2
  exit 1
fi

if ! command -v pmtiles >/dev/null 2>&1; then
  echo "ERROR: 'pmtiles' CLI utility is required for slicing." >&2
  echo "       Install via: go install github.com/protomaps/go-pmtiles@latest" >&2
  echo "       or download from https://github.com/protomaps/go-pmtiles/releases" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: 'jq' utility is required to parse slices.json." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}" "${TMP_DIR}"

echo "==> Slicing city extracts from ${MASTER_PMTILES}..."

# Read city IDs from slices.json
CITY_IDS=$(jq -r '.features[].properties.id' "${SLICES_JSON}")

for CITY_ID in ${CITY_IDS}; do
  NAME_EN=$(jq -r ".features[] | select(.properties.id == \"${CITY_ID}\") | .properties.name_en" "${SLICES_JSON}")
  FILENAME=$(jq -r ".features[] | select(.properties.id == \"${CITY_ID}\") | .properties.output_filename" "${SLICES_JSON}")
  TMP_GEOJSON="${TMP_DIR}/${CITY_ID}.geojson"
  DEST_FILE="${OUTPUT_DIR}/${FILENAME}"

  echo "  --> Extracting ${NAME_EN} -> ${DEST_FILE}..."

  # Extract single geometry Feature to temp file for pmtiles CLI
  jq ".features[] | select(.properties.id == \"${CITY_ID}\")" "${SLICES_JSON}" > "${TMP_GEOJSON}"

  # Run pmtiles extract
  pmtiles extract "${MASTER_PMTILES}" "${DEST_FILE}" --region="${TMP_GEOJSON}"

  # Verify generated slice
  pmtiles verify "${DEST_FILE}"

  # Assert file size constraint (< 45 MB)
  FILE_SIZE_BYTES=$(wc -c < "${DEST_FILE}")
  FILE_SIZE_MB=$(( FILE_SIZE_BYTES / 1024 / 1024 ))
  echo "      Size: ${FILE_SIZE_MB} MB"

  if [ "${FILE_SIZE_MB}" -gt 45 ]; then
    echo "WARNING: Slice ${DEST_FILE} exceeds the 45 MB budget threshold (${FILE_SIZE_MB} MB)!" >&2
  fi
done

# Cleanup temp files
rm -rf "${TMP_DIR}"

echo "==> City slicing complete. Generated archives:"
ls -lh "${OUTPUT_DIR}"/*.pmtiles
