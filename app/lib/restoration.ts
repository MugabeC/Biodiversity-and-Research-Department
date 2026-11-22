/**
 * Tree planting and survival, from the two staff forms. Survival is counted per planting (a group of trees of one species
 * in one sector on one day): at each check the officer records how many are alive, dead, or dead and replaced.
 */
import type { FormEntry } from '@/app/lib/entries';

export const SURVIVAL_TARGET = 90;
export const CHECKPOINTS = [
  { name: 'Week 1', days: 7 },
  { name: 'Month 1', days: 30 },
  { name: 'Month 3', days: 90 },
  { name: 'Month 6', days: 180 },
] as const;
export const SECTORS = ['S1', 'S2', 'S3', 'S4', 'S5', 'EA'] as const;

export type Check = { id: string; date: string; checkpoint: string; alive: number; dead: number; replaced: number; rate: number };
export type Planting = {
  id: string; date: string; species: string; common: string | null; sector: string; planted: number; by: string | null;
  checks: Record<string, Check | undefined>;
  /** The most advanced checkpoint with a record. */
  latest: Check | null;
};
export type SurvivalRow = { label: string; planted: number; alive: number; dead: number; replaced: number; rate: number | null; batches: number };
export type Restoration = {
  totalPlanted: number;
  species: number;
  plantings: Planting[];
  byCheckpoint: SurvivalRow[];
  bySector: SurvivalRow[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

export function buildRestoration(entries: FormEntry[]): Restoration | null {
  const plantings = new Map<string, Planting>();
  for (const e of entries.filter(x => x.form === 'planting')) {
    plantings.set(e.id, {
      id: e.id, date: e.entry_date, species: str(e.data.species) ?? 'Unknown', common: str(e.data.common_name), sector: str(e.data.sector) ?? '',
      planted: num(e.data.trees_planted), by: str(e.data.planted_by), checks: {}, latest: null,
    });
  }
  if (plantings.size === 0) return null;

  // newest entry wins if a checkpoint was recorded twice
  const checks = entries.filter(x => x.form === 'survival-check').sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at));
  for (const e of checks) {
    const p = plantings.get(String(e.data.planting_id));
    const checkpoint = str(e.data.checkpoint);
    if (!p || !checkpoint || p.planted < 1) continue;
    const alive = Math.min(num(e.data.alive), p.planted);
    p.checks[checkpoint] = {
      id: e.id, date: e.entry_date, checkpoint, alive, dead: num(e.data.dead), replaced: num(e.data.replaced), rate: round1((alive / p.planted) * 100),
    };
  }
  for (const p of plantings.values()) {
    for (const c of CHECKPOINTS) if (p.checks[c.name]) p.latest = p.checks[c.name] as Check;
  }

  const list = [...plantings.values()].sort((a, b) => b.date.localeCompare(a.date));
  const row = (label: string, items: { planted: number; c: Check }[]): SurvivalRow => {
    const planted = items.reduce((s, i) => s + i.planted, 0);
    const alive = items.reduce((s, i) => s + i.c.alive, 0);
    return {
      label, planted, alive, dead: items.reduce((s, i) => s + i.c.dead, 0), replaced: items.reduce((s, i) => s + i.c.replaced, 0),
      rate: planted > 0 ? round1((alive / planted) * 100) : null, batches: items.length,
    };
  };
  const byCheckpoint = CHECKPOINTS.map(c => row(c.name, list.filter(p => p.checks[c.name]).map(p => ({ planted: p.planted, c: p.checks[c.name] as Check }))));
  const bySector = SECTORS.map(sector => {
    const inSector = list.filter(p => p.sector === sector);
    const r = row(sector, inSector.filter(p => p.latest).map(p => ({ planted: p.planted, c: p.latest as Check })));
    return { ...r, planted: inSector.reduce((s, p) => s + p.planted, 0), batches: inSector.length };
  }).filter(r => r.planted > 0);

  return {
    totalPlanted: list.reduce((s, p) => s + p.planted, 0),
    species: new Set(list.map(p => p.species.toLowerCase())).size,
    plantings: list,
    byCheckpoint,
    bySector,
  };
}

export type DueCheck = { planting: Planting; checkpoint: string; due: string; overdue: boolean };

/** Checks that have not been recorded yet and are due within 14 days or already late, oldest first. */
export function checksDue(plantings: Planting[], today: string): DueCheck[] {
  const out: DueCheck[] = [];
  const soon = addDays(today, 14);
  for (const p of plantings) {
    for (const c of CHECKPOINTS) {
      if (p.checks[c.name]) continue;
      const due = addDays(p.date, c.days);
      if (due <= soon) out.push({ planting: p, checkpoint: c.name, due, overdue: due < today });
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}
