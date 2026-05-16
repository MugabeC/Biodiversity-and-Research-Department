'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from 'recharts';

type TaxaDonutDatum = { taxa: string; count: number; color: string };

const TAXA_META: { key: string; label: string; color: string }[] = [
  { key: 'birds', label: 'Birds', color: '#0C6038' },
  { key: 'plants', label: 'Plants', color: '#2D4C39' },
  { key: 'butterflies', label: 'Butterflies', color: '#F5A623' },
  { key: 'aquatic_inverts', label: 'Aquatic Inverts', color: '#808847' },
  { key: 'amphibians_reptiles', label: 'Amphibians & Reptiles', color: '#6C2728' },
  { key: 'mammals', label: 'Mammals', color: '#4895ef' },
  { key: 'fish', label: 'Fish', color: '#52b788' },
];

type PieActiveShapeProps = {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
  payload?: TaxaDonutDatum;
  value?: number;
  percent?: number;
};

const renderActiveShape = (props: PieActiveShapeProps) => {
  const cx = props.cx ?? 0;
  const cy = props.cy ?? 0;
  const innerRadius = props.innerRadius ?? 0;
  const outerRadius = props.outerRadius ?? 0;
  const startAngle = props.startAngle ?? 0;
  const endAngle = props.endAngle ?? 0;
  const fill = props.fill ?? '#0C6038';
  const { payload, value, percent } = props;
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
        {payload?.taxa}
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill="#4A5E4F"
        fontSize={11} fontFamily="Poppins, sans-serif">
        {((percent ?? 0) * 100).toFixed(1)}%
      </text>
    </g>
  );
};

const HEADING: React.CSSProperties = {
  fontSize: '16px',
  margin: '0 0 20px',
};

export default function TaxaDistributionChart() {
  const [donut, setDonut] = useState<TaxaDonutDatum[]>([]);
  const [total, setTotal] = useState(870);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/summary.json')
      .then(r => r.json())
      .then(json => {
        const taxa = json.taxa ?? {};
        setTotal(json.totalSpecies ?? 870);
        setDonut(
          TAXA_META.map(({ key, label, color }) => ({
            taxa: label,
            count: taxa[key]?.count2025 ?? 0,
            color,
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass-card">
        <h2 className="heading" style={HEADING}>Taxa Distribution 2025</h2>
        <p className="text-secondary" style={{ fontSize: '14px' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <h2 className="heading" style={HEADING}>Taxa Distribution 2025</h2>
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
            <div className="heading" style={{ fontSize: '28px', color: 'var(--accent-text)', lineHeight: 1 }}>{total}</div>
            <div className="text-secondary" style={{ fontSize: '12px', marginTop: '4px' }}>species</div>
          </div>
        )}
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              activeShape={renderActiveShape}
              data={donut}
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
              {donut.map(e => <Cell key={e.taxa} fill={e.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginTop: '12px' }}>
        {donut.map(e => (
          <div key={e.taxa} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontFamily: 'Poppins, sans-serif' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: e.color, flexShrink: 0 }} />
            <span className="text-secondary">{e.taxa}</span>
            <span className="heading" style={{ fontSize: '12px', marginLeft: 'auto' }}>{e.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
