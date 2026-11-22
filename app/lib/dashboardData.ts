/**
 * Dashboard datasets bundled at build time — avoids dev-server fetch hangs on /data/*.json.
 */
import summaryJson from '@/public/data/summary.json';
import schoolVisitsJson from '@/public/data/NEP_school_visits.json';
import communityActivitiesJson from '@/public/data/NEP_community_engagement.json';
import complementaryPassesJson from '@/public/data/NEP_complementary_passes.json';
import wasteJson from '@/public/data/NEP_waste_management.json';
import researchJson from '@/public/data/Research_ALL.json';
import conflictJson from '@/public/data/Conflict_Management.json';
import internshipJson from '@/public/data/NEP_internship.json';
import internshipPipelineJson from '@/public/data/NEP_internship_pipeline.json';
import waterQualityJson from '@/public/data/water_quality.json';
import { parseBiodiversitySurvey, type BioComplianceSummary } from '@/app/lib/parseBiodiversityWater';
import { SUPABASE_URL } from '@/app/lib/documents';
import { applyEntries, type FormEntry } from '@/app/lib/entries';
import { buildWaterTests, combineWater, type WaterOverall, type WaterTest } from '@/app/lib/waterTests';
import { buildRestoration, type Restoration } from '@/app/lib/restoration';

/** The data files that ship with the site. */
export type DataFiles = {
  summary: unknown; schoolVisits: unknown; community: unknown; passes: unknown;
  waste: unknown; research: unknown; conflicts: unknown; internships: unknown;
};
const BUNDLED: DataFiles = {
  summary: summaryJson, schoolVisits: schoolVisitsJson, community: communityActivitiesJson, passes: complementaryPassesJson,
  waste: wasteJson, research: researchJson, conflicts: conflictJson, internships: internshipJson,
};
import type { WasacRawParam } from '@/app/lib/exploreWaterQuality';

export type DashboardSummary = {
  parkName: string;
  parkSize: string;
  location: string;
  surveyYear: string;
  /** Student target per quarter (orange line on the quarterly chart). */
  studentTargetPerQuarter?: number;
  totalSpecies: number;
  taxa: Record<string, { count2025: number; count2023: number; [k: string]: unknown }>;
};

export type SchoolVisitsData = {
  monthlyTotals: { month: string; totalStudents: number | null; schoolGroups?: number | null; label?: string }[];
  individualVisits: {
    month: string;
    school: string;
    students: number | null;
    teachers?: string | number | null;
    notes?: string | null;
    schoolGroups?: number | null;
    otherAdults?: number | null;
    complimentary?: number | null;
    programme?: string | null;
    programmePupils?: number | null;
  }[];
};

export type CommunityRow = {
  month: string;
  activity: string;
  participants: number | null;
  participantGroup?: string | null;
  women?: number | null;
  men?: number | null;
  institutions?: number | null;
  complimentary?: number | null;
  notes?: string | null;
};

export type PassesData = {
  monthlyTotals: { month: string; totalPasses: number }[];
  detail: { month: string; group: string; passes: number; notes?: string | null }[];
};

export type WasteFile =
  | { month: string; kg: number | null; biodegradableKg?: number | null; nonBiodegradableKg?: number | null; splitEstimated?: boolean; note?: string | null }[]
  | { records: { month: string; kg: number | null; biodegradableKg?: number | null; nonBiodegradableKg?: number | null; splitEstimated?: boolean; note?: string | null }[]; splitNote?: string };

export type ResearchRow = {
  month: string;
  dateReceived: string | null;
  names: string;
  category: string;
  institution: string | null;
  program: string | null;
  topic: string | null;
  requestedActivities: string | null;
  /** Approved / permission granted, Under review / revise, Advised to revise, Pending … */
  status: string | null;
  internalRemarks: string | null;
  actionTaken: string | null;
  followUpDate: string | null;
  assignedContact: string | null;
};

export type ConflictRow = {
  id: number | null;
  date: string | null;
  stakeholder: string | null;
  areaType: string | null;
  location: string | null;
  category: string | null;
  issueType: string | null;
  description: string | null;
  affectedArea: string | null;
  actionType: string | null;
  assignedTo: string | null;
  status: string | null;
  resolutionDate: string | null;
  actionTaken: string | null;
  followUpRequired: string | null;
};

export type InternshipPipeline = {
  since: string;
  asOf: string;
  total: number;
  byType: { Academic: number; Professional: number };
  stages: { stage: string; academic: number; professional: number }[];
  institutions: { name: string; count: number }[];
  requestedPeriod: { period: string; count: number }[];
};

