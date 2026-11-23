'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return setError('Enter your user name and password.');
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Could not sign in.'); setBusy(false); return; }
      const next = new URLSearchParams(window.location.search).get('next') ?? '/';
      window.location.href = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/';
    } catch {
      setError('Could not reach the site. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <Image src="/images/nep-logo.png" alt="Nyandungu Eco-Park" width={150} height={85} unoptimized priority style={{ objectFit: 'contain', height: 'auto' }} />
        <h1 className="login-title">Biodiversity and Research Department</h1>
        <p className="login-sub">Sign in to continue</p>
        <label className="doc-upload-label" htmlFor="login-user">
          User name
          <input id="login-user" name="username" autoComplete="username" autoCapitalize="none" autoFocus value={username} disabled={busy} onChange={e => setUsername(e.target.value)} className="species-search doc-upload-field" />
        </label>
        <label className="doc-upload-label" htmlFor="login-pass">
          Password
          <input id="login-pass" name="password" type="password" autoComplete="current-password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} className="species-search doc-upload-field" />
        </label>
        {error && <p className="doc-upload-error" role="alert">{error}</p>}
        <button type="submit" className="doc-action-btn doc-action-btn--primary login-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}
