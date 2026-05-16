export type BioLimit =
  | { kind: 'max'; max: number }
  | { kind: 'min'; min: number }
  | { kind: 'range'; min: number; max: number };

export type BioParamRow = {
  parameter: string;
  unit: string;
  limit: string;
  method?: string;
  points: Record<string, string | number | null>;
};

export type BioParamParsed = {
  parameter: string;
  unit: string;
  limit: BioLimit | null;
  method?: string;
  /** site → measured value (null if missing / ND) */
  values: Record<string, number | null>;
  /** site → pass/fail; null if not scored */
  compliance: Record<string, boolean | null>;
};

export type BioComplianceSummary = {
  pass: number;
  fail: number;
  total: number;
  rate: number;
  parameters: BioParamParsed[];
  samplingPoints: string[];
  standard: string;
  samplingDate: string;
};

export function parseBioLimit(raw: string): BioLimit | null {
  const s = raw?.trim();
  if (!s || s === '–' || s === '-') return null;

  const gt = s.match(/^>\s*([\d.]+)/);
  if (gt) return { kind: 'min', min: parseFloat(gt[1]) };

  const range = s.match(/^([\d.]+)\s*[–-]\s*([\d.]+)/);
  if (range) return { kind: 'range', min: parseFloat(range[1]), max: parseFloat(range[2]) };

  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? { kind: 'max', max: n } : null;
}

/** Parse a single measurement; ND / below-detection returns null numeric. */
export function parseBioMeasurement(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).trim();
  if (!s || s === 'ND' || s === '–' || s === '-') return null;
  if (s.startsWith('<')) {
    const n = parseFloat(s.slice(1));
    return Number.isFinite(n) ? n : null;
  }
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** ND and below-detection values count as pass when a limit exists. */
export function isBioPass(value: number | null, limit: BioLimit, raw?: string | number | null): boolean {
  if (raw !== null && raw !== undefined) {
    const s = String(raw).trim();
    if (s === 'ND') return true;
    if (s.startsWith('<')) {
      const det = parseFloat(s.slice(1));
      if (limit.kind === 'max') return det <= limit.max;
      if (limit.kind === 'min') return det >= limit.min;
      if (limit.kind === 'range') return det >= limit.min && det <= limit.max;
    }
  }
  if (value === null) return true;
  if (limit.kind === 'max') return value <= limit.max;
  if (limit.kind === 'min') return value > limit.min;
  return value >= limit.min && value <= limit.max;
}

export function parseBiodiversitySurvey(survey: {
  standard: string;
  samplingDate: string;
  samplingPoints: string[];
  parameters: BioParamRow[];
}): BioComplianceSummary {
  const parameters: BioParamParsed[] = [];
  let pass = 0;
  let fail = 0;

  for (const p of survey.parameters) {
    const limit = parseBioLimit(p.limit);
    const values: Record<string, number | null> = {};
    const compliance: Record<string, boolean | null> = {};

    for (const [site, raw] of Object.entries(p.points)) {
      const num = parseBioMeasurement(raw);
      values[site] = num;
      if (!limit) {
        compliance[site] = null;
        continue;
      }
      const ok = isBioPass(num, limit, raw);
      compliance[site] = ok;
      if (ok) pass += 1;
      else fail += 1;
    }

    parameters.push({
      parameter: p.parameter,
      unit: p.unit,
      limit,
      method: p.method,
      values,
      compliance,
    });
  }

  const total = pass + fail;
  return {
    pass,
    fail,
    total,
    rate: total > 0 ? Math.round((pass / total) * 1000) / 10 : 0,
    parameters,
    samplingPoints: survey.samplingPoints,
    standard: survey.standard,
    samplingDate: survey.samplingDate,
  };
}

export function chartDataForParam(param: BioParamParsed) {
  return Object.entries(param.values).map(([site, value]) => ({
    site: site.length > 14 ? site.replace(' Pond', ' P').replace(' at ', ' ') : site,
    siteFull: site,
    value: value ?? 0,
    pass: param.compliance[site] ?? true,
    hasValue: value !== null,
    unit: param.unit,
    limit: param.limit,
  }));
}
