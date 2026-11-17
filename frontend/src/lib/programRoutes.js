import {
  AWRP_INTRO_LANDING_PATH,
  AWRP_INTRO_LANDING_PATH_INDIA,
  isAwrpIntroProgram,
} from './awrpIntroProgram';

/** Admin default `link` is "/program" — not a real page; use catalog id instead. */
export function isPlaceholderProgramLink(link) {
  const path = String(link || '').trim().split('?')[0];
  if (!path) return true;
  return path === '/program' || path === '/program/';
}

/** Public marketing URL for a program card or nav item (not enroll). */
export function programPublicPath(program, options = {}) {
  if (!program?.id) return '/programs';
  const link = (program.link || '').trim();
  if (link.startsWith('/') && !isPlaceholderProgramLink(link)) {
    return link.split('?')[0];
  }
  if (isAwrpIntroProgram(program)) {
    return options.indiaAds ? AWRP_INTRO_LANDING_PATH_INDIA : AWRP_INTRO_LANDING_PATH;
  }
  return `/program/${program.id}`;
}