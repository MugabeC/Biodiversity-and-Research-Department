'use client';

import { useEffect, useState } from 'react';

/** Recharts needs literal colors; sync from CSS variables on client. */
export function useChartColors() {
  const [colors, setColors] = useState({
    tick: '#4A5E4F',
    grid: 'rgba(224,232,226,0.6)',
    primary: '#0C6038',
    secondary: '#F1D2A1',
    accent: '#F5A623',
    pass: '#1A7D2E',
    fail: '#D4251C',
    tooltipBg: '#1A2E1F',
    tooltipText: '#ffffff',
    tooltipItem: '#E8F5E9',
    tooltipBorder: 'transparent',
  });

  useEffect(() => {
    const root = document.documentElement;
    const g = (name: string, fallback: string) =>
      getComputedStyle(root).getPropertyValue(name).trim() || fallback;
    setColors({
      tick: g('--chart-tick', '#4A5E4F'),
      grid: g('--border', '#E0E8E2'),
      primary: g('--meadow-green', '#0C6038'),
      secondary: g('--peach', '#F1D2A1'),
      accent: g('--golden', '#F5A623'),
      pass: '#1A7D2E',
      fail: '#D4251C',
      tooltipBg: g('--chart-tooltip-bg', '#1A2E1F'),
      tooltipText: g('--chart-tooltip-text', '#ffffff'),
      tooltipItem: g('--chart-tooltip-item', '#E8F5E9'),
      tooltipBorder: g('--chart-tooltip-border', 'transparent'),
    });
  }, []);

  return colors;
}

/** Readable tooltips — light text, not series green on dark background. */
export function chartTooltipProps(c: ReturnType<typeof useChartColors>) {
  return {
    contentStyle: {
      background: c.tooltipBg,
      border: `1px solid ${c.tooltipBorder}`,
      borderRadius: '10px',
      padding: '10px 14px',
      fontFamily: 'Poppins, sans-serif',
      fontSize: '13px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    },
    labelStyle: {
      color: c.tooltipText,
      fontWeight: 700,
      marginBottom: 6,
      fontFamily: 'Poppins, sans-serif',
    },
    itemStyle: {
      color: c.tooltipItem,
      fontFamily: 'Poppins, sans-serif',
      fontWeight: 400,
    },
    cursor: { fill: 'rgba(255, 255, 255, 0.08)' },
  };
}

/** @deprecated Use chartTooltipProps */
export function darkTooltip(c: ReturnType<typeof useChartColors>) {
  return chartTooltipProps(c);
}
