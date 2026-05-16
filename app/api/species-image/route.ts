import { NextRequest, NextResponse } from 'next/server';
import { resolveSpeciesImageUrl } from '@/app/lib/speciesImageServer';

export async function GET(request: NextRequest) {
  const scientific = request.nextUrl.searchParams.get('scientific') ?? '';
  const common = request.nextUrl.searchParams.get('common') ?? undefined;

  if (!scientific.trim()) {
    return NextResponse.json({ error: 'scientific name required' }, { status: 400 });
  }

  try {
    const result = await resolveSpeciesImageUrl(scientific, common);
    if (!result) {
      return NextResponse.json({ url: null, source: null });
    }
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    });
  } catch {
    return NextResponse.json({ url: null, source: null }, { status: 500 });
  }
}
