import React from 'react';
import DocxHtmlMirror from './DocxHtmlMirror';
import FaithfulDocumentParagraphs from './FaithfulDocumentParagraphs';
import { isDocxHtmlBody, extractDocxHtml } from '../lib/docxHtml';
import { CONTAINER, NARROW, SECTION_PY } from '../lib/designTokens';

/**
 * Program landing content — exact Word layout between hero and Experience sections.
 */
export default function ProgramDocumentMirror({ body, accent, continuation = false }) {
  if (!body?.trim()) return null;

  if (isDocxHtmlBody(body)) {
    return <DocxHtmlMirror html={extractDocxHtml(body)} accent={accent || '#C9962A'} continuation={continuation} />;
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
