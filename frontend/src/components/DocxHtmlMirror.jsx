import React from 'react';

/**
 * Word document mirror — landing (program pages) or article (blog journal).
 */
export default function DocxHtmlMirror({
  html,
  accent = '#C9962A',
  continuation = false,
  align,
  variant = 'landing',
}) {
  if (!html?.trim()) return null;

  const isArticle = variant === 'article';
  const resolvedAlign = align ?? (isArticle ? 'left' : 'center');
  const pageClass = resolvedAlign === 'left' ? 'mx-0' : 'mx-auto';
  const shellClass = isArticle ? 'docx-html-shell docx-html-article' : 'docx-html-shell';

  return (
    <section
      data-testid={continuation ? 'docx-html-mirror-continued' : 'docx-html-mirror'}
      className={`bg-white ${continuation ? 'pb-10 md:pb-14' : isArticle ? 'pb-12 md:pb-16' : 'py-10 md:py-14'}`}
    >
      <div
        className={`docx-page ${pageClass} w-full max-w-[816px] px-6 md:px-[72px]`}
        style={{ boxSizing: 'border-box' }}
      >
        <div
          className={shellClass}
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
