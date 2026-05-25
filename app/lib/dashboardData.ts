/**
 * Dashboard datasets bundled at build time — avoids dev-server fetch hangs on /data/*.json.
 */
import summaryJson from '@/public/data/summary.json';
import schoolVisitsJson from '@/public/data/School_Visits_-_Students.json';
import communityActivitiesJson from '@/public/data/Community_Engagement_Activities.json';
import complementaryPassesJson from '@/public/data/complementary_passes.json';
import wasteJson from '@/public/data/Waste_Management.json';
import researchJson from '@/public/data/Research_ALL.json';
import conflictJson from '@/public/data/Conflict_Management.json';
import waterQualityJson from '@/public/data/water_quality.json';
import { parseBiodiversitySurvey, type BioComplianceSummary } from '@/app/lib/parseBiodiversityWater';
import type { WasacRawParam } from '@/app/lib/exploreWaterQuality';

export type DashboardSummary = {
  parkName: string;
  parkSize: string;
  location: string;
  surveyYear: string;
  totalSpecies: number;
  taxa: Record<string, { count2025: number; count2023: number; [k: string]: unknown }>;
};

export type SchoolVisitsData = {
  monthlyTotals: { month: string; totalStudents: number | null; label?: string }[];
  individualVisits: {
    month: string;
    school: string;
    students: number | null;
    teachers?: string | null;
    notes?: string | null;
  }[];
};

export type CommunityRow = {
  month: string;
  activity: string;
  participants: string;
  notes?: string | null;
};

export type PassesData = {
  monthlyTotals: { month: string; totalPasses: number }[];
  detail: { month: string; group: string; passes: number; notes?: string | null }[];
};

export type WasteFile =
  | { month: string; kg: number | null; biodegradableKg?: number | null; nonBiodegradableKg?: number | null; note?: string | null }[]
  | { records: { month: string; kg: number | null; biodegradableKg?: number | null; nonBiodegradableKg?: number | null; note?: string | null }[]; splitNote?: string };

export type ResearchRow = {
  month: string;
  dateReceived: string | null;
  names: string;
  category: string;
  institution: string | null;
  program: string | null;
  topic: string | null;
  requestedActivities: string | null;
  internalRemarks: string | null;
  actionTaken: string | null;
  followUpDate: string | null;
  assignedContact: string | null;
};

export type ConflictRow = {
  id: number | null;
  date: string | null;
  reporter: string | null;
  stakeholder: string | null;
  phone: string | null;
  source: string | null;
  location: string | null;
  category: string | null;
  issueType: string | null;
  description: string | null;
  scale: string | null;
  affectedArea: string | null;
  actionType: string | null;
  assignedTo: string | null;
  status: string | null;
  resolutionDate: string | null;
  actionTaken: string | null;
  followUpRequired: string | null;
  followUpStatus: string | null;
};

export type LoadedDashboard = {
  summary: DashboardSummary;
  schools: SchoolVisitsData;
  community: CommunityRow[];
  passes: PassesData;
  waste: WasteFile;
  research: ResearchRow[];
  conflicts: ConflictRow[];
  bioWater: BioComplianceSummary | null;
  wasacParams: WasacRawParam[];
  wasacSiteLabels: string[];
};

type WrappedRows<T> = { data?: T[] };

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

function normalizeSchoolVisits(): SchoolVisitsData {
  type Raw = {
    Month?: string;
    'School / Group'?: string;
    Students?: number | null;
    'Teachers / Other'?: string | null;
    Notes?: string | null;
  };

  const rows = ((schoolVisitsJson as WrappedRows<Raw>).data ?? []);
  const individualVisits = rows
    .filter(row => !isSubtotal(cleanString(row['School / Group'])))
    .map(row => ({
      month: cleanString(row.Month) ?? 'Unknown',
      school: cleanString(row['School / Group']) ?? 'Unknown',
      students: parseNumber(row.Students),
      teachers: cleanString(row['Teachers / Other']),
      notes: cleanString(row.Notes),
    }));

  const totals = new Map<string, number>();
  for (const row of rows) {
    const month = cleanString(row.Month);
    if (!month) continue;
    const students = parseNumber(row.Students);
    if (students == null) continue;
    if (isSubtotal(cleanString(row['School / Group']))) {
      totals.set(month, students);
    } else if (!totals.has(month)) {
      totals.set(month, (totals.get(month) ?? 0) + students);
    }
  }

  return {
    monthlyTotals: Array.from(totals.entries()).map(([month, totalStudents]) => ({ month, totalStudents })),
    individualVisits,
  };
}

function normalizeCommunityActivities(): CommunityRow[] {
  type Raw = {
    Month?: string;
    Activity?: string;
    'Participants / Scale'?: string | null;
    Notes?: string | null;
  };

  return ((communityActivitiesJson as WrappedRows<Raw>).data ?? []).map(row => ({
    month: cleanString(row.Month) ?? 'Unknown',
    activity: cleanString(row.Activity) ?? 'Untitled activity',
    participants: cleanString(row['Participants / Scale']) ?? 'Not specified',
    notes: cleanString(row.Notes),
  }));
}

