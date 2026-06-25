/** Matches backend DEFAULT_SECTION_TEMPLATE — one layout for every program page. */
export const DEFAULT_PROGRAM_SECTION_TEMPLATE = [
  { id: 'journey', section_type: 'journey', default_title: 'The Journey', default_subtitle: '', order: 0, is_enabled: true },
  { id: 'who_for', section_type: 'who_for', default_title: 'Who It Is For?', default_subtitle: 'A Sacred Invitation for those who resonate', order: 1, is_enabled: true },
  { id: 'experience', section_type: 'experience', default_title: 'Your Experience', default_subtitle: '', order: 2, is_enabled: true },
  { id: 'why_now', section_type: 'why_now', default_title: 'Why You Need This Now?', default_subtitle: '', order: 3, is_enabled: true },
];

export const STANDARD_PROGRAM_SECTION_TYPES = new Set([
  'journey',
  'who_for',
  'experience',
  'why_now',
]);

function pickSectionField(value, defaultValue) {
  if (value != null && String(value).trim() !== '') return value;
  return defaultValue || '';
}

function isDocumentSection(section) {
  return section?.section_type === 'document' || section?.id === 'doc_main';
}

/**
 * Build the same section list for every program detail page from the global template.
 * Per-program content fills each slot; imported doc blocks are excluded from the layout.
 */
export function buildProgramPageSections(program, settings) {
  const sectionTemplate = settings?.program_section_template?.length
    ? settings.program_section_template
    : DEFAULT_PROGRAM_SECTION_TEMPLATE;

  const programSections = (program?.content_sections || []).filter(
    (s) => s.is_enabled !== false && !isDocumentSection(s),
  );

  return sectionTemplate
    .filter((tpl) => tpl.is_enabled !== false && STANDARD_PROGRAM_SECTION_TYPES.has(tpl.section_type))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((tpl) => {
      const match = programSections.find(
        (s) => s.id === tpl.id || s.section_type === tpl.section_type,
      ) || {};

      const title = pickSectionField(match.title, tpl.default_title);
      const subtitle = pickSectionField(match.subtitle, tpl.default_subtitle);
      let body = String(match.body || '').trim();
      if (!body && tpl.section_type === 'journey') {
        body = String(program?.description || '').trim();
      }

      return {
        id: tpl.id || tpl.section_type,
        section_type: tpl.section_type,
        title,
        subtitle,
        body,
        image_url: match.image_url || '',
        image_fit: match.image_fit || 'contain',
        image_position: match.image_position || 'center top',
        title_style: match.title_style,
        subtitle_style: match.subtitle_style,
        body_style: match.body_style,
        is_enabled: true,
        order: tpl.order,
      };
    });
}

export function isStandardProgramSection(sectionType) {
  return STANDARD_PROGRAM_SECTION_TYPES.has(sectionType);
}
