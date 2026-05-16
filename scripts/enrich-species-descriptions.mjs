/**
 * Refresh description_short from Wikipedia (complete sentences, no mid-sentence cuts).
 * Updates public/data/species/species.json in place.
 *
 * Usage:
 *   node scripts/enrich-species-descriptions.mjs
 *   node scripts/enrich-species-descriptions.mjs --taxa birds
 *   node scripts/enrich-species-descriptions.mjs --only-truncated
 *   node scripts/enrich-species-descriptions.mjs --only-missing
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { fetchWikipediaDescription } from './lib/wikipediaExtract.mjs';
import { getScientificName, getCommonName } from './lib/speciesImageResolve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPECIES_PATH = join(root, 'public', 'data', 'species', 'species.json');

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

async function main() {
  const data = JSON.parse(readFileSync(SPECIES_PATH, 'utf8'));
  const species = data.species ?? [];
  const todo = species.filter(row => {
    if (TAXA_FILTER && row.taxa !== TAXA_FILTER) return false;
    if (onlyTruncated) return isTruncated(row.description_short);
    if (onlyMissing) return !row.description_short || isTruncated(row.description_short);
    return true;
  });

  console.log(`Enriching ${todo.length} of ${species.length} species…\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < todo.length; i++) {
    const row = todo[i];
    const scientific = getScientificName(row);
    const common = getCommonName(row);

    if (!scientific) {
      skipped++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${todo.length}] ${common || scientific} … `);

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
      writeFileSync(SPECIES_PATH, JSON.stringify(data, null, 2));
    }
    await sleep(DELAY_MS);
  }

  writeFileSync(SPECIES_PATH, JSON.stringify(data, null, 2));
  console.log(`\nDone. Updated: ${updated} | Skipped: ${skipped} | Errors: ${failed}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
