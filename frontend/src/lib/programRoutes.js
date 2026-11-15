import { AWRP_INTRO_LANDING_PATH, isAwrpIntroProgram } from './awrpIntroProgram';

/** Public marketing URL for a program card or nav item (not enroll). */
export function programPublicPath(program) {
  if (!program?.id) return '/programs';
  const link = (program.link || '').trim();
  if (link.startsWith('/')) return link.split('?')[0];
  if (isAwrpIntroProgram(program)) return AWRP_INTRO_LANDING_PATH;
  return `/program/${program.id}`;
}