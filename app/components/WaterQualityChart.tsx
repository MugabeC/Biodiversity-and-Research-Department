'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import {
  parseWQParams,
  WQ_SITES,
  type WQParamData,
  type WQSite,
} from '../lib/parseWaterQuality';

type WQTooltipDatum = {
  site: WQSite;
  value: number;
  pass: boolean;
  limit: number;
  unit: string;
  paramName: string;
};

function WQTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload: WQTooltipDatum }> }) {
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

const HEADING: React.CSSProperties = {
  fontSize: '16px',
  margin: '0 0 20px',
};

const TICK_STYLE = { fontSize: 12, fill: '#4A5E4F', fontFamily: 'Poppins' };

export default function WaterQualityChart() {
  const [paramsData, setParamsData] = useState<Record<string, WQParamData>>({});
  const [selectedParam, setSelectedParam] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/water_quality.json')
      .then(r => r.json())
      .then(data => {
        const parsed = parseWQParams(data.wasac.parameters);
        setParamsData(parsed);
        const names = Object.keys(parsed);
        if (names.length > 0) setSelectedParam(names[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const paramList = Object.keys(paramsData);
  const paramData = paramsData[selectedParam];

  if (loading) {
    return (
      <div className="glass-card">
        <h2 style={HEADING}>Water Quality Compliance — Oct 2025</h2>
        <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '14px', color: '#4A5E4F' }}>Loading…</p>
      </div>
    );
  }

  if (!paramData || paramList.length === 0) {
    return (
      <div className="glass-card">
        <h2 style={HEADING}>Water Quality Compliance — Oct 2025</h2>
        <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '14px', color: '#4A5E4F' }}>No chart data available.</p>
      </div>
    );
  }

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
    <div className="glass-card">
      <h2 className="heading" style={HEADING}>Water Quality Compliance — Oct 2025</h2>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {paramList.map(param => {
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
