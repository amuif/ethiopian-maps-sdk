import assert from 'node:assert';
import { CompositePMTilesProtocol } from './dist/index.js';
const mk = (impl) => ({ getZxy: impl });
const ac = new AbortController(); const url = 'x://a/10/600/500';
const p = new CompositePMTilesProtocol({ remoteUrl: 'http://x/r.pmtiles' });
p.remotePMTiles = mk(async () => ({ data: 'R' }));
p.localPMTiles = mk(async () => ({ data: 'L' }));
assert.deepEqual(await p.tile({ url }, ac), { data: 'L' });
p.localPMTiles = mk(async () => { throw new Error('io'); });
assert.deepEqual(await p.tile({ url }, ac), { data: 'R' });
p.localPMTiles = mk(async () => undefined);
p.remotePMTiles = mk(async () => undefined);
assert.equal((await p.tile({ url }, ac)).data.length, 0);
p.remotePMTiles = mk(async () => { throw new Error('net'); });
await assert.rejects(p.tile({ url }, ac));
console.log('ok');

// Terrain helper
const { addTerrain } = await import('./dist/style.js');
const base = { sources: { omt: {} }, layers: [{ id: 'bg', type: 'background' }, { id: 'water', type: 'fill' }, { id: 'road', type: 'line' }] };
const t = addTerrain(base, { url: 'https://x/terrain.pmtiles' });
assert.deepEqual(t.layers.map((l) => l.id), ['bg', 'water', 'hillshade', 'road']);
assert.equal(t.sources.terrain.url, 'pmtiles://https://x/terrain.pmtiles');
assert.deepEqual(t.terrain, { source: 'terrain', exaggeration: 1 });
const n = addTerrain(base, { url: 'file:///t.pmtiles', terrain3d: false, hillshade: false });
assert.equal(n.terrain, undefined);
assert.equal(n.layers.length, 3);
assert.equal(base.layers.length, 3); // input untouched
console.log('terrain ok');
