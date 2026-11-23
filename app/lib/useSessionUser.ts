'use client';

import { useEffect, useState } from 'react';
import type { SessionUser } from '@/app/lib/auth';

let pending: Promise<SessionUser | null> | null = null;

/** The signed-in user (null while loading or when signed out). One request is shared by everything on the page. */
export function useSessionUser(): SessionUser | null {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => {
    pending ??= fetch('/api/auth/me', { cache: 'no-store' }).then(r => (r.ok ? (r.json() as Promise<SessionUser>) : null)).catch(() => null);
    let live = true;
    pending.then(u => { if (live) setUser(u); });
    return () => { live = false; };
  }, []);
  return user;
}

export async function signOut() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* the cookie may already be gone */ }
  window.location.href = '/login';
}
