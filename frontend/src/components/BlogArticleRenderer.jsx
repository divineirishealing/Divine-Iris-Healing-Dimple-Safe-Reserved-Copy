import React, { useMemo } from 'react';
import { enhanceBlogDocxHtml, BLOG_PURPLE } from '../lib/enhanceBlogDocxHtml';

/**
 * Journal article layout — structured docx content with site typography and illustration panels.
 */
export default function BlogArticleRenderer({ html, title, continuation = false }) {
  const enhanced = useMemo(
    () => enhanceBlogDocxHtml(html, { title }),
    [html, title],
  );
  if (!enhanced) return null;

  return (
    <section
      data-testid={continuation ? 'blog-article-continued' : 'blog-article-body'}
      className={`bg-white ${continuation ? 'pb-14 md:pb-20' : 'pb-14 md:pb-20 pt-2'}`}
    >
      <div className="blog-article-column mx-auto w-full max-w-[720px] px-6 md:px-10">
        <div
          className="docx-html-shell docx-html-blog"
          style={{
            wordBreak: 'break-word',
            '--blog-purple': BLOG_PURPLE,
            '--blog-body': '#555555',
          }}
          dangerouslySetInnerHTML={{ __html: enhanced }}
        />
      </div>
    </section>
  );
}
