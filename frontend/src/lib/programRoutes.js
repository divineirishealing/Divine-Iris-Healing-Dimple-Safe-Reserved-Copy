import { isAwrpIntroProgram } from './awrpIntroProgram';

/** Public marketing URL for a program card or nav item (not enroll). */
export function programPublicPath(program) {
  if (!program?.id) return '/programs';
  const link = (program.link || '').trim();
  if (link.startsWith('/')) return link.split('?')[0];
  if (isAwrpIntroProgram(program)) return '/awrp-intro-call';
  return `/program/${program.id}`;
}