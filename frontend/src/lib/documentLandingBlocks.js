/**
 * Split imported program document text into landing-page sections.
 * Major **headlines** start a new block; intro content stays in the first block.
 */
import { organizeDocumentBody, looksLikeMajorHeadline } from './organizeDocumentBody';

const LEGACY_CONTENT_TYPES = ['journey', 'who_for', 'why_now'];

function sectionBody(s) {
  return String(s?.body || '').trim();
}

function isDocumentSection(s) {
  if (!s || s.is_enabled === false) return false;
  return (s.section_type === 'document' || s.id === 'doc_main') && sectionBody(s);
}

/**
 * Resolve the text that drives the visitor landing layout.
 * Prefer live document/doc_main blocks; otherwise compose legacy journey/who_for/why_now copy.
 */
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

  const legacyParts = programSections
    .filter(
      (s) =>
        s.is_enabled !== false &&
        LEGACY_CONTENT_TYPES.includes(s.section_type) &&
        (sectionBody(s) || String(s.title || '').trim()),
    )
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (!legacyParts.length) return null;

  const body = legacyParts
    .map((s) => {
      const chunks = [];
      if (String(s.title || '').trim()) chunks.push(`**${String(s.title).trim()}**`);
      if (String(s.subtitle || '').trim()) chunks.push(String(s.subtitle).trim());
      if (sectionBody(s)) chunks.push(sectionBody(s));
      return chunks.join('\n\n');
    })
    .filter(Boolean)
    .join('\n\n');

  if (!body.trim()) return null;

  return {
    section: { id: 'legacy_doc', section_type: 'document', body },
    skipTypes: LEGACY_CONTENT_TYPES,
  };
}

export function parseDocumentLandingBlocks(body) {
  if (!body?.trim()) return [];

  const organized = organizeDocumentBody(body);
  const paragraphs = organized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const blocks = [];
  let current = null;

  const pushCurrent = () => {
    if (current?.paragraphs?.length) {
      blocks.push({
        ...current,
        body: current.paragraphs.join('\n\n'),
      });
    }
    current = null;
  };

  for (const para of paragraphs) {
    const majorMatch = para.match(/^\*\*(.+)\*\*$/s);
    const isMajor = majorMatch && (looksLikeMajorHeadline(para) || majorMatch[1].length < 70);

    if (isMajor) {
      pushCurrent();
      blocks.push({
        type: 'section',
        title: majorMatch[1].trim(),
        body: '',
        paragraphs: [],
      });
      current = { type: 'section-content', title: majorMatch[1].trim(), paragraphs: [] };
      continue;
    }

    if (!current) {
      current = { type: 'intro', title: '', paragraphs: [] };
    }
    current.paragraphs.push(para);
  }

  pushCurrent();
  return blocks;
}

/**
 * Split blocks so the black Experience section can sit after the intro + first topic.
 */
export function splitBlocksForExperience(blocks, sectionCountBefore = 1) {
  if (!blocks.length) return { before: [], after: [] };

  let seenSections = 0;
  let splitAt = blocks.length;

  for (let i = 0; i < blocks.length; i += 1) {
    if (blocks[i].type === 'section') {
      seenSections += 1;
      if (seenSections >= sectionCountBefore) {
        // Include content block(s) belonging to this section
        let end = i + 1;
        while (end < blocks.length && blocks[end].type === 'section-content') {
          end += 1;
        }
        splitAt = end;
        break;
      }
    }
  }

  // No major sections — split after intro halfway
  if (seenSections === 0 && blocks.length > 1) {
    splitAt = 1;
  }

  return {
    before: blocks.slice(0, splitAt),
    after: blocks.slice(splitAt),
  };
}
