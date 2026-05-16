'use client';

import { ResponsiveContainer } from 'recharts';

/** Fixed-height plot region so Recharts stays inside the glass card. */
export default function ChartPlotArea({
  height,
  children,
}: {
  height: number;
  children: React.ReactElement;
}) {
  return (
    <div className="chart-plot-area" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/** Height for horizontal bar charts from row count. */
export function barChartHeight(rowCount: number, opts?: { row?: number; min?: number; max?: number }) {
  const row = opts?.row ?? 30;
  const min = opts?.min ?? 160;
  const max = opts?.max ?? 420;
  return Math.min(max, Math.max(min, rowCount * row + 48));
}
