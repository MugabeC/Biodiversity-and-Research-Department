'use client';

import type { BioComplianceSummary } from '@/app/lib/parseBiodiversityWater';

export default function BiodiversityWaterCompliance({ summary }: { summary: BioComplianceSummary }) {
  const { pass, fail, total, rate, standard, samplingDate } = summary;

  return (
    <div className="wq-compliance-tile">
      <p className="chart-card-desc" style={{ marginTop: 0 }}>
        Park pond & wetland survey ({samplingDate}) — {standard}. Excludes WASAC industrial / effluent monitoring.
      </p>

      <div className="wq-formula-box">
        <p className="heading" style={{ fontSize: 14, margin: '0 0 8px', color: 'var(--accent-text)' }}>
          Compliance formula
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
          For each parameter with a defined limit, each sampling point is scored{' '}
          <strong style={{ color: 'var(--text-primary)' }}>PASS</strong> or{' '}
          <strong style={{ color: '#D4251C' }}>FAIL</strong> against Rwanda freshwater/wetland limits
          (max, min, or range). Non-detect (&quot;ND&quot;) and below-detection (&quot;&lt;limit&quot;) count as pass.
        </p>
        <p
          style={{
            fontSize: 14,
            fontFamily: 'Poppins, monospace',
            margin: '12px 0 0',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(12, 96, 56, 0.08)',
            color: 'var(--text-primary)',
          }}
        >
          Rate = PASS tests ÷ (PASS + FAIL) × 100 = {pass} ÷ {total} × 100
        </p>
      </div>

      <div className="wq-rate-display">
        <p className="heading wq-rate-value" style={{ color: rate >= 70 ? 'var(--accent-text)' : '#D4251C' }}>
          {rate}%
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          Overall compliance ({pass} pass · {fail} fail · {total} scored tests)
        </p>
      </div>
    </div>
  );
}
