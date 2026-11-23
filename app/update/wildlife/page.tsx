'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { callUploadFunction } from '@/app/documents/UploadPanel';
import { getStaffPassword, lockStaff } from '@/app/lib/staffAuth';
import { fetchObservations, fetchSyncStatus, type SyncStatus } from '@/app/lib/wildlife';

const when = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 2 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' (Rwanda time)' : 'never');

export default function WildlifeStaffPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [counts, setCounts] = useState<{ source: string; n: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [loadingYear, setLoadingYear] = useState(false);
  const [yearMsg, setYearMsg] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    fetchSyncStatus().then(setStatus);
    fetchObservations().then(obs => {
      const m = new Map<string, number>();
      for (const o of obs) m.set(o.source, (m.get(o.source) ?? 0) + 1);
      setCounts([...m.entries()].map(([source, n]) => ({ source, n })));
    }).catch(() => setCounts([]));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function syncNow() {
    const password = getStaffPassword();
    if (!password) return lockStaff();
    setBusy(true); setMsg(''); setError('');
    try {
      const body = (await callUploadFunction({ action: 'sync-wildlife', password })) as { ok?: boolean; inaturalist?: number | null; ebird?: number | null; notes?: string[] };
      setMsg(body.ok ? `Updated. ${body.inaturalist ?? 0} iNaturalist records${body.ebird != null ? `, ${body.ebird} eBird records` : ''}.` : `Updated with a problem: ${(body.notes ?? []).join(' ')}`);
      refresh();
    } catch (e) {
      if (e instanceof Error && e.message === 'Wrong password.') return lockStaff();
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  /** Loads the last 12 months of eBird records for the hotspot, a few weeks at a time (eBird asks for short pauses). */
  async function loadYear() {
    const password = getStaffPassword();
    if (!password) return lockStaff();
    setLoadingYear(true); setError(''); setYearMsg('Starting…');
    const day = (offset: number) => new Date(Date.now() + 2 * 3600 * 1000 - offset * 86400000).toISOString().slice(0, 10);
    const to = day(0);
    let from: string | null = day(365), total = 0;
    try {
      while (from) {
        const r = (await callUploadFunction({ action: 'sync-wildlife', password, backfill: { from, to } })) as { backfill?: { records: number; next: string | null; limited: boolean } };
        if (!r.backfill) throw new Error('The update did not run.');
        total += r.backfill.records;
        from = r.backfill.next;
        setYearMsg(from ? `Loaded up to ${from}. ${total.toLocaleString('en-US')} records so far.${r.backfill.limited ? ' eBird asked for a pause, continuing in a minute.' : ''}`.trim() : '');
        if (r.backfill.limited) await new Promise(res => setTimeout(res, 75_000));
      }
      setYearMsg(`Done. ${total.toLocaleString('en-US')} eBird records loaded for the past year.`);
      refresh();
    } catch (e) {
      if (e instanceof Error && e.message === 'Wrong password.') return lockStaff();
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setYearMsg('');
    } finally {
      setLoadingYear(false);
    }
  }

  const label = (s: string) => (s === 'inaturalist' ? 'iNaturalist' : s === 'ebird' ? 'eBird' : s);

  return (
    <div className="report-page">
      <p className="doc-upload-help" style={{ marginBottom: 8 }}><Link href="/update" className="dash-report-link">Staff data tools</Link></p>
      <h1 className="heading" style={{ margin: '0 0 1.25rem' }}>Wildlife records</h1>

      <div className="glass-card doc-upload-panel" style={{ maxWidth: 720 }}>
        <table className="report-table report-table--small">
          <tbody>
            <tr><td>Last update</td><td>{status ? when(status.last_run) : '…'}</td></tr>
            <tr><td>Last successful update</td><td>{status ? when(status.last_ok) : '…'}</td></tr>
            {counts.map(c => <tr key={c.source}><td>Records from {label(c.source)}</td><td>{c.n.toLocaleString('en-US')}</td></tr>)}
            <tr><td>eBird</td><td>{status ? (status.ebird_enabled ? 'Connected' : 'Not connected yet') : '…'}</td></tr>
          </tbody>
        </table>
        {status?.message && <p className="doc-upload-error">{status.message}</p>}
        <div className="doc-library-card-actions">
          <button type="button" className="doc-action-btn doc-action-btn--primary" disabled={busy} onClick={syncNow}>{busy ? 'Updating…' : 'Update now'}</button>
          {status?.ebird_enabled && (
            <button type="button" className="doc-action-btn doc-action-btn--ghost" disabled={loadingYear || busy} onClick={loadYear}>{loadingYear ? 'Loading past year…' : 'Load past year from eBird'}</button>
          )}
          <Link href="/wildlife" className="doc-action-btn doc-action-btn--ghost">Open the public page</Link>
        </div>
        {yearMsg && <p className="doc-upload-help" role="status">{yearMsg}</p>}
        {msg && <p className="doc-upload-ok">{msg}</p>}
        {error && <p className="doc-upload-error" role="alert">{error}</p>}
      </div>

      {status && !status.ebird_enabled && (
        <div className="glass-card doc-upload-panel" style={{ maxWidth: 720, marginTop: 16 }}>
          <h2 className="doc-upload-title">Connect eBird</h2>
          <ol className="doc-upload-help" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Sign in at <a className="dash-report-link" href="https://ebird.org/api/keygen" target="_blank" rel="noreferrer">ebird.org/api/keygen</a> and request a key.</li>
            <li>In Supabase, open Edge Functions, then Secrets, and add a secret named <code>EBIRD_API_KEY</code> with the key as its value.</li>
            <li>Come back here and press Update now.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
