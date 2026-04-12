import { BACKEND_URL as CONFIG_BACKEND_URL } from './config';

/**
 * Same origin resolution as the rest of the app (env at build time, else window.location.origin).
 * Must match axios/API base so /api/image/... loads from the real API host, not the static site.
 */
function backendOrigin() {
  return (CONFIG_BACKEND_URL || '').replace(/\/$/, '');
}

/** True if the value looks like an image URL (excludes mistaken plain text such as a client name). */
export function isLikelyImageUrl(s) {
  if (s == null || typeof s !== 'string') return false;
  const t = s.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (t.startsWith('//')) return true;
  if (t.startsWith('/api/')) return true;
  if (t.startsWith('data:') || t.startsWith('blob:')) return true;
  if (/^api\//i.test(t)) return true;
  if (t.startsWith('/') && t.length > 2) return true;
  // Paths saved without a leading slash or scheme (e.g. assets/... or cdn host + path) still need to render.
  if (/\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?|#|$)/i.test(t) && /[/\\]/.test(t)) return true;
  return false;
}

/**
 * Resolves an image/video URL for <img src> / background.
 * - Accepts a string or { url, secure_url } (Cloudinary-style).
 * - Absolute http(s) / data / blob URLs are returned as-is.
 * - Paths under /api/... are prefixed with BACKEND_URL from config (env or current origin).
 * - Tolerates missing leading slash (api/...) from older data.
 */
function toImageString(url) {
  if (url == null) return '';
  if (typeof url === 'string') return url.trim();
  if (typeof url === 'object') {
    const u = url.url ?? url.secure_url;
    if (typeof u === 'string') return u.trim();
  }
  return '';
}

export function resolveImageUrl(url) {
  let u = toImageString(url);
  if (!u) return '';

  const lower = u.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('//')
  ) {
    return u;
  }

  if (!u.startsWith('/') && u.startsWith('api/')) {
    u = `/${u}`;
  }

  const origin = backendOrigin();
  if (u.startsWith('/api/') && origin) {
    return `${origin}${u}`;
  }

  return u;
}
