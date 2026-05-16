'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';

type VisitRow = { quarter: string; visits: number };

const HEADING: React.CSSProperties = {
  fontSize: '16px',
  margin: '0 0 20px',
};

const DARK_TT = {
  contentStyle: {
    background: '#1A2E1F', border: 'none', borderRadius: '8px',
    padding: '8px 12px', fontFamily: 'Poppins, sans-serif', fontSize: '13px', color: '#ffffff',
  },
  itemStyle: { color: '#ffffff' },
  labelStyle: { color: '#ffffff', fontWeight: 700, marginBottom: '4px' },
  cursor: { fill: 'rgba(26,45,31,0.04)' },
};

const TICK_STYLE = { fontSize: 12, fill: '#4A5E4F', fontFamily: 'Poppins' };

function toQuarterly2026(monthlyTotals: { month: string; totalStudents: number | null }[]): VisitRow[] {
  const quarters: { label: string; months: string[] }[] = [
    { label: 'Q1 2026', months: ['January 2026', 'February 2026', 'March 2026'] },
    { label: 'Q2 2026', months: ['April 2026', 'May 2026', 'June 2026'] },
    { label: 'Q3 2026', months: ['July 2026', 'August 2026', 'September 2026'] },
    { label: 'Q4 2026', months: ['October 2026', 'November 2026', 'December 2026'] },
  ];

  return quarters.map(({ label, months }) => {
    const visits = monthlyTotals
      .filter(m => months.includes(m.month))
      .reduce((sum, m) => sum + (m.totalStudents ?? 0), 0);
    return { quarter: label, visits };
  });
}

export default function StudentVisitsChart() {
  const [data, setData] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/school_visits.json')
      .then(r => r.json())
      .then(json => {
        setData(toQuarterly2026(json.monthlyTotals ?? []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="glass-card">
      <h2 className="heading" style={HEADING}>Student Visits 2026</h2>
      {loading ? (
        <p className="text-secondary" style={{ fontSize: '14px' }}>Loading…</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 4, right: 48, left: -10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E8E2" vertical={false} />
            <XAxis dataKey="quarter" tick={TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} domain={[0, 600]} />
            <Tooltip
              {...DARK_TT}
              formatter={(value) => {
                const n = Number(value);
                const pct = Math.round((n / 500) * 100);
                return [`${n} students (${pct}% of target)`, 'Visits'];
              }}
            />
            <ReferenceLine
              y={500}
              stroke="#D4251C"
              strokeDasharray="6 3"
              strokeWidth={2}
              label={{ value: 'Target: 500', position: 'right', fontSize: 11, fill: '#D4251C', fontFamily: 'Poppins' }}
            />
            <Bar dataKey="visits" name="Visits" fill="#0C6038" radius={[6, 6, 0, 0]} animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
