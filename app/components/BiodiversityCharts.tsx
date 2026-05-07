'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell, Sector,
} from 'recharts';

// ── Chart 1: Species Count 2023 vs 2025 ──────────────────────────────────────

const BAR_2023_2025 = [
  { taxa: 'Birds',        '2023': 83,  '2025': 251 },
  { taxa: 'Plants',       '2023': 260, '2025': 468 },
  { taxa: 'Butterflies',  '2023': 56,  '2025': 57  },
  { taxa: 'Aq. Inverts',  '2023': 29,  '2025': 52  },
  { taxa: 'Amph.&Rept.',  '2023': 12,  '2025': 22  },
  { taxa: 'Mammals',      '2023': 9,   '2025': 13  },
  { taxa: 'Fish',         '2023': 7,   '2025': 7   },
];

// ── Chart 2: Taxa Distribution 2025 donut ─────────────────────────────────────

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

// ── Chart 3: Student Visits 2026 ──────────────────────────────────────────────

const STUDENT_VISITS = [
  { quarter: 'Q1 2026', visits: 120 },
  { quarter: 'Q2 2026', visits: 85  },
  { quarter: 'Q3 2026', visits: 0   },
  { quarter: 'Q4 2026', visits: 0   },
];

// ── Chart 4: Water Quality Compliance ─────────────────────────────────────────

type WQSite = 'R1' | 'R2' | 'Outlet' | 'S5';
const WQ_SITES: WQSite[] = ['R1', 'R2', 'Outlet', 'S5'];

type WQParamData = { unit: string; limit: number; R1: number; R2: number; Outlet: number; S5: number };

const WQ_PARAMS_DATA: Record<string, WQParamData> = {
  'Iron':                    { unit: 'mg/L', limit: 3.5,  R1: 6.06,  R2: 5.87,  Outlet: 0.42, S5: 1.03  },
  'Manganese':               { unit: 'mg/L', limit: 0.1,  R1: 0.784, R2: 0.905, Outlet: 0.199,S5: 0.387 },
  'Oil & Grease':            { unit: 'mg/L', limit: 10,   R1: 105,   R2: 12,    Outlet: 8,    S5: 91    },
  'Total Suspended Solids':  { unit: 'mg/L', limit: 50,   R1: 750,   R2: 39,    Outlet: 1,    S5: 419   },
  'Phosphates':              { unit: 'mg/L', limit: 2.2,  R1: 3.47,  R2: 0.81,  Outlet: 0.15, S5: 1.40  },
};

const WQ_PARAMS_LIST = Object.keys(WQ_PARAMS_DATA);

function WQTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const { site, value, pass, limit, unit, paramName } = payload[0].payload;
  return (
    <div style={{
      background: '#1A2E1F',
      color: '#fff',
      borderRadius: '8px',
      padding: '8px 12px',
      fontFamily: 'Poppins, sans-serif',
      fontSize: '13px',
      lineHeight: 1.6,
    }}>
      <p style={{ fontWeight: 700, marginBottom: '4px' }}>{paramName}</p>
      <p>Site: <strong>{site}</strong></p>
      <p>Value: {value} {unit}</p>
      <p>Limit: {limit} {unit}</p>
      <p style={{ marginTop: '4px', fontWeight: 700, color: pass ? '#52b788' : '#ef9a9a' }}>
        {pass ? '✓ PASS' : '✗ FAIL'}
      </p>
    </div>
  );
}

// ── Shared style constants ─────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E0E8E2',
  borderRadius: '16px',
  padding: '24px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
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
    background: '#1A2E1F',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    fontFamily: 'Poppins, sans-serif',
    fontSize: '13px',
    color: '#ffffff',
  },
  itemStyle: { color: '#ffffff' },
  labelStyle: { color: '#ffffff', fontWeight: 700, marginBottom: '4px' },
  cursor: { fill: 'rgba(26,45,31,0.04)' },
};

const TICK_STYLE = { fontSize: 12, fill: '#4A5E4F', fontFamily: 'Poppins' };

// ── Component ─────────────────────────────────────────────────────────────────

export default function BiodiversityCharts() {
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);
  const [selectedParam, setSelectedParam] = useState('Iron');

  const paramData = WQ_PARAMS_DATA[selectedParam];
  const wqChartData = WQ_SITES.map(site => ({
    site,
    value: paramData[site],
    pass: paramData[site] <= paramData.limit,
    limit: paramData.limit,
    unit: paramData.unit,
    paramName: selectedParam,
  }));
  const xMax = Math.max(...wqChartData.map(d => d.value), paramData.limit) * 1.25;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

      {/* ── Chart 1: 2023 vs 2025 ── */}
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

      {/* ── Chart 2: Taxa Distribution donut ── */}
      <div style={CARD}>
        <h2 style={HEADING}>Taxa Distribution 2025</h2>
        <div style={{ position: 'relative' }}>
          {activeDonutIndex === null && (
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
                onMouseEnter={(_, index) => setActiveDonutIndex(index)}
                onMouseLeave={() => setActiveDonutIndex(null)}
              >
                {TAXA_DONUT.map(e => <Cell key={e.taxa} fill={e.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
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

      {/* ── Chart 3: Student Visits 2026 ── */}
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

      {/* ── Chart 4: Water Quality Compliance ── */}
      <div style={CARD}>
        <h2 style={HEADING}>Water Quality Compliance — Oct 2025</h2>

        {/* Parameter selector */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {WQ_PARAMS_LIST.map(param => {
            const active = param === selectedParam;
            return (
              <button
                key={param}
                onClick={() => setSelectedParam(param)}
                style={{
                  padding: '5px 14px',
                  borderRadius: '9999px',
                  border: `2px solid ${active ? '#0C6038' : '#E0E8E2'}`,
                  background: active ? '#0C6038' : 'transparent',
                  color: active ? '#fff' : '#4A5E4F',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {param}
              </button>
            );
          })}
        </div>

        {/* Limit badge */}
        <p style={{ fontSize: '12px', color: '#4A5E4F', fontFamily: 'Poppins', marginBottom: '8px' }}>
          Compliance limit:&nbsp;
          <strong style={{ color: '#D4251C' }}>≤ {paramData.limit} {paramData.unit}</strong>
          &nbsp;· Bars: <span style={{ color: '#1A7D2E', fontWeight: 600 }}>green = PASS</span>,{' '}
          <span style={{ color: '#D4251C', fontWeight: 600 }}>red = FAIL</span>
        </p>

        {/* Horizontal bar chart */}
        <ResponsiveContainer width="100%" height={200}>
          <BarChart layout="vertical" data={wqChartData} margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E8E2" horizontal={false} />
            <YAxis type="category" dataKey="site" tick={TICK_STYLE} axisLine={false} tickLine={false} width={48} />
            <XAxis type="number" tick={TICK_STYLE} axisLine={false} tickLine={false} domain={[0, xMax]} />
            <Tooltip content={<WQTooltip />} cursor={{ fill: 'rgba(26,45,31,0.04)' }} />
            <ReferenceLine
              x={paramData.limit}
              stroke="#D4251C"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{ value: `${paramData.limit}`, position: 'top', fontSize: 10, fill: '#D4251C', fontFamily: 'Poppins' }}
            />
            <Bar dataKey="value" name={selectedParam} radius={[0, 4, 4, 0]} animationDuration={600}>
              {wqChartData.map((entry, i) => (
                <Cell key={i} fill={entry.pass ? '#1A7D2E' : '#D4251C'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
