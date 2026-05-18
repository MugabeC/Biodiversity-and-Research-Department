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
} as const;

export async function fetchMapGeoJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load map data (${res.status})`);
  }
  return res.json();
}
