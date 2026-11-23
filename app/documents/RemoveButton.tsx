'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callUploadFunction } from './UploadPanel';
import { HIDE_FUNCTION_URL, SUPABASE_PUBLISHABLE_KEY } from '@/app/lib/documents';

async function hideBuiltIn(password: string, id: string) {
  const res = await fetch(HIDE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ action: 'hide', password, id }),
  });
  if (!res.ok) {
    let msg = 'Something went wrong. Please try again.';
    try { const d = await res.json(); if (typeof d.error === 'string') msg = d.error; } catch { /* not JSON */ }
    throw new Error(msg);
  }
}

export default function RemoveButton({ id, title, builtIn = false }: { id: string; title: string; builtIn?: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return setError('Enter the upload password.');
    setBusy(true); setError('');
    try {
      if (builtIn) await hideBuiltIn(password, id);
      else await callUploadFunction({ action: 'delete', password, id });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  if (!asking) {
    return (
      <button type="button" className="doc-action-btn doc-action-btn--ghost" onClick={() => setAsking(true)}>
        Remove
      </button>
    );
  }
  return (
    <form className="doc-remove-form" onSubmit={remove}>
      <p className="doc-upload-help">Remove “{title}”{builtIn ? ' from this page' : ''}? Enter the staff password.</p>
      <input className="species-search doc-upload-field" type="password" autoComplete="off" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} />
      {error && <p className="doc-upload-error" role="alert">{error}</p>}
      <div className="doc-library-card-actions">
        <button type="submit" className="doc-action-btn doc-action-btn--primary" disabled={busy}>{busy ? 'Removing…' : 'Remove'}</button>
        <button type="button" className="doc-action-btn doc-action-btn--ghost" disabled={busy} onClick={() => { setAsking(false); setError(''); setPassword(''); }}>Cancel</button>
      </div>
    </form>
  );
}
