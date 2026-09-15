import { NextResponse } from 'next/server';

// Small standalone HTML answers of the admin auth routes (portal pass, sign-in
// errors). Never cached, never indexed, no referrer.

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** `body` is trusted markup: escape every dynamic value put into it. */
export function htmlPage(status: number, title: string, body: string, refreshTo?: string): NextResponse {
  const refresh = refreshTo ? `<meta http-equiv="refresh" content="0;url=${escapeHtml(refreshTo)}">` : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">${refresh}<title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;line-height:1.5"><h1 style="font-size:1.25rem">${escapeHtml(title)}</h1>${body}</body></html>`;
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
