/** Shared resolver for the "AWRP Intro Call" program (separate from the main AWRP workshop in admin). */

export const AWRP_INTRO_PROGRAM_TITLE = 'AWRP Intro Call';

/** Stable catalog id (matches backend bootstrap); override via REACT_APP_AWRP_INTRO_PROGRAM_ID if needed. */
export const AWRP_INTRO_PROGRAM_ID = (
  process.env.REACT_APP_AWRP_INTRO_PROGRAM_ID || '8c4f1a2e-6d9b-4f12-9e3a-7b5c6d8e9f01'
).trim();

export function isAwrpIntroProgram(program) {
  if (!program || typeof program !== 'object') return false;
  if (AWRP_INTRO_PROGRAM_ID && program.id === AWRP_INTRO_PROGRAM_ID) return true;
  const title = (program.title || '').trim().toLowerCase();
  if (title === AWRP_INTRO_PROGRAM_TITLE.toLowerCase()) return true;
  if (title === 'awrp introductory call') return true;
  const isAwrp = title.includes('awrp') || title.includes('atomic weight');
  if (!isAwrp) return false;
  if (title.includes('intro call') || title.includes('introductory call')) return true;
  return false;
}

/** Homepage Programs section + nav: show intro call alongside flagship cards when visible in admin. */
export function showInWebsiteProgramsSection(program) {
  if (!program || program.is_group_program) return false;
  if (isAwrpIntroProgram(program)) return true;
  return Boolean(program.is_flagship);
}

export function findAwrpIntroProgram(list) {
  const programs = Array.isArray(list) ? list : [];
  if (AWRP_INTRO_PROGRAM_ID) {
    const byId = programs.find((p) => p.id === AWRP_INTRO_PROGRAM_ID);
    if (byId) return byId;
  }
  const exact = programs.find(
    (p) => (p?.title || '').trim().toLowerCase() === AWRP_INTRO_PROGRAM_TITLE.toLowerCase(),
  );
  if (exact) return exact;
  return programs.find((p) => isAwrpIntroProgram(p)) || null;
}