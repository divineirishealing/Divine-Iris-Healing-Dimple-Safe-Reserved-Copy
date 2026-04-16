// Central config. Do not use window.location.origin: on Render/Vercel the static site host is not the API host,
// so /api/image/... would 404. Use REACT_APP_BACKEND_URL at build time, or dev fallback below.
const fromEnv = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
const devFallback =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development' ? 'http://localhost:8001' : '';
export const BACKEND_URL = fromEnv || devFallback;
export const API_URL = `${BACKEND_URL}/api`;
export const SITE_URL = BACKEND_URL.replace('/api', '').replace('api/', '');
