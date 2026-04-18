// Central config. Do not use window.location.origin: on Render/Vercel the static site host is not the API host,
// so /api/image/... would 404. Use REACT_APP_BACKEND_URL at build time, or dev fallback below.
function normalizeBackendOrigin(raw) {
  let s = (raw || '').trim().replace(/\/$/, '');
  if (!s) return '';
  // Accept either https://api.host.com or https://api.host.com/api (avoid double /api/api in API_URL)
  s = s.replace(/\/api\/?$/, '');
  return s;
}
const fromEnv = normalizeBackendOrigin(process.env.REACT_APP_BACKEND_URL);
const devFallback =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development'
    ? normalizeBackendOrigin('http://localhost:8001')
    : '';
export const BACKEND_URL = fromEnv || devFallback;
export const API_URL = `${BACKEND_URL}/api`;
export const SITE_URL = BACKEND_URL;
