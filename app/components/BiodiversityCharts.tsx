'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

type BarRow = { taxa: string; '2023': number; '2025': number };

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

const TAXA_ROWS: { key: string; label: string }[] = [
  { key: 'birds', label: 'Birds' },
  { key: 'plants', label: 'Plants' },
  { key: 'butterflies', label: 'Butterflies' },
  { key: 'aquatic_inverts', label: 'Aq. Inverts' },
  { key: 'amphibians_reptiles', label: 'Amph.&Rept.' },
  { key: 'mammals', label: 'Mammals' },
  { key: 'fish', label: 'Fish' },
];

export default function BiodiversityCharts() {
  const [barData, setBarData] = useState<BarRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/summary.json')
      .then(r => r.json())
      .then(json => {
        const taxa = json.taxa ?? {};
        setBarData(
          TAXA_ROWS.map(({ key, label }) => ({
            taxa: label,
            '2023': taxa[key]?.count2023 ?? 0,
            '2025': taxa[key]?.count2025 ?? 0,
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="glass-card">
      <h2 className="heading" style={HEADING}>Species Count: 2023 vs 2025</h2>
      {loading ? (
        <p className="text-secondary" style={{ fontSize: '14px' }}>Loading…</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E8E2" vertical={false} />
            <XAxis dataKey="taxa" tick={{ ...TICK_STYLE, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
            <Tooltip {...DARK_TT} />
            <Legend wrapperStyle={{ fontFamily: 'Poppins', fontSize: '12px', paddingTop: '14px' }} />
            <Bar dataKey="2023" name="2023 Baseline" fill="#F1D2A1" radius={[4, 4, 0, 0]} animationDuration={800} />
            <Bar dataKey="2025" name="2025 Current"  fill="#0C6038" radius={[4, 4, 0, 0]} animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
