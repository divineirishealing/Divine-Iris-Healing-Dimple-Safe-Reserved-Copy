import { resolveProgramDocument, parseDocumentLandingBlocks } from '../documentLandingBlocks';

describe('resolveProgramDocument', () => {
  it('prefers live document section over legacy blocks', () => {
    const program = {
      content_sections: [
        { id: 'journey', section_type: 'journey', body: 'Old journey', is_enabled: true },
        { id: 'doc_main', section_type: 'document', body: 'Imported copy', is_enabled: true },
      ],
    };
    const result = resolveProgramDocument(program, []);
    expect(result.section.body).toBe('Imported copy');
    expect(result.skipTypes).toContain('journey');
  });

  it('returns null when no document block exists', () => {
    const program = {
      content_sections: [
        { id: 'journey', section_type: 'journey', title: 'The Journey', body: 'Intro text', is_enabled: true, order: 0 },
      ],
    };
    expect(resolveProgramDocument(program, [])).toBeNull();
  });
});

describe('parseDocumentLandingBlocks', () => {
  it('creates intro and section blocks from headlines', () => {
    const blocks = parseDocumentLandingBlocks('Opening paragraph.\n\n**What is AMRP?**\n\nDetails here.');
    expect(blocks.some((b) => b.type === 'intro')).toBe(true);
    expect(blocks.some((b) => b.type === 'section' && b.title.includes('AMRP'))).toBe(true);
  });
});
