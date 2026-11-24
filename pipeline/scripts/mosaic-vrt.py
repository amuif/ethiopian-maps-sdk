"""Write a GDAL VRT mosaic of same-resolution GeoTIFFs (replaces gdalbuildvrt; only rasterio needed).

Usage: python mosaic-vrt.py out.vrt tile1.tif tile2.tif ...
"""
import sys
from xml.sax.saxutils import escape

import rasterio

out, paths = sys.argv[1], sys.argv[2:]
if not paths:
    sys.exit("mosaic-vrt: no input tiles")

tiles = []
for p in paths:
    with rasterio.open(p) as d:
        tiles.append((p, d.transform, d.width, d.height, d.dtypes[0], d.nodata))

res_x, res_y = tiles[0][1].a, tiles[0][1].e
for p, t, *_ in tiles:
    # shortcut: assumes one resolution (true for Copernicus GLO-30 below 50° lat); resample first otherwise
    assert abs(t.a - res_x) < 1e-12 and abs(t.e - res_y) < 1e-12, f"{p}: resolution differs"

west = min(t.c for _, t, *_ in tiles)
north = max(t.f for _, t, *_ in tiles)
east = max(t.c + w * t.a for _, t, w, *_ in tiles)
south = min(t.f + h * t.e for _, t, _, h, *_ in tiles)
width, height = round((east - west) / res_x), round((south - north) / res_y)
dtype = {"float32": "Float32", "int16": "Int16", "uint16": "UInt16", "float64": "Float64"}[tiles[0][4]]
nodata = tiles[0][5]

sources = "".join(
    f"""
    <ComplexSource>
      <SourceFilename relativeToVRT="0">{escape(p)}</SourceFilename>
      <SourceBand>1</SourceBand>
      <SrcRect xOff="0" yOff="0" xSize="{w}" ySize="{h}"/>
      <DstRect xOff="{round((t.c - west) / res_x)}" yOff="{round((t.f - north) / res_y)}" xSize="{w}" ySize="{h}"/>
      {f'<NODATA>{nodata}</NODATA>' if nodata is not None else ''}
    </ComplexSource>"""
    for p, t, w, h, *_ in tiles
)
with open(out, "w") as f:
    f.write(
        f"""<VRTDataset rasterXSize="{width}" rasterYSize="{height}">
  <SRS>EPSG:4326</SRS>
  <GeoTransform>{west!r}, {res_x!r}, 0, {north!r}, 0, {res_y!r}</GeoTransform>
  <VRTRasterBand dataType="{dtype}" band="1">
    {f'<NoDataValue>{nodata}</NoDataValue>' if nodata is not None else ''}{sources}
  </VRTRasterBand>
</VRTDataset>
"""
    )
print(f"mosaic-vrt: {len(tiles)} tiles, {width}x{height} px -> {out}")
