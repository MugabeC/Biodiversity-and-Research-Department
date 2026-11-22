'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { sortByMonth, withShortMonths } from '@/app/lib/dashboardUtils';
import { useChartColors } from './chartTheme';
import { GRADIENT_DEFS, SlickTooltip } from './minimal';

export type WasteRecord = {
  month: string;
  kg: number | null;
  biodegradableKg?: number | null;
  nonBiodegradableKg?: number | null;
  note?: string | null;
};

export type WasteFile = WasteRecord[] | { records: WasteRecord[]; splitNote?: string };

export function normalizeWasteData(data: WasteFile): WasteRecord[] {
  if (Array.isArray(data)) return data;
  return data.records ?? [];
}

export default function WasteDashboardCharts({ data }: { data: WasteFile }) {
  const c = useChartColors();
  const rows = normalizeWasteData(data);

  const monthly = useMemo(() => {
    const mapped = sortByMonth(
      rows
        .filter(r => r.kg != null || r.biodegradableKg != null || r.nonBiodegradableKg != null)
        .map(r => {
          const bio = r.biodegradableKg ?? (r.kg != null ? Math.round((r.kg as number) * 0.7) : 0);
          const nonBio = r.nonBiodegradableKg ?? (r.kg != null ? (r.kg as number) - bio : 0);
          const total = r.kg ?? bio + nonBio;
          return { month: r.month, total };
        })
    );
    return withShortMonths(mapped);
  }, [rows]);

  const cumulative = useMemo(() => {
    return monthly.map((m, i) => ({ ...m, cumulative: monthly.slice(0, i + 1).reduce((total, x) => total + x.total, 0) }));
  }, [monthly]);

  if (monthly.length === 0) {
    return (
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
        No waste collection records yet.
      </p>
    );
  }

  const axisTick = { fill: c.tick, fontFamily: 'Poppins', fontSize: 9 };

  return (
    <div className="dashboard-charts-grid">
      <div className="chart-card chart-plain">
        <h3 className="dash-chart-title">
          Collected per month (kg)
        </h3>
        <div className="chart-card-body" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
              {GRADIENT_DEFS}
              <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
              <XAxis dataKey="monthShort" tick={axisTick} angle={-35} textAnchor="end" height={56} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<SlickTooltip unit=" kg" />} cursor={{ fill: 'rgba(12,96,56,0.05)' }} />
              <Bar dataKey="total" name="Collected" fill="url(#gGreen)" radius={[6, 6, 0, 0]} barSize={14} animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card chart-plain">
        <h3 className="dash-chart-title">
          Running total
        </h3>
        <div className="chart-card-body" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulative} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
              {GRADIENT_DEFS}
              <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
              <XAxis dataKey="monthShort" tick={axisTick} angle={-35} textAnchor="end" height={56} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<SlickTooltip unit=" kg" />} cursor={{ stroke: '#2E9E5B', strokeDasharray: '3 3' }} />
              <Area type="monotone" dataKey="cumulative" name="Running total" stroke="#2E9E5B" strokeWidth={2} fill="url(#gAreaGreen)" dot={false} activeDot={{ r: 5, fill: '#fff', stroke: '#2E9E5B', strokeWidth: 2 }} animationDuration={1100} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
