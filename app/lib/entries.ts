/**
 * Staff form entries: reading them, and adding them on top of the workbook data.
 * The workbook files stay the base. Each entry from a form is added to the right month, the same way the workbook
 * import builds those files, so every chart and total on the dashboard stays consistent.
 */
import { monthLabelOf } from '@/app/lib/formSpec';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/app/lib/documents';

export type FormEntry = {
  id: string;
  form: string;
  entry_date: string;
  data: Record<string, string | number>;
  created_at: string;
  updated_at: string;
};

const PAGE = 1000;

/** All live entries (optionally one form only), newest first. Needs no password: the dashboard is public. */
export async function fetchEntries(form?: string): Promise<FormEntry[]> {
  const out: FormEntry[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${SUPABASE_URL}/rest/v1/form_entries?select=*&order=entry_date.desc,created_at.desc&limit=${PAGE}&offset=${offset}${form ? `&form=eq.${encodeURIComponent(form)}` : ''}`;
    const res = await fetch(url, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` }, cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load the saved entries.');
    const rows = (await res.json()) as FormEntry[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

// ── adding entries to the dashboard data files ─────────────────────────────
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const MONTH_ORDER = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function monthKeyOf(label: string): number {
  const [name, year] = label.split(' ');
  const m = MONTH_ORDER.indexOf(name);
  return Number(year) * 12 + (m < 0 ? 0 : m);
}

/** Finds the row for a month, or adds it in date order. */
function monthRow(rows: Json[], label: string, make: () => Json): Json {
  const found = rows.find(r => r.month === label);
  if (found) return found;
  const row = make();
  row.month = label;
  const at = rows.findIndex(r => monthKeyOf(String(r.month)) > monthKeyOf(label));
  if (at < 0) rows.push(row); else rows.splice(at, 0, row);
  return row;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

type Files = Record<string, unknown>;
export type EntryOutput = { files: Files; pipeline: Json | null };

/**
 * Returns copies of the data files with the entries added. `files` uses the dashboard's keys
 * (schoolVisits, community, passes, waste, research, conflicts, internships).
 */
export function applyEntries(files: Files, entries: FormEntry[], pipelineBase: unknown): EntryOutput {
  if (entries.length === 0) return { files, pipeline: null };
  const f: Files = { ...files };
  const own = (key: string): Json => { const c = structuredClone(f[key]) as Json; f[key] = c; return c; };
  const schoolVisits = own('schoolVisits'), community = own('community'), passes = own('passes');
  const waste = own('waste'), research = own('research'), conflicts = own('conflicts'), internships = own('internships');
  const pipeline = structuredClone(pipelineBase) as Json;

  // In a month where one total was given for all complimentary admissions, school and community entries add nothing of their own.
  const allScopeMonths = new Set(entries.filter(x => x.form === 'complimentary-pass' && x.data.notes === 'All complimentary admissions').map(x => monthLabelOf(x.entry_date)));
  const addPass = (month: string, group: string, count: number, notes: string) => {
    const row = monthRow(passes.months, month, () => ({ subtotal: 0, passes: [] }));
    const item = (row.passes as Json[]).find(p => p.group === group);
    if (item) item.count = (num(item.count) ?? 0) + count; else row.passes.push({ group, count, notes });
    row.subtotal = (num(row.subtotal) ?? 0) + count;
  };
  const bump = (list: Json[], key: string, name: string, field?: string) => {
    const hit = list.find(x => String(x[key]).toLowerCase() === name.toLowerCase());
    if (hit) { if (field) hit[field] = (num(hit[field]) ?? 0) + 1; else hit.count = (num(hit.count) ?? 0) + 1; return; }
    list.push(field ? { [key]: name, academic: 0, professional: 0, [field]: 1 } : { [key]: name, count: 1 });
  };

  // case numbers follow the order the cases were logged, whatever date they carry
  const baseMax = Math.max(0, ...((conflicts.data as Json[]) ?? []).map(c => num(c.id) ?? 0));
  const conflictIds = new Map(entries.filter(x => x.form === 'conflict-case').sort((a, b) => a.created_at.localeCompare(b.created_at)).map((x, i) => [x.id, baseMax + i + 1]));
  const ordered = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at));

  for (const e of ordered) {
    const month = monthLabelOf(e.entry_date);
    const d = e.data;
    switch (e.form) {
      case 'school-visit': {
        const row = monthRow(schoolVisits.months, month, () => ({ subtotal_students: null, school_groups: null, visits: [] }));
        const students = num(d.students), groups = num(d.school_groups);
        if (students !== undefined) row.subtotal_students = (num(row.subtotal_students) ?? 0) + students;
        if (groups !== undefined) row.school_groups = (num(row.school_groups) ?? 0) + groups;
        row.visits.push({
          school: str(d.school) ?? null, students: students ?? null, school_groups: groups ?? null, teachers: num(d.teachers) ?? null, other_adults: num(d.other_adults) ?? null,
          complimentary: num(d.complimentary) ?? null, programme: str(d.programme) ?? null, programme_pupils: num(d.programme_pupils) ?? null,
        });
        if (num(d.complimentary) && !allScopeMonths.has(month)) addPass(month, 'Complimentary participants in school visits', num(d.complimentary) as number, 'From School_Visits');
        break;
      }
      case 'community-activity': {
        const row = monthRow(community.months, month, () => ({ activities: [] }));
        row.activities.push({
          activity: str(d.activity) ?? null, participant_group: str(d.participant_group) ?? null, participants: num(d.participants) ?? null,
          women: num(d.women) ?? null, men: num(d.men) ?? null, institutions: num(d.institutions) ?? null, complimentary: num(d.complimentary) ?? null,
        });
        if (num(d.complimentary) && !allScopeMonths.has(month)) addPass(month, 'Complimentary participants in community activities', num(d.complimentary) as number, 'From Community_Activities');
        break;
      }
      case 'complimentary-pass':
        addPass(month, str(d.group) ?? 'Complimentary admissions', num(d.count) ?? 0, str(d.notes) ?? 'Identified admissions');
        break;
      case 'internship-application': {
        const type = str(d.type) === 'Professional' ? 'Professional' : 'Academic';
        const apps = monthRow(internships.applications, month, () => ({ count: 0 }));
        apps.count = (num(apps.count) ?? 0) + 1;
        if (str(d.start_date)) {
          const startMonth = monthLabelOf(str(d.start_date) as string);
          const list: Json[] = type === 'Academic' ? internships.academic_internship : internships.professional_internship;
          const row = monthRow(list, startMonth, () => ({ count: 0 }));
          row.count = (num(row.count) ?? 0) + 1;
        }
        if (pipeline) {
          pipeline.total = (num(pipeline.total) ?? 0) + 1;
          pipeline.byType[type] = (num(pipeline.byType[type]) ?? 0) + 1;
          bump(pipeline.stages, 'stage', str(d.stage) ?? 'Application received', type.toLowerCase());
          bump(pipeline.institutions, 'name', str(d.institution) ?? 'Not specified');
          bump(pipeline.requestedPeriod, 'period', str(d.requested_period) ?? 'Not specified');
          if (!str(pipeline.asOf) || e.entry_date > pipeline.asOf) pipeline.asOf = e.entry_date;
        }
        break;
      }
      case 'research-request':
        research.data.push({
          month, 'Date Received': e.entry_date, Names: str(d.names) ?? null, Category: str(d.category) ?? null, Institution: str(d.institution) ?? null,
          'Program/Degree level': str(d.program) ?? null, 'Research Title / Topic': str(d.topic) ?? null, 'Requested Activities': str(d.requested_activities) ?? null,
          Status: str(d.status) ?? null, 'Internal Remarks': str(d.internal_remarks) ?? null, 'Action taken': str(d.action_taken) ?? null,
          'Follow-Up Date': str(d.follow_up_date) ?? null, 'Assigned contact': str(d.assigned_contact) ?? null,
        });
        research.total_records = (num(research.total_records) ?? 0) + 1;
        break;
      case 'conflict-case':
        conflicts.data.push({
          id: conflictIds.get(e.id) ?? null, month, date: e.entry_date, stakeholder: str(d.stakeholder) ?? null, areaType: str(d.area_type) ?? null, location: str(d.location) ?? null,
          category: str(d.category) ?? null, issueType: str(d.issue_type) ?? null, description: str(d.description) ?? null, affectedArea: str(d.affected_area) ?? null,
          actionType: str(d.action_type) ?? null, assignedTo: str(d.assigned_to) ?? null, status: str(d.status) ?? null, resolutionDate: str(d.resolution_date) ?? null,
          actionTaken: str(d.action_taken) ?? null, followUpRequired: str(d.follow_up_required) ?? null,
        });
        conflicts.total_records = (num(conflicts.total_records) ?? 0) + 1;
        break;
      case 'waste': {
        const total = num(d.total_kg) ?? 0, bio = num(d.biodegradable_kg), non = num(d.non_biodegradable_kg);
        const existing = (waste.records as Json[]).find(r => r.month === month);
        if (!existing) {
          monthRow(waste.records, month, () => ({ waste_collected_kg: total, biodegradable_kg: bio ?? null, non_biodegradable_kg: non ?? null }));
        } else {
          const had = num(existing.biodegradable_kg) !== undefined && num(existing.non_biodegradable_kg) !== undefined;
          const hasSplit = bio !== undefined && non !== undefined;
          existing.waste_collected_kg = (num(existing.waste_collected_kg) ?? 0) + total;
          if (had && hasSplit) { existing.biodegradable_kg = (num(existing.biodegradable_kg) as number) + (bio as number); existing.non_biodegradable_kg = (num(existing.non_biodegradable_kg) as number) + (non as number); }
          else { existing.biodegradable_kg = null; existing.non_biodegradable_kg = null; } // mixed: fall back to the dashboard's 70 / 30 estimate
        }
        break;
      }
    }
  }
  conflicts.data.sort((a: Json, b: Json) => (num(a.id) ?? 0) - (num(b.id) ?? 0));
  return { files: f, pipeline };
}