export type LoadedDashboard = {
  summary: DashboardSummary;
  schools: SchoolVisitsData;
  community: CommunityRow[];
  passes: PassesData;
  waste: WasteFile;
  research: ResearchRow[];
  conflicts: ConflictRow[];
  internships: { month: string; academic: number; professional: number; total: number }[];
  internshipPipeline: InternshipPipeline;
  /** Internship applications received per month (counts only). */
  applications: { month: string; count: number }[];
  bioWater: BioComplianceSummary | null;
  /** Water tests entered from the staff form, newest first. */
  waterTests: WaterTest[];
  /** The park survey and the website tests counted together. */
  waterOverall: WaterOverall | null;
  /** Tree planting and survival from the staff forms, or null when nothing is recorded. */
  restoration: Restoration | null;
  wasacParams: WasacRawParam[];
  wasacSiteLabels: string[];
};

type WrappedRows<T> = { data?: T[] };
type WrappedMonths<T> = { months?: T[] };

function cleanString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = cleanString(value);
  if (!text || /^n\/?a$/i.test(text)) return null;
  const n = Number(text.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function isSubtotal(label: string | null): boolean {
  return Boolean(label && /subtotal/i.test(label));
}

function normalizeSchoolVisits(f: DataFiles): SchoolVisitsData {
  type NewVisit = {
    school?: string; students?: number | null; school_groups?: number | null; teachers?: number | null;
    other_adults?: number | null; complimentary?: number | null; programme?: string | null; programme_pupils?: number | null;
    teachers_other?: string | null; notes?: string | null;
  };
  type NewMonth = { month?: string; subtotal_students?: number | null; school_groups?: number | null; visits?: NewVisit[] };
  const newMonths = ((f.schoolVisits as WrappedMonths<NewMonth>).months ?? []);
  if (newMonths.length > 0) {
    const monthlyTotals = newMonths.map(m => ({
      month: cleanString(m.month) ?? 'Unknown',
      totalStudents: parseNumber(m.subtotal_students),
      schoolGroups: parseNumber(m.school_groups),
    }));
    const individualVisits = newMonths.flatMap(m =>
      (m.visits ?? []).map(v => ({
        month: cleanString(m.month) ?? 'Unknown',
        school: cleanString(v.school) ?? 'School groups (names not listed)',
        students: parseNumber(v.students),
        teachers: parseNumber(v.teachers) ?? cleanString(v.teachers_other),
        notes: cleanString(v.notes),
        schoolGroups: parseNumber(v.school_groups),
        otherAdults: parseNumber(v.other_adults),
        complimentary: parseNumber(v.complimentary),
        programme: cleanString(v.programme),
        programmePupils: parseNumber(v.programme_pupils),
      }))
    );
    return { monthlyTotals, individualVisits };
  }

  type Old = { Month?: string; 'School / Group'?: string; Students?: number | null; 'Teachers / Other'?: string | null; Notes?: string | null };
  const rows = ((f.schoolVisits as WrappedRows<Old>).data ?? []);
  const individualVisits = rows.filter(row => !isSubtotal(cleanString(row['School / Group']))).map(row => ({
    month: cleanString(row.Month) ?? 'Unknown',
    school: cleanString(row['School / Group']) ?? 'Unknown',
    students: parseNumber(row.Students),
    teachers: cleanString(row['Teachers / Other']),
    notes: cleanString(row.Notes),
  }));
  const totals = new Map<string, number>();
  for (const row of rows) {
    const month = cleanString(row.Month);
    const students = parseNumber(row.Students);
    if (!month || students == null) continue;
    if (isSubtotal(cleanString(row['School / Group']))) totals.set(month, students);
    else if (!totals.has(month)) totals.set(month, (totals.get(month) ?? 0) + students);
  }
  return { monthlyTotals: Array.from(totals.entries()).map(([month, totalStudents]) => ({ month, totalStudents })), individualVisits };
}

function normalizeCommunityActivities(f: DataFiles): CommunityRow[] {
  type NewActivity = {
    activity?: string; participant_group?: string | null; participants?: number | null;
    women?: number | null; men?: number | null; institutions?: number | null; complimentary?: number | null; notes?: string | null;
  };
  type NewMonth = { month?: string; activities?: NewActivity[] };
  return ((f.community as WrappedMonths<NewMonth>).months ?? []).flatMap(m =>
    (m.activities ?? []).map(a => ({
      month: cleanString(m.month) ?? 'Unknown',
      activity: cleanString(a.activity) ?? 'Untitled activity',
      participants: parseNumber(a.participants),
      participantGroup: cleanString(a.participant_group),
      women: parseNumber(a.women),
      men: parseNumber(a.men),
      institutions: parseNumber(a.institutions),
      complimentary: parseNumber(a.complimentary),
      notes: cleanString(a.notes),
    }))
  );
}

function normalizeComplementaryPasses(f: DataFiles): PassesData {
  type NewPass = { group?: string; count?: number | null; notes?: string | null };
  type NewMonth = { month?: string; subtotal?: number | null; passes?: NewPass[] };
  const newMonths = ((f.passes as WrappedMonths<NewMonth>).months ?? []);
  if (newMonths.length > 0) {
    const detail = newMonths.flatMap(m =>
      (m.passes ?? []).map(p => ({
        month: cleanString(m.month) ?? 'Unknown',
        group: cleanString(p.group) ?? 'Unknown',
        passes: parseNumber(p.count) ?? 0,
        notes: cleanString(p.notes),
      }))
    );
    const monthlyTotals = newMonths.map(m => ({
      month: cleanString(m.month) ?? 'Unknown',
      totalPasses: parseNumber(m.subtotal) ?? (m.passes ?? []).reduce((s, p) => s + (parseNumber(p.count) ?? 0), 0),
    }));
    return { monthlyTotals, detail };
  }

  type Old = { Month?: string; 'Group / Recipient Name'?: string; 'Number of Passes'?: number | null; Notes?: string | null };
  const rows = ((f.passes as WrappedRows<Old>).data ?? []);
  const detail = rows.filter(row => parseNumber(row['Number of Passes']) != null).filter(row => !isSubtotal(cleanString(row['Group / Recipient Name']))).map(row => ({
    month: cleanString(row.Month) ?? 'Unknown',
    group: cleanString(row['Group / Recipient Name']) ?? 'Unknown',
    passes: parseNumber(row['Number of Passes']) ?? 0,
    notes: cleanString(row.Notes),
  }));
  const subtotals = new Map<string, number>();
  for (const row of rows) {
    const month = cleanString(row.Month);
    const passes = parseNumber(row['Number of Passes']);
    if (!month || passes == null) continue;
    if (isSubtotal(cleanString(row['Group / Recipient Name']))) subtotals.set(month, passes);
  }
  const monthlyMap = new Map<string, number>();
  for (const row of detail) monthlyMap.set(row.month, (monthlyMap.get(row.month) ?? 0) + row.passes);
  return { monthlyTotals: Array.from(new Set([...Array.from(monthlyMap.keys()), ...Array.from(subtotals.keys())])).map(month => ({ month, totalPasses: subtotals.get(month) ?? monthlyMap.get(month) ?? 0 })), detail };
}

function normalizeWaste(f: DataFiles): WasteFile {
  type NewRow = {
    month?: string;
    waste_collected_kg?: number | string | null;
    biodegradable_kg?: number | null;
    non_biodegradable_kg?: number | null;
  };
  const newRows = (f.waste as { records?: NewRow[] }).records ?? [];

  const records = newRows.map(row => {
    const kg = parseNumber(row.waste_collected_kg);
    const note = typeof row.waste_collected_kg === 'string' && row.waste_collected_kg.trim().startsWith('>') ? `${row.waste_collected_kg} total` : null;
    const bioActual = parseNumber(row.biodegradable_kg);
    const nonActual = parseNumber(row.non_biodegradable_kg);
    const weighed = kg != null && (bioActual != null || nonActual != null);
    let biodegradableKg: number | null;
    let nonBiodegradableKg: number | null;
    if (weighed) {
      biodegradableKg = bioActual ?? (kg as number) - (nonActual as number);
      nonBiodegradableKg = nonActual ?? (kg as number) - (bioActual as number);
    } else {
      biodegradableKg = kg == null ? null : Math.round(kg * 0.7);
      nonBiodegradableKg = kg == null || biodegradableKg == null ? null : kg - biodegradableKg;
    }
    return {
      month: cleanString(row.month) ?? 'Unknown',
      kg,
      biodegradableKg,
      nonBiodegradableKg,
      splitEstimated: kg != null && !weighed,
      note,
    };
  });

  return {
    splitNote: 'Months without weighed figures use a 70% / 30% estimate for the biodegradable / non-biodegradable split.',
    records,
  };
}

function normalizeResearch(f: DataFiles): ResearchRow[] {
  type Raw = {
    month?: string;
    'Date Received'?: string | null;
    Names?: string | null;
    Category?: string | null;
    Institution?: string | null;
    'Program/Degree level'?: string | null;
    'Research Title / Topic'?: string | null;
    'Requested Activities'?: string | null;
    Status?: string | null;
    'Internal Remarks'?: string | null;
    'Action taken'?: string | null;
    'Follow-Up Date'?: string | null;
    'Assigned contact'?: string | null;
  };

  return ((f.research as WrappedRows<Raw>).data ?? [])
    .filter(row => cleanString(row.Names) || cleanString(row['Research Title / Topic']))
    .map(row => ({
      month: cleanString(row.month) ?? 'Unknown',
      dateReceived: cleanString(row['Date Received']),
      names: cleanString(row.Names) ?? 'Unknown',
      category: cleanString(row.Category)?.replace(/^=C4:I4/, '') ?? 'Unspecified',
      institution: cleanString(row.Institution),
      program: cleanString(row['Program/Degree level']),
      topic: cleanString(row['Research Title / Topic']),
      requestedActivities: cleanString(row['Requested Activities']),
      status: cleanString(row.Status),
      internalRemarks: cleanString(row['Internal Remarks']),
      actionTaken: cleanString(row['Action taken']),
      followUpDate: cleanString(row['Follow-Up Date']),
      assignedContact: cleanString(row['Assigned contact']),
    }));
}

function normalizeConflicts(f: DataFiles): ConflictRow[] {
  type Raw = Record<string, unknown>;
  const rows = ((f.conflicts as WrappedRows<Raw>).data ?? []);

  return rows
    .filter(row => typeof row.id === 'number')
    .map(row => ({
      id: parseNumber(row.id),
      date: cleanString(row.date),
      stakeholder: cleanString(row.stakeholder),
      areaType: cleanString(row.areaType),
      location: cleanString(row.location),
      category: cleanString(row.category),
      issueType: cleanString(row.issueType),
      description: cleanString(row.description),
      affectedArea: cleanString(row.affectedArea),
      actionType: cleanString(row.actionType),
      assignedTo: cleanString(row.assignedTo),
      status: cleanString(row.status),
      resolutionDate: cleanString(row.resolutionDate),
      actionTaken: cleanString(row.actionTaken),
      followUpRequired: cleanString(row.followUpRequired),
    }));
}

function normalizeInternships(f: DataFiles): { month: string; academic: number; professional: number; total: number }[] {
  type Row = { month?: string; count?: number | null };
  type InternshipFile = { academic_internship?: Row[]; professional_internship?: Row[] };
  const data = f.internships as InternshipFile;

  const map = new Map<string, { academic: number; professional: number }>();
  for (const row of data.academic_internship ?? []) {
    const month = cleanString(row.month) ?? 'Unknown';
    const cur = map.get(month) ?? { academic: 0, professional: 0 };
    cur.academic += parseNumber(row.count) ?? 0;
    map.set(month, cur);
  }
  for (const row of data.professional_internship ?? []) {
    const month = cleanString(row.month) ?? 'Unknown';
    const cur = map.get(month) ?? { academic: 0, professional: 0 };
    cur.professional += parseNumber(row.count) ?? 0;
    map.set(month, cur);
  }

  return Array.from(map.entries()).map(([month, vals]) => ({
    month,
    academic: vals.academic,
    professional: vals.professional,
    total: vals.academic + vals.professional,
  }));
}

export function loadDashboardFromBundle(overrides?: Partial<DataFiles>, entries: FormEntry[] = []): LoadedDashboard {
  const base: DataFiles = { ...BUNDLED, ...overrides };
  // entries from the staff forms are added on top of the workbook data
  const added = applyEntries(base as unknown as Record<string, unknown>, entries, internshipPipelineJson);
  const f = added.files as unknown as DataFiles;
  type WaterQualityFile = {
    biodiversitySurvey?: Parameters<typeof parseBiodiversitySurvey>[0];
    wasac?: { parameters?: WasacRawParam[]; samplingPoints?: string[] };
  };

  const wq = waterQualityJson as WaterQualityFile;

  let bioWater: BioComplianceSummary | null = null;
  try {
    if (wq.biodiversitySurvey) {
      bioWater = parseBiodiversitySurvey(wq.biodiversitySurvey);
    }
  } catch {
    bioWater = null;
  }

  const waterTests = buildWaterTests(entries, bioWater?.parameters ?? []);

  return {
    summary: f.summary as DashboardSummary,
    schools: normalizeSchoolVisits(f),
    community: normalizeCommunityActivities(f),
    passes: normalizeComplementaryPasses(f),
    waste: normalizeWaste(f),
    research: normalizeResearch(f),
    conflicts: normalizeConflicts(f),
    internships: normalizeInternships(f),
    internshipPipeline: (added.pipeline ?? internshipPipelineJson) as InternshipPipeline,
    applications: ((f.internships as { applications?: { month?: string; count?: number | null }[] }).applications ?? []).map(a => ({ month: a.month ?? 'Unknown', count: a.count ?? 0 })),
    bioWater,
    waterTests,
    waterOverall: combineWater(bioWater, waterTests),
    restoration: buildRestoration(entries),
    wasacParams: wq.wasac?.parameters ?? [],
    wasacSiteLabels: wq.wasac?.samplingPoints ?? [],
  };
}
