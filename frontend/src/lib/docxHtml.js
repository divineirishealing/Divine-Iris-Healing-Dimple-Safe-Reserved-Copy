/** Stored docx HTML bodies begin with this marker from backend import. */
export const DOCX_HTML_MARKER = '@@DOCX_HTML@@\n';

export function isDocxHtmlBody(body) {
  return String(body || '').startsWith(DOCX_HTML_MARKER);
}

export function extractDocxHtml(body) {
  if (!isDocxHtmlBody(body)) return String(body || '');
  return String(body).slice(DOCX_HTML_MARKER.length);
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
