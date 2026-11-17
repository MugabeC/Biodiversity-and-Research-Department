'use client';

import { useEffect, useRef, useState } from 'react';

/** True when the visitor has asked their system for less motion. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Number that counts up once, the first time it scrolls into view. */
export function CountUp({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (prefersReducedMotion()) { setShown(value); return; }
    setShown(0);
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 900);
        setShown(value * (1 - Math.pow(1 - t, 3)));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); run(); }
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(frame); };
  }, [value]);

  const text = shown.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span ref={ref}>{text}{suffix}</span>;
}

/** Tiny trend line that draws itself in. */
export function Sparkline({ values, width = 140, height = 36 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <div style={{ height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (width - pad * 2),
    height - pad - ((v - min) / span) * (height - pad * 2),
  ]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg className="viz-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} pathLength={1} className="viz-spark-line" />
      <circle cx={last[0]} cy={last[1]} r={3} className="viz-spark-dot" />
    </svg>
  );
}

/** Thin progress ring, 0–100. */
export function Ring({ percent, size = 64, tone = 'ok' }: { percent: number; size?: number; tone?: 'ok' | 'warn' | 'bad' }) {
  const r = (size - 8) / 2;
  const c = size / 2;
  return (
    <svg className={`viz-ring viz-ring--${tone}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={c} cy={c} r={r} className="viz-ring-track" />
      <circle
        cx={c} cy={c} r={r} pathLength={100} className="viz-ring-arc"
        style={{ strokeDasharray: `${Math.max(0, Math.min(100, percent))} 100` }}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </svg>
  );
}

export type Segment = { label: string; value: number; color: string };

/** One slim horizontal strip split into proportional segments. */
export function SegmentBar({ segments, labels = true }: { segments: Segment[]; labels?: boolean }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="viz-seg">
      <div className="viz-seg-bar" role="img" aria-label={segments.map(s => `${s.label} ${s.value}`).join(', ')}>
        {segments.filter(s => s.value > 0).map((s, i) => (
          <span
            key={s.label}
            style={{ flexGrow: s.value / total, background: s.color, animationDelay: `${i * 90}ms` }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      {labels && (
        <ul className="viz-seg-legend">
          {segments.filter(s => s.value > 0).map(s => (
            <li key={s.label}><i style={{ background: s.color }} />{s.label} <b>{s.value}</b></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────── Slick chart parts ───────────── */

/** Gradient fills used by the charts: reference as fill="url(#gGreen)". */
export const GRADIENT_DEFS = (
    <defs>
      <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3FB07A" />
        <stop offset="100%" stopColor="#0C6038" />
      </linearGradient>
      <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F9C966" />
        <stop offset="100%" stopColor="#E39A1F" />
      </linearGradient>
      <linearGradient id="gSand" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F6E5C4" />
        <stop offset="100%" stopColor="#EBCF9C" />
      </linearGradient>
      <linearGradient id="gAreaGreen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2E9E5B" stopOpacity={0.32} />
        <stop offset="100%" stopColor="#2E9E5B" stopOpacity={0} />
      </linearGradient>
    </defs>
);

type TipPayload = { name?: string; value?: number | string; color?: string; fill?: string; stroke?: string };

/** Small white tooltip that matches the minimal look. */
export function SlickTooltip({ active, payload, label, unit }: {
  active?: boolean; payload?: TipPayload[]; label?: string | number; unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="slick-tip">
      {label !== undefined && <p>{label}</p>}
      {payload.map((p, i) => (
        <div key={i}>
          <i style={{ background: p.stroke || p.fill || p.color }} />
          <span>{p.name}</span>
          <b>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{unit ?? ''}</b>
        </div>
      ))}
    </div>
  );
}

/** A row of large light figures with small labels, shown at the top of each topic. */
export function StatRow({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="stat-row">
      {items.map(it => (
        <div key={it.label}>
          <b>{it.value}</b>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Before/after rows: faint bar for the earlier value, solid bar for the latest. */
export function GrowthRows({ rows }: { rows: { label: string; from: number; to: number }[] }) {
  const max = Math.max(1, ...rows.flatMap(r => [r.from, r.to]));
  return (
    <div className="viz-growth">
      {rows.map((r, i) => {
        const change = r.from > 0 ? Math.round(((r.to - r.from) / r.from) * 100) : 0;
        return (
          <div className="viz-growth-row" key={r.label}>
            <span className="viz-growth-label">{r.label}</span>
            <span className="viz-growth-track">
              <i className="from" style={{ width: `${(r.from / max) * 100}%` }} />
              <i className="to" style={{ width: `${(r.to / max) * 100}%`, animationDelay: `${i * 70}ms` }} />
            </span>
            <span className="viz-growth-num">{r.from} → <b>{r.to}</b></span>
            <em className={change > 0 ? 'up' : ''}>{change > 0 ? `+${change}%` : 'no change'}</em>
          </div>
        );
      })}
      <p className="viz-growth-key"><i className="from" /> 2023 baseline <i className="to" /> 2025 survey</p>
    </div>
  );
}

/** 100-dot grid: each dot is 1% of the total. */
export function Waffle({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  // largest-remainder allocation so the dots add up to exactly 100
  const raw = segments.map(s => (s.value / total) * 100);
  const dots = raw.map(Math.floor);
  let left = 100 - dots.reduce((a, b) => a + b, 0);
  raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem).forEach(({ i }) => { if (left > 0) { dots[i] += 1; left -= 1; } });
  const cells: { color: string; label: string }[] = [];
  segments.forEach((s, i) => { for (let k = 0; k < dots[i]; k++) cells.push({ color: s.color, label: s.label }); });
  return (
    <div className="viz-waffle-wrap">
      <div className="viz-waffle" role="img" aria-label="Share of species by group, one dot per percent">
        {cells.map((cell, i) => (
          <span key={i} style={{ background: cell.color, animationDelay: `${i * 9}ms` }} title={cell.label} />
        ))}
      </div>
      <ul className="viz-waffle-legend">
        {segments.map(s => (
          <li key={s.label}><i style={{ background: s.color }} />{s.label}<b>{s.value}</b><em>{Math.round((s.value / total) * 100)}%</em></li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked list: label, thin proportional bar, value. */
export function RankRows({ items, color = '#0C6038' }: { items: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div className="viz-rank">
      {items.map((it, i) => (
        <div className="viz-rank-row" key={it.label}>
          <span className="viz-rank-label" title={it.label}>{it.label}</span>
          <span className="viz-rank-track"><i style={{ width: `${(it.value / max) * 100}%`, background: color, animationDelay: `${i * 60}ms` }} /></span>
          <b>{it.value.toLocaleString()}</b>
        </div>
      ))}
    </div>
  );
}
