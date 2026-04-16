import { BACKEND_URL as CONFIG_BACKEND_URL } from './config';

const PUBLIC_API_STORAGE_KEY = 'divine_iris_public_api_base';

/** Call when /api/settings loads — HOST_URL from the server helps /api/image URLs if the bundle lacked REACT_APP_BACKEND_URL. */
export function rememberPublicApiBase(url) {
  if (typeof window === 'undefined' || url == null) return;
  const u = String(url).trim().replace(/\/$/, '');
  if (!u) return;
  try {
    sessionStorage.setItem(PUBLIC_API_STORAGE_KEY, u);
  } catch (_) {
    /* private mode / quota */
  }
}

/**
 * Origin for resolving /api/... media paths — build-time env first, then server-reported public_api_base.
 */
function backendOrigin() {
  const env = (CONFIG_BACKEND_URL || '').replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(PUBLIC_API_STORAGE_KEY);
      if (stored) return stored.replace(/\/$/, '');
    } catch (_) {}
  }
  return '';
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
 * - Accepts a string or { url, secure_url } (legacy object shape from older uploads).
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
