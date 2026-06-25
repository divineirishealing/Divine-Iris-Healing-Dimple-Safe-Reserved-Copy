/**
 * Shape Experience (dark) section — only explicit admin/import fields; no invented copy.
 */
function stripMarkup(s) {
  return (s || '').replace(/\*+/g, '').trim();
}

function isBulletLine(line) {
  return /^[✦•●\-–—]/.test(String(line || '').trim());
}

export function stripBulletsFromText(text) {
  if (!text) return '';
  return text
    .split('\n')
    .filter((line) => !isBulletLine(line))
    .join('\n')
    .replace(/^\s*✦\s+/gm, '')
    .trim();
}

export function parseExperienceMoment(section) {
  const quote = stripMarkup(section?.title);
  const heading = stripMarkup(section?.subtitle);
  const message = stripBulletsFromText(section?.body || '');

  return { quote, heading, message };
}

export function experienceMomentHasContent(section, portraitUrl) {
  const { quote, heading, message } = parseExperienceMoment(section || {});
  return !!(portraitUrl || quote || heading || message);
}
