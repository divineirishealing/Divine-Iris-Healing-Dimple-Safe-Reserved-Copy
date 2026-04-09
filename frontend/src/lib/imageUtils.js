const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

/**
 * Resolves an image/video URL for <img src> / background.
 * - Absolute http(s) / data / blob URLs are returned as-is.
 * - Paths served by the API (/api/image/...) get the backend origin in production
 *   (required on Vercel: the browser must load files from your API host, not vercel.app).
 * - Tolerates missing leading slash (api/image/...) from older data.
 */
export function resolveImageUrl(url) {
  if (url == null || typeof url !== 'string') return '';
  let u = url.trim();
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

  if (!u.startsWith('/')) {
    if (u.startsWith('api/image/')) u = `/${u}`;
  }

  if (u.startsWith('/api/image/')) {
    if (BACKEND_URL) return `${BACKEND_URL}${u}`;
    return u;
  }

  return u;
}
