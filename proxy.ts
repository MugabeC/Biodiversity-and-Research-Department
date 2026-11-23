import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionUser } from '@/app/lib/auth';

/** Keeps the whole website behind the sign-in page. Staff tools also need a staff or admin account; Settings needs an admin. */
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const user = await sessionUser(req.cookies.get(SESSION_COOKIE)?.value);

  if (path === '/login') {
    return user ? NextResponse.redirect(new URL('/', req.url)) : NextResponse.next();
  }
  if (path === '/api/auth/login') return NextResponse.next();

  if (!user) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
    const to = new URL('/login', req.url);
    if (path !== '/') to.searchParams.set('next', path + req.nextUrl.search);
    return NextResponse.redirect(to);
  }
  if (path.startsWith('/update') && user.role === 'user') return NextResponse.redirect(new URL('/', req.url));
  if ((path.startsWith('/settings') || path.startsWith('/api/auth/users')) && user.role !== 'admin') {
    return path.startsWith('/api/') ? NextResponse.json({ error: 'Admins only.' }, { status: 403 }) : NextResponse.redirect(new URL('/', req.url));
  }
  const res = NextResponse.next();
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}

export const config = {
  // Left open so the sign-in page, the app icons and link previews still load: build files, fonts, logo images,
  // icons, the web manifest, robots.txt, and the park boundary file the nightly wildlife sync reads.
  matcher: ['/((?!_next/|_vercel/|fonts/|images/|maplibre/|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest|robots\\.txt|og\\.png|data/map/boundary\\.geojson).*)'],
};
