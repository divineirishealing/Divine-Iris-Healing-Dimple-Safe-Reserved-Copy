import React from 'react';

/**
 * Word document body — inline typography from import; hero and Experience stay on ProgramDetailPage.
 */
export default function DocxHtmlMirror({ html, continuation = false }) {
  if (!html?.trim()) return null;

  return (
    <section
      data-testid={continuation ? 'docx-html-mirror-continued' : 'docx-html-mirror'}
      className={`bg-white ${continuation ? 'pb-10 md:pb-14' : 'py-10 md:py-14'}`}
    >
      <div
        className="docx-page mx-auto w-full max-w-[816px] px-6 md:px-[72px]"
        style={{ boxSizing: 'border-box' }}
      >
        <div
          className="docx-html-shell"
          style={{ wordBreak: 'break-word' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  );
}
