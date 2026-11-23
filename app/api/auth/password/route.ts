import { NextResponse, type NextRequest } from 'next/server';
import { rpc, SESSION_COOKIE } from '@/app/lib/auth';
import { crossSite } from '../../_guard';

export async function POST(req: NextRequest) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const b = await req.json().catch(() => ({}));
  try {
    const r = await rpc<{ error?: string; ok?: boolean }>('app_change_password', {
      p_token: req.cookies.get(SESSION_COOKIE)?.value ?? '',
      p_current: typeof b.current === 'string' ? b.current.slice(0, 200) : '',
      p_new: typeof b.next === 'string' ? b.next.slice(0, 200) : '',
    });
    return r.error ? NextResponse.json({ error: r.error === 'forbidden' ? 'Please sign in again.' : r.error }, { status: 400 }) : NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
