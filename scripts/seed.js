const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '..', 'NEP_Biodiversity_Index_Corrected.xlsx');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', 'species');

// Each sheet's header row index and column-to-key mapping (index 0 is always "No." / id)
const SHEET_CONFIG = {
  Birds: {
    file: 'birds.json',
    taxa: 'birds',
    keys: ['id', 'order', 'family', 'commonName', 'scientificName', 'status'],
  },
  Plants: {
    file: 'plants.json',
    taxa: 'plants',
    keys: ['id', 'order', 'family', 'scientificName', 'iucnGlobal', 'albertineRiftEndemic'],
  },
  'Amphibians & Reptiles': {
    file: 'amphibians-reptiles.json',
    taxa: 'amphibians-reptiles',
    keys: ['id', 'group', 'family', 'commonName', 'scientificName', 'iucnGlobal', 'endemism'],
  },
  Fish: {
    file: 'fish.json',
    taxa: 'fish',
    keys: ['id', 'family', 'commonName', 'scientificName', 'iucn', 'origin'],
  },
  'Aquatic Inverts': {
    file: 'aquatic_inverts.json',
    taxa: 'aquatic_inverts',
    keys: ['id', 'class', 'order', 'family', 'genusSpecies', 'pollutionTolerance'],
  },
  Butterflies: {
    file: 'butterflies.json',
    taxa: 'butterflies',
    keys: ['id', 'family', 'scientificName', 'commonName', 'iucn', 'feedingGroup'],
  },
  Mammals: {
    file: 'mammals.json',
    taxa: 'mammals',
    keys: ['id', 'order', 'family', 'commonName', 'scientificName', 'iucn', 'endemism'],
  },
};

// Row index 0 = title banner, index 1 = empty, index 2 = real column headers → data starts at 3
const DATA_START_ROW = 3;

function parseSheet(ws, config) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const species = [];

  for (let i = DATA_START_ROW; i < rows.length; i++) {
    const row = rows[i];
    // Stop at empty rows or rows where the first cell is not a number
    if (!row || typeof row[0] !== 'number') continue;

    const record = { taxa: config.taxa };
    config.keys.forEach((key, col) => {
      if (key === 'id') {
        record.id = row[0];
        return;
      }
      const raw = row[col];
      record[key] = raw !== undefined && raw !== null ? String(raw).trim() : '';
    });

    species.push(record);
  }

  return species;
}

function parseSummary(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  // Summary header is at row index 4
  const headers = ['taxaGroup', 'count2023', 'count2025', 'change', 'iucnThreatened', 'invasiveSpp', 'newRecords2025', 'databaseTab'];
  const summary = [];

  for (let i = 5; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0] || typeof row[0] !== 'string') continue;
    const record = {};
    headers.forEach((key, col) => {
      const raw = row[col];
      record[key] = raw !== undefined && raw !== null ? String(raw).trim() : '';
    });
    summary.push(record);
  }

  return summary;
}

function main() {
  if (!fs.existsSync(EXCEL_FILE)) {
    console.error(`ERROR: Excel file not found at ${EXCEL_FILE}`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const wb = XLSX.readFile(EXCEL_FILE);
  const allSpecies = [];
  const counts = {};

  for (const [sheetName, config] of Object.entries(SHEET_CONFIG)) {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      console.warn(`  WARN: Sheet "${sheetName}" not found — skipping`);
      continue;
    }

    const species = parseSheet(ws, config);
    counts[config.taxa] = species.length;

    const outPath = path.join(OUTPUT_DIR, config.file);
    fs.writeFileSync(outPath, JSON.stringify({ taxa: config.taxa, count: species.length, species }, null, 2));
    console.log(`  ✓ ${config.file.padEnd(28)} ${species.length} records`);

    allSpecies.push(...species);
  }

  // Parse summary stats
  const summarySheet = wb.Sheets['Summary'];
  const summary = summarySheet ? parseSummary(summarySheet) : [];

  // Write combined species.json
  const combined = {
    total: allSpecies.length,
    byTaxa: counts,
    summary,
    species: allSpecies,
  };

  const combinedPath = path.join(OUTPUT_DIR, 'species.json');
  fs.writeFileSync(combinedPath, JSON.stringify(combined, null, 2));
  console.log(`  ✓ ${'species.json'.padEnd(28)} ${allSpecies.length} total records`);
  console.log('\nDone. Output written to public/data/species/');
}

main();
