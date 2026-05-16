/**
 * Pre-fetch species photo URLs and write public/data/species/image-urls.json
 *
 * Usage:
 *   node scripts/cache-species-images.mjs
 *   node scripts/cache-species-images.mjs --limit 50
 *   node scripts/cache-species-images.mjs --delay 400
 *   node scripts/cache-species-images.mjs --refresh        # re-fetch all
 *   node scripts/cache-species-images.mjs --only-missing   # skip cached URLs
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  resolveSpeciesImageUrl,
  getScientificName,
  getCommonName,
  speciesUid,
} from './lib/speciesImageResolve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPECIES_PATH = join(root, 'public', 'data', 'species', 'species.json');
const OUT_PATH = join(root, 'public', 'data', 'species', 'image-urls.json');

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const delayIdx = args.indexOf('--delay');
const REFRESH = args.includes('--refresh');
const ONLY_MISSING = args.includes('--only-missing');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const DELAY_MS = delayIdx >= 0 ? parseInt(args[delayIdx + 1], 10) : 350;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function loadExisting() {
  if (!existsSync(OUT_PATH)) {
    return { generatedAt: null, images: {} };
  }
  try {
    return JSON.parse(readFileSync(OUT_PATH, 'utf8'));
  } catch {
    return { generatedAt: null, images: {} };
  }
}

function save(cache) {
  const withImage = Object.values(cache.images).filter(Boolean).length;
  const total = Object.keys(cache.images).length;
  cache.generatedAt = new Date().toISOString();
  cache.stats = {
    total,
    withImage,
    missing: total - withImage,
  };
  const tmp = `${OUT_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
  writeFileSync(OUT_PATH, readFileSync(tmp));
  try { unlinkSync(tmp); } catch { /* ignore */ }
}

async function main() {
  const speciesFile = JSON.parse(readFileSync(SPECIES_PATH, 'utf8'));
  const rows = speciesFile.species ?? [];
  const toProcess = rows.slice(0, Number.isFinite(LIMIT) ? LIMIT : rows.length);

  const cache = loadExisting();
  if (!cache.images) cache.images = {};

  console.log(`Species image cache — ${toProcess.length} to process (delay ${DELAY_MS}ms)`);
  console.log(`Output: ${OUT_PATH}\n`);

  let fetched = 0;
  let skipped = 0;
  let found = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i];
    const uid = speciesUid(row);
    const scientific = getScientificName(row);
    const common = getCommonName(row);

    const cached = cache.images[uid];
    if (!REFRESH) {
      if (ONLY_MISSING && cached?.url) {
        skipped++;
        continue;
      }
      if (!ONLY_MISSING && cached !== undefined) {
        skipped++;
        continue;
      }
    }

    if (!scientific) {
      cache.images[uid] = null;
      save(cache);
      continue;
    }

    process.stdout.write(`[${i + 1}/${toProcess.length}] ${uid} — ${scientific} ... `);

    try {
      const result = await resolveSpeciesImageUrl(scientific, common);
      cache.images[uid] = result
        ? { url: result.url, source: result.source }
        : null;
      if (result) found++;
      console.log(result ? `${result.source} ✓` : 'no image');
    } catch (err) {
      cache.images[uid] = null;
      console.log(`error: ${err.message}`);
    }

    fetched++;
    save(cache);
    await sleep(DELAY_MS);
  }

  save(cache);
  console.log('\nDone.');
  console.log(`  Newly fetched: ${fetched}`);
  console.log(`  Skipped (cached): ${skipped}`);
  console.log(`  With images: ${cache.stats.withImage} / ${cache.stats.total}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
