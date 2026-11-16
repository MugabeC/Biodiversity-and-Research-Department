/**
 * Sizes for map features, computed in the browser from the GeoJSON itself
 * (the files only carry CAD properties, no lengths or areas).
 */

type Position = number[]; // [lon, lat]
type GeometryLike = { type: string; coordinates?: unknown };
type FeatureLike = { properties?: Record<string, unknown> | null; geometry: GeometryLike };
export type FeatureCollectionLike = { features: FeatureLike[] };

const EARTH_R = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

function haversine(a: Position, b: Position): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

function lineLength(coords: Position[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1], coords[i]);
  return total;
}

/** Unsigned area of one ring in m², projecting to local metres around the ring's mean latitude. */
function ringArea(ring: Position[]): number {
  if (ring.length < 3) return 0;
  const lat0 = ring.reduce((t, p) => t + p[1], 0) / ring.length;
  const kx = EARTH_R * Math.cos(toRad(lat0)) * (Math.PI / 180);
  const ky = EARTH_R * (Math.PI / 180);
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = ring[i][0] * kx, y1 = ring[i][1] * ky;
    const x2 = ring[i + 1][0] * kx, y2 = ring[i + 1][1] * ky;
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

function polygonMeasure(rings: Position[][]): { area: number; perimeter: number } {
  if (!rings.length) return { area: 0, perimeter: 0 };
  const holes = rings.slice(1).reduce((t, r) => t + ringArea(r), 0);
  return { area: Math.max(0, ringArea(rings[0]) - holes), perimeter: lineLength(rings[0]) };
}

/** length (m) for lines; area (m²) and outer perimeter (m) for polygons. */
export function measureGeometry(g: GeometryLike): { length: number; area: number; perimeter: number } {
  const c = g.coordinates as never;
  switch (g.type) {
    case 'LineString':
      return { length: lineLength(c as Position[]), area: 0, perimeter: 0 };
    case 'MultiLineString':
      return { length: (c as Position[][]).reduce((t, l) => t + lineLength(l), 0), area: 0, perimeter: 0 };
    case 'Polygon': {
      const m = polygonMeasure(c as Position[][]);
      return { length: 0, ...m };
    }
    case 'MultiPolygon': {
      let area = 0, perimeter = 0;
      for (const poly of c as Position[][][]) {
        const m = polygonMeasure(poly);
        area += m.area;
        perimeter += m.perimeter;
      }
      return { length: 0, area, perimeter };
    }
    default:
      return { length: 0, area: 0, perimeter: 0 };
  }
}

/**
 * Adds to every feature's properties:
 *   _size       length in m (lines) or area in m² (polygons) of this feature
 *   _perimeter  outer perimeter in m (polygons)
 *   _typeTotal  total _size of all features sharing the same `typeKey` value
 *   _typeCount  how many features share it
 * Mutates the collection and returns it.
 */
export function annotateMeasures<T extends FeatureCollectionLike>(fc: T, typeKey = 'Layer'): T {
  const totals = new Map<string, { size: number; count: number }>();
  for (const f of fc.features) {
    const m = measureGeometry(f.geometry);
    const size = m.area > 0 ? m.area : m.length;
    const props = (f.properties ??= {});
    props._size = Math.round(size * 10) / 10;
    props._perimeter = Math.round(m.perimeter);
    const key = String(props[typeKey] ?? '');
    const t = totals.get(key) ?? { size: 0, count: 0 };
    t.size += size;
    t.count += 1;
    totals.set(key, t);
  }
  for (const f of fc.features) {
    const props = f.properties as Record<string, unknown>;
    const t = totals.get(String(props[typeKey] ?? ''))!;
    props._typeTotal = Math.round(t.size * 10) / 10;
    props._typeCount = t.count;
  }
  return fc;
}
