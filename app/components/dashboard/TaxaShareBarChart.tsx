'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { chartTooltipProps, useChartColors } from './chartTheme';
import ChartPlotArea, { barChartHeight } from './ChartPlotArea';

type Row = { taxa: string; count: number; color: string };

export default function TaxaShareBarChart({ data, total }: { data: Row[]; total: number }) {
  const c = useChartColors();
  const tt = chartTooltipProps(c);
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const plotHeight = barChartHeight(sorted.length, { row: 32, min: 220, max: 300 });

  return (
    <div className="chart-card-body-content">
      <p className="chart-card-desc" style={{ marginTop: 0 }}>
        {total.toLocaleString()} species in 2025 — share by taxonomic group (horizontal bars, easiest to compare).
      </p>
      <ChartPlotArea height={plotHeight}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 4, bottom: 28 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
          <XAxis type="number" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 10 }} />
          <YAxis
            type="category"
            dataKey="taxa"
            width={118}
            tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            {...tt}
            formatter={(value: number, _name: string, item) => {
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return [`${value} species (${pct}%)`, item.payload.taxa];
            }}
          />
          <Bar dataKey="count" name="Species" radius={[0, 6, 6, 0]} barSize={18}>
            {sorted.map(row => (
              <Cell key={row.taxa} fill={row.color} />
            ))}
          </Bar>
        </BarChart>
      </ChartPlotArea>
    </div>
  );
}
