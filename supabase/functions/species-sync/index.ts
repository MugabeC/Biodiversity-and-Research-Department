// Supabase Edge Function: species-sync
//
// Collects wildlife records made inside Nyandungu Eco-Park from iNaturalist (research grade only) and, when an eBird key
// is set, from the eBird hotspot. Records are stored in public.species_observations and counted on the Wildlife page.
//
// It runs every day (pg_cron) and can also be started from the staff tools. It only reads public data and is limited to
// one run every 20 minutes, unless the staff password (secret UPLOAD_PASSWORD) is sent to force a run.
//
// Optional secret: EBIRD_API_KEY (free key from https://ebird.org/api/keygen).
//
// eBird's "recent" service only goes back 30 days. To load older records, start it with { password, backfill: { from, to } }
// (dates like 2025-11-23). It reads the hotspot one day at a time, for as long as its time budget allows, and answers with
// { backfill: { next, limited } }: the day to continue from (null when the whole range is done), and whether eBird asked us to slow down.
//
// A long load can also run on its own: the row in public.ebird_backfill holds the next day to read, and a scheduled job
// (pg_cron, every 5 minutes) calls this function with { continue: true } until the range is done. That call needs no password:
// it only reads public eBird data for a range already stored in the database.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SITE = 'https://biodiversity-and-research-departmen-roan.vercel.app';
const EBIRD_HOTSPOT = 'L4235382';
const MIN_GAP_MS = 20 * 60 * 1000;
const MAX_PAGES = 60;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function same(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const A = new Uint8Array(x), B = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < A.length; i++) diff |= A[i] ^ B[i];
  return diff === 0;
}

type Ring = number[][];
type Polygon = Ring[];

