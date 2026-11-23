'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROLE_LABEL, type Role } from '@/app/lib/auth';

type User = { id: string; username: string; role: Role; disabled: boolean; created_at: string; last_seen: string | null; active: boolean; me: boolean };

const rwandaTime = (iso: string) => new Date(Date.parse(iso) + 2 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);

async function call(method: string, body?: unknown, url = '/api/auth/users'): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: 'Could not reach the site.' } };
  }
}

export default function SettingsPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [nu, setNu] = useState({ username: '', password: '', role: 'user' as Role });
  const [pw, setPw] = useState({ current: '', next: '' });

  const load = useCallback(async () => {
    const r = await call('GET');
    if (r.ok) setUsers(r.data.users as User[]); else setError(String(r.data.error ?? 'Could not load the users.'));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(method: string, body: unknown, done: string) {
    setError(''); setNotice('');
    const r = await call(method, body);
    if (!r.ok) return setError(String(r.data.error ?? 'Something went wrong.'));
    setNotice(done);
    load();
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setNotice('');
    const r = await call('POST', nu);
    if (!r.ok) return setError(String(r.data.error ?? 'Something went wrong.'));
    setNotice(`${nu.username.trim()} can now sign in.`);
    setNu({ username: '', password: '', role: 'user' });
    load();
  }

  async function changeMine(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setNotice('');
    const r = await call('POST', pw, '/api/auth/password');
    if (!r.ok) return setError(String(r.data.error ?? 'Something went wrong.'));
    setNotice('Your password is changed. Other devices signed in as you were signed out.');
    setPw({ current: '', next: '' });
  }

  const active = (users ?? []).filter(u => u.active);

  return (
    <div className="report-page settings-page">
      <h1 className="heading" style={{ margin: '0 0 1.25rem' }}>Settings</h1>
      {error && <p className="doc-upload-error" role="alert">{error}</p>}
      {notice && <p className="doc-upload-ok" role="status">{notice}</p>}

      <section className="glass-card wildlife-card">
        <h2 className="settings-title">Active now</h2>
        {users === null ? <p className="doc-upload-help">Loading…</p> : active.length === 0 ? (
          <p className="doc-upload-help">Nobody has used the site in the last 5 minutes.</p>
        ) : (
          <p className="settings-active">
            {active.map(u => <span key={u.id} className="settings-chip"><i aria-hidden />{u.username}</span>)}
          </p>
        )}
        <p className="doc-upload-meta">Updated every 30 seconds. A user counts as active if they opened a page in the last 5 minutes.</p>
      </section>

      <section className="glass-card wildlife-card">
        <h2 className="settings-title">Users</h2>
        {users && (
          <div className="settings-table-wrap">
            <table className="report-table settings-table">
              <thead><tr><th>User name</th><th>Access</th><th>Last seen</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={u.disabled ? 'settings-off' : undefined}>
                    <td>{u.username}{u.me ? ' (you)' : ''}{u.disabled ? ' · switched off' : ''}</td>
                    <td>
                      <select className="settings-select" value={u.role} disabled={u.me} aria-label={`Access for ${u.username}`}
                        onChange={e => act('PATCH', { id: u.id, role: e.target.value }, `${u.username} now has ${ROLE_LABEL[e.target.value as Role].toLowerCase()} access.`)}>
                        {(Object.keys(ROLE_LABEL) as Role[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </td>
                    <td>{u.active ? <span className="settings-live">Active now</span> : u.last_seen ? `${rwandaTime(u.last_seen)} (Rwanda time)` : 'Never signed in'}</td>
                    <td className="settings-actions">
                      {resetFor === u.id ? (
                        <form className="settings-inline" onSubmit={e => { e.preventDefault(); act('PATCH', { id: u.id, password: resetPw }, `Password changed for ${u.username}.`); setResetFor(null); setResetPw(''); }}>
                          <input className="species-search settings-pw" type="password" autoComplete="new-password" placeholder="New password" aria-label={`New password for ${u.username}`} value={resetPw} onChange={e => setResetPw(e.target.value)} autoFocus />
                          <button type="submit" className="doc-action-btn doc-action-btn--primary">Save</button>
                          <button type="button" className="doc-action-btn doc-action-btn--ghost" onClick={() => { setResetFor(null); setResetPw(''); }}>Cancel</button>
                        </form>
                      ) : (
                        <>
                          <button type="button" className="doc-action-btn doc-action-btn--ghost" onClick={() => setResetFor(u.id)}>Reset password</button>
                          {!u.me && (
                            <>
                              <button type="button" className="doc-action-btn doc-action-btn--ghost" onClick={() => act('PATCH', { id: u.id, disabled: !u.disabled }, u.disabled ? `${u.username} can sign in again.` : `${u.username} is switched off and signed out.`)}>{u.disabled ? 'Switch on' : 'Switch off'}</button>
                              <button type="button" className="doc-action-btn doc-action-btn--ghost" onClick={() => { if (window.confirm(`Remove ${u.username}? They will not be able to sign in.`)) act('DELETE', { id: u.id }, `${u.username} is removed.`); }}>Remove</button>
                            </>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="wildlife-two">
        <form className="glass-card wildlife-card" onSubmit={addUser}>
          <h2 className="settings-title">Add a user</h2>
          <label className="doc-upload-label" htmlFor="nu-name">User name
            <input id="nu-name" className="species-search doc-upload-field" autoComplete="off" value={nu.username} onChange={e => setNu({ ...nu, username: e.target.value })} />
          </label>
          <label className="doc-upload-label" htmlFor="nu-pass">Password (at least 8 characters)
            <input id="nu-pass" className="species-search doc-upload-field" type="password" autoComplete="new-password" value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })} />
          </label>
          <label className="doc-upload-label" htmlFor="nu-role">Access
            <select id="nu-role" className="species-search doc-upload-field" value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value as Role })}>
              {(Object.keys(ROLE_LABEL) as Role[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </label>
          <p className="doc-upload-meta">View only: the whole website except the staff tools. Staff: also the staff data tools (they still need the staff password). Admin: also this page.</p>
          <div className="doc-library-card-actions"><button type="submit" className="doc-action-btn doc-action-btn--primary">Add user</button></div>
        </form>

        <form className="glass-card wildlife-card" onSubmit={changeMine}>
          <h2 className="settings-title">Change my password</h2>
          <label className="doc-upload-label" htmlFor="pw-cur">Current password
            <input id="pw-cur" className="species-search doc-upload-field" type="password" autoComplete="current-password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} />
          </label>
          <label className="doc-upload-label" htmlFor="pw-new">New password (at least 8 characters)
            <input id="pw-new" className="species-search doc-upload-field" type="password" autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
          </label>
          <div className="doc-library-card-actions"><button type="submit" className="doc-action-btn doc-action-btn--primary">Change password</button></div>
        </form>
      </div>
    </div>
  );
}
