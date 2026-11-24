import assert from 'node:assert';
import http from 'node:http';
import { search, reverse, route, decodePolyline, ServiceError, amharicInstruction } from './dist/index.js';

// Fake Nominatim
const seen = [];
// Minimal precision-6 encoder so the fake server can return real Valhalla shapes
const enc = (pts) => { let o = '', pl = 0, pn = 0; const e = (v) => { v = v < 0 ? ~(v << 1) : v << 1; while (v >= 0x20) { o += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } o += String.fromCharCode(v + 63); };
  for (const [lon, lat] of pts) { const a = Math.round(lat * 1e6), b = Math.round(lon * 1e6); e(a - pl); e(b - pn); pl = a; pn = b; } return o; };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  seen.push(u);
  res.setHeader('content-type', 'application/json');
  if (u.pathname === '/search' && u.searchParams.get('q') === 'boom') return res.writeHead(503).end('down');
  if (u.pathname === '/search')
    return res.end(JSON.stringify([{ lat: '9.03', lon: '38.76', name: 'መስቀል አደባባይ', display_name: 'መስቀል አደባባይ, አዲስ አበባ', category: 'place', type: 'square', boundingbox: ['9.0', '9.1', '38.7', '38.8'] }]));
  if (u.pathname === '/route') {
    let body = '';
    req.on('data', (c) => (body += c));
    return req.on('end', () => {
      seen.push(JSON.parse(body));
      // Two legs sharing (38.75, 9.0); precision-6 shapes
      const leg = (shape) => ({ shape, maneuvers: [{ type: 10, street_names: ['ቦሌ መንገድ'], instruction: 'Turn right onto ቦሌ መንገድ.', length: 1.2, time: 90, begin_shape_index: 0 }] });
      res.end(JSON.stringify({ trip: { summary: { length: 2.5, time: 200 }, legs: [leg(enc([[38.74, 9.01], [38.75, 9.0]])), leg(enc([[38.75, 9.0], [38.76, 9.02]]))] } }));
    });
  }
  if (u.searchParams.get('lat') === '0') return res.end(JSON.stringify({ error: 'Unable to geocode' }));
  res.end(JSON.stringify({ lat: '9.03', lon: '38.76', display_name: 'Meskel Square, Addis Ababa', category: 'place', type: 'square' }));
});
await new Promise((r) => server.listen(0, r));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;

const [p] = await search('መስቀል', { baseUrl, language: 'am' });
assert.deepEqual(p, { name: 'መስቀል አደባባይ', label: 'መስቀል አደባባይ, አዲስ አበባ', lon: 38.76, lat: 9.03, bbox: [38.7, 9.0, 38.8, 9.1], category: 'place', type: 'square' });
assert.equal(seen[0].searchParams.get('accept-language'), 'am');
assert.equal(seen[0].searchParams.get('countrycodes'), 'et');

assert.equal((await reverse([38.76, 9.03], { baseUrl })).name, 'Meskel Square');
assert.equal(await reverse([0, 0], { baseUrl }), null);

await assert.rejects(search('boom', { baseUrl }), (e) => e instanceof ServiceError && e.status === 503);
// Google's reference vector (precision 5), read back as [lon, lat]
assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5), [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
const r = await route([[38.74, 9.01], [38.75, 9.0], [38.76, 9.02]], { baseUrl, profile: 'pedestrian' });
assert.deepEqual(r.geometry.coordinates, [[38.74, 9.01], [38.75, 9.0], [38.76, 9.02]]);
assert.equal(r.maneuvers.length, 2);
assert.deepEqual(r.maneuvers[1].location, [38.75, 9.0]);
assert.equal(seen.at(-1).costing, 'pedestrian');
const am = await route([[38.74, 9.01], [38.76, 9.02]], { baseUrl, language: 'am' });
assert.equal(seen.at(-1).directions_options.language, 'en-US');
assert.equal(am.maneuvers[0].instruction, 'ወደ ቀኝ ታጠፍ፤ ቦሌ መንገድ።');
assert.equal(amharicInstruction({ type: 26, roundabout_exit_count: 2 }), 'ወደ አደባባዩ ግባና በ2ኛው መውጫ ውጣ።');
assert.equal(amharicInstruction({ type: 4, street_names: ['x'] }), 'መድረሻህ ደርሰሃል።');
server.close();
console.log('ok');
