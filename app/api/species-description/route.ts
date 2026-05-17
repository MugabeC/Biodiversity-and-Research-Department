import { NextRequest, NextResponse } from 'next/server';
import { resolveSpeciesDescription } from '@/app/lib/speciesDescriptionServer';

export async function GET(request: NextRequest) {
  const scientific = request.nextUrl.searchParams.get('scientific') ?? '';
  const common = request.nextUrl.searchParams.get('common') ?? undefined;

  if (!scientific.trim()) {
    return NextResponse.json({ error: 'scientific name required' }, { status: 400 });
  }

  try {
    const result = await resolveSpeciesDescription(scientific, common);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    });
  } catch {
    return NextResponse.json({ description: '', source: null }, { status: 500 });
  }
}
