/**
 * Public nav labels for fixed paths. Keeps CMS `href` while standardizing visible text.
 * @param {string} href
 * @param {string} [storedLabel] — label from site settings
 */
export function publicNavLinkLabel(href, storedLabel) {
  const path = String(href || '')
    .trim()
    .split('?')[0]
    .toLowerCase();
  if (path === '/dashboardaccessform' || path === '/client-intake') return 'Dashboard access form';
  return String(storedLabel ?? '').trim();
}
