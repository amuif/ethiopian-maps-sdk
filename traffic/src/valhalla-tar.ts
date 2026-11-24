import { closeSync, openSync, readSync, writeSync } from 'node:fs';

// Layout from valhalla/baldr/traffictile.h and scripts/valhalla_build_extract:
// each tar entry "<level>/<tile digits>.gph" = 32-byte header (<2Q4I: tile_id, last_update, edge_count, version, spare×2)
// then one little-endian u64 TrafficSpeed per directed edge.
const HEADER = 32;

/** GraphId bits (valhalla/baldr/graphid.h): level 3, tile 22, edge index 21 */
export const splitGraphId = (id: number) => ({ level: id % 8, tile: Math.floor(id / 8) % 2 ** 22, index: Math.floor(id / 2 ** 25) % 2 ** 21 });

/** Uniform speed over the whole edge (2 km/h resolution, breakpoint1 = 255). 0 = no live data. */
export function encodeSpeed(kmh: number): bigint {
  const s = BigInt(Math.max(1, Math.min(252, Math.round(kmh))) >> 1); // 0 would mean "closed"
  return s | (s << 7n) | (255n << 28n);
}

/** Byte offset of each tile's traffic data in traffic.tar, keyed "level/tile". */
export function indexTrafficTar(fd: number) {
  const tiles = new Map<string, { offset: number; edges: number }>();
  const block = Buffer.alloc(512);
  const head = Buffer.alloc(HEADER);
  for (let pos = 0; readSync(fd, block, 0, 512, pos) === 512 && block[0] !== 0; ) {
    const field = (a: number, b: number) => block.toString('latin1', a, b).replace(/\0.*$/s, '');
    const name = (field(345, 500) ? field(345, 500) + '/' : '') + field(0, 100);
    const size = parseInt(field(124, 136).trim(), 8);
    const data = pos + 512;
    const m = /^(\d)\/([\d/]+)\.gph$/.exec(name);
    if (m && size >= HEADER) {
      readSync(fd, head, 0, HEADER, data);
      tiles.set(`${m[1]}/${Number(m[2].replace(/\//g, ''))}`, { offset: data, edges: head.readUInt32LE(16) });
    }
    pos = data + Math.ceil(size / 512) * 512;
  }
  return tiles;
}

/**
 * Writes live speeds into Valhalla's memory-mapped traffic.tar in place; Valhalla sees them on the next request, no restart.
 * Edges written last time but missing now are reset to "no data". Returns the edge ids written, to pass back as `previous`.
 */
export function writeLiveSpeeds(path: string, speeds: Map<number, number>, previous: Set<number> = new Set(), now = Date.now()) {
  const fd = openSync(path, 'r+');
  try {
    const tiles = indexTrafficTar(fd);
    const buf = Buffer.alloc(8);
    const touched = new Set<string>();
    const written = new Set<number>();
    const put = (edge: number, value: bigint) => {
      const { level, tile, index } = splitGraphId(edge);
      const t = tiles.get(`${level}/${tile}`);
      if (!t || index >= t.edges) return false; // edge from another graph build: skip, don't corrupt
      buf.writeBigUInt64LE(value);
      writeSync(fd, buf, 0, 8, t.offset + HEADER + index * 8);
      touched.add(`${level}/${tile}`);
      return true;
    };
    for (const edge of previous) if (!speeds.has(edge)) put(edge, 0n);
    for (const [edge, kmh] of speeds) if (put(edge, encodeSpeed(kmh))) written.add(edge);
    buf.writeBigUInt64LE(BigInt(Math.floor(now / 1000)));
    for (const key of touched) writeSync(fd, buf, 0, 8, tiles.get(key)!.offset + 8);
    return written;
  } finally {
    closeSync(fd);
  }
}
