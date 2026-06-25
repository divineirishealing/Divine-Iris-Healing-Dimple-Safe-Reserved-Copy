/**
 * Faithful document prep — preserve import markup; only normalise bullet characters.
 */
export function prepareFaithfulDocumentBody(body) {
  if (!body) return '';
  return body
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (/^[•●○▪\-–—]\s/.test(t) && !t.startsWith('✦')) {
        return `✦ ${t.replace(/^[•●○▪\-–—]\s*/, '')}`;
      }
      return line;
    })
    .join('\n')
    .trim();
}

/** Parse Word alignment prefix from import (>>c center, >>j justify, >>r right). */
export function stripAlignPrefix(line) {
  const raw = String(line || '').trim();
  const m = raw.match(/^>>([cjr])\s+(.*)$/s);
  if (!m) return { align: null, text: raw };
  const map = { c: 'center', j: 'justify', r: 'right' };
  return { align: map[m[1]] || null, text: m[2].trim() };
}

export function textAlignStyle(align) {
  if (align === 'center') return 'center';
  if (align === 'justify') return 'justify';
  if (align === 'right') return 'right';
  return 'left';
}

/** Parse `#` / `##` / `###` prefix from import (Word heading levels). */
export function parseHeadingPrefix(line) {
  const m = String(line || '').trim().match(/^(#{1,4})\s+(.*)$/s);
  if (!m) return null;
  return { level: m[1].length, content: m[2].trim() };
}

export function isImportedBoldLine(text) {
  return /^\*\*.+\*\*$/s.test(String(text || '').trim());
}

export function headingStyleForLevel(level, HEADING) {
  if (level === 1) {
    return {
      ...HEADING,
      color: '#1a1a1a',
      fontSize: '1.45rem',
      letterSpacing: '0.03em',
      lineHeight: 1.35,
    };
  }
  if (level === 2) {
    return {
      ...HEADING,
      color: '#1a1a1a',
      fontSize: '1.15rem',
      letterSpacing: '0.02em',
      lineHeight: 1.4,
    };
  }
  return {
    ...HEADING,
    color: '#1a1a1a',
    fontSize: '1.05rem',
    letterSpacing: '0.02em',
    lineHeight: 1.4,
  };
}
