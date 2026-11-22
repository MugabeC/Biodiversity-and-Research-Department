// Prints the dashboard figures that come from staff records, so two versions of the code can be compared.
// Run: npx tsx scripts/dump_dashboard.ts > before.json
import { loadDashboardFromBundle } from '../app/lib/dashboardData';

const d = loadDashboardFromBundle();
const key = (...xs: unknown[]) => JSON.stringify(xs);
const out = {
  schoolMonthly: d.schools.monthlyTotals,
  schoolVisits: d.schools.individualVisits.map(v => key(v.month, v.school, v.students, v.teachers, v.otherAdults, v.schoolGroups, v.complimentary, v.programme, v.programmePupils)),
  community: d.community.map(c => key(c.month, c.activity, c.participantGroup, c.participants, c.women, c.men, c.institutions, c.complimentary)),
  passesMonthly: d.passes.monthlyTotals,
  passesDetail: d.passes.detail.map(p => key(p.month, p.group, p.passes, p.notes)).sort(),
  research: d.research.map(r => key(r.month, r.dateReceived, r.names, r.category, r.institution, r.program, r.topic, r.requestedActivities, r.status)),
  conflicts: d.conflicts.map(c => key(c.id, c.date, c.stakeholder, c.areaType, c.location, c.category, c.issueType, c.description, c.affectedArea, c.actionType, c.assignedTo, c.status, c.resolutionDate, c.actionTaken, c.followUpRequired)),
  waste: d.waste,
  internships: d.internships,
  applications: d.applications,
};
console.log(JSON.stringify(out, null, 1));
