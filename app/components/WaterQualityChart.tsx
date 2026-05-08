'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';

type WQSite = 'R1' | 'R2' | 'Outlet' | 'S5';
const WQ_SITES: WQSite[] = ['R1', 'R2', 'Outlet', 'S5'];

type WQParamData = { unit: string; limit: number; R1: number; R2: number; Outlet: number; S5: number };

const WQ_PARAMS_DATA: Record<string, WQParamData> = {
  'Iron':                    { unit: 'mg/L',      limit: 3.5,  R1: 6.06,   R2: 5.87,   Outlet: 0.42,   S5: 1.03   },
  'Manganese':               { unit: 'mg/L',      limit: 0.1,  R1: 0.784,  R2: 0.905,  Outlet: 0.199,  S5: 0.387  },
  'Oil & Grease':            { unit: 'mg/L',      limit: 10,   R1: 105,    R2: 12,     Outlet: 8,      S5: 91     },
  'Total Suspended Solids':  { unit: 'mg/L',      limit: 50,   R1: 750,    R2: 39,     Outlet: 1,      S5: 419    },
  'Phosphates':              { unit: 'mg/L',      limit: 2.2,  R1: 3.47,   R2: 0.81,   Outlet: 0.15,   S5: 1.40   },
  'Nitrites':                { unit: 'mg/L',      limit: 0.9,  R1: 0.000,  R2: 0.102,  Outlet: 0.005,  S5: 0.025  },
  'Ammonia Nitrogen':        { unit: 'mg/L',      limit: 20,   R1: 12.3,   R2: 4.1,    Outlet: 0.02,   S5: 350    },
  'Electrical Conductivity': { unit: 'µS/cm',     limit: 1500, R1: 983,    R2: 910,    Outlet: 653,    S5: 3930   },
  'Total Coliforms':         { unit: 'CFU/100mL', limit: 400,  R1: 25000,  R2: 173200, Outlet: 155300, S5: 41100  },
  'E.Coli':                  { unit: 'CFU/100mL', limit: 100,  R1: 19200,  R2: 3500,   Outlet: 32600,  S5: 3000   },
};

const WQ_PARAMS_LIST = Object.keys(WQ_PARAMS_DATA);

function WQTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const { site, value, pass, limit, unit, paramName } = payload[0].payload;
  return (
    <div style={{
      background: '#1A2E1F', color: '#fff', borderRadius: '8px',
      padding: '8px 12px', fontFamily: 'Poppins, sans-serif', fontSize: '13px', lineHeight: 1.6,
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

const TICK_STYLE = { fontSize: 12, fill: '#4A5E4F', fontFamily: 'Poppins' };

export default function WaterQualityChart() {
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
    <div style={CARD}>
      <h2 style={HEADING}>Water Quality Compliance — Oct 2025</h2>

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

      <p style={{ fontSize: '12px', color: '#4A5E4F', fontFamily: 'Poppins', marginBottom: '8px' }}>
        Compliance limit:&nbsp;
        <strong style={{ color: '#D4251C' }}>≤ {paramData.limit} {paramData.unit}</strong>
        &nbsp;· Bars: <span style={{ color: '#1A7D2E', fontWeight: 600 }}>green = PASS</span>,{' '}
        <span style={{ color: '#D4251C', fontWeight: 600 }}>red = FAIL</span>
      </p>

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
  );
}
