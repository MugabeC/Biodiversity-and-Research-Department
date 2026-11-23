import { NextResponse, type NextRequest } from 'next/server';
import { rpc, SESSION_COOKIE, SESSION_DAYS, type Role } from '@/app/lib/auth';
import { crossSite } from '../../_guard';

export async function POST(req: NextRequest) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  let body: { username?: unknown; password?: unknown } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  const username = typeof body.username === 'string' ? body.username.slice(0, 80) : '';
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  if (!username.trim() || !password) return NextResponse.json({ error: 'Enter your user name and password.' }, { status: 400 });
  try {
    const r = await rpc<{ token?: string; username?: string; role?: Role; error?: string }>('app_login', { p_username: username, p_password: password });
    if (r.error === 'too_many') return NextResponse.json({ error: 'Too many tries. Wait 15 minutes and try again.' }, { status: 429 });
    if (!r.token) return NextResponse.json({ error: 'Wrong user name or password.' }, { status: 401 });
    const res = NextResponse.json({ ok: true, username: r.username, role: r.role });
    res.cookies.set(SESSION_COOKIE, r.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86400 });
    return res;
  } catch {
    return NextResponse.json({ error: 'The sign-in service is not reachable. Try again in a moment.' }, { status: 503 });
  }
}
