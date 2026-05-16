/**
 * Extract only map-visible layers from full topo GeoJSON into small files.
 * Run after updating source shapefiles: node scripts/build-map-geojson.mjs
 *
 * Source (local only, gitignored): Topo_polylines.geojson, Topo_polygon.geojson
 * Output (committed): public/data/geojson/map/*.geojson
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'public', 'data', 'geojson');
const OUT = join(SRC, 'map');

const TRAIL_LAYERS = new Set(['PEDESTRIAN WALKWAYS AND TRAILS']);
const ROAD_LAYERS = new Set(['MAIN ROAD_PEDESTRIAN', 'INTERNAL SERVICE ROAD', 'EXISTING EARTHROAD']);
const OPEN_GROUND_LAYERS = new Set(['BAMBOO_TREE', 'GARDEN', 'BOTANIC GARDEN']);

function isDrainageLayer(layer) {
  if (!layer) return false;
  const L = String(layer).toUpperCase();
  return L.includes('DRAINAGE') || L.includes('DRAIN');
}

function roundCoords(coords, decimals = 5) {
  if (typeof coords[0] === 'number') {
    return coords.map(c => +Number(c).toFixed(decimals));
  }
  return coords.map(c => roundCoords(c, decimals));
}

/** Reduce dense rings — keeps shape at park map zoom without huge files. */
function simplifyRing(ring, maxPoints = 120) {
  if (!ring?.length) return ring;
  if (ring.length <= maxPoints) return roundCoords(ring);
  const step = Math.ceil(ring.length / maxPoints);
  const out = [];
  for (let i = 0; i < ring.length; i += step) out.push(ring[i]);
  const last = ring[ring.length - 1];
  const tail = out[out.length - 1];
  if (tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
  return roundCoords(out);
}

/** Keep largest polygon parts only — source bamboo layers have 100+ micro-parts per feature. */
function trimForMap(geom, maxParts = 20, maxRingPoints = 64) {
  if (!geom?.coordinates) return null;
  if (geom.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geom.coordinates.map(ring => simplifyRing(ring, maxRingPoints)),
    };
  }
  if (geom.type === 'MultiPolygon') {
    const ranked = geom.coordinates
      .map(poly => ({ poly, len: poly[0]?.length ?? 0 }))
      .sort((a, b) => b.len - a.len)
      .slice(0, maxParts);
    return {
      type: 'MultiPolygon',
      coordinates: ranked.map(({ poly }) => poly.map(ring => simplifyRing(ring, maxRingPoints))),
    };
  }
  return null;
}

function simplifyGeometry(geom) {
  if (!geom?.coordinates) return null;
  const trimmed = trimForMap(geom);
  if (trimmed) return trimmed;
  if (geom.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geom.coordinates.map(ring => simplifyRing(ring)),
    };
  }
  if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map(poly => poly.map(ring => simplifyRing(ring))),
    };
  }
  if (geom.type === 'LineString') {
    return {
      type: 'LineString',
      coordinates: simplifyRing(geom.coordinates, 200),
    };
  }
  return {
    type: geom.type,
    coordinates: roundCoords(geom.coordinates),
  };
}

function slimFeature(f, simplify = false) {
  const geom = f.geometry;
  if (!geom?.coordinates) return null;
  const geometry = simplify ? simplifyGeometry(geom) : {
    type: geom.type,
    coordinates: roundCoords(geom.coordinates),
  };
  if (!geometry) return null;
  return {
    type: 'Feature',
    properties: { Layer: f.properties?.Layer ?? '' },
    geometry,
  };
}

function polygonToLine(f) {
  const ring = f.geometry?.coordinates?.[0];
  if (!ring || ring.length < 2) return null;
  return {
    type: 'Feature',
    properties: { Layer: f.properties?.Layer ?? '' },
    geometry: {
      type: 'LineString',
      coordinates: simplifyRing(ring, 200),
    },
  };
}

function writeCollection(path, features) {
  const fc = { type: 'FeatureCollection', features };
  writeFileSync(path, JSON.stringify(fc));
  return features.length;
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function main() {
  const polylinePath = join(SRC, 'Topo_polylines.geojson');
  const polygonPath = join(SRC, 'Topo_polygon.geojson');

  if (!existsSync(polylinePath) || !existsSync(polygonPath)) {
    console.error('Missing source files. Need locally:');
    console.error(' ', polylinePath);
    console.error(' ', polygonPath);
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });

  console.log('Reading Topo_polylines.geojson…');
  const polylines = JSON.parse(readFileSync(polylinePath, 'utf8'));
  console.log('Reading Topo_polygon.geojson…');
  const polygons = JSON.parse(readFileSync(polygonPath, 'utf8'));

  const trails = [];
  const drainage = [];
  const roads = [];
  const openGrounds = [];

  for (const f of polylines.features) {
    const layer = f.properties?.Layer ?? '';
    const slim = slimFeature(f);
    if (!slim) continue;
    if (TRAIL_LAYERS.has(layer)) trails.push(slim);
    else if (isDrainageLayer(layer)) drainage.push(slim);
    else if (ROAD_LAYERS.has(layer)) roads.push(slim);
  }

  for (const f of polygons.features) {
    const layer = f.properties?.Layer ?? '';
    if (OPEN_GROUND_LAYERS.has(layer)) {
      const slim = slimFeature(f, true);
      if (slim) openGrounds.push(slim);
    } else if (isDrainageLayer(layer)) {
      const line = polygonToLine(f);
      if (line) drainage.push(line);
    }
  }

  const counts = {
    trails: writeCollection(join(OUT, 'trails.geojson'), trails),
    drainage: writeCollection(join(OUT, 'drainage.geojson'), drainage),
    roads: writeCollection(join(OUT, 'roads.geojson'), roads),
    'open-grounds': writeCollection(join(OUT, 'open-grounds.geojson'), openGrounds),
  };

  console.log('\nMap layer files written to public/data/geojson/map/');
  for (const name of Object.keys(counts)) {
    const p = join(OUT, `${name}.geojson`);
    const size = readFileSync(p).length;
    console.log(`  ${name}.geojson — ${counts[name]} features, ${mb(size)}`);
  }

  const total = ['trails', 'drainage', 'roads', 'open-grounds'].reduce(
    (s, n) => s + readFileSync(join(OUT, `${n}.geojson`)).length,
    0
  );
  console.log(`\nTotal map layers: ${mb(total)} (was ~348 MB full topo)`);
}

main();
