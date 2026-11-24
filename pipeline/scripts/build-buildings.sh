#!/usr/bin/env bash
# Builds buildings.pmtiles: footprints from Microsoft, Google Open Buildings and Esri that OSM doesn't have, with heights.
# Overture Maps already conflates those sources against OSM, so taking every Overture building with no OSM source
# gives the extra footprints without duplicating the OSM buildings in ethiopia.pmtiles.
# Needs: python3 (venv), tippecanoe >= 2.17 (writes .pmtiles), curl. Usage: build-buildings.sh [workdir] [outdir]
set -euo pipefail

WORK="${1:-data/buildings}"
OUT="${2:-dist}"
# pipeline/planetiler.properties bounds
BBOX="${BUILDINGS_BBOX:-32.99,3.40,47.98,14.89}"
S3="https://overturemaps-us-west-2.s3.amazonaws.com"

mkdir -p "$WORK" "$OUT"
if [ ! -x "$WORK/venv/bin/python" ]; then
  python3 -m venv "$WORK/venv"
  "$WORK/venv/bin/pip" install -q "duckdb>=1.4.1,<2"
fi

# Latest release unless pinned, e.g. OVERTURE_RELEASE=2026-10-22.0
RELEASE="${OVERTURE_RELEASE:-$(curl -sf "$S3/?list-type=2&prefix=release/&delimiter=/" | grep -o 'release/[0-9][^/<]*' | sort | tail -1 | cut -d/ -f2)}"
[ -n "$RELEASE" ] || { echo "could not find an Overture release" >&2; exit 1; }
echo "==> Overture $RELEASE buildings in $BBOX without an OSM source"

rm -f "$WORK/buildings.fgb"
IFS=, read -r W S E N <<<"$BBOX"
"$WORK/venv/bin/python" -I - "$RELEASE" "$W" "$S" "$E" "$N" "$WORK/buildings.fgb" <<'PY'
import sys, duckdb
release, w, s, e, n, out = sys.argv[1], *map(float, sys.argv[2:6]), sys.argv[6]
db = duckdb.connect()
db.execute("INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
db.execute(f"""
COPY (
  SELECT
    -- Overture height, else floors x 3 m; tiles without either fall back to the style's 5 m default
    round(coalesce(height, num_floors * 3.0), 1) AS render_height,
    round(coalesce(min_height, 0), 1) AS render_min_height,
    list_transform(sources, x -> x.dataset)[1] AS source,
    geometry
  FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=buildings/type=building/*', hive_partitioning=1)
  WHERE bbox.xmin < {e} AND bbox.xmax > {w} AND bbox.ymin < {n} AND bbox.ymax > {s}
    AND NOT list_contains(list_transform(sources, x -> x.dataset), 'OpenStreetMap')
    AND NOT coalesce(is_underground, false)
) TO '{out}' WITH (FORMAT GDAL, DRIVER 'FlatGeobuf', SRS 'EPSG:4326')
""")
print(db.execute(f"SELECT count(*) FROM ST_Read('{out}')").fetchone()[0], "buildings")
PY

echo "==> Tiling z13-z15"
# Same layer name as OpenMapTiles so the style's building filters carry over
tippecanoe -f -o "$OUT/buildings.pmtiles" -l building -Z13 -z15 --drop-densest-as-needed \
  --attribution "© Overture Maps Foundation (ODbL): Microsoft, Google Open Buildings, Esri" \
  "$WORK/buildings.fgb"
ls -la "$OUT/buildings.pmtiles"
