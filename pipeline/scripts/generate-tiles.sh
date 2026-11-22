#!/usr/bin/env bash
set -euo pipefail

# Versions
PLANETILER_VERSION="0.8.2"
PLANETILER_JAR="planetiler-${PLANETILER_VERSION}.jar"
PLANETILER_URL="https://github.com/onthegomap/planetiler/releases/download/v${PLANETILER_VERSION}/planetiler.jar"

DATA_DIR="${1:-data}"
DIST_DIR="${2:-dist}"
OSM_PBF="${DATA_DIR}/ethiopia-latest.osm.pbf"
OUTPUT_PMTILES="${DIST_DIR}/ethiopia.pmtiles"
CONFIG_FILE="pipeline/planetiler.properties"

mkdir -p "${DIST_DIR}" "${DATA_DIR}"

# 1. Ensure OSM PBF exists
if [ ! -f "${OSM_PBF}" ]; then
  echo "==> OSM PBF missing at ${OSM_PBF}. Running fetch-osm.sh..."
  bash pipeline/scripts/fetch-osm.sh "${DATA_DIR}"
fi

# 2. Download Planetiler JAR if missing
ARGS=(--config="${CONFIG_FILE}" --osm-path="${OSM_PBF}" --output="${OUTPUT_PMTILES}" --force)

if command -v java >/dev/null 2>&1; then
  if [ ! -f "${PLANETILER_JAR}" ]; then
    echo "==> Downloading Planetiler v${PLANETILER_VERSION}..."
    curl -L -o "${PLANETILER_JAR}" "${PLANETILER_URL}"
  fi
  echo "==> Building ethiopia.pmtiles via Planetiler (Java)..."
  java -Xmx4g -XX:+UseG1GC -jar "${PLANETILER_JAR}" "${ARGS[@]}"
elif command -v docker >/dev/null 2>&1; then
  echo "==> Java not found; building ethiopia.pmtiles via Planetiler Docker image..."
  docker run --rm -u "$(id -u):$(id -g)" -e JAVA_TOOL_OPTIONS="-Xmx4g" -v "$(pwd)":/work -w /work \
    "ghcr.io/onthegomap/planetiler:${PLANETILER_VERSION}" "${ARGS[@]}"
else
  echo "ERROR: Planetiler needs Java 21+ or Docker." >&2
  exit 1
fi

echo "==> Planetiler compilation complete: ${OUTPUT_PMTILES}"

# 5. Verify PMTiles archive integrity if pmtiles CLI is available
if command -v pmtiles >/dev/null 2>&1; then
  echo "==> Verifying archive integrity via pmtiles verify..."
  pmtiles verify "${OUTPUT_PMTILES}"
  echo "==> Verification passed."
else
  echo "==> pmtiles CLI not installed locally. Verification skipped (handled in CI)."
fi

echo "==> Data build complete: $(ls -lh "${OUTPUT_PMTILES}")"
