import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionUser } from '@/app/lib/auth';

export async function GET(req: NextRequest) {
  const user = await sessionUser(req.cookies.get(SESSION_COOKIE)?.value);
  return user ? NextResponse.json(user, { headers: { 'Cache-Control': 'private, no-store' } }) : NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
}
