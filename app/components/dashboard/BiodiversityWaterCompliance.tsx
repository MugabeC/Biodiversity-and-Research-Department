'use client';

import type { BioComplianceSummary } from '@/app/lib/parseBiodiversityWater';
import { CountUp, Ring } from './minimal';

export default function BiodiversityWaterCompliance({ summary }: { summary: BioComplianceSummary }) {
  const { pass, fail, total, rate, standard, samplingDate } = summary;
  const tone = rate >= 90 ? 'ok' : rate >= 70 ? 'warn' : 'bad';

  return (
    <div className="wq-compliance-tile">
      <div className="wq-summary">
        <Ring percent={rate} size={92} tone={tone} />
        <div>
          <p className="wq-rate"><CountUp value={rate} decimals={1} suffix="%" /></p>
          <p className="wq-rate-sub">{pass} of {total} tests within limits · {fail} outside</p>
          <p className="wq-rate-sub">Park ponds and wetland, {samplingDate} · {standard}</p>
        </div>
      </div>
      <details className="wq-how">
        <summary>How is this calculated?</summary>
        <p>
          Each sampling point is scored PASS or FAIL against Rwanda freshwater and wetland limits (maximum, minimum or range).
          Non-detect and below-detection values count as pass. Rate = PASS ÷ (PASS + FAIL) × 100 = {pass} ÷ {total} × 100.
          WASAC industrial and effluent monitoring is reported separately.
        </p>
      </details>
    </div>
  );
}
