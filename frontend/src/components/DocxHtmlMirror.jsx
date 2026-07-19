import React from 'react';

/**
 * Word document mirror — inline Word typography preserved from import.
 * Program pages use landing wrappers in HTML; blog articles use faithful article HTML.
 */
export default function DocxHtmlMirror({ html, accent = '#C9962A', continuation = false }) {
  if (!html?.trim()) return null;

  return (
    <section
      data-testid={continuation ? 'docx-html-mirror-continued' : 'docx-html-mirror'}
      className={`bg-white ${continuation ? 'pb-10 md:pb-14' : 'py-8 md:py-10'}`}
    >
      <div
        className="docx-page mx-auto w-full max-w-[816px] px-6 md:px-[72px]"
        style={{ boxSizing: 'border-box' }}
      >
        <div
          className="docx-html-shell"
          style={{
            wordBreak: 'break-word',
            '--docx-gold': accent,
            '--docx-purple': '#534AB7',
            '--docx-navy': '#2A1F5E',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  );
}
