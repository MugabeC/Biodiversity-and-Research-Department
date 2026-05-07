const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'data', 'geojson');

const SOURCE_DIRS = [
  path.join(ROOT, 'public', 'data', 'Restored Area under Arcos Partnership'),
  path.join(ROOT, 'public', 'data', 'TOPOGRAPHICAL_MAP_SHAPFILLES'),
];

function findShapefiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findShapefiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.shp')) {
      results.push(full);
    }
  }
  return results;
}

async function convertShapefile(shpPath) {
  const name = path.basename(shpPath, '.shp');
  const dbfPath = shpPath.replace(/\.shp$/i, '.dbf');
  const outPath = path.join(OUTPUT_DIR, `${name}.geojson`);

  const dbf = fs.existsSync(dbfPath) ? dbfPath : undefined;
  const source = await shapefile.open(shpPath, dbf, { encoding: 'UTF-8' });

  const features = [];
  let result = await source.read();
  while (!result.done) {
    features.push(result.value);
    result = await source.read();
  }

  const collection = {
    type: 'FeatureCollection',
    features,
  };

  fs.writeFileSync(outPath, JSON.stringify(collection, null, 2));
  return { name, features: features.length, outPath };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const shapefiles = SOURCE_DIRS.flatMap(findShapefiles);

  if (shapefiles.length === 0) {
    console.error('No shapefiles found in source directories.');
    process.exit(1);
  }

  console.log(`Found ${shapefiles.length} shapefile(s):\n`);

  for (const shpPath of shapefiles) {
    const rel = path.relative(ROOT, shpPath);
    try {
      const { name, features } = await convertShapefile(shpPath);
      console.log(`  ✓ ${name}.geojson  (${features} features)  ←  ${rel}`);
    } catch (err) {
      console.error(`  ✗ FAILED: ${rel}\n    ${err.message}`);
    }
  }

  console.log(`\nDone. GeoJSON files written to public/data/geojson/`);
}

main();
