import React from 'react';
import { CONTAINER, SECTION_PY } from '../lib/designTokens';

/**
 * Render backend-generated Word HTML with inline typography preserved.
 */
export default function DocxHtmlMirror({ html }) {
  if (!html?.trim()) return null;

  return (
    <section data-testid="docx-html-mirror" className={`${SECTION_PY} bg-white`}>
      <div className={CONTAINER}>
        <div
          className="docx-html-shell mx-auto w-full max-w-[44rem] px-1 sm:px-0"
          style={{ wordBreak: 'break-word' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  );
}
