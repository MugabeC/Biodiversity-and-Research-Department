/**
 * Turns the department's data-entry workbook into the JSON files the dashboard reads.
 * This is a line-for-line port of scripts/import_dashboard_xlsx.py, so the website can do the same job in the browser.
 * It only reads figures; applicant names in Internships are never copied.
 */

export type Cell = string | number | boolean | null | XDate;
/** An Excel date with no time zone. */
export class XDate {
  constructor(public y: number, public m: number, public d: number) {}
}
export type Sheet = Cell[][];
export type Sheets = Record<string, Sheet>;
type Row = Record<string, Cell>;
type Json = Record<string, unknown>;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const REQUIRED_FILES = [
  'summary.json', 'NEP_school_visits.json', 'NEP_community_engagement.json', 'NEP_complementary_passes.json',
  'Research_ALL.json', 'NEP_internship.json', 'Conflict_Management.json', 'NEP_waste_management.json',
] as const;

export class WorkbookError extends Error {}

// ── helpers ────────────────────────────────────────────────────────────────
type MKey = number; // year * 12 + (month - 1)
const mk = (y: number, m: number): MKey => y * 12 + (m - 1);
const unKey = (k: MKey) => ({ y: Math.floor(k / 12), m: (k % 12) + 1 });
const monthLabel = (k: MKey) => { const { y, m } = unKey(k); return `${MONTH_NAMES[m - 1]} ${y}`; };

