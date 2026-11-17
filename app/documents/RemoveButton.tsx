'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callUploadFunction } from './UploadPanel';

export default function RemoveButton({ id, title }: { id: string; title: string }) {
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
      await callUploadFunction({ action: 'delete', password, id });
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
      <p className="doc-upload-help">Remove “{title}”? Enter the upload password.</p>
      <input className="species-search doc-upload-field" type="password" autoComplete="off" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} />
      {error && <p className="doc-upload-error" role="alert">{error}</p>}
      <div className="doc-library-card-actions">
        <button type="submit" className="doc-action-btn doc-action-btn--primary" disabled={busy}>{busy ? 'Removing…' : 'Remove'}</button>
        <button type="button" className="doc-action-btn doc-action-btn--ghost" disabled={busy} onClick={() => { setAsking(false); setError(''); setPassword(''); }}>Cancel</button>
      </div>
    </form>
  );
}
