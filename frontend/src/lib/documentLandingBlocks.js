/**
 * Resolve imported program document section from live content.
 */
const LEGACY_CONTENT_TYPES = ['journey', 'who_for', 'why_now'];

function sectionBody(s) {
  return String(s?.body || '').trim();
}

function isDocumentSection(s) {
  if (!s || s.is_enabled === false) return false;
  return (s.section_type === 'document' || s.id === 'doc_main') && sectionBody(s);
}

export function resolveProgramDocument(program, mergedSections = []) {
  const programSections = program?.content_sections || [];

  const explicit =
    programSections.find(isDocumentSection) ||
    (mergedSections || []).find(isDocumentSection);

  if (explicit) {
    return {
      section: explicit,
      skipTypes: LEGACY_CONTENT_TYPES,
    };
  }

  return null;
}
