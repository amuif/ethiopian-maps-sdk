import assert from 'node:assert';
import http from 'node:http';
import { createApp, parseTrace } from './dist/app.js';
import { TrafficStore, samplesFromMatch } from './dist/aggregate.js';

// Precision-6 polyline encoder for fake Valhalla shapes
const enc = (pts) => { let o = '', pl = 0, pn = 0; const e = (v) => { v = v < 0 ? ~(v << 1) : v << 1; while (v >= 0x20) { o += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } o += String.fromCharCode(v + 63); };
  for (const [lon, lat] of pts) { const a = Math.round(lat * 1e6), b = Math.round(lon * 1e6); e(a - pl); e(b - pn); pl = a; pn = b; } return o; };

// One 1.1 km edge; vehicle covers all of it in 120 s => 33 km/h vs 50 expected
const match = {
  shape: enc([[38.74, 9.0], [38.745, 9.0], [38.75, 9.0]]),
  edges: [{ way_id: 42, length: 1.1, speed: 50, begin_shape_index: 0, end_shape_index: 2 }],
  matched_points: [
    { type: 'matched', edge_index: 0, distance_along_edge: 0 },
    { type: 'unmatched' },
    { type: 'matched', edge_index: 0, distance_along_edge: 0.5 },
    { type: 'matched', edge_index: 0, distance_along_edge: 1 },
  ],
};
let valhallaStatus = 200;
let lastBody;
const valhalla = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    lastBody = JSON.parse(b);
    res.writeHead(valhallaStatus, { 'content-type': 'application/json' }).end(JSON.stringify(valhallaStatus === 200 ? match : { error: 'no match' }));
  });
});
await new Promise((r) => valhalla.listen(0, r));

// Pure aggregation
const [s] = samplesFromMatch(match, [0, 30, 60, 120]);
assert.equal(Math.round(s.observedKmh), 33);
assert.deepEqual(s.coordinates, [[38.74, 9.0], [38.745, 9.0], [38.75, 9.0]]);
assert.equal(samplesFromMatch(match, [0, 0, 0, 0]).length, 0); // no elapsed time => no speed

const store = new TrafficStore(15 * 60_000, 3);
const app = createApp({ valhallaUrl: `http://127.0.0.1:${valhalla.address().port}`, ingestToken: 'secret', salt: 'pepper', windowMinutes: 15, minVehicles: 3 }, store);
const points = [0, 30, 60, 120].map((t, i) => ({ lon: 38.74 + i * 0.003, lat: 9.0, time: 1_700_000_000 + t }));
const post = (body, token = 'secret') =>
  app.fetch(new Request('http://x/v1/traces', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const traffic = async () => (await app.fetch(new Request('http://x/v1/traffic.geojson'))).json();

assert.equal((await post({ vehicleId: 'bus-1', points }, 'wrong')).status, 401);
assert.equal((await post({ vehicleId: 'bus-1', points: points.slice(0, 1) })).status, 400);
assert.equal(typeof parseTrace({ vehicleId: 'a', points: [points[1], points[0]] }), 'string'); // out of order
assert.equal(typeof parseTrace({ vehicleId: 'a', points: [{ lon: 500, lat: 0, time: 1 }, points[0]] }), 'string');

// k-anonymity: one vehicle reporting repeatedly is still one vehicle
assert.equal((await post({ vehicleId: 'bus-1', points })).status, 202);
assert.equal(lastBody.use_timestamps, true);
await post({ vehicleId: 'bus-1', points });
await post({ vehicleId: 'bus-2', points });
assert.equal((await traffic()).features.length, 0);

await post({ vehicleId: 'bus-3', points });
const fc = await traffic();
assert.equal(fc.features.length, 1);
assert.deepEqual(fc.features[0].properties, { wayId: 42, speedKmh: 33, expectedKmh: 50, ratio: 0.66, vehicles: 3 });
assert.ok(!JSON.stringify(fc).includes('bus-'), 'vehicle ids must never be published');

// Window expiry
assert.equal(store.geojson(Date.now() + 16 * 60_000).features.length, 0);

// Valhalla can't match => 422, nothing stored
valhallaStatus = 400;
assert.equal((await post({ vehicleId: 'bus-4', points })).status, 422);

valhalla.close();
console.log('ok');
