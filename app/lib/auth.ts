/**
 * Sign-in for the whole website. Users and sessions live in Supabase (see supabase/sql/auth.sql); the browser only holds
 * a random session token in an httpOnly cookie. Passwords are checked inside the database, which keeps only their hashes.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/app/lib/documents';

export const SESSION_COOKIE = 'nep_session';
export const SESSION_DAYS = 14;
export type Role = 'admin' | 'staff' | 'user';
export type SessionUser = { username: string; role: Role };
export const ROLE_LABEL: Record<Role, string> = { user: 'View only', staff: 'Staff (can enter data)', admin: 'Admin' };

/** Calls one of the sign-in functions in the database. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Sign-in service answered ${res.status}`);
  return (await res.json()) as T;
}

// A short memory of recent answers, so every page and data file does not ask the database again.
const recent = new Map<string, { user: SessionUser | null; at: number }>();
const FRESH_MS = 30_000;      // trust an answer for 30 seconds
const STALE_OK_MS = 600_000;  // if the database cannot be reached, a user seen in the last 10 minutes stays signed in

export async function sessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length < 32 || token.length > 200) return null;
  const hit = recent.get(token);
  const now = Date.now();
  if (hit && now - hit.at < FRESH_MS) return hit.user;
  try {
    const user = await rpc<SessionUser | null>('app_check_session', { p_token: token });
    if (recent.size > 500) recent.clear();
    recent.set(token, { user, at: now });
    return user;
  } catch {
    return hit && hit.user && now - hit.at < STALE_OK_MS ? hit.user : null;
  }
}

export function forget(token: string | undefined) {
  if (token) recent.delete(token);
}
