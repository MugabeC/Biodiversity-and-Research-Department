'use client';

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import {
  chartDataForParam,
  type BioComplianceSummary,
} from '@/app/lib/parseBiodiversityWater';
import { chartTooltipProps, useChartColors } from './chartTheme';
import ChartPlotArea, { barChartHeight } from './ChartPlotArea';

function limitLabel(limit: BioComplianceSummary['parameters'][0]['limit'], unit: string): string {
  if (!limit) return '—';
  if (limit.kind === 'max') return `≤ ${limit.max} ${unit}`.trim();
  if (limit.kind === 'min') return `> ${limit.min} ${unit}`.trim();
  return `${limit.min}–${limit.max} ${unit}`.trim();
}

export default function BiodiversityWaterExplorer({ summary }: { summary: BioComplianceSummary }) {
  const c = useChartColors();
  const tt = chartTooltipProps(c);
  const scorable = useMemo(
    () => summary.parameters.filter(p => p.limit !== null),
    [summary.parameters],
  );
  const [selected, setSelected] = useState(scorable[0]?.parameter ?? '');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scorable;
    return scorable.filter(p => p.parameter.toLowerCase().includes(q));
  }, [scorable, query]);

  const param = scorable.find(p => p.parameter === selected) ?? scorable[0];
  const chartData = param ? chartDataForParam(param) : [];
  const plotHeight = barChartHeight(chartData.length, { row: 28, min: 160, max: 400 });

  const xMax = param?.limit
    ? Math.max(
        ...chartData.map(d => d.value),
        param.limit.kind === 'max' ? param.limit.max : param.limit.kind === 'min' ? param.limit.min * 2 : param.limit.max,
      ) * 1.15
    : 100;

  const refX = param?.limit
    ? param.limit.kind === 'max'
      ? param.limit.max
      : param.limit.kind === 'min'
        ? param.limit.min
        : param.limit.max
    : null;

  return (
    <div className="chart-card-body-content">
      <p className="chart-card-desc" style={{ marginTop: 0 }}>
        Search a parameter, then view measured values at each park sampling point (biodiversity survey only).
      </p>
      <div className="chart-controls-row chart-controls-row--emphasis">
        <input
          type="search"
          className="species-search"
          placeholder="Search parameter (e.g. pH, Turbidity)…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select
          className="species-search chart-select"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          {filtered.map(p => (
            <option key={p.parameter} value={p.parameter}>
              {p.parameter}
            </option>
          ))}
        </select>
      </div>

      {param && (
        <>
          <p className="chart-limit-hint">
            Limit: <strong className="chart-limit-fail">{limitLabel(param.limit, param.unit)}</strong>
            {param.method ? ` · ${param.method}` : ''}
            {' · '}
            <span className="chart-limit-pass">green = PASS</span>,{' '}
            <span className="chart-limit-fail">red = FAIL</span>
          </p>
          <ChartPlotArea height={plotHeight}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 8, right: 44, left: 4, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
              <YAxis type="category" dataKey="site" width={92} tick={{ fill: c.tick, fontSize: 9, fontFamily: 'Poppins' }} />
              <XAxis type="number" domain={[0, xMax]} tick={{ fill: c.tick, fontSize: 10, fontFamily: 'Poppins' }} />
              <Tooltip {...tt} />
              {refX != null && param.limit?.kind === 'max' && (
                <ReferenceLine
                  x={refX}
                  stroke="#D4251C"
                  strokeDasharray="5 3"
                  label={{ value: `${refX}`, position: 'top', fontSize: 10, fill: '#D4251C' }}
                />
              )}
              <Bar dataKey="value" name={param.parameter} radius={[0, 4, 4, 0]} barSize={20}>
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
