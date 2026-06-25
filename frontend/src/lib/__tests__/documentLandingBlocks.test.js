import {
  resolveProgramDocument,
  parseDocumentLandingBlocks,
  splitBlocksForExperience,
} from '../documentLandingBlocks';

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

describe('faithfulDocument', () => {
  const { prepareFaithfulDocumentBody, isImportedBoldLine } = require('../faithfulDocument');

  it('preserves bold lines and only normalises bullets', () => {
    const out = prepareFaithfulDocumentBody('**Real Heading**\n\n• First point');
    expect(out).toContain('**Real Heading**');
    expect(out).toContain('✦ First point');
    expect(out).not.toContain('• First');
  });

  it('detects imported bold lines', () => {
    expect(isImportedBoldLine('**From Word**')).toBe(true);
    expect(isImportedBoldLine('Plain question?')).toBe(false);
  });

});

describe('parseDocumentLandingBlocks', () => {
  it('splits on Word Heading 1 (# prefix) into highlighted sections', () => {
    const body = [
      'Opening intro paragraph here with enough text.',
      '',
      '# **What Is AMRP?**',
      '',
      'Details about the program.',
      '',
      '# **Who Is AMRP For?**',
      '',
      'Audience details.',
    ].join('\n');
    const blocks = parseDocumentLandingBlocks(body);
    expect(blocks.some((b) => b.type === 'intro')).toBe(true);
    expect(blocks.filter((b) => b.type === 'section').map((b) => b.title)).toEqual([
      'What Is AMRP?',
      'Who Is AMRP For?',
    ]);
  });

  it('splitBlocksForExperience places experience after first topic', () => {
    const blocks = parseDocumentLandingBlocks(
      '# **First Topic**\n\nContent.\n\n# **Second Topic**\n\nMore.',
    );
    const { before, after } = splitBlocksForExperience(blocks, 1);
    expect(before.some((b) => b.title === 'First Topic')).toBe(true);
    expect(after.some((b) => b.title === 'Second Topic')).toBe(true);
  });
});
