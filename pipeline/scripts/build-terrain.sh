#!/usr/bin/env bash
# Builds terrain.pmtiles (Mapbox terrain-RGB, 512 px PNG) from Copernicus GLO-30 for the Ethiopia bounds.
# Needs: curl, python3 (venv), pmtiles CLI. Usage: build-terrain.sh [workdir] [outdir]
set -euo pipefail

WORK="${1:-data/terrain}"
OUT="${2:-dist}"
# z10 = ~76 m/px at 512 px tiles; z11 doubles detail but ~4x size (whole bbox would exceed GitHub's 2 GB asset limit)
MAX_Z="${TERRAIN_MAX_Z:-10}"
MIN_Z="${TERRAIN_MIN_Z:-5}"
# Integer-degree tile range covering pipeline/planetiler.properties bounds (32.99,3.40,47.98,14.89)
LON_MIN="${TERRAIN_LON_MIN:-32}" LON_MAX="${TERRAIN_LON_MAX:-47}"
LAT_MIN="${TERRAIN_LAT_MIN:-3}" LAT_MAX="${TERRAIN_LAT_MAX:-14}"
BASE="https://copernicus-dem-30m.s3.amazonaws.com"
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$WORK/dem" "$OUT"

if [ ! -x "$WORK/venv/bin/rio" ]; then
  python3 -m venv "$WORK/venv"
  "$WORK/venv/bin/pip" install -q "rio-rgbify==0.4.0" "rasterio>=1.4"
fi

echo "==> Downloading Copernicus GLO-30 tiles (${LON_MIN}..${LON_MAX}E, ${LAT_MIN}..${LAT_MAX}N)"
for lat in $(seq "$LAT_MIN" "$LAT_MAX"); do
  for lon in $(seq "$LON_MIN" "$LON_MAX"); do
    name=$(printf "Copernicus_DSM_COG_10_N%02d_00_E%03d_00_DEM" "$lat" "$lon")
    f="$WORK/dem/$name.tif"
    [ -s "$f" ] && continue
    # 404 = no land in that square (Copernicus omits pure-ocean tiles); anything else is a real failure
    code=$(curl -sL --retry 3 -o "$f.part" -w '%{http_code}' "$BASE/$name/$name.tif")
    case "$code" in
      200) mv "$f.part" "$f" ;;
      404|403) rm -f "$f.part" ;;
      *) echo "download failed ($code): $name" >&2; exit 1 ;;
    esac
  done
done
ls "$WORK"/dem/*.tif >/dev/null 2>&1 || { echo "no DEM tiles downloaded" >&2; exit 1; }

echo "==> Mosaicking"
"$WORK/venv/bin/python" -I "$SCRIPTS/mosaic-vrt.py" "$WORK/mosaic.vrt" "$WORK"/dem/*.tif

echo "==> Encoding terrain-RGB z${MIN_Z}-z${MAX_Z}"
rm -f "$WORK/terrain.mbtiles"
"$WORK/venv/bin/rio" rgbify -b -10000 -i 0.1 --min-z "$MIN_Z" --max-z "$MAX_Z" -j "$(nproc)" --format png \
  "$WORK/mosaic.vrt" "$WORK/terrain.mbtiles"

echo "==> Converting to PMTiles"
pmtiles convert "$WORK/terrain.mbtiles" "$OUT/terrain.pmtiles"
ls -la "$OUT/terrain.pmtiles"
