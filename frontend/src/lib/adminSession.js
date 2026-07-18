import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export function getAdminToken() {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem('admin_token') || '';
}

export function adminHeaders() {
  const t = getAdminToken();
  return t ? { 'X-Admin-Session': t } : {};
}

export function clearAdminSession() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('adminLoggedIn');
  localStorage.removeItem('admin_token');
}

export function isAdminSessionError(error) {
  const status = error?.response?.status;
  const detail = String(error?.response?.data?.detail || '').toLowerCase();
  return status === 401 && detail.includes('admin session');
}

export async function validateAdminSession() {
  const token = getAdminToken();
  if (!token || token.length < 16 || localStorage.getItem('adminLoggedIn') !== 'true') {
    clearAdminSession();
    return false;
  }
  try {
    await axios.get(`${API}/admin/clients/session`, { headers: adminHeaders() });
    return true;
  } catch {
    clearAdminSession();
    return false;
  }
}

export function handleAdminSessionExpired() {
  clearAdminSession();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('admin-session-expired'));
  }
}
