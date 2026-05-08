'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';

const STUDENT_VISITS = [
  { quarter: 'Q1 2026', visits: 120 },
  { quarter: 'Q2 2026', visits: 85  },
  { quarter: 'Q3 2026', visits: 0   },
  { quarter: 'Q4 2026', visits: 0   },
];

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.5)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.6)',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 8px 32px rgba(12,96,56,0.10)',
};

const HEADING: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif',
  fontWeight: 700,
  fontSize: '16px',
  color: '#1A2E1F',
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

export default function StudentVisitsChart() {
  return (
    <div style={CARD}>
      <h2 style={HEADING}>Student Visits 2026</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={STUDENT_VISITS} margin={{ top: 4, right: 48, left: -10, bottom: 4 }}>
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
    </div>
  );
}
