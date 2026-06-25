import {
  DOCX_HTML_MARKER,
  isDocxHtmlBody,
  extractDocxHtml,
  wrapDocxHtmlFragment,
} from '../docxHtml';

describe('docxHtml', () => {
  it('detects marker-prefixed bodies', () => {
    expect(isDocxHtmlBody(`${DOCX_HTML_MARKER}<p>x</p>`)).toBe(true);
  });

  it('detects HTML without marker via structure classes', () => {
    const html = '<div class="docx-cover-stage"><h1 class="docx-h1">Title</h1></div>';
    expect(isDocxHtmlBody(html)).toBe(true);
    expect(extractDocxHtml(html)).toBe(html);
  });

  it('detects via docx-html subtitle', () => {
    expect(isDocxHtmlBody('<article><p class="docx-p">Hi</p></article>', 'docx-html')).toBe(true);
  });

  it('wraps split fragments in mirror article', () => {
    const fragment = '<h1 class="docx-h1">Second</h1><p class="docx-p">Body</p>';
    const wrapped = wrapDocxHtmlFragment(fragment);
    expect(wrapped).toMatch(/^<article class="docx-mirror/);
    expect(wrapped).toMatch(/<\/article>$/);
    expect(wrapped).toContain('Second');
  });

  it('closes partial article fragments after experience split', () => {
    const partial = '<article class="docx-mirror"><h1>First</h1><p>A</p>';
    const wrapped = wrapDocxHtmlFragment(partial);
    expect(wrapped).toMatch(/<\/article>$/);
  });
});
