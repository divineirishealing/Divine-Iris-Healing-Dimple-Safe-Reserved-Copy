import { indiaProgramRazorpayPath } from './indiaProgramLanding';
import { programPublicPath } from './programRoutes';

/** Marketing homepage mirror at /india (same UI as /). */
export function isIndiaMarketingHome(pathname) {
  return pathname === '/india';
}

export function programLinkForHome(pathname, program) {
  if (isIndiaMarketingHome(pathname)) {
    return indiaProgramRazorpayPath(program) || programPublicPath(program);
  }
  return programPublicPath(program);
}

export function homePathForLocation(pathname) {
  return isIndiaMarketingHome(pathname) ? '/india' : '/';
}