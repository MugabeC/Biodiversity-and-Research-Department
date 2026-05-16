/**
 * Refresh description_short from Wikipedia (complete sentences, no mid-sentence cuts).
 *
 * Usage:
 *   node scripts/enrich-species-descriptions.mjs
 *   node scripts/enrich-species-descriptions.mjs --taxa birds
 *   node scripts/enrich-species-descriptions.mjs --only-truncated
 *   node scripts/enrich-species-descriptions.mjs --only-missing
 *   node scripts/enrich-species-descriptions.mjs --delay 400
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { fetchWikipediaDescription } from './lib/wikipediaExtract.mjs';
import { getScientificName, getCommonName } from './lib/speciesImageResolve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(root, 'public', 'data', 'species');

const TAXA_FILES = [
  'birds.json',
  'plants.json',
  'amphibians-reptiles.json',
  'fish.json',
  'aquatic_inverts.json',
  'butterflies.json',
  'mammals.json',
];

const args = process.argv.slice(2);
const taxaIdx = args.indexOf('--taxa');
const onlyTruncated = args.includes('--only-truncated');
const onlyMissing = args.includes('--only-missing');
const delayIdx = args.indexOf('--delay');
const TAXA_FILTER = taxaIdx >= 0 ? args[taxaIdx + 1] : null;
const DELAY_MS = delayIdx >= 0 ? parseInt(args[delayIdx + 1], 10) : 300;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isTruncated(desc) {
  return !desc || desc.endsWith('…') || desc.endsWith('...');
}

function rebuildSpeciesJson() {
  const allSpecies = [];
  const byTaxa = {};
  for (const file of TAXA_FILES) {
    const filePath = join(DATA_DIR, file);
    if (!existsSync(filePath)) continue;
    const { taxa, species } = JSON.parse(readFileSync(filePath, 'utf8'));
    byTaxa[taxa] = species.length;
    allSpecies.push(...species);
  }
  const speciesPath = join(DATA_DIR, 'species.json');
  const existing = existsSync(speciesPath)
    ? JSON.parse(readFileSync(speciesPath, 'utf8'))
    : { summary: [] };
  writeFileSync(
    speciesPath,
    JSON.stringify(
      { total: allSpecies.length, byTaxa, summary: existing.summary || [], species: allSpecies },
      null,
      2
    )
  );
  console.log(`Rebuilt species.json (${allSpecies.length} records)`);
}

async function main() {
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of TAXA_FILES) {
    const filePath = join(DATA_DIR, file);
    if (!existsSync(filePath)) continue;

    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    if (TAXA_FILTER && data.taxa !== TAXA_FILTER) continue;

    const species = data.species ?? [];
    console.log(`\n── ${data.taxa} (${species.length}) ──`);

    for (let i = 0; i < species.length; i++) {
      const row = species[i];
      const scientific = getScientificName(row);
      const common = getCommonName(row);

      if (!scientific) {
        skipped++;
        continue;
      }

      if (onlyTruncated && !isTruncated(row.description_short)) {
        skipped++;
        continue;
      }

      if (onlyMissing && row.description_short && !isTruncated(row.description_short)) {
        skipped++;
        continue;
      }

      process.stdout.write(`[${i + 1}/${species.length}] ${common || scientific} … `);

      try {
        const desc = await fetchWikipediaDescription(scientific, common);
        if (desc) {
          row.description_short = desc;
          updated++;
          console.log(`✓ (${desc.length} chars)`);
        } else {
          console.log('no extract');
          skipped++;
        }
      } catch (err) {
        console.log(`error: ${err.message}`);
        failed++;
      }

      if ((i + 1) % 15 === 0) {
        writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
      await sleep(DELAY_MS);
    }

    writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  rebuildSpeciesJson();
  console.log(`\nDone. Updated: ${updated} | Skipped: ${skipped} | Errors: ${failed}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
