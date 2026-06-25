import { resolveProgramDocument } from '../documentLandingBlocks';
import { prepareFaithfulDocumentBody, isImportedBoldLine } from '../faithfulDocument';

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
