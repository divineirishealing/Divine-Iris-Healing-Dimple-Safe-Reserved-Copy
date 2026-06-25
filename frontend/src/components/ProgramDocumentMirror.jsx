import React from 'react';
import DocxHtmlMirror from './DocxHtmlMirror';
import FaithfulDocumentParagraphs from './FaithfulDocumentParagraphs';
import { isDocxHtmlBody, extractDocxHtml } from '../lib/docxHtml';
import { CONTAINER, NARROW, SECTION_PY } from '../lib/designTokens';

/**
 * Exact Word mirror — styled HTML when imported from .docx, markdown fallback otherwise.
 */
export default function ProgramDocumentMirror({ body, accent }) {
  if (!body?.trim()) return null;

  if (isDocxHtmlBody(body)) {
    return <DocxHtmlMirror html={extractDocxHtml(body)} />;
  }

  return (
    <section data-testid="program-document-mirror" className={`${SECTION_PY} bg-white`}>
      <div className={CONTAINER}>
        <div className={`${NARROW} max-w-[42rem] mx-auto`}>
          <FaithfulDocumentParagraphs body={body} accent={accent} variant="mirror" />
        </div>
      </div>
    </section>
  );
}
