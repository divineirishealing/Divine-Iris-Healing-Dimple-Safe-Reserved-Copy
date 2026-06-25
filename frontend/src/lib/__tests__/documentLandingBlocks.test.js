import {
  resolveProgramDocument,
  parseDocumentLandingBlocks,
  splitDocumentBodyForExperience,
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
  const { prepareFaithfulDocumentBody, isImportedBoldLine, stripAlignPrefix } = require('../faithfulDocument');

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

  it('parses alignment prefix from import', () => {
    expect(stripAlignPrefix('>>c *Centered*')).toEqual({ align: 'center', text: '*Centered*' });
    expect(stripAlignPrefix('>>j Body text')).toEqual({ align: 'justify', text: 'Body text' });
    expect(stripAlignPrefix('Plain')).toEqual({ align: null, text: 'Plain' });
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
});

describe('splitDocumentBodyForExperience', () => {
  it('splits raw body at second Heading 1 for experience placement', () => {
    const body = [
      '# **First Topic**',
      '',
      'Content under first.',
      '',
      '# **Second Topic**',
      '',
      'Content under second.',
    ].join('\n');
    const { before, after } = splitDocumentBodyForExperience(body, 1);
    expect(before).toContain('First Topic');
    expect(before).toContain('Content under first.');
    expect(before).not.toContain('Second Topic');
    expect(after).toContain('Second Topic');
  });
});
