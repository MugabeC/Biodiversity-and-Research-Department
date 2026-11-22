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

// water tests
eq('water needs a parameter', errs('water-test', '2026-11-25', { sampling_point: 'S1 Pond 1' }).length, 1);
eq('water ok', errs('water-test', '2026-11-25', { sampling_point: 'S1 Pond 1', w_ph: '7.1', report_ref: '2025110512345' }), []);
eq('water keeps 4 decimals', validateEntry('water-test', '2026-11-25', { sampling_point: 'A', w_lead: '0.0049' }, opts).clean?.data.w_lead, 0.0049);
const wEntries = [mk('water-test', '2026-11-25', { sampling_point: 'S1 Pond 1', w_ph: 7, w_turbidity: 45, w_do: 4, w_lead: 0.004, w_temperature: 22 }, 1)];
const withWater = loadDashboardFromBundle(undefined, wEntries);
const wt = withWater.waterTests[0];
eq('water test scored', [wt.pass, wt.fail, wt.rate, wt.outside.map(r => r.parameter)], [2, 2, 50, ['Turbidity', 'Dissolved Oxygen']]);
eq('water overall adds the survey', [withWater.waterOverall?.total, withWater.waterOverall?.tests], [(base.waterOverall?.total ?? 0) + 4, 1]);
eq('no tests means survey only', base.waterOverall?.rate, base.bioWater?.rate);

// tree planting and survival
import { buildRestoration, checksDue } from '../app/lib/restoration';
const uuidA = '11111111-1111-4111-8111-111111111111', uuidB = '22222222-2222-4222-8222-222222222222';
eq('planting ok (earlier date allowed)', errs('planting', '2026-03-30', { species: 'Croton megalocarpus', sector: 'S3', trees_planted: '50' }), []);
eq('planting needs a sector', errs('planting', '2026-11-25', { species: 'Croton megalocarpus', trees_planted: 5 }).length, 1);
eq('check needs a real planting id', errs('survival-check', '2026-12-02', { planting_id: 'abc', checkpoint: 'Week 1', alive: 5 }).length, 1);
eq('check ok', errs('survival-check', '2026-12-02', { planting_id: uuidA, checkpoint: 'Week 1', alive: 5 }), []);
eq('check needs a count', errs('survival-check', '2026-12-02', { planting_id: uuidA, checkpoint: 'Week 1' }).length >= 1, true);
const pe = (id: string, d: string, data: Record<string, string | number>, n: number): FormEntry => ({ id, form: 'planting', entry_date: d, data, created_at: `2026-11-2${n}T10:00:00Z`, updated_at: '' });
const ce = (id: string, d: string, data: Record<string, string | number>, n: number): FormEntry => ({ id, form: 'survival-check', entry_date: d, data, created_at: `2026-12-0${n}T10:00:00Z`, updated_at: '' });
const rest = buildRestoration([
  pe(uuidA, '2026-11-01', { species: 'Croton megalocarpus', sector: 'S3', trees_planted: 50 }, 1),
  pe(uuidB, '2026-11-10', { species: 'Ficus sur', sector: 'S1', trees_planted: 20 }, 2),
  ce('c1', '2026-11-08', { planting_id: uuidA, checkpoint: 'Week 1', alive: 48, dead: 2 }, 1),
  ce('c2', '2026-12-01', { planting_id: uuidA, checkpoint: 'Month 1', alive: 45, dead: 3, replaced: 2 }, 2),
  ce('c3', '2026-12-02', { planting_id: uuidB, checkpoint: 'Month 1', alive: 20 }, 3),
  ce('orphan', '2026-12-02', { planting_id: '99999999-9999-4999-8999-999999999999', checkpoint: 'Week 1', alive: 5 }, 4),
]);
eq('totals', [rest?.totalPlanted, rest?.species, rest?.plantings.length], [70, 2, 2]);
eq('week 1 survival 96', [rest?.byCheckpoint[0].planted, rest?.byCheckpoint[0].alive, rest?.byCheckpoint[0].rate], [50, 48, 96]);
eq('month 1 survival (50+20 trees, 65 alive)', [rest?.byCheckpoint[1].planted, rest?.byCheckpoint[1].alive, rest?.byCheckpoint[1].rate], [70, 65, 92.9]);
eq('month 3 empty', rest?.byCheckpoint[2].rate, null);
eq('sector S3 uses its latest check', [rest?.bySector.find(r => r.label === 'S3')?.rate, rest?.bySector.find(r => r.label === 'S1')?.rate], [90, 100]);
eq('orphan check ignored', rest?.plantings.every(p => !p.checks['Week 1'] || p.id === uuidA), true);
const due = checksDue(rest?.plantings ?? [], '2026-12-10');
eq('Croton month 3 not due yet', due.some(d => d.planting.species === 'Croton megalocarpus' && d.checkpoint === 'Month 3'), false);
eq('Ficus week 1 is overdue', due.some(d => d.planting.species === 'Ficus sur' && d.checkpoint === 'Week 1' && d.overdue), true);
eq('no plantings means no restoration data', buildRestoration([]), null);

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('all checks passed');
