import React from 'react';
import FaithfulDocumentParagraphs from './FaithfulDocumentParagraphs';
import { CONTAINER, NARROW, SECTION_PY } from '../lib/designTokens';

/** Flat single-band fallback (legacy). Prefer ProgramDocumentLanding for program pages. */
export default function ProgramDocumentBody({ body, accent }) {
  if (!body?.trim()) return null;

  return (
    <section data-testid="program-document-body" className={`${SECTION_PY} bg-white`}>
      <div className={CONTAINER}>
        <div className={NARROW}>
          <FaithfulDocumentParagraphs body={body} accent={accent} subheadStyle="accent" />
        </div>
      </div>
    </section>
  );
}
