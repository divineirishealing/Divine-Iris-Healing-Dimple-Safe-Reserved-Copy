import {
  buildProgramPageSections,
  DEFAULT_PROGRAM_SECTION_TEMPLATE,
} from '../programPageSections';

describe('buildProgramPageSections', () => {
  it('returns the same four standard sections for every program', () => {
    const program = { description: 'Program intro', content_sections: [] };
    const sections = buildProgramPageSections(program, {});
    expect(sections.map((s) => s.section_type)).toEqual([
      'journey',
      'who_for',
      'experience',
      'why_now',
    ]);
    expect(sections[0].title).toBe('The Journey');
    expect(sections[0].body).toBe('Program intro');
    expect(sections[2].title).toBe('Your Experience');
  });

  it('merges per-program content and ignores imported document sections', () => {
    const program = {
      description: '',
      content_sections: [
        { id: 'doc_main', section_type: 'document', body: '@@DOCX_HTML@@<p>Doc</p>', is_enabled: true },
        { id: 'who_for', section_type: 'who_for', title: 'Custom Who', body: 'Line one', is_enabled: true },
      ],
    };
    const sections = buildProgramPageSections(program, {
      program_section_template: DEFAULT_PROGRAM_SECTION_TEMPLATE,
    });
    expect(sections).toHaveLength(4);
    expect(sections.find((s) => s.section_type === 'document')).toBeUndefined();
    expect(sections.find((s) => s.section_type === 'who_for').title).toBe('Custom Who');
  });

  it('falls back to template defaults when fields are blank', () => {
    const program = {
      content_sections: [
        { id: 'journey', section_type: 'journey', title: '', subtitle: '', body: '', is_enabled: true },
      ],
    };
    const sections = buildProgramPageSections(program, {
      program_section_template: DEFAULT_PROGRAM_SECTION_TEMPLATE,
    });
    expect(sections[0].title).toBe('The Journey');
    expect(sections[1].subtitle).toBe('A Sacred Invitation for those who resonate');
  });
});
