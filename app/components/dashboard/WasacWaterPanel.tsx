'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import { parseWQParams, WQ_SITES, type WQParamData } from '@/app/lib/parseWaterQuality';
import { chartTooltipProps, useChartColors } from './chartTheme';
import ChartPlotArea from './ChartPlotArea';

export default function WasacWaterPanel() {
  const c = useChartColors();
  const tt = chartTooltipProps(c);
  const [paramsData, setParamsData] = useState<Record<string, WQParamData>>({});
  const [meta, setMeta] = useState<{ standard: string; samplingDate: string; rate?: number } | null>(null);
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/water_quality.json')
      .then(r => r.json())
      .then(data => {
        setParamsData(parseWQParams(data.wasac?.parameters ?? []));
        setMeta({
          standard: data.wasac?.standard ?? 'RS 109',
          samplingDate: data.wasac?.samplingDate ?? '',
          rate: data.wasac?.overall?.rate,
        });
        const names = Object.keys(parseWQParams(data.wasac?.parameters ?? []));
        if (names.length) setSelected(names[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const paramList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const names = Object.keys(paramsData).sort();
    return q ? names.filter(n => n.toLowerCase().includes(q)) : names;
  }, [paramsData, query]);

  const paramData = paramsData[selected];

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading WASAC data…</p>;
  }

  const chartData = paramData
    ? WQ_SITES.map(site => ({
        site,
        value: paramData[site],
        pass: paramData[site] <= paramData.limit,
      }))
    : [];

  const xMax = paramData ? Math.max(...chartData.map(d => d.value), paramData.limit) * 1.2 : 100;
  const plotHeight = 200;

  return (
    <div className="chart-card-body-content">
      <p className="chart-card-desc" style={{ marginTop: 0 }}>
        <strong>WASAC / RS 109</strong> — industrial wastewater and effluent from the community (e.g. Phoenix Apartment
        discharge). Sampling points R1, R2, Outlet, S5 · {meta?.samplingDate}.
        {meta?.rate != null && (
          <>
            {' '}
            Overall WASAC compliance: <strong>{meta.rate}%</strong>.
          </>
        )}
      </p>

      <div className="chart-controls-row">
        <input
          type="search"
          className="species-search"
          placeholder="Search WASAC parameter…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select
          className="species-search chart-select"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          {paramList.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {paramData && (
        <>
          <p className="chart-limit-hint">
            Limit: ≤ {paramData.limit} {paramData.unit}
          </p>
          <ChartPlotArea height={plotHeight}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 8, right: 40, left: 4, bottom: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
              <YAxis type="category" dataKey="site" width={56} tick={{ fill: c.tick, fontSize: 11, fontFamily: 'Poppins' }} />
              <XAxis type="number" domain={[0, xMax]} tick={{ fill: c.tick, fontSize: 10, fontFamily: 'Poppins' }} />
              <Tooltip {...tt} />
              <ReferenceLine x={paramData.limit} stroke="#D4251C" strokeDasharray="5 3" />
              <Bar dataKey="value" name={selected} radius={[0, 4, 4, 0]} barSize={32}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.pass ? '#1A7D2E' : '#D4251C'} />
                ))}
              </Bar>
            </BarChart>
          </ChartPlotArea>
        </>
      )}
    </div>
  );
}