/** The park boundary from the website's map layer, as polygons of [lon, lat] rings. */
async function loadBoundary(): Promise<Polygon[]> {
  const res = await fetch(`${SITE}/data/map/boundary.geojson`);
  if (!res.ok) throw new Error('Could not load the park boundary.');
  const gj = await res.json();
  const polys: Polygon[] = [];
  for (const f of gj.features ?? []) {
    const g = f.geometry;
    if (g?.type === 'Polygon') polys.push(g.coordinates);
    else if (g?.type === 'MultiPolygon') polys.push(...g.coordinates);
  }
  if (!polys.length) throw new Error('The park boundary is empty.');
  return polys;
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPolygons = (x: number, y: number, polys: Polygon[]) =>
  polys.some(p => inRing(x, y, p[0]) && !p.slice(1).some(hole => inRing(x, y, hole)));

type Row = {
  source: string; source_id: string; scientific_name: string; common_name: string | null; taxon_group: string | null;
  observed_on: string; quality: string | null; status: string; lat: number | null; lon: number | null; last_seen: string;
};

/** Research-grade iNaturalist observations inside the park, species level. Returns null if the run was cut short. */
async function fetchInaturalist(polys: Polygon[], now: string): Promise<{ rows: Row[]; complete: boolean }> {
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  for (const p of polys) for (const [x, y] of p[0]) { minLon = Math.min(minLon, x); maxLon = Math.max(maxLon, x); minLat = Math.min(minLat, y); maxLat = Math.max(maxLat, y); }
  const rows: Row[] = [];
  let idAbove = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `https://api.inaturalist.org/v1/observations?nelat=${maxLat}&nelng=${maxLon}&swlat=${minLat}&swlng=${minLon}` +
      `&quality_grade=research&captive=false&order_by=id&order=asc&per_page=200&locale=en&id_above=${idAbove}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Nyandungu-Biodiversity-Dashboard' } });
    if (!res.ok) return { rows, complete: false };
    const body = await res.json();
    const results = (body.results ?? []) as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const o of results) {
      idAbove = Math.max(idAbove, o.id);
      const t = o.taxon;
      const coords = o.geojson?.coordinates as number[] | undefined;
      if (!t || !o.observed_on || !coords || o.obscured) continue;
      if (!['species', 'subspecies', 'variety', 'form'].includes(t.rank)) continue;
      const name = String(t.name).split(' ').slice(0, 2).join(' ');
      if (name.includes('×') || !name.includes(' ')) continue;
      if (!inPolygons(coords[0], coords[1], polys)) continue;
      rows.push({
        source: 'inaturalist', source_id: String(o.id), scientific_name: name, common_name: t.preferred_common_name ?? null,
        taxon_group: t.iconic_taxon_name ?? null, observed_on: o.observed_on, quality: 'research', status: 'approved',
        lat: Math.round(coords[1] * 10000) / 10000, lon: Math.round(coords[0] * 10000) / 10000, last_seen: now,
      });
    }
    if (results.length < 200) return { rows, complete: true };
    await sleep(800);
  }
  return { rows, complete: false };
}

/** The last 30 days of eBird records at the park hotspot (eBird's live service does not go back further). */
async function fetchEbird(key: string, now: string): Promise<Row[]> {
  const res = await fetch(`https://api.ebird.org/v2/data/obs/${EBIRD_HOTSPOT}/recent?back=30&cat=species&maxResults=10000&sppLocale=en`, { headers: { 'X-eBirdApiToken': key, 'User-Agent': 'Mozilla/5.0 (compatible; NyandunguBiodiversity/1.0)', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`eBird answered ${res.status}.`);
  const list = (await res.json()) as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const rows: Row[] = [];
  for (const o of list) {
    if (!o.sciName || !o.obsDt || !o.subId) continue;
    rows.push({
      source: 'ebird', source_id: `${o.subId}:${o.speciesCode}`, scientific_name: o.sciName, common_name: o.comName ?? null, taxon_group: 'Aves',
      observed_on: String(o.obsDt).slice(0, 10), quality: o.obsReviewed ? 'reviewed' : 'unreviewed', status: o.obsValid === false ? 'pending' : 'approved',
      lat: null, lon: null, last_seen: now,
    });
  }
  return rows;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const addDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

/** Past records of the hotspot, one day at a time (the live "recent" service stops at 30 days). */
async function backfillEbird(key: string, from: string, to: string, now: string, budgetMs: number): Promise<{ rows: Row[]; next: string | null; days: number; limited: boolean }> {
  const rows: Row[] = [];
  const started = Date.now();
  let day = from, days = 0;
  while (day <= to && Date.now() - started < budgetMs) {
    const [y, m, d] = day.split('-').map(Number);
    const res = await fetch(`https://api.ebird.org/v2/data/obs/${EBIRD_HOTSPOT}/historic/${y}/${m}/${d}?cat=species&maxResults=10000&sppLocale=en`, {
      headers: { 'X-eBirdApiToken': key, 'User-Agent': 'Mozilla/5.0 (compatible; NyandunguBiodiversity/1.0)', Accept: 'application/json' },
    });
    if (res.status === 429) return { rows, next: day, days, limited: true }; // eBird asks us to slow down: keep what we have and continue later
    if (!res.ok) throw new Error(`eBird answered ${res.status} for ${day}.`);
    for (const o of (await res.json()) as Record<string, any>[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!o.sciName || !o.obsDt || !o.subId) continue;
      rows.push({
        source: 'ebird', source_id: `${o.subId}:${o.speciesCode}`, scientific_name: o.sciName, common_name: o.comName ?? null, taxon_group: 'Aves',
        observed_on: String(o.obsDt).slice(0, 10), quality: o.obsReviewed ? 'reviewed' : 'unreviewed', status: o.obsValid === false ? 'pending' : 'approved',
        lat: null, lon: null, last_seen: now,
      });
    }
    day = addDay(day); days += 1;
    await sleep(1100); // eBird allows only a slow trickle of history requests
  }
  return { rows, next: day <= to ? day : null, days, limited: false };
}

async function upsertAll(supa: ReturnType<typeof createClient>, rows: Row[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supa.from('species_observations').upsert(rows.slice(i, i + 500), { onConflict: 'source,source_id' });
    if (error) throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* an empty body is fine */ }

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const expected = Deno.env.get('UPLOAD_PASSWORD');
  let forced = false;
  if (typeof body.password === 'string') {
    if (!expected || !(await same(body.password, expected))) { await sleep(1000); return json({ error: 'Wrong password.' }, 401); }
    forced = true;
  }

  // the scheduled long load: reads the next stretch of days from the stored cursor
  if (body.continue === true) {
    const key = Deno.env.get('EBIRD_API_KEY');
    const { data: cur } = await supa.from('ebird_backfill').select('*').eq('id', 1).maybeSingle();
    if (!key || !cur?.active || !cur.next_day || !cur.to_day) return json({ ok: true, idle: true });
    try {
      const r = await backfillEbird(key, cur.next_day, cur.to_day, new Date().toISOString(), 70_000);
      await upsertAll(supa, r.rows);
      await supa.from('ebird_backfill').update({ next_day: r.next ?? cur.next_day, active: r.next !== null, records: (cur.records ?? 0) + r.rows.length, updated_at: new Date().toISOString() }).eq('id', 1);
      return json({ ok: true, backfill: { records: r.rows.length, days: r.days, next: r.next, limited: r.limited } });
    } catch (e) {
      console.error(e);
      return json({ error: 'The eBird update failed.' }, 502);
    }
  }

  // loading older eBird records: needs the password and does nothing else
  const bf = body.backfill as { from?: unknown; to?: unknown } | undefined;
  if (bf && typeof bf === 'object') {
    const key = Deno.env.get('EBIRD_API_KEY');
    const today = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
    if (!forced) return json({ error: 'Password needed.' }, 401);
    if (!key) return json({ error: 'The eBird key is not set.' }, 400);
    if (typeof bf.from !== 'string' || typeof bf.to !== 'string' || !DATE.test(bf.from) || !DATE.test(bf.to) || bf.from > bf.to || bf.to > today ||
        Date.parse(bf.to) - Date.parse(bf.from) > 400 * 86400000) return json({ error: 'Choose a start and end date (at most 400 days, not in the future).' }, 400);
    try {
      const r = await backfillEbird(key, bf.from, bf.to, new Date().toISOString(), 90_000);
      await upsertAll(supa, r.rows);
      return json({ ok: true, backfill: { records: r.rows.length, days: r.days, next: r.next, limited: r.limited } });
    } catch (e) {
      console.error(e);
      return json({ error: e instanceof Error ? e.message : 'The eBird update failed.' }, 502);
    }
  }

  const { data: status } = await supa.from('species_sync').select('last_run').eq('id', 1).maybeSingle();
  if (!forced && status?.last_run && Date.now() - Date.parse(status.last_run) < MIN_GAP_MS) return json({ skipped: true, message: 'Ran recently.' });

  const started = new Date().toISOString();
  await supa.from('species_sync').update({ last_run: started }).eq('id', 1);
  const ebirdKey = Deno.env.get('EBIRD_API_KEY');
  const notes: string[] = [];
  let inatCount: number | null = null, ebirdCount: number | null = null;

  try {
    const polys = await loadBoundary();
    const inat = await fetchInaturalist(polys, started);
    await upsertAll(supa, inat.rows);
    inatCount = inat.rows.length;
    if (inat.complete) {
      // records that are no longer research grade, or were removed, stop counting
      const { error } = await supa.from('species_observations').delete().eq('source', 'inaturalist').lt('last_seen', started);
      if (error) throw error;
    } else {
      notes.push('iNaturalist run was cut short; old records kept.');
    }
  } catch (e) {
    console.error(e);
    notes.push(`iNaturalist: ${e instanceof Error ? e.message : 'failed'}`);
  }

  if (ebirdKey) {
    try {
      const rows = await fetchEbird(ebirdKey, started);
      await upsertAll(supa, rows);
      ebirdCount = rows.length;
    } catch (e) {
      console.error(e);
      notes.push(`eBird: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  const ok = inatCount !== null && notes.length === 0;
  await supa.from('species_sync').update({
    last_ok: ok ? new Date().toISOString() : undefined,
    inat_count: inatCount, ebird_count: ebirdCount, ebird_enabled: !!ebirdKey, message: notes.join(' ') || null,
  }).eq('id', 1);
  return json({ ok, inaturalist: inatCount, ebird: ebirdCount, ebirdEnabled: !!ebirdKey, notes });
});
