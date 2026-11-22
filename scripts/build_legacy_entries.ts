// One-off: turns the records that used to ship as data files (school visits, community activities, complimentary
// admissions, research requests, conflict cases, waste) into entries for the staff forms, so every one can be edited.
// Writes public/data/entries-snapshot.json (the copy the site falls back on) and a SQL file for the database.
// Run: npx tsx scripts/build_legacy_entries.ts <output.sql>
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { validateEntry } from '../app/lib/formSpec';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const read = (f: string): Json => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const firstOf = (label: string) => { const [m, y] = label.split(' '); return `${y}-${String(MONTHS.indexOf(m) + 1).padStart(2, '0')}-01`; };
const clean = (o: Json): Record<string, string | number> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [k, typeof v === 'number' ? v : String(v).trim()]));

type Entry = { id: string; form: string; entry_date: string; data: Record<string, string | number>; created_at: string; updated_at: string };
const entries: Entry[] = [];
let n = 0;
const add = (form: string, entry_date: string, data: Json) => {
  const created = new Date(Date.UTC(2026, 10, 22, 0, 0, 0) + n++ * 1000).toISOString();
  entries.push({ id: randomUUID(), form, entry_date, data: clean(data), created_at: created, updated_at: created });
};

const passes = read('NEP_complementary_passes.json').months as Json[];

for (const m of read('NEP_school_visits.json').months as Json[]) {
  for (const v of m.visits) add('school-visit', firstOf(m.month), { school: v.school || 'School groups (names not listed)', students: v.students, school_groups: v.school_groups, teachers: v.teachers, other_adults: v.other_adults, complimentary: v.complimentary, programme: v.programme, programme_pupils: v.programme_pupils });
}
for (const m of read('NEP_community_engagement.json').months as Json[]) {
  for (const a of m.activities) add('community-activity', firstOf(m.month), { activity: a.activity, participant_group: a.participant_group, participants: a.participants, women: a.women, men: a.men, institutions: a.institutions, complimentary: a.complimentary });
}
for (const m of passes) {
  // rows derived from school visits and community activities are worked out again from the entries above
  for (const p of m.passes) if (p.notes === 'Identified admissions' || p.notes === 'All complimentary admissions') add('complimentary-pass', firstOf(m.month), { group: p.group, count: p.count, notes: p.notes });
}
for (const r of read('Research_ALL.json').data as Json[]) {
  add('research-request', r['Date Received'] || firstOf(r.month), { names: r.Names, category: r.Category, institution: r.Institution, program: r['Program/Degree level'], topic: r['Research Title / Topic'], requested_activities: r['Requested Activities'], status: r.Status, internal_remarks: r['Internal Remarks'], action_taken: r['Action taken'], follow_up_date: r['Follow-Up Date'], assigned_contact: r['Assigned contact'] });
}
for (const c of [...(read('Conflict_Management.json').data as Json[])].sort((a, b) => a.id - b.id)) {
  add('conflict-case', c.date, { stakeholder: c.stakeholder, area_type: c.areaType, location: c.location, category: c.category, issue_type: c.issueType, description: c.description, affected_area: c.affectedArea, action_type: c.actionType, assigned_to: c.assignedTo, status: c.status, resolution_date: c.resolutionDate, action_taken: c.actionTaken, follow_up_required: c.followUpRequired });
}
for (const w of read('NEP_waste_management.json').records as Json[]) {
  add('waste', firstOf(w.month), { total_kg: w.waste_collected_kg, biodegradable_kg: w.biodegradable_kg, non_biodegradable_kg: w.non_biodegradable_kg, note: 'Monthly total' });
}

// check every entry against the form rules (a missing status on old conflict cases is expected and listed)
const problems: string[] = [];
for (const e of entries) {
  const c = validateEntry(e.form, e.entry_date, e.data, { today: '2026-12-31', start: '2020-01-01' });
  if (c.errors.length) problems.push(`${e.form} ${e.entry_date} ${String(e.data.school ?? e.data.activity ?? e.data.group ?? e.data.names ?? e.data.issue_type ?? '').slice(0, 40)}: ${c.errors.join(' ')}`);
}
const counts: Record<string, number> = {};
for (const e of entries) counts[e.form] = (counts[e.form] ?? 0) + 1;
console.error('entries:', entries.length, counts);
console.error(problems.length ? `form-rule notes (${problems.length}):\n  ${problems.join('\n  ')}` : 'all entries pass the form rules');

writeFileSync('public/data/entries-snapshot.json', JSON.stringify(entries));
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const rows = entries.map(e => `(${q(e.id)}, ${q(e.form)}, ${q(e.entry_date)}, ${q(JSON.stringify(e.data))}::jsonb, ${q(e.created_at)}, ${q(e.updated_at)})`);
writeFileSync(process.argv[2] ?? 'legacy.sql', `insert into public.form_entries (id, form, entry_date, data, created_at, updated_at) values\n${rows.join(',\n')};\n`);
