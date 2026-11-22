/**
 * Map layer GeoJSON, served from the site itself (public/data/map) so the map keeps working
 * even if the Supabase project is paused. Large layers are simplified to well under 1 MB.
 */
export const MAP_GEOJSON = {
  boundary: '/data/map/boundary.geojson',
  restored: '/data/map/restored.geojson',
  trails: '/data/map/trails.geojson',
  drainage: '/data/map/drainage.geojson',
  roads: '/data/map/roads.geojson',
  openGrounds: '/data/map/open-grounds.geojson',
  // Converted from a Strava GPX recording.
  accessTrail: '/data/map/access-trail.geojson',
  // Survey areas (invasive species removal, pond, macadamia) from the GPS tracks recorded 16 Nov 2026.
  surveyAreas: '/data/map/survey-areas.geojson',
} as const;

export async function fetchMapGeoJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load map data (${res.status})`);
  }
  return res.json();
}
