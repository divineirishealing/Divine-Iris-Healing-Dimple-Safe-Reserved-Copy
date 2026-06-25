import React from 'react';
import FaithfulDocumentParagraphs from './FaithfulDocumentParagraphs';
import { CONTAINER, NARROW, SECTION_PY } from '../lib/designTokens';

/**
 * Flat Word-faithful layout — no Welcome bands, gold titles, or alternating section chrome.
 */
export default function ProgramDocumentMirror({ body, accent }) {
  if (!body?.trim()) return null;

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
