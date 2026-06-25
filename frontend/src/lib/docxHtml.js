/** Stored docx HTML bodies begin with this marker from backend import. */
export const DOCX_HTML_MARKER = '@@DOCX_HTML@@\n';

export function isDocxHtmlBody(body, subtitle) {
  const s = String(body || '').trim();
  if (!s) return false;
  if (s.startsWith(DOCX_HTML_MARKER)) return true;
  if (subtitle === 'docx-html' && s.startsWith('<')) return true;
  if (s.includes('docx-cover-stage') || s.includes('docx-section-major')) return true;
  if (/<article[^>]*docx-mirror/i.test(s)) return true;
  if (/class="docx-h[123]"/i.test(s) || /class="docx-p"/i.test(s)) return true;
  return false;
}

export function extractDocxHtml(body) {
  const s = String(body || '');
  if (s.startsWith(DOCX_HTML_MARKER)) return s.slice(DOCX_HTML_MARKER.length).trim();
  return s.trim();
}

/** Ensure split or partial HTML fragments still get mirror wrapper + styles. */
export function wrapDocxHtmlFragment(html) {
  const s = String(html || '').trim();
  if (!s) return '';

  const hasOpeningArticle = /^<article[^>]*docx-mirror/i.test(s);
  const hasClosingArticle = /<\/article>\s*$/i.test(s);

  if (hasOpeningArticle) {
    return hasClosingArticle ? s : `${s}</article>`;
  }

  const inner = s
    .replace(/^<article[^>]*>/i, '')
    .replace(/<\/article>\s*$/i, '')
    .trim();

  return (
    '<article class="docx-mirror docx-mirror-landing" '
    + 'style="font-family:Georgia,\'Times New Roman\',Times,serif;'
    + 'font-size:11pt;color:#1a1a2e;line-height:1.45;width:100%;">'
    + `${inner}</article>`
  );
}

/**
 * Split styled HTML at the Nth <h1> for the Experience block.
 */
export function splitDocxHtmlForExperience(html, sectionCountBefore = 1) {
  const source = String(html || '').trim();
  if (!source) return { before: '', after: '' };

  const splitNeedle = '@@DOCX_EXPERIENCE_SPLIT@@';
  let h1Count = 0;
  const marked = source.replace(/<h1\b[^>]*>/gi, (match) => {
    h1Count += 1;
    if (h1Count === sectionCountBefore + 1) {
      return `${splitNeedle}${match}`;
    }
    return match;
  });

  if (!marked.includes(splitNeedle)) {
    return { before: source, after: '' };
  }

  const [before, after] = marked.split(splitNeedle);
  return { before, after };
}
