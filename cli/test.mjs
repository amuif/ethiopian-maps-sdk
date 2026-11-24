import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { plan } from './dist/index.js';

assert.deepEqual(plan(['build', '--out', 'o', '--no-slices']), [
  ['bash', 'pipeline/scripts/fetch-osm.sh', 'data'],
  ['bash', 'pipeline/scripts/generate-tiles.sh', 'data', 'o'],
]);
assert.deepEqual(plan(['build']).at(-1), ['bash', 'pipeline/scripts/slice-cities.sh', 'dist/ethiopia.pmtiles', 'dist/slices']);
assert.deepEqual(plan(['stack', '--traffic']), [['docker', 'compose', '-f', 'stack/docker-compose.yml', '--profile', 'traffic', 'up', '-d']]);
assert.equal(typeof plan(['check']), 'string');
assert.equal(typeof plan(['nope']), 'string');
assert.throws(() => plan(['build', '--bogus']));

// Real run from another cwd: help exits 0, a failing step propagates its exit code
const bin = new URL('./dist/index.js', import.meta.url).pathname;
assert.match(spawnSync('node', [bin], { cwd: '/', encoding: 'utf8' }).stderr, /ethiomap <command>/);
const r = spawnSync('node', [bin, 'check', 'http://127.0.0.1:1/x.pmtiles'], { cwd: '/', encoding: 'utf8' });
assert.equal(r.status, 1);
assert.match(r.stderr, /\$ bash tools\/check-pmtiles\/cli.sh/);
console.log('ok');
