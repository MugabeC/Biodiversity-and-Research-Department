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
