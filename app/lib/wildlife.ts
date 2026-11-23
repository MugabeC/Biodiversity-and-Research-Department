/**
 * Wildlife records made inside Nyandungu Eco-Park, collected from iNaturalist (research grade) and eBird by the
 * species-sync function and stored in Supabase. This file reads them and works out the monthly and yearly counts.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/app/lib/documents';

export type Observation = { source: string; scientific_name: string; common_name: string | null; taxon_group: string | null; observed_on: string };
export type SyncStatus = { last_run: string | null; last_ok: string | null; inat_count: number | null; ebird_count: number | null; ebird_enabled: boolean; message: string | null };

const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` };

export async function fetchObservations(): Promise<Observation[]> {
  const out: Observation[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/species_observations?select=source,scientific_name,common_name,taxon_group,observed_on&order=observed_on.asc&limit=1000&offset=${offset}`, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load the wildlife records.');
    const rows = (await res.json()) as Observation[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export async function fetchSyncStatus(): Promise<SyncStatus | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/species_sync?select=*&id=eq.1`, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    return ((await res.json()) as SyncStatus[])[0] ?? null;
  } catch {
    return null;
  }
}

export const GROUP_LABEL: Record<string, string> = {
  Aves: 'Birds', Mammalia: 'Mammals', Reptilia: 'Reptiles', Amphibia: 'Amphibians', Actinopterygii: 'Fish', Insecta: 'Insects',
  Arachnida: 'Spiders and relatives', Mollusca: 'Molluscs', Plantae: 'Plants', Fungi: 'Fungi',
};
export const groupLabel = (g: string | null) => (g ? GROUP_LABEL[g] ?? g : 'Other');

export type Period = { key: string; label: string; species: number; observations: number; newSpecies: number };
export type WildlifeSummary = {
  totalSpecies: number;
  totalObservations: number;
  thisYear: Period;
  thisMonth: Period;
  quarterly: Period[];
  yearly: Period[];
  groups: { group: string; species: number }[];
  recentNew: { name: string; common: string | null; group: string; date: string }[];
  sources: { source: string; observations: number }[];
  firstDate: string | null;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const rwandaToday = () => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);

/** `today` is a date like 2026-11-22 (Rwanda time). */
export function summarize(obs: Observation[], today: string): WildlifeSummary {
  const year = today.slice(0, 4), monthKey = today.slice(0, 7);
  const first = new Map<string, string>(); // species -> first date
  const meta = new Map<string, { common: string | null; group: string | null }>();
  for (const o of obs) {
    const f = first.get(o.scientific_name);
    if (!f || o.observed_on < f) first.set(o.scientific_name, o.observed_on);
    if (!meta.has(o.scientific_name) || (!meta.get(o.scientific_name)!.common && o.common_name)) meta.set(o.scientific_name, { common: o.common_name, group: o.taxon_group });
  }

  const build = (keyOf: (d: string) => string, labelOf: (k: string) => string): Period[] => {
    const species = new Map<string, Set<string>>(), count = new Map<string, number>(), fresh = new Map<string, number>();
    for (const o of obs) {
      const k = keyOf(o.observed_on);
      if (!species.has(k)) species.set(k, new Set());
      species.get(k)!.add(o.scientific_name);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    for (const [name, date] of first) { const k = keyOf(date); fresh.set(k, (fresh.get(k) ?? 0) + 1); void name; }
    return [...species.keys()].sort().map(k => ({ key: k, label: labelOf(k), species: species.get(k)!.size, observations: count.get(k) ?? 0, newSpecies: fresh.get(k) ?? 0 }));
  };

  const monthsAll = build(d => d.slice(0, 7), k => `${MONTH_SHORT[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`);
  const yearly = build(d => d.slice(0, 4), k => k);
  const qKey = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
  const quartersAll = build(qKey, k => `Q${k.slice(6)} ${k.slice(2, 4)}`);
  // the last 12 quarters, including quarters with no records; the current quarter is part of the list
  const quarterly: Period[] = [];
  const tq = Number(today.slice(0, 4)) * 4 + Math.floor((Number(today.slice(5, 7)) - 1) / 3);
  for (let i = 11; i >= 0; i--) {
    const idx = tq - i, y = Math.floor(idx / 4), q = (idx % 4) + 1;
    const key = `${y}-Q${q}`;
    quarterly.push(quartersAll.find(p => p.key === key) ?? { key, label: `Q${q} ${String(y).slice(2)}`, species: 0, observations: 0, newSpecies: 0 });
  }
  const empty = (key: string, label: string): Period => ({ key, label, species: 0, observations: 0, newSpecies: 0 });
  const groupCount = new Map<string, number>();
  for (const name of first.keys()) { const g = groupLabel(meta.get(name)?.group ?? null); groupCount.set(g, (groupCount.get(g) ?? 0) + 1); }
  const cutoff = new Date(Date.parse(today) - 120 * 86400000).toISOString().slice(0, 10);
  const sourceCount = new Map<string, number>();
  for (const o of obs) sourceCount.set(o.source, (sourceCount.get(o.source) ?? 0) + 1);

  return {
    totalSpecies: first.size,
    totalObservations: obs.length,
    thisYear: yearly.find(p => p.key === year) ?? empty(year, year),
    thisMonth: monthsAll.find(p => p.key === monthKey) ?? empty(monthKey, monthKey),
    quarterly,
    yearly,
    groups: [...groupCount.entries()].map(([group, species]) => ({ group, species })).sort((a, b) => b.species - a.species),
    recentNew: [...first.entries()].filter(([, d]) => d >= cutoff).sort((a, b) => b[1].localeCompare(a[1]))
      .map(([name, date]) => ({ name, common: meta.get(name)?.common ?? null, group: groupLabel(meta.get(name)?.group ?? null), date })),
    sources: [...sourceCount.entries()].map(([source, observations]) => ({ source, observations })),
    firstDate: obs.length ? obs[0].observed_on : null,
  };
}

// ── map dots ──────────────────────────────────────────────────────────────
export type MapObservation = { source: string; scientific_name: string; common_name: string | null; observed_on: string; lat: number | null; lon: number | null };
/** eBird records are made at one hotspot, so they are drawn at the hotspot's point. */
export const EBIRD_POINT = { lon: 30.1461196, lat: -1.9540988 };

export async function fetchMapObservations(): Promise<MapObservation[]> {
  const out: MapObservation[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/species_observations?select=source,scientific_name,common_name,observed_on,lat,lon&order=observed_on.asc&limit=1000&offset=${offset}`, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load the wildlife records.');
    const rows = (await res.json()) as MapObservation[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const CELL = 0.0004; // about 45 metres: records this close share one dot

type DotFeature = { type: 'Feature'; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Record<string, string | number> };

/** One dot per place, with how many species and records were logged there and when. `from` and `to` (years like "2025") limit the records to those years, both included; leave them null for every year. */
export function wildlifeDots(obs: MapObservation[], from: string | null, to: string | null = from): { type: 'FeatureCollection'; features: DotFeature[] } {
  const cells = new Map<string, { src: string; lons: number[]; lats: number[]; species: Map<string, { label: string; last: string }>; records: number; first: string; last: string }>();
  for (const o of obs) {
    const y = o.observed_on.slice(0, 4);
    if ((from && y < from) || (to && y > to)) continue;
    const ebird = o.source === 'ebird';
    const lon = ebird ? EBIRD_POINT.lon : o.lon, lat = ebird ? EBIRD_POINT.lat : o.lat;
    if (lon == null || lat == null) continue;
    const key = ebird ? 'ebird' : `${Math.round(lon / CELL)}:${Math.round(lat / CELL)}`;
    let c = cells.get(key);
    if (!c) { c = { src: ebird ? 'eBird hotspot' : 'iNaturalist', lons: [], lats: [], species: new Map(), records: 0, first: o.observed_on, last: o.observed_on }; cells.set(key, c); }
    c.lons.push(lon); c.lats.push(lat); c.records += 1;
    if (o.observed_on < c.first) c.first = o.observed_on;
    if (o.observed_on > c.last) c.last = o.observed_on;
    const prev = c.species.get(o.scientific_name);
    if (!prev || o.observed_on > prev.last) c.species.set(o.scientific_name, { label: o.common_name ?? o.scientific_name, last: o.observed_on });
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const features: DotFeature[] = [];
  for (const c of cells.values()) {
    const names = [...c.species.values()].sort((a, b) => b.last.localeCompare(a.last)).slice(0, 40).map(s => `${s.label}~${s.last}`).join('|');
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [mean(c.lons), mean(c.lats)] },
      properties: { species: c.species.size, records: c.records, first: c.first, last: c.last, source: c.src, names },
    });
  }
  return { type: 'FeatureCollection', features };
}
