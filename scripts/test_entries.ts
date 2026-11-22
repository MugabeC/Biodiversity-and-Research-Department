// Checks the staff-form rules and the way entries are added to the dashboard data.  Run: npx tsx scripts/test_entries.ts
import { validateEntry } from '../app/lib/formSpec';
import { applyEntries, type FormEntry } from '../app/lib/entries';
import { loadDashboardFromBundle } from '../app/lib/dashboardData';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};
const opts = { today: '2026-12-10' };
const errs = (form: string, date: unknown, data: unknown) => validateEntry(form, date, data, opts).errors;

// validation
eq('valid school visit', errs('school-visit', '2026-11-25', { school: 'Test School', students: '40' }), []);
eq('missing required', errs('school-visit', '2026-11-25', { school: 'Test School' }).length, 1);
eq('date before start', errs('school-visit', '2026-11-01', { school: 'A', students: 3 }).length, 1);
eq('future date', errs('school-visit', '2026-12-20', { school: 'A', students: 3 }).length, 1);
eq('phone number refused', errs('conflict-case', '2026-11-25', { issue_type: 'Other', description: 'Call 0788123456 about it', status: 'Open' }).length, 1);
eq('unknown field refused', errs('waste', '2026-11-25', { total_kg: 5, surprise: 1 }).length, 1);
eq('split must match total', errs('waste', '2026-11-25', { total_kg: 100, biodegradable_kg: 10, non_biodegradable_kg: 10 }).length, 1);
eq('split ok', errs('waste', '2026-11-25', { total_kg: 100, biodegradable_kg: 40, non_biodegradable_kg: 60 }), []);
eq('one split field only', errs('waste', '2026-11-25', { total_kg: 100, biodegradable_kg: 40 }).length, 1);
eq('resolved needs date', errs('conflict-case', '2026-11-25', { issue_type: 'Other', description: 'x', status: 'Resolved' }).length, 1);

// merge
const base = loadDashboardFromBundle();
const mk = (form: string, entry_date: string, data: Record<string, string | number>, n = 0): FormEntry => ({ id: `${form}${n}`, form, entry_date, data, created_at: `2026-11-2${n}T10:00:00Z`, updated_at: '' });
const entries: FormEntry[] = [
  mk('school-visit', '2026-11-25', { school: 'Test School', students: 40, school_groups: 1, teachers: 3, complimentary: 5 }, 1),
  mk('community-activity', '2026-11-26', { activity: 'Test activity', participants: 20, complimentary: 4 }, 2),
  mk('complimentary-pass', '2026-12-02', { group: 'Test visitors', count: 7, notes: 'Identified admissions' }, 3),
  mk('internship-application', '2026-11-27', { type: 'Academic', institution: 'UNILAK', requested_period: '6 weeks', stage: 'Application received' }, 4),
  mk('research-request', '2026-11-28', { names: 'Test Researcher', category: 'Academic Research', topic: 'Test topic', status: 'Pending' }, 5),
  mk('conflict-case', '2026-11-29', { issue_type: 'Other', description: 'Test case', status: 'Open' }, 6),
  mk('waste', '2026-11-24', { total_kg: 50, biodegradable_kg: 20, non_biodegradable_kg: 30 }, 7),
  mk('waste', '2026-12-03', { total_kg: 80 }, 8),
];
const after = loadDashboardFromBundle(undefined, entries);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const students = (d: typeof base) => sum(d.schools.monthlyTotals.map(m => m.totalStudents ?? 0));
const get = <T extends { month: string }>(rows: T[], m: string) => rows.find(r => r.month === m);

eq('students +40', students(after) - students(base), 40);
eq('school groups Nov +1', (get(after.schools.monthlyTotals, 'November 2026')?.schoolGroups ?? 0) - (get(base.schools.monthlyTotals, 'November 2026')?.schoolGroups ?? 0), 1);
eq('activities +1', after.community.length - base.community.length, 1);
const adm = (d: typeof base, m: string) => get(d.passes.monthlyTotals, m)?.totalPasses ?? 0;
eq('Nov admissions +9 (5 school + 4 community)', adm(after, 'November 2026') - adm(base, 'November 2026'), 9);
eq('Dec admissions +7', adm(after, 'December 2026') - adm(base, 'December 2026'), 7);
eq('applications Nov +1', (get(after.applications, 'November 2026')?.count ?? 0) - (get(base.applications, 'November 2026')?.count ?? 0), 1);
eq('pipeline total +1', after.internshipPipeline.total - base.internshipPipeline.total, 1);
eq('research +1', after.research.length - base.research.length, 1);
eq('conflicts +1 with next id', [after.conflicts.length - base.conflicts.length, after.conflicts.at(-1)?.id], [1, (base.conflicts.at(-1)?.id ?? 0) + 1]);
const wasteKg = (d: typeof base, m: string) => (Array.isArray(d.waste) ? d.waste : d.waste.records).find(r => r.month === m)?.kg ?? 0;
eq('waste Nov +50', wasteKg(after, 'November 2026') - wasteKg(base, 'November 2026'), 50);
eq('waste Dec = 80', wasteKg(after, 'December 2026'), 80);
// merging does not change the inputs
const again = loadDashboardFromBundle();
eq('base data untouched', students(again), students(base));
eq('no entries means same files', applyEntries({ a: 1 }, [], null).files, { a: 1 });

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('all checks passed');
