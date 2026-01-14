import { NextRequest, NextResponse } from 'next/server';
import { parseChangelog } from '@/lib/changelog/parser';

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') || 'en';
  const releases = parseChangelog(locale);

  return NextResponse.json(releases, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
