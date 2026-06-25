import React from 'react';
import DocxHtmlMirror from './DocxHtmlMirror';
import ProgramDocumentLanding from './ProgramDocumentLanding';
import FaithfulDocumentParagraphs from './FaithfulDocumentParagraphs';
import { isDocxHtmlBody, extractDocxHtml, wrapDocxHtmlFragment } from '../lib/docxHtml';
import { parseDocumentLandingBlocks } from '../lib/documentLandingBlocks';
import { CONTAINER, NARROW, SECTION_PY } from '../lib/designTokens';

/**
 * Program landing content — Word HTML mirror or highlighted landing bands for markdown.
 */
export default function ProgramDocumentMirror({
  body,
  blocks,
  subtitle,
  accent,
  continuation = false,
  startIndex = 0,
}) {
  if (!body?.trim() && !blocks?.length) return null;

  if (body?.trim() && isDocxHtmlBody(body, subtitle)) {
    const html = wrapDocxHtmlFragment(extractDocxHtml(body));
    return (
      <DocxHtmlMirror
        html={html}
        accent={accent || '#C9962A'}
        continuation={continuation}
      />
    );
  }

  const landingBlocks = blocks?.length
    ? blocks
    : (body?.trim() ? parseDocumentLandingBlocks(body) : []);

  if (landingBlocks.length) {
    return (
      <ProgramDocumentLanding
        blocks={landingBlocks}
        accent={accent}
        startIndex={startIndex}
      />
    );
  }

  return (
    <section
      data-testid={continuation ? 'program-document-mirror-continued' : 'program-document-mirror'}
      className={`${continuation ? 'pb-10' : SECTION_PY} bg-white`}
    >
      <div className={CONTAINER}>
        <div className={`${NARROW} mx-auto max-w-[42rem]`}>
          <FaithfulDocumentParagraphs body={body} accent={accent} variant="mirror" />
        </div>
      </div>
    </section>
  );
}
