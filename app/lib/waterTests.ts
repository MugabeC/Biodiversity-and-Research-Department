/**
 * Water quality tests entered from the staff form. Each result is scored against the same Rwanda freshwater limits the
 * park survey uses (read from public/data/water_quality.json), so the percentage "within limits" is comparable.
 */
import { isBioPass, type BioLimit, type BioParamParsed } from '@/app/lib/parseBiodiversityWater';
import { WATER_PARAMETERS } from '@/app/lib/formSpec';
import type { FormEntry } from '@/app/lib/entries';

export type WaterResult = { parameter: string; unit: string; value: number; limit: string; ok: boolean | null };
export type WaterTest = {
  id: string;
  date: string;
  point: string;
  ref: string | null;
  note: string | null;
  results: WaterResult[];
  pass: number;
  fail: number;
  /** Share of scored results within limits, one decimal. Null when no result has a limit. */
  rate: number | null;
  outside: WaterResult[];
};
export type WaterOverall = { pass: number; fail: number; total: number; rate: number; tests: number };

export function limitText(limit: BioLimit | null): string {
  if (!limit) return 'no limit';
  if (limit.kind === 'max') return `up to ${limit.max}`;
  if (limit.kind === 'min') return `above ${limit.min}`;
  return `${limit.min} to ${limit.max}`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildWaterTests(entries: FormEntry[], params: BioParamParsed[]): WaterTest[] {
  const byName = new Map(params.map(p => [p.parameter, p]));
  return entries
    .filter(e => e.form === 'water-test')
    .map(e => {
      const results: WaterResult[] = [];
      for (const wp of WATER_PARAMETERS) {
        const value = e.data[wp.key];
        if (typeof value !== 'number') continue;
        const limit = byName.get(wp.name)?.limit ?? null;
        results.push({ parameter: wp.name, unit: wp.unit, value, limit: limitText(limit), ok: limit ? isBioPass(value, limit) : null });
      }
      const pass = results.filter(r => r.ok === true).length;
      const fail = results.filter(r => r.ok === false).length;
      return {
        id: e.id, date: e.entry_date, point: String(e.data.sampling_point ?? ''), ref: typeof e.data.report_ref === 'string' ? e.data.report_ref : null,
        note: typeof e.data.note === 'string' ? e.data.note : null,
        results, pass, fail, rate: pass + fail > 0 ? round1((pass / (pass + fail)) * 100) : null, outside: results.filter(r => r.ok === false),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** The park survey and the tests entered from the website, counted together. */
export function combineWater(survey: { pass: number; fail: number } | null, tests: WaterTest[]): WaterOverall | null {
  const pass = (survey?.pass ?? 0) + tests.reduce((s, t) => s + t.pass, 0);
  const fail = (survey?.fail ?? 0) + tests.reduce((s, t) => s + t.fail, 0);
  const total = pass + fail;
  if (total === 0) return null;
  return { pass, fail, total, rate: round1((pass / total) * 100), tests: tests.length };
}
