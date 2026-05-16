export type WQSite = 'R1' | 'R2' | 'Outlet' | 'S5';
export const WQ_SITES: WQSite[] = ['R1', 'R2', 'Outlet', 'S5'];

export type WQParamData = {
  unit: string;
  limit: number;
  R1: number;
  R2: number;
  Outlet: number;
  S5: number;
};

type RawParam = {
  parameter: string;
  unit: string;
  limit: string;
  R1: string;
  R2: string;
  Outlet: string;
  S5: string;
};

/** Parse values like "25×10³", "0.8", or "5–9" (returns lower bound for ranges). */
export function parseWQValue(raw: string): number | null {
  const s = raw?.trim();
  if (!s || s === '–' || s === '-') return null;

  const sci = s.match(/([\d.]+)\s*[×x]\s*10\s*([²³23\d]+)/i);
  if (sci) {
    const base = parseFloat(sci[1]);
    const expChar = sci[2];
    const exp = expChar === '²' || expChar === '2' ? 2 : expChar === '³' || expChar === '3' ? 3 : parseInt(expChar, 10);
    return base * 10 ** exp;
  }

  const range = s.match(/^([\d.]+)\s*[–-]\s*([\d.]+)$/);
  if (range) return parseFloat(range[1]);

  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseWQParams(raw: RawParam[]): Record<string, WQParamData> {
  const out: Record<string, WQParamData> = {};

  for (const p of raw) {
    const limit = parseWQValue(p.limit);
    const R1 = parseWQValue(p.R1);
    const R2 = parseWQValue(p.R2);
    const Outlet = parseWQValue(p.Outlet);
    const S5 = parseWQValue(p.S5);
    if (limit === null || R1 === null || R2 === null || Outlet === null || S5 === null) continue;
    out[p.parameter] = { unit: p.unit, limit, R1, R2, Outlet, S5 };
  }

  return out;
}
