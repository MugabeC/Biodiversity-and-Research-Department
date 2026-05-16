'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, Sector, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';
import { useChartColors } from './chartTheme';

type DonutRow = { taxa: string; count: number; color: string };

function ActiveShape(props: PieSectorDataItem & { payload?: DonutRow }) {
  const {
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    fill = '#000',
    payload,
    percent = 0,
    value = 0,
  } = props;
  const pct = ((percent ?? 0) * 100).toFixed(1);
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={(outerRadius as number) + 14}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={2}
      />
      <text x={cx} y={(cy as number) - 8} textAnchor="middle" fill="var(--text-primary)" fontSize={11} fontWeight={700} fontFamily="Poppins">
        {payload?.taxa}
      </text>
      <text x={cx} y={(cy as number) + 10} textAnchor="middle" fill="var(--text-secondary)" fontSize={11} fontFamily="Poppins">
        {value} species
      </text>
      <text x={cx} y={(cy as number) + 26} textAnchor="middle" fill="#F5A623" fontSize={10} fontFamily="Poppins">
        {pct}% of total
      </text>
    </g>
  );
}

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: DonutRow }>;
}) {
  const c = useChartColors();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div
      style={{
        background: c.tooltipBg,
        border: `1px solid ${c.tooltipBorder}`,
        borderRadius: 10,
        padding: '10px 14px',
        fontFamily: 'Poppins, sans-serif',
        fontSize: 13,
      }}
    >
      <p style={{ color: c.tooltipText, fontWeight: 700, margin: '0 0 4px' }}>{row.taxa}</p>
      <p style={{ color: c.tooltipItem, margin: 0 }}>{row.count} species recorded in 2025</p>
      <p style={{ color: c.accent, margin: '4px 0 0', fontSize: 12 }}>Share of park biodiversity</p>
    </div>
  );
}

export default function TaxaDonutChart({ data, total }: { data: DonutRow[]; total: number }) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Share of the {total.toLocaleString()} species recorded in 2025, by taxonomic group. Hover a slice to highlight it.
      </p>
      <div style={{ position: 'relative', width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="taxa"
              cx="40%"
              cy="50%"
              innerRadius={52}
              outerRadius={88}
              paddingAngle={2}
              strokeWidth={0}
              activeIndex={activeIndex}
              activeShape={ActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {data.map((e, i) => (
                <Cell key={e.taxa} fill={e.color} opacity={activeIndex === undefined || activeIndex === i ? 1 : 0.45} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontFamily: 'Poppins', fontSize: 11, paddingLeft: 8, lineHeight: '1.6' }}
              formatter={(value: string) => {
                const row = data.find(d => d.taxa === value);
                return `${value} (${row?.count ?? ''})`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {activeIndex === undefined && (
          <div
            style={{
              position: 'absolute',
              left: '40%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <p className="heading" style={{ fontSize: 22, margin: 0, color: 'var(--accent-text)', lineHeight: 1 }}>
              {total}
            </p>
            <p style={{ fontSize: 11, margin: '2px 0 0', color: 'var(--text-secondary)' }}>species</p>
          </div>
        )}
      </div>
    </div>
  );
}
