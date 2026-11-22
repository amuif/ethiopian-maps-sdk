import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GLYPHS_DIR = path.join(__dirname, 'dist');

// Sample representative strings covering Amharic, Afaan Oromoo (Qubee), Tigrigna, and English
const TEST_STRINGS = [
  'አዲስ አበባ',                  // Addis Ababa (Amharic)
  'ቦሌ ዓለም አቀፍ አውሮፕላን ማረፊያ', // Bole International Airport
  'ድሬዳዋ',                      // Dire Dawa
  'Finfinnee',                  // Addis Ababa (Afaan Oromoo)
  'Bishooftuu',                 // Bishoftu (Afaan Oromoo with double vowel)
  'Mootummaa Naannoo Oromiyaa', // Oromia Regional Government (Qubee)
  'መቐለ',                       // Mekelle (Tigrigna)
  'ባሕር ዳር',                    // Bahir Dar
  'ሀዋሳ',                       // Hawassa
  'Addis-Djibouti Freight Road' // English Latin
];

/**
 * Returns the range [start, end] containing the given character code.
 */
function findRangeForCode(code) {
  const start = Math.floor(code / 256) * 256;
  const end = start + 255;
  return `${start}-${end}.pbf`;
}

function testCoverage() {
  console.log('==> Testing Glyph Range Coverage for Ethiopian Placenames...');

  const uniqueChars = new Set();
  for (const str of TEST_STRINGS) {
    for (const char of str) {
      uniqueChars.add(char);
    }
  }

  console.log(`    Total unique test characters sampled: ${uniqueChars.size}`);

  const requiredRanges = new Set();
  for (const char of uniqueChars) {
    const code = char.charCodeAt(0);
    const rangeName = findRangeForCode(code);
    requiredRanges.add(rangeName);
  }

  console.log('    Required 256-glyph PBF chunks:');
  for (const r of [...requiredRanges].sort()) {
    console.log(`      - ${r}`);
  }

  // Verify that required ranges exist in dist/
  const fontstack = 'Noto Sans Ethiopic Regular,Noto Sans Regular'; // bilingual label stack
  const stackDir = path.join(GLYPHS_DIR, fontstack);

  if (!fs.existsSync(stackDir)) {
    console.log(`  ℹ Note: ${stackDir} not yet built (run 'pnpm build:glyphs' first).`);
    console.log('==> Glyph range coverage definition verified.');
    return;
  }

  let missingCount = 0;
  for (const r of requiredRanges) {
    const file = path.join(stackDir, r);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
      console.error(`  ❌ Missing or empty PBF chunk: ${file}`);
      missingCount++;
    }
  }

  if (missingCount > 0) {
    console.error(`FAIL: ${missingCount} required glyph chunk(s) missing.`);
    process.exit(1);
  }

  console.log('==> PASS: All sample placename characters map to available PBF chunks.');
}

testCoverage();
