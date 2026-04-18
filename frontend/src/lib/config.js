// Central config. Do not use window.location.origin: on Render/Vercel the static site host is not the API host,
// so /api/image/... would 404. Use REACT_APP_BACKEND_URL at build time, or dev fallback below.
function normalizeBackendOrigin(raw) {
  let s = (raw || '').trim().replace(/\/$/, '');
  if (!s) return '';
  // Use origin only (protocol + host + port). Extra path segments (e.g. …/api/v1 or …/api/foo) would otherwise
  // produce …/api/foo/api/student/… and FastAPI returns 404 {"detail":"Not Found"}.
  if (!/^https?:\/\//i.test(s)) {
    const host0 = s.split('/')[0] || '';
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host0);
    s = `${local ? 'http' : 'https'}://${s}`;
  }
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    return s.replace(/\/api\/?$/, '');
  }
}
const fromEnv = normalizeBackendOrigin(process.env.REACT_APP_BACKEND_URL);
const devFallback =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development'
    ? normalizeBackendOrigin('http://localhost:8001')
    : '';
export const BACKEND_URL = fromEnv || devFallback;
export const API_URL = `${BACKEND_URL}/api`;
export const SITE_URL = BACKEND_URL;

/** When REACT_APP_SAME_ORIGIN_API=1 (e.g. Vercel rewrites /api/* to Render), call APIs on the page origin. */
const sameOriginApi =
  typeof process !== 'undefined' && process.env.REACT_APP_SAME_ORIGIN_API === '1';

export function getBackendUrl() {
  if (sameOriginApi && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return BACKEND_URL;
}

export function getApiUrl() {
  if (sameOriginApi && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return API_URL;
}

/** True when the bundle can call the API from this browser (absolute URL, or same-origin path like /api). */
export function isUploadApiReachable() {
  const api = getApiUrl();
  if (!api) return false;
  if (typeof window === 'undefined') return true;
  if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return true;
  if (api.startsWith('http')) return true;
  if (api.startsWith('/')) return true;
  return false;
}
