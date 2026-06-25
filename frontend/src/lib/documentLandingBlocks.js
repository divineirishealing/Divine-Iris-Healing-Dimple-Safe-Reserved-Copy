/**
 * Split imported program document text into landing-page sections.
 * Major **headlines** start a new block; intro content stays in the first block.
 */
import { organizeDocumentBody, looksLikeMajorHeadline } from './organizeDocumentBody';

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
