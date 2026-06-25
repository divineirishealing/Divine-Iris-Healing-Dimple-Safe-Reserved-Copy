/**
 * Split imported program document into highlighted landing-page sections.
 * Word Heading 1 (# prefix) starts a gold title band; content follows in alternating bands.
 */
import {
  prepareFaithfulDocumentBody,
  parseHeadingPrefix,
  isImportedBoldLine,
} from './faithfulDocument';
import { isDocxHtmlBody, extractDocxHtml, splitDocxHtmlForExperience, DOCX_HTML_MARKER } from './docxHtml';

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

function stripMarkup(s) {
  return (s || '').replace(/\*+/g, '').trim();
}

function majorSectionTitle(para) {
  const trimmed = para.trim();
  const prefixed = parseHeadingPrefix(trimmed);
  if (prefixed?.level === 1) {
    return stripMarkup(prefixed.content);
  }
  if (isImportedBoldLine(trimmed)) {
    const inner = trimmed.match(/^\*\*(.+)\*\*$/s)?.[1];
    if (inner && stripMarkup(inner).length < 100) {
      return stripMarkup(inner);
    }
  }
  return null;
}

export function parseDocumentLandingBlocks(body) {
  if (!body?.trim()) return [];

  const prepared = prepareFaithfulDocumentBody(body);
  const paragraphs = prepared.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

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
    const title = majorSectionTitle(para);
    if (title) {
      pushCurrent();
      blocks.push({
        type: 'section',
        title,
        body: '',
        paragraphs: [],
      });
      current = { type: 'section-content', title, paragraphs: [] };
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
 * Split imported document body at the Nth Word Heading 1 for the Experience block.
 */
export function splitDocumentBodyForExperience(body, sectionCountBefore = 1) {
  if (!body?.trim()) return { before: '', after: '' };

  if (isDocxHtmlBody(body)) {
    const html = extractDocxHtml(body);
    const { before, after } = splitDocxHtmlForExperience(html, sectionCountBefore);
    const marker = String(body).startsWith(DOCX_HTML_MARKER) ? DOCX_HTML_MARKER : '';
    return {
      before: before ? `${marker}${before}` : '',
      after: after ? `${marker}${after}` : '',
    };
  }
  const prepared = prepareFaithfulDocumentBody(body);
  const paragraphs = prepared.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  let h1Count = 0;
  let splitAt = paragraphs.length;

  for (let i = 0; i < paragraphs.length; i += 1) {
    const prefixed = parseHeadingPrefix(paragraphs[i]);
    if (prefixed?.level === 1) {
      h1Count += 1;
      if (h1Count === sectionCountBefore + 1) {
        splitAt = i;
        break;
      }
    }
  }

  return {
    before: paragraphs.slice(0, splitAt).join('\n\n'),
    after: paragraphs.slice(splitAt).join('\n\n'),
  };
}

/**
 * Split blocks so the black Experience section sits after intro + first topic.
 */
export function splitBlocksForExperience(blocks, sectionCountBefore = 1) {
  if (!blocks.length) return { before: [], after: [] };

  let seenSections = 0;
  let splitAt = blocks.length;

  for (let i = 0; i < blocks.length; i += 1) {
    if (blocks[i].type === 'section') {
      seenSections += 1;
      if (seenSections >= sectionCountBefore) {
        let end = i + 1;
        while (end < blocks.length && blocks[end].type === 'section-content') {
          end += 1;
        }
        splitAt = end;
        break;
      }
    }
  }

  if (seenSections === 0 && blocks.length > 1) {
    splitAt = 1;
  }

  return {
    before: blocks.slice(0, splitAt),
    after: blocks.slice(splitAt),
  };
}
