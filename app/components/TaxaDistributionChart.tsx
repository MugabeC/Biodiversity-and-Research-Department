'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from 'recharts';

const TAXA_DONUT = [
  { taxa: 'Birds',                 count: 251, color: '#0C6038' },
  { taxa: 'Plants',                count: 468, color: '#2D4C39' },
  { taxa: 'Butterflies',           count: 57,  color: '#F5A623' },
  { taxa: 'Aquatic Inverts',       count: 52,  color: '#808847' },
  { taxa: 'Amphibians & Reptiles', count: 22,  color: '#6C2728' },
  { taxa: 'Mammals',               count: 13,  color: '#4895ef' },
  { taxa: 'Fish',                  count: 7,   color: '#52b788' },
];

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 5} outerRadius={innerRadius - 1}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <text x={cx} y={cy - 16} textAnchor="middle" fill="#1A2E1F"
        fontSize={22} fontWeight={900} fontFamily="Poppins, sans-serif">
        {value}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#4A5E4F"
        fontSize={11} fontFamily="Poppins, sans-serif">
        {payload.taxa}
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill="#4A5E4F"
        fontSize={11} fontFamily="Poppins, sans-serif">
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
};

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

export default function TaxaDistributionChart() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div style={CARD}>
      <h2 style={HEADING}>Taxa Distribution 2025</h2>
      <div style={{ position: 'relative' }}>
        {activeIndex === null && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: '28px', color: '#0C6038', lineHeight: 1 }}>870</div>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '12px', color: '#4A5E4F', marginTop: '4px' }}>species</div>
          </div>
        )}
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              activeShape={renderActiveShape}
              data={TAXA_DONUT}
              dataKey="count"
              nameKey="taxa"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={108}
              paddingAngle={2}
              strokeWidth={0}
              animationDuration={800}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {TAXA_DONUT.map(e => <Cell key={e.taxa} fill={e.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginTop: '12px' }}>
        {TAXA_DONUT.map(e => (
          <div key={e.taxa} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontFamily: 'Poppins, sans-serif' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: e.color, flexShrink: 0 }} />
            <span style={{ color: '#4A5E4F' }}>{e.taxa}</span>
            <span style={{ color: '#1A2E1F', fontWeight: 600, marginLeft: 'auto' }}>{e.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
