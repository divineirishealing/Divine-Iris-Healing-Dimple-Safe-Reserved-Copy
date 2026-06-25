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

/**
 * True when the whole paragraph is bold from Word/import (**…**).
 */
export function isImportedBoldLine(text) {
  return /^\*\*.+\*\*$/s.test(String(text || '').trim());
}
