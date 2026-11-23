import { NextResponse, type NextRequest } from 'next/server';
import { forget, rpc, SESSION_COOKIE } from '@/app/lib/auth';
import { crossSite } from '../../_guard';

type Answer = { error?: string; ok?: boolean; users?: unknown[] };
const token = (req: NextRequest) => req.cookies.get(SESSION_COOKIE)?.value ?? '';
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
function reply(r: Answer) {
  if (r.error === 'forbidden') return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r, { headers: { 'Cache-Control': 'private, no-store' } });
}
async function call(fn: string, args: Record<string, unknown>) {
  try { return reply(await rpc<Answer>(fn, args)); } catch { return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 }); }
}

export async function GET(req: NextRequest) {
  return call('app_list_users', { p_token: token(req) });
}

export async function POST(req: NextRequest) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const b = await req.json().catch(() => ({}));
  return call('app_add_user', { p_token: token(req), p_username: text(b.username, 60), p_password: text(b.password), p_role: text(b.role, 10) });
}

export async function PATCH(req: NextRequest) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const b = await req.json().catch(() => ({}));
  const args: Record<string, unknown> = { p_token: token(req), p_id: text(b.id, 40) };
  if (typeof b.role === 'string') args.p_role = b.role;
  if (typeof b.disabled === 'boolean') args.p_disabled = b.disabled;
  if (typeof b.password === 'string') args.p_password = b.password.slice(0, 200);
  return call('app_update_user', args);
}

export async function DELETE(req: NextRequest) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const b = await req.json().catch(() => ({}));
  forget(undefined);
  return call('app_delete_user', { p_token: token(req), p_id: text(b.id, 40) });
}