function asDate(v: Cell | undefined): XDate | null { return v instanceof XDate ? v : null; }
function monthKey(v: Cell | undefined): MKey | null { const d = asDate(v); return d ? mk(d.y, d.m) : null; }
function iso(v: Cell | undefined): string | null {
  const d = asDate(v);
  return d ? `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null;
}
export function num(v: Cell | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const f = Number(v.replace(/,/g, '').trim());
    return v.trim() !== '' && Number.isFinite(f) ? f : null;
  }
  return null;
}
export function text(v: Cell | undefined): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof XDate) return iso(v);
  const s = String(v).trim();
  return s || null;
}
const truthy = (n: number | null | undefined) => !!n;

function rowsOf(sheet: Sheet | undefined, name: string): Row[] {
  if (!sheet || sheet.length === 0) throw new WorkbookError(`The workbook has no sheet called "${name}".`);
  const headers = sheet[0].map(h => text(h));
  const out: Row[] = [];
  for (const r of sheet.slice(1)) {
    if (r.every(c => c === null || c === undefined || (typeof c === 'string' && !c.trim()))) continue;
    const o: Row = {};
    headers.forEach((h, i) => { if (h) o[h] = r[i] ?? null; });
    out.push(o);
  }
  return out;
}
function need(rows: Row[], sheet: string, cols: string[]) {
  const got = new Set(rows[0] ? Object.keys(rows[0]) : []);
  const missing = cols.filter(c => !got.has(c));
  if (missing.length) throw new WorkbookError(`Sheet "${sheet}" is missing column(s): ${missing.join(', ')}`);
}
function mustMonth(v: Cell | undefined, sheet: string, rowNo: number): MKey {
  const k = monthKey(v);
  if (k === null) throw new WorkbookError(`Sheet "${sheet}", row ${rowNo + 2}: the month is empty or not a date.`);
  return k;
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const fmtG = (v: number) => String(parseFloat(v.toPrecision(6)));

type Agg = Map<MKey, Record<string, number>>;
const aget = (agg: Agg, k: MKey) => { let r = agg.get(k); if (!r) { r = {}; agg.set(k, r); } return r; };
const aadd = (agg: Agg, k: MKey, name: string, v: number) => { const r = aget(agg, k); r[name] = (r[name] ?? 0) + v; };

// ── conversion ─────────────────────────────────────────────────────────────
export type Converted = { files: Record<string, Json>; agg: Agg; admissions: Record<string, number>; notes: string[] };

export function convert(wb: Sheets): Converted {
  const out: Record<string, Json> = {};
  const agg: Agg = new Map();
  const notes: string[] = [];

  // Settings + Species -> summary.json
  const st: Record<string, Row> = {};
  for (const r of rowsOf(wb.Settings, 'Settings')) { const k = text(r.Setting); if (k) st[k] = r; }
  const need1 = (k: string) => { if (!st[k]) throw new WorkbookError(`Sheet "Settings" has no row called "${k}".`); return st[k]; };
  const size = need1('Park size');
  const sizeTxt = typeof size.Value === 'number'
    ? `${fmtG(size.Value)} ${(text(size.Unit) ?? 'ha').replace(/^./, c => c.toUpperCase()).replace(/(?<=.)./g, c => c.toLowerCase())}`
    : String(size.Value);
  const taxaRows = rowsOf(wb.Species, 'Species');
  need(taxaRows, 'Species', ['Taxa', '2023 count', '2025 count']);
  const keyOf: Record<string, string> = {
    Birds: 'birds', Plants: 'plants', 'Amphibians & Reptiles': 'amphibians_reptiles', Fish: 'fish',
    'Aquatic invertebrates': 'aquatic_inverts', Butterflies: 'butterflies', Mammals: 'mammals',
  };
  const taxa: Record<string, Json> = {};
  for (const r of taxaRows) {
    const k = keyOf[text(r.Taxa) ?? ''];
    if (!k) { notes.push(`Species: unknown group "${r.Taxa}" skipped`); continue; }
    const t: Json = { count2025: num(r['2025 count']), count2023: num(r['2023 count']) };
    for (const [src, dst] of [['Orders', 'orders'], ['Families', 'families'], ['Amphibians', 'amphibians'], ['Reptiles', 'reptiles']]) {
      if (num(r[src]) !== null) t[dst] = num(r[src]);
    }
    taxa[k] = t;
  }
  out['summary.json'] = {
    parkName: need1('Park name').Value, parkSize: sizeTxt, location: need1('Location').Value,
    surveyYear: String(need1('Survey year (label)').Value),
    studentTargetPerQuarter: num(need1('Student target per quarter').Value),
    totalSpecies: sum(Object.values(taxa).map(t => (t.count2025 as number | null) ?? 0)), taxa,
  };

  // School visits
  const sv = rowsOf(wb.School_Visits, 'School_Visits'); need(sv, 'School_Visits', ['Month', 'School / group', 'Students']);
  type SM = { month: string; subtotal_students: number | null; school_groups: number | null; visits: Json[] };
  const sMonths = new Map<MKey, SM>();
  sv.forEach((r, i) => {
    const k = mustMonth(r.Month, 'School_Visits', i);
    let m = sMonths.get(k);
    if (!m) { m = { month: monthLabel(k), subtotal_students: null, school_groups: null, visits: [] }; sMonths.set(k, m); }
    const stu = num(r.Students), grp = num(r['School groups']);
    if (stu !== null) m.subtotal_students = (m.subtotal_students ?? 0) + stu;
    if (grp !== null) m.school_groups = (m.school_groups ?? 0) + grp;
    for (const [col, a] of [['Students', 'students'], ['Teachers recorded', 'teachers'], ['School groups', 'groups'], ['Complimentary participants', 'school_comp']]) {
      const n = num(r[col]); if (n !== null) aadd(agg, k, a, n);
    }
    m.visits.push({
      school: text(r['School / group']), students: stu, school_groups: grp, teachers: num(r['Teachers recorded']),
      other_adults: num(r['Other adults recorded']), complimentary: num(r['Complimentary participants']),
      programme: text(r.Programme), programme_pupils: num(r['Programme pupils']),
    });
  });
  out['NEP_school_visits.json'] = { dataset: 'NEP School Visits', source_sheet: 'School_Visits', months: [...sMonths.keys()].sort((a, b) => a - b).map(k => sMonths.get(k)) };

  // Community activities
  const ca = rowsOf(wb.Community_Activities, 'Community_Activities'); need(ca, 'Community_Activities', ['Month', 'Activity']);
  const cMonths = new Map<MKey, { month: string; activities: Json[] }>();
  ca.forEach((r, i) => {
    const k = mustMonth(r.Month, 'Community_Activities', i);
    let m = cMonths.get(k);
    if (!m) { m = { month: monthLabel(k), activities: [] }; cMonths.set(k, m); }
    m.activities.push({
      activity: text(r.Activity), participant_group: text(r['Participant group']), participants: num(r['Participants recorded']),
      women: num(r.Women), men: num(r.Men), institutions: num(r.Institutions), complimentary: num(r['Complimentary participants']),
    });
    aadd(agg, k, 'activities', 1);
    for (const [col, a] of [['Participants recorded', 'participants'], ['Complimentary participants', 'community_comp']]) {
      const n = num(r[col]); if (n !== null) aadd(agg, k, a, n);
    }
  });
  out['NEP_community_engagement.json'] = { dataset: 'NEP Community Engagement', source_sheet: 'Community_Activities', months: [...cMonths.keys()].sort((a, b) => a - b).map(k => cMonths.get(k)) };

  // Complimentary admissions = passes + school complimentary + community complimentary
  const cp = rowsOf(wb.Complementary_Passes, 'Complementary_Passes'); need(cp, 'Complementary_Passes', ['Month', 'Passes']);
  type Item = { group: string | null; count: number; notes: string | null };
  const detail = new Map<MKey, Item[]>(); const allScope = new Set<MKey>();
  cp.forEach((r, i) => {
    const n = num(r.Passes); if (n === null) return;
    const k = mustMonth(r.Month, 'Complementary_Passes', i);
    if ((text(r['Admission scope']) ?? '').toLowerCase().includes('all complimentary')) allScope.add(k);
    const arr = detail.get(k) ?? []; detail.set(k, arr);
    arr.push({ group: text(r['Group / category']) ?? text(r['Admission scope']) ?? 'Complimentary admissions', count: n, notes: text(r['Admission scope']) });
    aadd(agg, k, 'passes', n);
  });
  const keys = new Set<MKey>(detail.keys());
  for (const [k, v] of agg) if (truthy(v.school_comp) || truthy(v.community_comp)) keys.add(k);
  const pMonths: { month: string; subtotal: number; passes: Item[] }[] = [];
  for (const k of [...keys].sort((a, b) => a - b)) {
    const items = [...(detail.get(k) ?? [])];
    if (allScope.has(k)) { pMonths.push({ month: monthLabel(k), subtotal: sum(items.map(i => i.count)), passes: items }); continue; }
    const a = aget(agg, k);
    if (truthy(a.school_comp)) items.push({ group: 'Complimentary participants in school visits', count: Math.trunc(a.school_comp), notes: 'From School_Visits' });
    if (truthy(a.community_comp)) items.push({ group: 'Complimentary participants in community activities', count: Math.trunc(a.community_comp), notes: 'From Community_Activities' });
    pMonths.push({ month: monthLabel(k), subtotal: sum(items.map(i => i.count)), passes: items });
  }
  const admissions: Record<string, number> = {};
  for (const m of pMonths) admissions[m.month] = m.subtotal;
  out['NEP_complementary_passes.json'] = { dataset: 'NEP Complimentary Admissions', source_sheet: 'Complementary_Passes + School_Visits + Community_Activities', months: pMonths };

  // Research requests
  const rr = rowsOf(wb.Research_Requests, 'Research_Requests'); need(rr, 'Research_Requests', ['Month', 'Applicant / group', 'Category', 'Status']);
  const rdata: Json[] = [];
  rr.forEach((r, i) => {
    const k = mustMonth(r.Month, 'Research_Requests', i); aadd(agg, k, 'research', 1);
    rdata.push({
      month: monthLabel(k), 'Date Received': iso(r['Request date']), Names: text(r['Applicant / group']), Category: text(r.Category),
      Institution: text(r.Institution), 'Program/Degree level': text(r['Programme / degree']), 'Research Title / Topic': text(r['Research topic']),
      'Requested Activities': text(r['Requested activity']), Status: text(r.Status),
    });
  });
  out['Research_ALL.json'] = { source: 'Nyandungu Eco-Park Research Database', description: 'All research requests', total_records: rdata.length, data: rdata };

  // Internships: counts only
  const it = rowsOf(wb.Internships, 'Internships'); need(it, 'Internships', ['Application month', 'Type', 'Start month', 'Application records', 'Starts recorded']);
  const starts: Record<string, Map<MKey, number>> = { Academic: new Map(), Professional: new Map() };
  const apps = new Map<MKey, number>();
  for (const r of it) {
    const ak = monthKey(r['Application month']), sk = monthKey(r['Start month']);
    const ar = num(r['Application records']);
    if (ak !== null && truthy(ar)) { apps.set(ak, (apps.get(ak) ?? 0) + (ar as number)); aadd(agg, ak, 'applications', ar as number); }
    const typ = text(r.Type); const sr = num(r['Starts recorded']);
    if (sk !== null && typ && typ in starts && truthy(sr)) {
      starts[typ].set(sk, (starts[typ].get(sk) ?? 0) + (sr as number)); aadd(agg, sk, `${typ.toLowerCase()}_starts`, sr as number);
    }
  }
  const allk = [...new Set([...starts.Academic.keys(), ...starts.Professional.keys()])].sort((a, b) => a - b);
  const span: MKey[] = [];
  if (allk.length) for (let k = allk[0]; k <= allk[allk.length - 1]; k++) span.push(k);
  out['NEP_internship.json'] = {
    dataset: 'NEP Internships (placements = start month)', source_sheet: 'Internships',
    academic_internship: span.map(k => ({ month: monthLabel(k), count: starts.Academic.get(k) ?? 0 })),
    professional_internship: span.filter(k => starts.Professional.get(k)).map(k => ({ month: monthLabel(k), count: starts.Professional.get(k) })),
    applications: [...apps.keys()].sort((a, b) => a - b).map(k => ({ month: monthLabel(k), count: apps.get(k) })),
  };

  // Conflict cases (no phone numbers or reporter names are used)
  const cf = rowsOf(wb.Conflict_Cases, 'Conflict_Cases'); need(cf, 'Conflict_Cases', ['Case ID', 'Month', 'Date reported', 'Status']);
  const cdata: Json[] = [];
  const sorted = cf.map((r, i) => ({ r, i })).sort((a, b) => (num(a.r['Case ID']) ?? 0) - (num(b.r['Case ID']) ?? 0) || a.i - b.i);
  for (const { r, i } of sorted) {
    const k = mustMonth(r.Month, 'Conflict_Cases', i); aadd(agg, k, 'conflicts', 1);
    if (text(r.Status) === 'Open') aadd(agg, k, 'open_conflicts', 1);
    cdata.push({
      id: num(r['Case ID']), month: monthLabel(k), date: iso(r['Date reported']), stakeholder: text(r['Stakeholder type']), areaType: text(r['Area type']),
      location: text(r.Location), category: text(r.Category), issueType: text(r['Issue type']), description: text(r.Description),
      affectedArea: text(r['Affected area']), actionType: text(r['Action type']), assignedTo: text(r['Assigned to']), status: text(r.Status),
      resolutionDate: iso(r['Resolution date']), actionTaken: text(r['Action taken']), followUpRequired: text(r['Follow-up required']),
    });
  }
  out['Conflict_Management.json'] = { source: 'Nyandungu Eco-Park Community Data', sheet: 'Conflict_Cases', total_records: cdata.length, data: cdata };

  // Waste
  const wr = rowsOf(wb.Waste, 'Waste'); need(wr, 'Waste', ['Reporting month', 'Waste collected (kg)']);
  const recs: Json[] = [];
  wr.forEach((r, i) => {
    const k = mustMonth(r['Reporting month'], 'Waste', i); const kg = num(r['Waste collected (kg)']);
    if (kg === null) { notes.push(`Waste: ${monthLabel(k)} has no total, so it is left out (dashboard shows "no data")`); return; }
    aadd(agg, k, 'waste', kg);
    recs.push({ month: monthLabel(k), waste_collected_kg: kg, biodegradable_kg: num(r['Biodegradable (kg)']), non_biodegradable_kg: num(r['Non-biodegradable (kg)']) });
  });
  out['NEP_waste_management.json'] = { dataset: 'NEP Waste Management', source_sheet: 'Waste', records: recs };

  return { files: out, agg, admissions, notes };
}

// ── cross-check against the workbook's own Monthly_Summary ─────────────────
export type Difference = { month: string; figure: string; workbook: number; website: number };

/**
 * Differences that stop publishing are in `differences`. The one rule the department has confirmed is in `warnings`:
 * "Complimentary admissions" on the website also include complimentary participants from school visits and community
 * activities, so in months where the workbook's Monthly_Summary counts passes only, the website figure is higher.
 */
export function crossCheck(wb: Sheets, conv: Converted): { checked: number; differences: Difference[]; warnings: Difference[] } {
  const sheet = wb.Monthly_Summary;
  if (!sheet || !sheet.length) throw new WorkbookError('The workbook has no sheet called "Monthly_Summary".');
  const hdr = sheet[0].map(h => text(h));
  const cols: Record<string, string> = {
    'Students recorded': 'students', 'Teachers recorded': 'teachers', 'School groups': 'groups', 'Community activities': 'activities',
    'Community participants': 'participants', 'Research requests': 'research', 'Internship applications': 'applications',
    'Academic starts': 'academic_starts', 'Professional starts': 'professional_starts', 'Waste collected (kg)': 'waste',
    'Conflicts reported': 'conflicts', 'Open conflicts': 'open_conflicts',
  };
  const bad: Difference[] = []; const warnings: Difference[] = []; let checked = 0;
  for (const r of sheet.slice(1)) {
    const k = monthKey(r[0]); if (k === null) continue;
    const row: Row = {}; hdr.forEach((h, i) => { if (h) row[h] = r[i] ?? null; });
    const label = monthLabel(k);
    const wantComp = num(row['Complimentary admissions']) ?? 0, gotComp = conv.admissions[label] ?? 0;
    if (wantComp !== gotComp) (gotComp > wantComp ? warnings : bad).push({ month: label, figure: 'Complimentary admissions', workbook: wantComp, website: gotComp });
    for (const [h, a] of Object.entries(cols)) {
      const want = num(row[h]) ?? 0, got = (conv.agg.get(k) ?? {})[a] ?? 0;
      checked += 1;
      if (want !== got) bad.push({ month: label, figure: h, workbook: want, website: got });
    }
  }
  return { checked, differences: bad, warnings };
}

// ── reading an .xlsx file in the browser or in Node ────────────────────────
export async function readWorkbook(data: ArrayBuffer | Uint8Array): Promise<Sheets> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  const sheets: Sheets = {};
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false });
    sheets[name] = rows.map(r => r.map(c => {
      if (c instanceof Date) {
        const d = new Date(c.getTime() + 12 * 3600 * 1000); // cells have no time zone: read the calendar day, not the instant
        return new XDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
      }
      return c as Cell;
    }));
  }
  return sheets;
}

/** The numbers a person checks before publishing. */
export function preview(conv: Converted) {
  const f = conv.files as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const months: string[] = f['NEP_school_visits.json'].months.map((m: { month: string }) => m.month);
  const students = sum(f['NEP_school_visits.json'].months.map((m: { subtotal_students: number | null }) => m.subtotal_students ?? 0));
  return {
    species: f['summary.json'].totalSpecies as number,
    students,
    schoolGroups: sum(f['NEP_school_visits.json'].months.map((m: { school_groups: number | null }) => m.school_groups ?? 0)),
    activities: sum(f['NEP_community_engagement.json'].months.map((m: { activities: unknown[] }) => m.activities.length)),
    research: (f['Research_ALL.json'].data as unknown[]).length,
    conflicts: (f['Conflict_Management.json'].data as unknown[]).length,
    openConflicts: (f['Conflict_Management.json'].data as { status: string | null }[]).filter(c => c.status === 'Open').length,
    wasteKg: sum((f['NEP_waste_management.json'].records as { waste_collected_kg: number }[]).map(r => r.waste_collected_kg)),
    latestMonth: conv.agg.size ? monthLabel(Math.max(...Array.from(conv.agg.keys()))) : (months[months.length - 1] ?? ''),
  };
}
