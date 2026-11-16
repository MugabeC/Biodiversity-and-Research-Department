/** Map layer GeoJSON — public Supabase Storage (not bundled in the repo). */

const SUPABASE_STORAGE =
  'https://dakgnvnaqiosizouuciy.supabase.co/storage/v1/object/public/Biodiversity%20and%20Research%20Department';

export const MAP_GEOJSON = {
  boundary: `${SUPABASE_STORAGE}/Surveyed_boundary.geojson`,
  restored: `${SUPABASE_STORAGE}/Nyandungu.geojson`,
  trails: `${SUPABASE_STORAGE}/trails.geojson`,
  drainage: `${SUPABASE_STORAGE}/drainage.geojson`,
  roads: `${SUPABASE_STORAGE}/roads.geojson`,
  openGrounds: `${SUPABASE_STORAGE}/open-grounds.geojson`,
  // Converted from a Strava GPX recording; served from /public.
  accessTrail: '/data/map/access-trail.geojson',
  // Survey areas (invasive species removal, pond, macadamia) from the GPS tracks
  // recorded 16 Nov 2026; closed polygons with sizes. Served from /public.
  surveyAreas: '/data/map/survey-areas.geojson',
} as const;

export async function fetchMapGeoJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load map data (${res.status})`);
  }
  return res.json();
}
