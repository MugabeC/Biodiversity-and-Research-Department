'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { callUploadFunction } from '@/app/documents/UploadPanel';
import { useDashboardData } from '@/app/lib/useDashboardData';
import { normalizeWasteData } from '@/app/components/dashboard/WasteDashboardCharts';
import {
  convert, crossCheck, preview, readWorkbook, WorkbookError,
  type Converted, type Difference,
} from '@/app/lib/workbookImport';

type Checked = {
  fileName: string;
  conv: Converted;
  checked: number;
  differences: Difference[];
  warnings: Difference[];
  facts: ReturnType<typeof preview>;
};

const n = (v: number) => Math.round(v).toLocaleString('en-US');

export default function UpdateDataPage() {
  const input = useRef<HTMLInputElement>(null);
  const { data: live } = useDashboardData();
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<Checked | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const liveFacts = live ? {
    students: live.schools.monthlyTotals.reduce((t, m) => t + (m.totalStudents ?? 0), 0),
    activities: live.community.length,
    research: live.research.length,
    conflicts: live.conflicts.length,
    wasteKg: normalizeWasteData(live.waste).reduce((t, w) => t + (w.kg ?? 0), 0),
  } : null;

  async function onFile(file: File | null) {
    setResult(null); setError(''); setDone('');
    if (!file) return;
    setBusy(true);
    try {
      const sheets = await readWorkbook(await file.arrayBuffer());
      const conv = convert(sheets);
      const cc = crossCheck(sheets, conv);
      setResult({ fileName: file.name, conv, checked: cc.checked, differences: cc.differences, warnings: cc.warnings, facts: preview(conv) });
    } catch (e) {
      setError(e instanceof WorkbookError ? e.message : 'This file could not be read. Please use the data-entry workbook (.xlsx).');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!result) return;
    if (!password) return setError('Enter the upload password.');
    setBusy(true); setError(''); setDone('');
    try {
      await callUploadFunction({ action: 'publish-data', password, bundle: { files: result.conv.files } });
      setDone(`Published. The dashboard now shows data to ${result.facts.latestMonth}. Pages already open update when they are refreshed.`);
      setResult(null);
      if (input.current) input.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const blocked = !!result && result.differences.length > 0;
  const f = result?.facts;

  return (
    <div className="report-page">
      <h1 className="heading" style={{ margin: '0 0 6px' }}>Update the dashboard data</h1>
      <p className="doc-upload-help" style={{ marginBottom: '1.5rem' }}>
        Choose the filled data-entry workbook. It is read here in your browser and checked against its own Monthly_Summary sheet.
        Nothing is published until you press Publish. Applicant names are never copied, only counts.
      </p>

      <div className="glass-card doc-upload-panel" style={{ maxWidth: 720 }}>
        <label className="doc-upload-label">
          1. Workbook (.xlsx)
          <input ref={input} type="file" accept=".xlsx" className="doc-upload-input" disabled={busy} onChange={e => onFile(e.target.files?.[0] ?? null)} />
        </label>

        {busy && !result && <p className="doc-upload-help">Reading the workbook…</p>}

        {result && f && (
          <>
            <div>
              <p className="doc-upload-help" style={{ marginBottom: 8 }}>2. Check what the workbook contains ({result.fileName})</p>
              <table className="report-table">
                <thead><tr><th>Figure</th><th>In this workbook</th><th>On the dashboard now</th></tr></thead>
                <tbody>
                  <tr><td>Data runs to</td><td>{f.latestMonth}</td><td>n/a</td></tr>
                  <tr><td>Students reached</td><td>{n(f.students)}</td><td>{liveFacts ? n(liveFacts.students) : '…'}</td></tr>
                  <tr><td>Community activities</td><td>{n(f.activities)}</td><td>{liveFacts ? n(liveFacts.activities) : '…'}</td></tr>
                  <tr><td>Research requests</td><td>{n(f.research)}</td><td>{liveFacts ? n(liveFacts.research) : '…'}</td></tr>
                  <tr><td>Conflict cases</td><td>{n(f.conflicts)} ({n(f.openConflicts)} open)</td><td>{liveFacts ? n(liveFacts.conflicts) : '…'}</td></tr>
                  <tr><td>Waste collected (kg)</td><td>{n(f.wasteKg)}</td><td>{liveFacts ? n(liveFacts.wasteKg) : '…'}</td></tr>
                  <tr><td>Species recorded</td><td>{n(f.species)}</td><td>{live ? n(live.summary.totalSpecies) : '…'}</td></tr>
                </tbody>
              </table>
            </div>

            <p className={result.differences.length ? 'doc-upload-error' : 'doc-upload-ok'}>
              {result.checked} figures were compared with the workbook&apos;s Monthly_Summary: {result.differences.length === 0 ? 'no differences.' : `${result.differences.length} differ. Fix the workbook and choose it again.`}
            </p>
            {result.differences.map((d, i) => (
              <p key={i} className="doc-upload-error">{d.month}: {d.figure}. Monthly_Summary says {d.workbook}, the raw rows add up to {d.website}.</p>
            ))}
            {result.warnings.map((d, i) => (
              <p key={i} className="doc-upload-help">
                {d.month}: complimentary admissions are {d.website} on the dashboard and {d.workbook} in Monthly_Summary. The dashboard also counts complimentary participants from school visits and community activities (confirmed rule).
              </p>
            ))}
            {result.conv.notes.map((t, i) => <p key={i} className="doc-upload-help">Note: {t}</p>)}

            <label className="doc-upload-label">
              3. Upload password
              <input className="species-search doc-upload-field" type="password" autoComplete="off" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} />
            </label>
            <div className="doc-library-card-actions">
              <button type="button" className="doc-action-btn doc-action-btn--primary" disabled={busy || blocked} onClick={publish}>
                {busy ? 'Publishing…' : 'Publish to the dashboard'}
              </button>
            </div>
          </>
        )}

        {error && <p className="doc-upload-error" role="alert">{error}</p>}
        {done && <p className="doc-upload-ok">{done} <Link href="/" className="dash-report-link">Open the dashboard →</Link></p>}
      </div>

      <p className="doc-upload-help" style={{ marginTop: '1.25rem', maxWidth: 720 }}>
        Water quality, the species list and the map are not part of this workbook and stay as they are. Every published version is kept, so a mistake can be rolled back.
      </p>
    </div>
  );
}
