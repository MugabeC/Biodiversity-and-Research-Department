'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
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

// ── Chart 3: Student Visits 2026 ──────────────────────────────────────────────

const STUDENT_VISITS = [
  { quarter: 'Q1 2026', visits: 120 },
  { quarter: 'Q2 2026', visits: 85  },
  { quarter: 'Q3 2026', visits: 0   },
  { quarter: 'Q4 2026', visits: 0   },
];

// ── Chart 4: Water Quality Compliance ─────────────────────────────────────────

type Site = 'R1' | 'R2' | 'Outlet' | 'S5';
const WQ_SITES: Site[] = ['R1', 'R2', 'Outlet', 'S5'];

type WQEntry = {
  param: string;
  limitDisplay: string;
  unit: string;
  R1: number;     R1_raw: number;     R1_pass: boolean;
  R2: number;     R2_raw: number;     R2_pass: boolean;
  Outlet: number; Outlet_raw: number; Outlet_pass: boolean;
  S5: number;     S5_raw: number;     S5_pass: boolean;
};

const WQ_RAW = [
  { param: 'pH',           unit: '',      limitLow: 5,   limitHigh: 9,    R1: 7.5,   R2: 7.5,   Outlet: 7.5,  S5: 7.5   },
  { param: 'Iron',         unit: 'mg/L',  limitLow: 0,   limitHigh: 3.5,  R1: 6.06,  R2: 5.87,  Outlet: 0.42, S5: 1.03  },
  { param: 'Manganese',    unit: 'mg/L',  limitLow: 0,   limitHigh: 0.1,  R1: 0.784, R2: 0.905, Outlet: 0.199,S5: 0.387 },
  { param: 'Oil & Grease', unit: 'mg/L',  limitLow: 0,   limitHigh: 10,   R1: 105,   R2: 12,    Outlet: 8,    S5: 91    },
  { param: 'TSS',          unit: 'mg/L',  limitLow: 0,   limitHigh: 50,   R1: 750,   R2: 39,    Outlet: 1,    S5: 419   },
  { param: 'Phosphates',   unit: 'mg/L',  limitLow: 0,   limitHigh: 2.2,  R1: 3.47,  R2: 0.81,  Outlet: 0.15, S5: 1.40  },
];

function sitePass(row: typeof WQ_RAW[number], site: Site): boolean {
  const v = row[site];
  return row.limitLow > 0
    ? v >= row.limitLow && v <= row.limitHigh
    : v <= row.limitHigh;
}

const WQ_DATA: WQEntry[] = WQ_RAW.map(row => ({
  param:        row.param,
  unit:         row.unit,
  limitDisplay: row.limitLow > 0
    ? `${row.limitLow}–${row.limitHigh}${row.unit ? ' ' + row.unit : ''}`
    : `≤ ${row.limitHigh}${row.unit ? ' ' + row.unit : ''}`,
  R1:     Math.min(row.R1 / row.limitHigh, 16),      R1_raw: row.R1,     R1_pass: sitePass(row, 'R1'),
  R2:     Math.min(row.R2 / row.limitHigh, 16),      R2_raw: row.R2,     R2_pass: sitePass(row, 'R2'),
  Outlet: Math.min(row.Outlet / row.limitHigh, 16),  Outlet_raw: row.Outlet, Outlet_pass: sitePass(row, 'Outlet'),
  S5:     Math.min(row.S5 / row.limitHigh, 16),      S5_raw: row.S5,     S5_pass: sitePass(row, 'S5'),
}));

function getPass(entry: WQEntry, site: Site): boolean {
  if (site === 'R1') return entry.R1_pass;
  if (site === 'R2') return entry.R2_pass;
  if (site === 'Outlet') return entry.Outlet_pass;
  return entry.S5_pass;
}
function getRaw(entry: WQEntry, site: Site): number {
  if (site === 'R1') return entry.R1_raw;
  if (site === 'R2') return entry.R2_raw;
  if (site === 'Outlet') return entry.Outlet_raw;
  return entry.S5_raw;
}

// ── Custom tooltip for Chart 4 ────────────────────────────────────────────────

function WQTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; payload: WQEntry }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #F1D2A1',
      borderRadius: '10px',
      padding: '0.8rem 1rem',
      fontSize: '12px',
      fontFamily: 'Poppins, sans-serif',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      minWidth: '200px',
    }}>
      <p style={{ fontWeight: 700, color: '#2D4C39', marginBottom: '0.35rem' }}>{label}</p>
      <p style={{ color: '#888', fontSize: '11px', marginBottom: '0.5rem' }}>
        Limit: {row.limitDisplay}
      </p>
      {WQ_SITES.map(site => {
        const pass = getPass(row, site);
        const raw = getRaw(row, site);
        return (
          <div key={site} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.2rem 0', borderTop: '1px solid #f5f0e8',
          }}>
            <span style={{ fontWeight: 600, minWidth: 44, color: '#2D4C39' }}>{site}</span>
            <span style={{ flex: 1 }}>{raw}{row.unit ? ` ${row.unit}` : ''}</span>
            <span style={{ fontWeight: 600, color: pass ? '#0C6038' : '#C0392B' }}>
              {pass ? '✓ PASS' : '✗ FAIL'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: '#fff',
  borderRadius: '14px',
  padding: '1.75rem',
  boxShadow: '0 2px 16px rgba(12,96,56,0.08)',
};

const HEADING: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '0.95rem',
  color: 'var(--outerspace)',
  marginBottom: '1.25rem',
  fontFamily: 'Poppins, sans-serif',
};

const TICK = { fontSize: 11, fill: '#2D4C39', fontFamily: 'Poppins' };

const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: '8px',
    border: '1px solid #F1D2A1',
    fontSize: '13px',
    fontFamily: 'Poppins, sans-serif',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  cursor: { fill: 'rgba(241,210,161,0.15)' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BiodiversityCharts() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

      {/* ── Chart 1: 2023 vs 2025 ── */}
      <div style={CARD}>
        <h2 style={HEADING}>Species Count: 2023 vs 2025</h2>
        <ResponsiveContainer width="100%" height={290}>
          <BarChart data={BAR_2023_2025} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe0" vertical={false} />
            <XAxis dataKey="taxa" tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontFamily: 'Poppins', fontSize: '12px', paddingTop: '12px' }} />
            <Bar dataKey="2023" name="2023 Baseline" fill="#F1D2A1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="2025" name="2025 Current"  fill="#0C6038" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Chart 2: Taxa Distribution donut ── */}
      <div style={CARD}>
        <h2 style={HEADING}>Taxa Distribution 2025</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ResponsiveContainer width="55%" height={280}>
            <PieChart>
              <Pie
                data={TAXA_DONUT}
                dataKey="count"
                nameKey="taxa"
                cx="50%" cy="50%"
                outerRadius={108} innerRadius={54}
                paddingAngle={2} strokeWidth={0}
              >
                {TAXA_DONUT.map(e => <Cell key={e.taxa} fill={e.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #F1D2A1', fontSize: '13px', fontFamily: 'Poppins, sans-serif' }}
                formatter={(value) => [`${value} species`]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
            {TAXA_DONUT.map(e => (
              <div key={e.taxa} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: e.color, flexShrink: 0 }} />
                <span style={{ color: '#2D4C39', fontWeight: 500, flex: 1 }}>{e.taxa}</span>
                <span style={{ color: '#888', fontWeight: 600 }}>{e.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chart 3: Student Visits 2026 ── */}
      <div style={CARD}>
        <h2 style={HEADING}>Student Visits 2026</h2>
        <ResponsiveContainer width="100%" height={290}>
          <BarChart data={STUDENT_VISITS} margin={{ top: 4, right: 40, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe0" vertical={false} />
            <XAxis dataKey="quarter" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} domain={[0, 600]} />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v) => [`${v} students`, 'Visits']}
            />
            <ReferenceLine
              y={500}
              stroke="#C0392B"
              strokeDasharray="6 3"
              strokeWidth={2}
              label={{ value: 'Target: 500', position: 'right', fontSize: 11, fill: '#C0392B', fontFamily: 'Poppins' }}
            />
            <Bar dataKey="visits" name="Visits" fill="#0C6038" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Chart 4: Water Quality Compliance ── */}
      <div style={CARD}>
        <h2 style={HEADING}>Water Quality Compliance — Oct 2025</h2>
        <p style={{ fontSize: '11px', color: '#999', marginBottom: '0.75rem', fontFamily: 'Poppins', lineHeight: 1.5 }}>
          Y-axis = value ÷ limit · Dashed line = threshold (1.0) · Sites per group L→R: R1, R2, Outlet, S5
        </p>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={WQ_DATA} margin={{ top: 4, right: 40, left: -12, bottom: 28 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe0" vertical={false} />
            <XAxis
              dataKey="param"
              tick={{ ...TICK, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={TICK} axisLine={false} tickLine={false} domain={[0, 16]} />
            <Tooltip content={<WQTooltip />} />
            <ReferenceLine
              y={1}
              stroke="#C0392B"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{ value: 'Limit', position: 'right', fontSize: 10, fill: '#C0392B', fontFamily: 'Poppins' }}
            />
            {WQ_SITES.map(site => (
              <Bar key={site} dataKey={site} name={site} radius={[3, 3, 0, 0]}>
                {WQ_DATA.map((entry, i) => (
                  <Cell key={i} fill={getPass(entry, site) ? '#0C6038' : '#C0392B'} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.5rem', fontSize: '11px', fontFamily: 'Poppins', color: '#666' }}>
          <span><span style={{ color: '#0C6038', fontWeight: 700 }}>■</span> Compliant (≤ limit)</span>
          <span><span style={{ color: '#C0392B', fontWeight: 700 }}>■</span> Exceeds limit</span>
        </div>
      </div>

    </div>
  );
}