function normalizeComplementaryPasses(): PassesData {
  type Raw = {
    Month?: string;
    'Group / Recipient Name'?: string;
    'Number of Passes'?: number | null;
    Notes?: string | null;
  };

  const rows = ((complementaryPassesJson as WrappedRows<Raw>).data ?? []);
  const detail = rows
    .filter(row => parseNumber(row['Number of Passes']) != null)
    .filter(row => !isSubtotal(cleanString(row['Group / Recipient Name'])))
    .map(row => ({
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
    if (isSubtotal(cleanString(row['Group / Recipient Name']))) {
      subtotals.set(month, passes);
    }
  }

  const monthlyMap = new Map<string, number>();
  for (const row of detail) {
    monthlyMap.set(row.month, (monthlyMap.get(row.month) ?? 0) + row.passes);
  }

  return {
    monthlyTotals: Array.from(new Set([...Array.from(monthlyMap.keys()), ...Array.from(subtotals.keys())])).map(month => ({
      month,
      totalPasses: subtotals.get(month) ?? monthlyMap.get(month) ?? 0,
    })),
    detail,
  };
}

function normalizeWaste(): WasteFile {
  type Raw = {
    Month?: string;
    'Waste Collected (kg)'?: number | string | null;
  };

  const records = ((wasteJson as WrappedRows<Raw>).data ?? []).map(row => {
    const rawKg = row['Waste Collected (kg)'];
    const kg = parseNumber(rawKg);
    const note = typeof rawKg === 'string' && rawKg.trim().startsWith('>') ? `${rawKg} total` : null;
    const biodegradableKg = kg == null ? null : Math.round(kg * 0.7);
    const nonBiodegradableKg = kg == null || biodegradableKg == null ? null : kg - biodegradableKg;
    return {
      month: cleanString(row.Month) ?? 'Unknown',
      kg,
      biodegradableKg,
      nonBiodegradableKg,
      note,
    };
  });

  return {
    splitNote: 'Biodegradable / non-biodegradable split uses 70% / 30% estimates until weighed data is entered.',
    records,
  };
}

function normalizeResearch(): ResearchRow[] {
  type Raw = {
    month?: string;
    'Date Received'?: string | null;
    Names?: string | null;
    Category?: string | null;
    Institution?: string | null;
    'Program/Degree level'?: string | null;
    'Research Title / Topic'?: string | null;
    'Requested Activities'?: string | null;
    'Internal Remarks'?: string | null;
    'Action taken'?: string | null;
    'Follow-Up Date'?: string | null;
    'Assigned contact'?: string | null;
  };

  return ((researchJson as WrappedRows<Raw>).data ?? [])
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
      internalRemarks: cleanString(row['Internal Remarks']),
      actionTaken: cleanString(row['Action taken']),
      followUpDate: cleanString(row['Follow-Up Date']),
      assignedContact: cleanString(row['Assigned contact']),
    }));
}

function normalizeConflicts(): ConflictRow[] {
  type Raw = Record<string, unknown>;
  const rows = ((conflictJson as WrappedRows<Raw>).data ?? []);

  return rows
    .filter(row => typeof row['1.0'] === 'number')
    .map(row => ({
      id: parseNumber(row['1.0']),
      date: cleanString(row['2026-05-04 00:00:00']),
      reporter: cleanString(row.Duff),
      stakeholder: cleanString(row['Park Staff']),
      phone: cleanString(row['782663796.0']),
      source: cleanString(row['Nearby Community']),
      location: cleanString(row['Kamashashi Cell/ King David Academy']),
      category: cleanString(row.Other),
      issueType: cleanString(row['Pollution Incident']),
      description: cleanString(row['Kind David Academ realease sewage water to the park']),
      scale: cleanString(row['More than 10']),
      affectedArea: cleanString(row['Park and wildlife']),
      actionType: cleanString(row['Monitoring Conducted']),
      assignedTo: cleanString(row['Elie and Arielle']),
      status: cleanString(row.Open),
      resolutionDate: cleanString(row.col_16),
      actionTaken: cleanString(row['Reported to the source and reffered to Cell']),
      followUpRequired: cleanString(row.Yes),
      followUpStatus: cleanString(row['Followup ongoing']),
    }));
}

export function loadDashboardFromBundle(): LoadedDashboard {
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

  return {
    summary: summaryJson as DashboardSummary,
    schools: normalizeSchoolVisits(),
    community: normalizeCommunityActivities(),
    passes: normalizeComplementaryPasses(),
    waste: normalizeWaste(),
    research: normalizeResearch(),
    conflicts: normalizeConflicts(),
    bioWater,
    wasacParams: wq.wasac?.parameters ?? [],
    wasacSiteLabels: wq.wasac?.samplingPoints ?? [],
  };
}
