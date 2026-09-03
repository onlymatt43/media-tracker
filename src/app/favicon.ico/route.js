import { NextResponse } from 'next/server';
import { siteFaviconBaseUrl } from '@/lib/site-config';

// Browsers request /favicon.ico on their own, regardless of the <link rel=icon>
// tags in <head>. The icon lives on the brand asset host (SITE_FAVICON_BASE_URL),
// so this route forwards there permanently; when no asset host is configured,
// there is no icon to point at and the request gets a plain 404 rather than a
// fake file.
export const dynamic = 'force-dynamic';

export async function GET() {
  const base = siteFaviconBaseUrl();
  if (!base) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.redirect(`${base}/favicon.ico`, 308);
}
