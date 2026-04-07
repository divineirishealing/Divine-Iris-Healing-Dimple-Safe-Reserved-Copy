const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Resolves an image URL. If it's a relative path (starts with /api/image/),
 * prepends the backend URL when set. Otherwise returns as-is (same-origin /api works).
 */
export function resolveImageUrl(url) {
  if (url == null || typeof url !== 'string') return '';
  const u = url.trim();
  if (!u) return '';
  if (u.startsWith('/api/image/')) {
    if (BACKEND_URL) return `${BACKEND_URL}${u}`;
    return u;
  }
  return u;
}
