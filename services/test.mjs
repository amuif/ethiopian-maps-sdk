import assert from 'node:assert';
import http from 'node:http';
import { search, reverse, ServiceError } from './dist/index.js';

// Fake Nominatim
const seen = [];
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  seen.push(u);
  res.setHeader('content-type', 'application/json');
  if (u.pathname === '/search' && u.searchParams.get('q') === 'boom') return res.writeHead(503).end('down');
  if (u.pathname === '/search')
    return res.end(JSON.stringify([{ lat: '9.03', lon: '38.76', name: 'መስቀል አደባባይ', display_name: 'መስቀል አደባባይ, አዲስ አበባ', category: 'place', type: 'square', boundingbox: ['9.0', '9.1', '38.7', '38.8'] }]));
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
server.close();
console.log('ok');
