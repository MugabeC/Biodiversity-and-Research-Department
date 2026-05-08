'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

const BAR_2023_2025 = [
  { taxa: 'Birds',        '2023': 83,  '2025': 251 },
  { taxa: 'Plants',       '2023': 260, '2025': 468 },
  { taxa: 'Butterflies',  '2023': 56,  '2025': 57  },
  { taxa: 'Aq. Inverts',  '2023': 29,  '2025': 52  },
  { taxa: 'Amph.&Rept.',  '2023': 12,  '2025': 22  },
  { taxa: 'Mammals',      '2023': 9,   '2025': 13  },
  { taxa: 'Fish',         '2023': 7,   '2025': 7   },
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

export default function BiodiversityCharts() {
  return (
    <div style={CARD}>
      <h2 style={HEADING}>Species Count: 2023 vs 2025</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={BAR_2023_2025} margin={{ top: 4, right: 8, left: -10, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="#E0E8E2" vertical={false} />
          <XAxis dataKey="taxa" tick={{ ...TICK_STYLE, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
          <Tooltip {...DARK_TT} />
          <Legend wrapperStyle={{ fontFamily: 'Poppins', fontSize: '12px', paddingTop: '14px' }} />
          <Bar dataKey="2023" name="2023 Baseline" fill="#F1D2A1" radius={[4, 4, 0, 0]} animationDuration={800} />
          <Bar dataKey="2025" name="2025 Current"  fill="#0C6038" radius={[4, 4, 0, 0]} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
