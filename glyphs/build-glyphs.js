// Builds SDF glyph PBFs from fonts/*.ttf (file name = fontstack name) into dist/.
// Combined fontstacks the styles request (e.g. "Ethiopic,Latin") come from combinations.json.
// Requires: cargo install build_pbf_glyphs
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const bin = process.env.BUILD_PBF_GLYPHS || 'build_pbf_glyphs';

try {
  execFileSync(bin, ['--overwrite', '-c', path.join(dir, 'combinations.json'), path.join(dir, 'fonts'), path.join(dir, 'dist')], { stdio: 'inherit' });
} catch (err) {
  if (err.code === 'ENOENT') console.error(`${bin} not found. Install it with: cargo install build_pbf_glyphs`);
  process.exit(1);
}
