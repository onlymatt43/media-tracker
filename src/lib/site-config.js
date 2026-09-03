// Per-deployment site identity for the root <head>: name, description, locale
// and brand asset URLs. Everything is read from the environment so the app can
// be redeployed for another operator by changing configuration only. Mirrors
// only-one/lib/site-config.ts (same variable names). Every value is optional:
// what is unset is omitted from <head>, never replaced by a placeholder.
import pkg from '../../package.json';

function env(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

// Display name: the operator's brand when configured, otherwise the package
// name, which is the project's own identifier and always defined.
export function siteName() {
  return env('SITE_BRAND_NAME') ?? pkg.name;
}

export function siteDescription() {
  return env('SITE_DESCRIPTION');
}

// BCP-47 tag for <html lang>. Falls back to the language the root page copy is
// written in. og:locale is only emitted when the locale is configured.
export function siteLocale() {
  return env('SITE_LOCALE') ?? 'en';
}

export function siteOpenGraphLocale() {
  const locale = env('SITE_LOCALE');
  return locale ? locale.replace('-', '_') : null;
}

// Canonical public origin (scheme + host). Unset -> Next's own host detection.
export function siteUrl() {
  const raw = env('SITE_URL');
  if (!raw) return null;
  try {
    return new URL(raw.replace(/\/$/, ''));
  } catch {
    return null;
  }
}

export function siteOgImageUrl() {
  return env('SITE_OG_IMAGE_URL');
}

// Base URL of the shared favicon set (no trailing slash), or null when unset.
export function siteFaviconBaseUrl() {
  const base = env('SITE_FAVICON_BASE_URL');
  return base ? base.replace(/\/$/, '') : null;
}

// Base URL of the shared favicon set; file names follow the ecosystem layout.
export function siteIcons() {
  const base = env('SITE_FAVICON_BASE_URL');
  if (!base) return null;
  const root = base.replace(/\/$/, '');
  return {
    icon: [
      { url: `${root}/favicon-32.png`, sizes: '32x32', type: 'image/png' },
      { url: `${root}/favicon-16.png`, sizes: '16x16', type: 'image/png' },
    ],
    shortcut: `${root}/favicon.ico`,
    apple: `${root}/apple-touch-icon.png`,
  };
}

// Root metadata object. Keys are only present when their source is set.
export function siteMetadata() {
  const name = siteName();
  const description = siteDescription();
  const url = siteUrl();
  const image = siteOgImageUrl();
  const ogLocale = siteOpenGraphLocale();
  const icons = siteIcons();
  return {
    title: name,
    ...(description ? { description } : {}),
    ...(url ? { metadataBase: url } : {}),
    openGraph: {
      title: name,
      siteName: name,
      type: 'website',
      ...(description ? { description } : {}),
      ...(image ? { images: [image] } : {}),
      ...(ogLocale ? { locale: ogLocale } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: name,
      ...(description ? { description } : {}),
      ...(image ? { images: [image] } : {}),
    },
    ...(icons ? { icons } : {}),
  };
}

// Legal identity shown on user-facing legal pages (src/app/privacy). Both are
// optional: a page renders nothing for an unset value rather than a placeholder.
export function siteOperatorName() {
  return env('SITE_OPERATOR_NAME');
}

export function siteContactEmail() {
  return env('SITE_CONTACT_EMAIL');
}
