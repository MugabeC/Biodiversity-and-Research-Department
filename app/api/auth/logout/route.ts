import { NextResponse, type NextRequest } from 'next/server';
import { forget, rpc, SESSION_COOKIE } from '@/app/lib/auth';
import { crossSite } from '../../_guard';

export async function POST(req: NextRequest) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  forget(token);
  if (token) { try { await rpc('app_logout', { p_token: token }); } catch { /* the cookie is cleared anyway */ } }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
