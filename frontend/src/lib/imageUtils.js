const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

/**
 * Resolves an image/video URL for <img src> / background.
 * - Accepts a string or { url, secure_url } (Cloudinary-style).
 * - Absolute http(s) / data / blob URLs are returned as-is.
 * - Paths under /api/... get the backend origin when REACT_APP_BACKEND_URL is set.
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

  if (u.startsWith('/api/') && BACKEND_URL) {
    return `${BACKEND_URL}${u}`;
  }

  return u;
}
