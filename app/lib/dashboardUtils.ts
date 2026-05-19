const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Sort key for labels like "April 2025". */
export function monthSortKey(label: string): number {
  const parts = label.trim().split(' ');
  if (parts.length < 2) return 0;
  const year = parseInt(parts[parts.length - 1], 10);
  const monthName = parts.slice(0, -1).join(' ');
  const mi = MONTHS.findIndex(m => monthName.startsWith(m));
  return year * 12 + (mi >= 0 ? mi : 0);
}

export function sortByMonth<T extends { month: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month));
}

/** "April 2025" → "Apr 2025" */
export function abbreviateMonth(label: string): string {
  const parts = label.trim().split(' ');
  if (parts.length < 2) return label;
  const year = parts[parts.length - 1];
  const monthName = parts.slice(0, -1).join(' ');
  const mi = MONTHS.findIndex(m => monthName.startsWith(m));
  if (mi < 0) return label;
  return `${MONTHS[mi].slice(0, 3)} ${year}`;
}

/** Add monthShort to rows that have a month field. */
export function withShortMonths<T extends { month: string }>(rows: T[]): (T & { monthShort: string })[] {
  return rows.map(r => ({ ...r, monthShort: abbreviateMonth(r.month) }));
}

/** Calendar quarter label for "April 2025" → "Q2-2025" (Q1 Jan–Mar, Q2 Apr–Jun, Q3 Jul–Sep, Q4 Oct–Dec). */
export function monthToQuarterLabel(monthLabel: string): string | null {
  const parts = monthLabel.trim().split(' ');
  if (parts.length < 2) return null;
  const year = parseInt(parts[parts.length - 1], 10);
  const monthName = parts.slice(0, -1).join(' ');
  const mi = MONTHS.findIndex(m => monthName.startsWith(m));
  if (mi < 0 || Number.isNaN(year)) return null;
  const quarter = mi <= 2 ? 1 : mi <= 5 ? 2 : mi <= 8 ? 3 : 4;
  return `Q${quarter}-${year}`;
}

function quarterSortKey(label: string): number {
  const m = label.match(/^Q(\d)-(\d+)$/);
  if (!m) return 0;
  return parseInt(m[2], 10) * 10 + parseInt(m[1], 10);
}

/** Sum student counts by quarter from monthly rows. */
export function aggregateStudentsByQuarter(
  monthly: { month: string; students: number }[]
): { quarter: string; students: number }[] {
  const totals = new Map<string, number>();
  for (const row of monthly) {
    const label = monthToQuarterLabel(row.month);
    if (!label) continue;
    totals.set(label, (totals.get(label) ?? 0) + row.students);
  }
  return Array.from(totals.entries())
    .map(([quarter, students]) => ({ quarter, students }))
    .sort((a, b) => quarterSortKey(a.quarter) - quarterSortKey(b.quarter));
}

/** Pull a numeric participant count from free-text fields. */
export function parseParticipantCount(text: string | undefined): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  if (lower.includes('not specified') || lower === 'internal' || lower === 'internal team') return 0;
  const labeled = text.match(/([\d,]+)\s*(students|delegates|operators|members|participants|teachers|adults|children)/i);
  if (labeled) return parseInt(labeled[1].replace(/,/g, ''), 10);
  const first = text.match(/([\d,]+)/);
  return first ? parseInt(first[1].replace(/,/g, ''), 10) : 0;
}

export const CHART = {
  tick: { fontSize: 11, fill: 'var(--chart-tick)', fontFamily: 'Poppins' },
  grid: '#E0E8E2',
  tooltip: {
    contentStyle: {
      background: 'var(--chart-tooltip-bg)',
      border: '1px solid var(--chart-tooltip-border)',
      borderRadius: '8px',
      padding: '8px 12px',
      fontFamily: 'Poppins, sans-serif',
      fontSize: '13px',
      color: 'var(--chart-tooltip-text)',
    },
  },
};

export const TAXA_META = [
  { key: 'birds', label: 'Birds', iconLabel: 'Birds', color: '#0C6038' },
  { key: 'plants', label: 'Plants', iconLabel: 'Plants', color: '#2D4C39' },
  { key: 'butterflies', label: 'Butterflies', iconLabel: 'Butterflies', color: '#F5A623' },
  { key: 'aquatic_inverts', label: 'Aquatic Inverts', iconLabel: 'Aquatic Inverts', color: '#808847' },
  { key: 'amphibians_reptiles', label: 'Amphibians & Reptiles', iconLabel: 'Amphibians & Reptiles', color: '#6C2728' },
  { key: 'mammals', label: 'Mammals', iconLabel: 'Mammals', color: '#4895ef' },
  { key: 'fish', label: 'Fish', iconLabel: 'Fish', color: '#52b788' },
] as const;
