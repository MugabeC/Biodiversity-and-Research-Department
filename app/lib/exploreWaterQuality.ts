import type { BioComplianceSummary, BioLimit } from './parseBiodiversityWater';
import { parseWQValue } from './parseWaterQuality';

export type WaterExploreRow = {
  parameter: string;
  site: string;
  value: string;
  unit: string;
  limit: string;
  result: string;
  methodOrRemarks: string;
};

export type WasacRawParam = {
  parameter: string;
  unit: string;
  limit: string;
  R1: string;
  R2: string;
  Outlet: string;
  S5: string;
  remarks?: string | null;
};

const WASAC_SITE_KEYS = ['R1', 'R2', 'Outlet', 'S5'] as const;

function formatBioLimit(limit: BioLimit | null): string {
  if (!limit) return '—';
  if (limit.kind === 'max') return `≤ ${limit.max}`;
  if (limit.kind === 'min') return `> ${limit.min}`;
  return `${limit.min}–${limit.max}`;
}

function formatBioResult(compliance: boolean | null | undefined): string {
  if (compliance === null || compliance === undefined) return '—';
  return compliance ? 'PASS' : 'FAIL';
}

function formatValue(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  return String(raw);
}

function wasacSitePass(valueRaw: string, limitRaw: string): string {
  const limit = limitRaw?.trim();
  if (!limit || limit === '–' || limit === '-') return '—';

  const value = parseWQValue(valueRaw);
  if (value === null) return '—';

  const range = limit.match(/^([\d.]+)\s*[–-]\s*([\d.]+)$/);
  if (range) {
    const min = parseFloat(range[1]);
    const max = parseFloat(range[2]);
    return value >= min && value <= max ? 'PASS' : 'FAIL';
  }

  const max = parseWQValue(limit);
  if (max === null) return '—';
  return value <= max ? 'PASS' : 'FAIL';
}

export function flattenBiodiversityExplore(summary: BioComplianceSummary): WaterExploreRow[] {
  const rows: WaterExploreRow[] = [];

  for (const param of summary.parameters) {
    for (const site of summary.samplingPoints) {
      const num = param.values[site];
      const value =
        num !== null && num !== undefined
          ? String(num)
          : 'ND';

      rows.push({
        parameter: param.parameter,
        site,
        value,
        unit: param.unit || '—',
        limit: formatBioLimit(param.limit),
        result: formatBioResult(param.compliance[site]),
        methodOrRemarks: param.method || '—',
      });
    }
  }

  return rows;
}

export function flattenWasacExplore(
  parameters: WasacRawParam[],
  samplingPointLabels?: string[],
): WaterExploreRow[] {
  const rows: WaterExploreRow[] = [];

  for (const param of parameters) {
    WASAC_SITE_KEYS.forEach((key, index) => {
      const valueRaw = param[key] ?? '—';
      rows.push({
        parameter: param.parameter,
        site: samplingPointLabels?.[index] ?? key,
        value: formatValue(valueRaw),
        unit: param.unit || '—',
        limit: param.limit || '—',
        result: wasacSitePass(valueRaw, param.limit),
        methodOrRemarks: param.remarks?.trim() || '—',
      });
    });
  }

  return rows;
}

export function filterWaterExploreRows(rows: WaterExploreRow[], query: string): WaterExploreRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    r =>
      r.parameter.toLowerCase().includes(q) ||
      r.site.toLowerCase().includes(q) ||
      r.value.toLowerCase().includes(q) ||
      r.unit.toLowerCase().includes(q) ||
      r.limit.toLowerCase().includes(q) ||
      r.result.toLowerCase().includes(q) ||
      r.methodOrRemarks.toLowerCase().includes(q),
  );
}
