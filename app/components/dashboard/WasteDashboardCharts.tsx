'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { sortByMonth, withShortMonths } from '@/app/lib/dashboardUtils';
import { chartTooltipProps, useChartColors } from './chartTheme';

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
  const tt = chartTooltipProps(c);
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
    let sum = 0;
    return monthly.map(m => {
      sum += m.total;
      return { ...m, cumulative: sum };
    });
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
      <div className="glass-card chart-card">
        <h3 className="heading" style={{ fontSize: 16, margin: '0 0 0.5rem' }}>
          Waste collected (kg per month)
        </h3>
        <p className="chart-card-desc">Monthly waste totals from the Waste Management JSON dataset.</p>
        <div className="chart-card-body" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
              <XAxis dataKey="monthShort" tick={axisTick} angle={-35} textAnchor="end" height={56} />
              <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} />
              <Tooltip {...tt} />
              <Legend wrapperStyle={{ fontFamily: 'Poppins', fontSize: 12, color: c.tick }} />
              <Bar dataKey="total" name="Waste collected (kg)" fill={c.primary} radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card chart-card">
        <h3 className="heading" style={{ fontSize: 16, margin: '0 0 0.5rem' }}>
          Cumulative waste collected (12 months)
        </h3>
        <p className="chart-card-desc">Running total of waste collected across the reporting year.</p>
        <div className="chart-card-body" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulative} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
              <XAxis dataKey="monthShort" tick={axisTick} angle={-35} textAnchor="end" height={56} />
              <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} />
              <Tooltip {...tt} />
              <Line
                type="monotone"
                dataKey="cumulative"
                name="Cumulative (kg)"
                stroke={c.primary}
                strokeWidth={2.5}
                dot={{ r: 3, fill: c.primary }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
