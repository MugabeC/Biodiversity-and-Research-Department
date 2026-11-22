'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useDashboardData } from '@/app/lib/useDashboardData';
import { normalizeWasteData } from '@/app/components/dashboard/WasteDashboardCharts';
import { monthSortKey } from '@/app/lib/dashboardUtils';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function isoToMonth(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

type Row = { label: string; byMonth: Map<string, number>; unit?: string };

function fmt(n: number | null | undefined) {
  if (n == null) return 'none recorded';
  return Math.round(n).toLocaleString('en-US');
}

export default function MonthlySummaryPage() {
  const { data } = useDashboardData();

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const add = (m: Map<string, number>, k: string, v: number | null | undefined) => { if (v != null) m.set(k, (m.get(k) ?? 0) + v); };
    const students = new Map<string, number>(), groups = new Map<string, number>();
    for (const m of data.schools.monthlyTotals) { add(students, m.month, m.totalStudents); add(groups, m.month, m.schoolGroups); }
    const acts = new Map<string, number>(), people = new Map<string, number>();
    for (const r of data.community) { add(acts, r.month, 1); add(people, r.month, r.participants ?? 0); }
    const passes = new Map<string, number>();
    for (const m of data.passes.monthlyTotals) add(passes, m.month, m.totalPasses);
    const research = new Map<string, number>();
    for (const r of data.research) {
      const parts = r.month.trim().split(' ');
      const label = /\b20\d{2}\b/.test(r.month) ? r.month.trim() : `${parts[0]} 20${parts[1] ?? '25'}`;
      add(research, label, 1);
    }
    const apps = new Map<string, number>(), starts = new Map<string, number>();
    for (const a of data.applications) add(apps, a.month, a.count);
    for (const i of data.internships) add(starts, i.month, i.total);
    const conflicts = new Map<string, number>();
    for (const c of data.conflicts) { const k = isoToMonth(c.date); if (k) add(conflicts, k, 1); }
    const waste = new Map<string, number>();
    for (const w of normalizeWasteData(data.waste)) add(waste, w.month, w.kg);
    return [
      { label: 'Students reached (school visits)', byMonth: students },
      { label: 'School groups', byMonth: groups },
      { label: 'Community activities', byMonth: acts },
      { label: 'Community participants (estimated)', byMonth: people },
      { label: 'Complimentary admissions', byMonth: passes },
      { label: 'Research requests', byMonth: research },
      { label: 'Internship applications', byMonth: apps },
      { label: 'Internship starts', byMonth: starts },
      { label: 'Conflict cases reported', byMonth: conflicts },
      { label: 'Waste collected', byMonth: waste, unit: 'kg' },
    ];
  }, [data]);

  const months = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => r.byMonth.forEach((_, k) => set.add(k)));
    return Array.from(set).sort((a, b) => monthSortKey(b) - monthSortKey(a));
  }, [rows]);

  const [picked, setPicked] = useState('');
  const month = picked && months.includes(picked) ? picked : (months[0] ?? '');
  const setMonth = setPicked;
  const prev = useMemo(() => {
    const idx = months.indexOf(month);
    return idx >= 0 ? months[idx + 1] ?? null : null;
  }, [months, month]);

  const today = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Kigali' }).format(new Date());
  const openConflicts = (data?.conflicts ?? []).filter(c => c.status?.toLowerCase() === 'open').length;

  return (
    <div className="report-page">
      <div className="report-controls">
        <label>
          Month{' '}
          <select value={month} onChange={e => setMonth(e.target.value)} className="chart-select">
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <button type="button" className="doc-action-btn doc-action-btn--primary" onClick={() => window.print()}>
          Save as PDF / Print
        </button>
        <p className="doc-upload-help">In the print window, choose &quot;Save as PDF&quot; as the destination.</p>
      </div>

      <article className="report-sheet">
        <header className="report-head">
          <Image src="/images/nep-logo.png" alt="Nyandungu Eco-Park" width={72} height={72} unoptimized />
          <div>
            <h1>Monthly Summary: {month}</h1>
            <p>Biodiversity and Research Department · Nyandungu Eco-Park, Kigali, Rwanda</p>
          </div>
        </header>

        <table className="report-table">
          <thead>
            <tr><th>Indicator</th><th>{month}</th><th>{prev ?? 'Previous month'}</th><th>Change</th><th>Total to {month}</th></tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const cur = r.byMonth.get(month);
              const before = prev ? r.byMonth.get(prev) : undefined;
              const diff = cur != null && before != null ? cur - before : null;
              const total = Array.from(r.byMonth.entries()).filter(([k]) => monthSortKey(k) <= monthSortKey(month)).reduce((t, [, v]) => t + v, 0);
              return (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{fmt(cur)}{cur != null && r.unit ? ` ${r.unit}` : ''}</td>
                  <td>{fmt(before)}{before != null && r.unit ? ` ${r.unit}` : ''}</td>
                  <td>{diff == null ? 'n/a' : `${diff > 0 ? '+' : ''}${Math.round(diff).toLocaleString('en-US')}`}</td>
                  <td>{fmt(total)}{r.unit ? ` ${r.unit}` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <table className="report-table report-table--small">
          <tbody>
            <tr><td>Open conflict cases (all months)</td><td>{openConflicts}</td></tr>
            <tr><td>Water quality compliance (latest park survey)</td><td>{data?.bioWater ? `${data.bioWater.rate}% (${data.bioWater.pass} of ${data.bioWater.total} tests within limits)` : 'no data'}</td></tr>
            <tr><td>Species recorded (2025 survey)</td><td>{data?.summary.totalSpecies ?? 'no data'}</td></tr>
          </tbody>
        </table>

        <footer className="report-foot">
          Source: Biodiversity and Research Department dashboard data. Prepared on {today}.
          &nbsp;Months without a record show &quot;none recorded&quot;. Counts only; no personal details are included.
        </footer>
      </article>
    </div>
  );
}
