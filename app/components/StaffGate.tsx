'use client';

import { useEffect, useState } from 'react';
import { callUploadFunction } from '@/app/documents/UploadPanel';
import { useSessionUser } from '@/app/lib/useSessionUser';
import { getStaffPassword, setStaffPassword, STAFF_LOCK_EVENT } from '@/app/lib/staffAuth';

/** One sign-in for all the staff data tools. Everything inside is hidden until the staff password has been accepted. */
export default function StaffGate({ children }: { children: React.ReactNode }) {
  const user = useSessionUser();
  const [state, setState] = useState<'checking' | 'locked' | 'open'>('checking');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setState(getStaffPassword() ? 'open' : 'locked');
    const lock = () => { setPassword(''); setError(''); setState('locked'); };
    window.addEventListener(STAFF_LOCK_EVENT, lock);
    return () => window.removeEventListener(STAFF_LOCK_EVENT, lock);
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return setError('Enter your password.');
    setBusy(true); setError('');
    try {
      await callUploadFunction({ action: 'check', password });
      setStaffPassword(password);
      setPassword('');
      setState('open');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'open') return <>{children}</>;
  if (state === 'checking') return <div className="report-page" />;

  return (
    <div className="report-page">
      <h1 className="heading" style={{ margin: '0 0 1.25rem' }}>Staff data tools</h1>
      <form className="glass-card doc-upload-panel" onSubmit={signIn} style={{ maxWidth: 420 }}>
        {/* a hidden user name helps a password manager save the password properly */}
        <input type="text" name="username" autoComplete="username" defaultValue={user?.username ?? ''} tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
        <label className="doc-upload-label" htmlFor="staff-password">
          Your password
          <input id="staff-password" name="password" type="password" autoComplete="current-password" autoFocus value={password} disabled={busy} onChange={e => setPassword(e.target.value)} className="species-search doc-upload-field" />
        </label>
        {error && <p className="doc-upload-error" role="alert">{error}</p>}
        <div className="doc-library-card-actions">
          <button type="submit" className="doc-action-btn doc-action-btn--primary" disabled={busy}>{busy ? 'Checking…' : 'Open staff tools'}</button>
        </div>
      </form>
    </div>
  );
}
