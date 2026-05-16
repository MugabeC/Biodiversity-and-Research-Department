/**
 * Enriches birds.json with description_short and habitat_types from Wikipedia.
 * Skips birds that already have description_short.
 * Regenerates species.json from all individual taxa files when done.
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR   = path.join(__dirname, '../public/data/species');
const BIRDS_FILE = path.join(DATA_DIR, 'birds.json');

const HABITAT_KEYWORDS = {
  'forest':    'Forest',
  'woodland':  'Woodland',
  'wetland':   'Wetland',
  'grassland': 'Grassland',
  'savanna':   'Savanna',
  'savannah':  'Savanna',
  'riparian':  'Riparian',
  'aquatic':   'Aquatic',
  'montane':   'Montane forest',
  'shrub':     'Shrubland',
  'bush':      'Bushland',
  'marsh':     'Wetland',
  'reed':      'Wetland',
  'lake':      'Aquatic',
  'river':     'Riparian',
  'stream':    'Riparian',
  'water':     'Aquatic',
  'garden':    'Urban/Garden',
  'urban':     'Urban/Garden',
  'farmland':  'Farmland',
  'agricult':  'Farmland',
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'NEP-Biodiversity-Dashboard/1.0 (educational research)' },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error('JSON parse error')); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractHabitats(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Set();
  for (const [kw, label] of Object.entries(HABITAT_KEYWORDS)) {
    if (lower.includes(kw)) found.add(label);
  }
  return [...found].sort();
}

async function fetchWikipedia(scientificName) {
  const title = scientificName.replace(/ /g, '_');
  const url   = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const data  = await httpsGet(url);
  const extract = data.extract || '';
  // Keep complete sentences only (see scripts/lib/wikipediaExtract.mjs)
  const sentences = extract.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [extract];
  let short = '';
  for (const s of sentences) {
    if ((short + s).length > 1200 && short.length > 0) break;
    short += s;
  }
  short = short.trim() || extract;
  return { description_short: short, fullExtract: extract };
}

function rebuildSpeciesJson() {
  const taxa_files = [
    'birds.json', 'plants.json', 'amphibians-reptiles.json',
    'fish.json', 'aquatic_inverts.json', 'butterflies.json', 'mammals.json',
  ];
  const allSpecies = [];
  const byTaxa = {};

  for (const file of taxa_files) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) continue;
    const { taxa, species } = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    byTaxa[taxa] = species.length;
    allSpecies.push(...species);
  }

  // Preserve existing summary if present
  const existing = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'species.json'), 'utf8'));
  const combined = {
    total:   allSpecies.length,
    byTaxa,
    summary: existing.summary || [],
    species: allSpecies,
  };
  fs.writeFileSync(path.join(DATA_DIR, 'species.json'), JSON.stringify(combined));
  console.log(`\nRebuilt species.json — ${allSpecies.length} total records`);
}

async function main() {
  const file  = JSON.parse(fs.readFileSync(BIRDS_FILE, 'utf8'));
  const birds = file.species;

  const todo = birds.filter(b => !b.description_short);
  console.log(`Birds total: ${birds.length}  |  Already enriched: ${birds.length - todo.length}  |  To fetch: ${todo.length}\n`);

  let ok = 0, skipped = 0, errors = 0;

  for (let i = 0; i < todo.length; i++) {
    const bird = todo[i];
    process.stdout.write(`[${i + 1}/${todo.length}] ${bird.commonName} (${bird.scientificName}) … `);

    if (!bird.scientificName || bird.scientificName.trim() === '') {
      console.log('skip (no scientific name)');
      skipped++;
      continue;
    }

    try {
      const { description_short, fullExtract } = await fetchWikipedia(bird.scientificName);

      if (!description_short) {
        console.log('no extract');
        skipped++;
      } else {
        const habitats = extractHabitats(fullExtract);
        // Merge into the actual bird record in the main array
        const record = birds.find(b => b.id === bird.id);
        record.description_short = description_short;
        if (habitats.length > 0 && !record.habitat_types) {
          record.habitat_types = habitats;
        }
        console.log(`✓  ${description_short.length} chars${habitats.length ? '  habitats: ' + habitats.join(', ') : ''}`);
        ok++;
      }
    } catch (e) {
      console.log(`✗  ${e.message}`);
      errors++;
    }

    // Save progress every 10 birds in case of interruption
    if ((i + 1) % 10 === 0) {
      file.species = birds;
      fs.writeFileSync(BIRDS_FILE, JSON.stringify(file, null, 2));
    }

    await sleep(2000);
  }

  // Final save
  file.species = birds;
  fs.writeFileSync(BIRDS_FILE, JSON.stringify(file, null, 2));

  console.log(`\n── Summary ──────────────────────`);
  console.log(`Fetched OK : ${ok}`);
  console.log(`No extract : ${skipped}`);
  console.log(`Errors     : ${errors}`);
  console.log(`Total enriched now: ${birds.filter(b => b.description_short).length} / ${birds.length}`);

  rebuildSpeciesJson();
}

main().catch(console.error);
