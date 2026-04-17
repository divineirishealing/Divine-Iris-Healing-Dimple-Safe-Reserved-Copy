/** Bearer token from login (fallback when cross-site session cookies are blocked, e.g. private browsing). */
export function getAuthHeaders() {
  try {
    const token = localStorage.getItem('session_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
