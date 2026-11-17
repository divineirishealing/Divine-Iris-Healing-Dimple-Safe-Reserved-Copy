import { indiaProgramRazorpayPath } from './indiaProgramLanding';
import { programPublicPath } from './programRoutes';

const MIRROR_SKIP_PREFIXES = [
  '/admin',
  '/dashboard',
  '/login',
  '/payment',
  '/checkout/',
  '/enroll/',
  '/india-payment',
  '/manual-payment',
  '/pay/',
  '/update-contact',
  '/dashboardaccessform',
  '/client-intake',
  '/preview/',
];

/** User is browsing the India marketing site (/india and mirrored pages). */
export function isIndiaSite(pathname) {
  if (pathname === '/india') return true;
  if (!pathname?.startsWith('/india/')) return false;
  if (pathname.startsWith('/india-payment')) return false;
  return true;
}

/** @deprecated use isIndiaSite */
export function isIndiaMarketingHome(pathname) {
  return pathname === '/india';
}

export function homePathForLocation(pathname) {
  return isIndiaSite(pathname) ? '/india' : '/';
}

/**
 * Prefix internal paths with /india when already on the India site.
 * Leaves payment, dashboard, and already-/india URLs unchanged.
 */
export function toIndiaSitePath(href, pathname) {
  if (!href || typeof href !== 'string') return href;
  if (/^https?:/i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) return href;
  if (!isIndiaSite(pathname)) return href;
  if (href.startsWith('/india')) return href;
  const hashIdx = href.indexOf('#');
  const withoutHash = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const hash = hashIdx >= 0 ? href.slice(hashIdx) : '';
  const qIdx = withoutHash.indexOf('?');
  const base = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
  const query = qIdx >= 0 ? withoutHash.slice(qIdx) : '';

  if (href.startsWith('/#')) return `/india${href.slice(1)}`;

  for (const prefix of MIRROR_SKIP_PREFIXES) {
    if (base === prefix.replace(/\/$/, '') || base.startsWith(prefix)) return href;
  }

  if (base === '/' || base === '') return `/india${query}${hash}`;
  return `/india${base}${query}${hash}`;
}

export function programLinkForHome(pathname, program) {
  if (isIndiaSite(pathname)) {
    return indiaProgramRazorpayPath(program) || programPublicPath(program);
  }
  return programPublicPath(program);
}