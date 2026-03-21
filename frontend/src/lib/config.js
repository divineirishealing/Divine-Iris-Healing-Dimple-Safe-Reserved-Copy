// Central config — safe fallback for all environments (Emergent, Hostinger, etc.)
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin || '';
export const API_URL = `${BACKEND_URL}/api`;
export const SITE_URL = BACKEND_URL.replace('/api', '').replace('api/', '');
