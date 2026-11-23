import { NextResponse, type NextRequest } from 'next/server';

/** Refuses requests that come from another website (the session cookie is also SameSite=Lax). */
export function crossSite(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.nextUrl.host) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  return null;
}
