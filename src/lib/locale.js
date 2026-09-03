// Locale selection for user-facing pages rendered in the visitor's own
// language (legal pages). No user accounts exist here, so the browser's
// Accept-Language header is the visitor's language setting; an explicit
// override (a ?lang= query param from an on-page FR/EN toggle) always wins.
// Ported from only-one/lib/locale.ts; the fallback comes from siteLocale().
import { siteLocale } from './site-config';

export const SUPPORTED_LOCALES = ['fr', 'en'];

function matchSupported(tag) {
  const lower = String(tag).trim().toLowerCase();
  return SUPPORTED_LOCALES.find((l) => lower === l || lower.startsWith(`${l}-`)) ?? null;
}

// Site default when the visitor expresses no usable preference: the configured
// site locale when it is a supported language, English otherwise (the language
// the root page copy is written in).
export function defaultLocale() {
  return matchSupported(siteLocale()) ?? 'en';
}

export function pickLocale(acceptLanguage, override) {
  if (override) {
    const matched = matchSupported(override);
    if (matched) return matched;
  }

  if (acceptLanguage) {
    const preferences = acceptLanguage
      .split(',')
      .map((part) => {
        const [tag, ...params] = part.split(';');
        const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
        const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
        return { tag, q: Number.isFinite(q) ? q : 0 };
      })
      .filter((p) => p.q > 0)
      .sort((a, b) => b.q - a.q);

    for (const { tag } of preferences) {
      const matched = matchSupported(tag);
      if (matched) return matched;
    }
  }

  return defaultLocale();
}
