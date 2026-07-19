import { resolveImageUrl } from './imageUtils';

const BLOG_PURPLE = '#534AB7';

/** Strip inline typography on headings so journal CSS controls look. */
function normalizeHeadingStyles(html) {
  return html.replace(/(<h([123])\b[^>]*>)([\s\S]*?)(<\/h\2>)/gi, (_, open, _level, inner, close) => {
    const cleanedInner = inner.replace(/\sstyle="[^"]*"/gi, '');
    const cleanOpen = open.replace(/\sstyle="[^"]*"/gi, '');
    return `${cleanOpen}${cleanedInner}${close}`;
  });
}

/** First bold paragraph that matches the post title → h1. */
function promoteTitleParagraph(html, title) {
  if (!title || /<h1\b/i.test(html)) return html;
  const normalized = title.trim().toLowerCase().replace(/\s+/g, ' ');
  return html.replace(
    /^\s*(<p\b[^>]*class="[^"]*docx-p[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/i,
    (match, open, inner, close) => {
      const text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!text || (text !== normalized && !text.includes(normalized) && !normalized.includes(text))) {
        return match;
      }
      const cleaned = inner.replace(/\sstyle="[^"]*"/gi, '');
      return `<h1 class="docx-h1 blog-article-title">${cleaned}</h1>`;
    },
  );
}

/**
 * Prepare imported Word HTML for the blog journal layout (hosted images, lead header).
 */
export function enhanceBlogDocxHtml(html, { title } = {}) {
  let s = String(html || '').trim();
  if (!s) return '';

  s = s.replace(
    /(<img\b[^>]*\ssrc=")(\/api\/[^"]+)(")/gi,
    (_, pre, src, post) => `${pre}${resolveImageUrl(src)}${post}`,
  );

  s = promoteTitleParagraph(s, title);
  s = normalizeHeadingStyles(s);
  s = s.replace(/class="docx-figure"/g, 'class="docx-figure blog-article-figure"');
  s = s.replace(/class="docx-h1"/g, 'class="docx-h1 blog-article-title"');
  s = s.replace(/class="docx-h2"/g, 'class="docx-h2 blog-article-section-title"');
  s = s.replace(/class="docx-h3"/g, 'class="docx-h3 blog-article-section-title"');

  if (!s.includes('blog-article-lead')) {
    s = s.replace(
      /(<h1\b[^>]*class="[^"]*docx-h1[^"]*"[^>]*>[\s\S]*?<\/h1>\s*(?:<div[^>]*class="[^"]*docx-figure[^"]*"[^>]*>[\s\S]*?<\/div>\s*)?)/i,
      '<header class="blog-article-lead">$1</header>',
    );
  }

  s = s.replace(
    /(<p\b[^>]*class="[^"]*docx-p[^"]*"[^>]*style="[^"]*italic[^"]*"[^>]*>[\s\S]*?<\/p>)/gi,
    (match) => {
      if (match.includes('blog-article-pull')) return match;
      return match.replace('class="docx-p"', 'class="docx-p blog-article-pull"');
    },
  );

  return s;
}

export { BLOG_PURPLE };
