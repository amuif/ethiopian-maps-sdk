#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Effect } from 'effect';

// The pipeline scripts use repo-relative paths, so everything runs from the repo root
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

export const USAGE = `ethiomap <command> [options]

  build      [--data data] [--out dist] [--no-slices]   OSM -> ethiopia.pmtiles (+ city slices)
  terrain    [--data data/terrain] [--out dist]         Copernicus GLO-30 -> terrain.pmtiles
  buildings  [--data data/buildings] [--out dist]       Overture footprints -> buildings.pmtiles
  check      <pmtiles-url>                              Check a host serves CORS + byte ranges
  serve                                                 Serve styles, glyphs and dist/ on :3000
  stack      [up|down] [--traffic]                      Self-hosted search, routing, traffic

Options for terrain/buildings scripts (TERRAIN_MAX_Z, BUILDINGS_BBOX, ...) pass through as env vars.`;

export type Step = [cmd: string, ...args: string[]];

/** Turns argv into the commands to run, or a usage error. Kept pure so it can be tested without running anything. */
export function plan(argv: string[]): Step[] | string {
  const [command, ...rest] = argv;
  const { values: o, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: { data: { type: 'string' }, out: { type: 'string' }, 'no-slices': { type: 'boolean' }, traffic: { type: 'boolean' } },
  });
  const out = o.out ?? 'dist';
  switch (command) {
    case 'build': {
      const data = o.data ?? 'data';
      const steps: Step[] = [
        ['bash', 'pipeline/scripts/fetch-osm.sh', data],
        ['bash', 'pipeline/scripts/generate-tiles.sh', data, out],
      ];
      if (!o['no-slices']) steps.push(['bash', 'pipeline/scripts/slice-cities.sh', `${out}/ethiopia.pmtiles`, `${out}/slices`]);
      return steps;
    }
    case 'terrain':
      return [['bash', 'pipeline/scripts/build-terrain.sh', o.data ?? 'data/terrain', out]];
    case 'buildings':
      return [['bash', 'pipeline/scripts/build-buildings.sh', o.data ?? 'data/buildings', out]];
    case 'check':
      return positionals[0] ? [['bash', 'tools/check-pmtiles/cli.sh', positionals[0]]] : 'check needs a URL';
    case 'serve':
      return [['node', 'tools/serve.js']];
    case 'stack': {
      const action = positionals[0] ?? 'up';
      if (action !== 'up' && action !== 'down') return 'stack takes up or down';
      return [['docker', 'compose', '-f', 'stack/docker-compose.yml', ...(o.traffic ? ['--profile', 'traffic'] : []), action, ...(action === 'up' ? ['-d'] : [])]];
    }
    default:
      return command && command !== 'help' && command !== '--help' && command !== '-h' ? `unknown command: ${command}` : '';
  }
}

const run = ([cmd, ...args]: Step) =>
  Effect.callback<void, Error>((resume, signal) => {
    console.error(`$ ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', signal });
    child.on('error', (e) => resume(Effect.fail(e)));
    child.on('exit', (code) => resume(code === 0 ? Effect.void : Effect.fail(new Error(`${cmd} exited with ${code}`))));
  });

if (process.argv[1] && fileURLToPath(import.meta.url) === (await import('node:fs')).realpathSync(process.argv[1])) {
  let steps: Step[] | string;
  try {
    steps = plan(process.argv.slice(2));
  } catch (e) {
    steps = (e as Error).message; // parseArgs rejects unknown flags
  }
  if (typeof steps === 'string') {
    console.error(steps ? `${steps}\n\n${USAGE}` : USAGE);
    process.exit(steps ? 2 : 0);
  }
  Effect.runPromise(Effect.forEach(steps, run, { discard: true })).catch((e) => {
    console.error(`ethiomap: ${e.message}`);
    process.exit(1);
  });
}
