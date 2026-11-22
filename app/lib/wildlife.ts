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
  monthly: Period[];
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
  // last 24 months, including months with no records
  const monthly: Period[] = [];
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  for (let i = 23; i >= 0; i--) {
    const idx = ty * 12 + (tm - 1) - i, y = Math.floor(idx / 12), m = (idx % 12) + 1;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    monthly.push(monthsAll.find(p => p.key === key) ?? { key, label: `${MONTH_SHORT[m - 1]} ${String(y).slice(2)}`, species: 0, observations: 0, newSpecies: 0 });
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
    monthly,
    yearly,
    groups: [...groupCount.entries()].map(([group, species]) => ({ group, species })).sort((a, b) => b.species - a.species),
    recentNew: [...first.entries()].filter(([, d]) => d >= cutoff).sort((a, b) => b[1].localeCompare(a[1]))
      .map(([name, date]) => ({ name, common: meta.get(name)?.common ?? null, group: groupLabel(meta.get(name)?.group ?? null), date })),
    sources: [...sourceCount.entries()].map(([source, observations]) => ({ source, observations })),
    firstDate: obs.length ? obs[0].observed_on : null,
  };
}
