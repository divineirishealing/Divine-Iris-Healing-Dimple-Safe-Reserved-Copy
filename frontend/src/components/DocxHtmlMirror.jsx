import React from 'react';

/**
 * Word document landing — full doc typography plus highlighted section structure.
 */
export default function DocxHtmlMirror({ html, accent = '#C9962A', continuation = false, align = 'center' }) {
  if (!html?.trim()) return null;

  const pageClass = align === 'left' ? 'mx-0' : 'mx-auto';

  return (
    <section
      data-testid={continuation ? 'docx-html-mirror-continued' : 'docx-html-mirror'}
      className={`bg-white ${continuation ? 'pb-10 md:pb-14' : 'py-10 md:py-14'}`}
    >
      <div
        className={`docx-page ${pageClass} w-full max-w-[816px] px-6 md:px-[72px]`}
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
