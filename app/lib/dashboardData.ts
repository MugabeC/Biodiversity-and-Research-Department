/**
 * Dashboard datasets bundled at build time — avoids dev-server fetch hangs on /data/*.json.
 */
import summaryJson from '@/public/data/summary.json';
import schoolVisitsJson from '@/public/data/school_visits.json';
import communityActivitiesJson from '@/public/data/community_activities.json';
import complementaryPassesJson from '@/public/data/complementary_passes.json';
import wasteJson from '@/public/data/waste.json';
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

export type LoadedDashboard = {
  summary: DashboardSummary;
  schools: SchoolVisitsData;
  community: CommunityRow[];
  passes: PassesData;
  waste: WasteFile;
  bioWater: BioComplianceSummary | null;
  wasacParams: WasacRawParam[];
  wasacSiteLabels: string[];
};

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
    schools: schoolVisitsJson as SchoolVisitsData,
    community: (communityActivitiesJson as CommunityRow[]) ?? [],
    passes: complementaryPassesJson as PassesData,
    waste: wasteJson as WasteFile,
    bioWater,
    wasacParams: wq.wasac?.parameters ?? [],
    wasacSiteLabels: wq.wasac?.samplingPoints ?? [],
  };
}
