'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/app/lib/documents';
import { getStaffPassword, lockStaff } from '@/app/lib/staffAuth';
import { fetchObservations, fetchSyncStatus, type SyncStatus } from '@/app/lib/wildlife';

const when = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 2 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' (Rwanda time)' : 'never');

export default function WildlifeStaffPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [counts, setCounts] = useState<{ source: string; n: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/species-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ password }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; inaturalist?: number | null; ebird?: number | null; notes?: string[] };
      if (res.status === 401) return lockStaff();
      if (!res.ok) throw new Error(body.error ?? 'The update did not run.');
      setMsg(body.ok ? `Updated. ${body.inaturalist ?? 0} iNaturalist records${body.ebird != null ? `, ${body.ebird} eBird records` : ''}.` : `Updated with a problem: ${(body.notes ?? []).join(' ')}`);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const label = (s: string) => (s === 'inaturalist' ? 'iNaturalist' : s === 'ebird' ? 'eBird' : s);

  return (
    <div className="report-page">
      <p className="doc-upload-help" style={{ marginBottom: 8 }}><Link href="/update" className="dash-report-link">← Staff data tools</Link></p>
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
          <Link href="/wildlife" className="doc-action-btn doc-action-btn--ghost">Open the public page</Link>
        </div>
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
