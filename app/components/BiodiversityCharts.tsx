'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const BAR_DATA = [
  { taxa: 'Birds', '2023': 83, '2025': 251 },
  { taxa: 'Plants', '2023': 260, '2025': 468 },
  { taxa: 'Butterflies', '2023': 56, '2025': 57 },
  { taxa: 'Aq. Inverts', '2023': 29, '2025': 52 },
  { taxa: 'Amph. & Rept.', '2023': 12, '2025': 22 },
  { taxa: 'Mammals', '2023': 9, '2025': 13 },
  { taxa: 'Fish', '2023': 7, '2025': 7 },
];

const IUCN_COLORS: Record<string, string> = {
  LC: '#0C6038',
  NT: '#F5A623',
  VU: '#E8960C',
  EN: '#D64F1A',
  CR: '#C0392B',
  EW: '#8B0000',
  EX: '#4a0000',
  DD: '#95a5a6',
  NE: '#bdc3c7',
};

const IUCN_LABELS: Record<string, string> = {
  LC: 'Least Concern',
  NT: 'Near Threatened',
  VU: 'Vulnerable',
  EN: 'Endangered',
  CR: 'Critically Endangered',
  EW: 'Extinct in Wild',
  EX: 'Extinct',
  DD: 'Data Deficient',
  NE: 'Not Evaluated',
};

type IUCNEntry = { status: string; count: number };

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '14px',
  padding: '1.75rem',
  boxShadow: '0 2px 16px rgba(12,96,56,0.08)',
};

const headingStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '1rem',
  color: 'var(--outerspace)',
  marginBottom: '1.25rem',
  fontFamily: 'Poppins, sans-serif',
};

export default function BiodiversityCharts({ iucnData }: { iucnData: IUCNEntry[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
        gap: '1.5rem',
      }}
    >
      {/* 2023 vs 2025 grouped bar chart */}
      <div style={cardStyle}>
        <h2 style={headingStyle}>Species Count: 2023 vs 2025</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={BAR_DATA} margin={{ top: 4, right: 16, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe0" vertical={false} />
            <XAxis
              dataKey="taxa"
              tick={{ fontSize: 11, fill: '#2D4C39', fontFamily: 'Poppins, sans-serif' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#2D4C39', fontFamily: 'Poppins, sans-serif' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #F1D2A1',
                fontSize: '13px',
                fontFamily: 'Poppins, sans-serif',
              }}
              cursor={{ fill: 'rgba(241,210,161,0.15)' }}
            />
            <Legend
              wrapperStyle={{ fontFamily: 'Poppins, sans-serif', fontSize: '13px', paddingTop: '12px' }}
            />
            <Bar dataKey="2023" name="2023 Baseline" fill="#F1D2A1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="2025" name="2025 Current" fill="#0C6038" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* IUCN status donut chart */}
      <div style={cardStyle}>
        <h2 style={headingStyle}>IUCN Conservation Status</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <ResponsiveContainer width="55%" height={280}>
            <PieChart>
              <Pie
                data={iucnData}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={58}
                paddingAngle={2}
                strokeWidth={0}
              >
                {iucnData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={IUCN_COLORS[entry.status] ?? '#95a5a6'}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #F1D2A1',
                  fontSize: '13px',
                  fontFamily: 'Poppins, sans-serif',
                }}
                formatter={(value, name) => [
                  `${value} spp`,
                  IUCN_LABELS[String(name)] ?? String(name),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
            {iucnData.map((entry) => (
              <div
                key={entry.status}
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: IUCN_COLORS[entry.status] ?? '#95a5a6',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600, color: 'var(--outerspace)', minWidth: 28 }}>
                  {entry.status}
                </span>
                <span style={{ color: '#555', fontFamily: 'Poppins, sans-serif' }}>
                  {entry.count.toLocaleString()} spp
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
