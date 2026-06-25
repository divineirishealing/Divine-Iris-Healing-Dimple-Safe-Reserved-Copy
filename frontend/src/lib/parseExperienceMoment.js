/**
 * Shape Experience (dark) section content: quote + life-changing message (no bullet lists).
 */
const DEFAULT_QUOTE =
  'When the body finally releases what it has held for years, healing is not a hope — it becomes a lived reality.';
const DEFAULT_HEADING = 'How It Can Be Life-Changing';
const DEFAULT_MESSAGE =
  'This work reaches beyond symptom relief. Clients often describe feeling lighter in their body, clearer in their mind, and more at home in themselves — as if years of tension and old survival patterns are finally allowed to leave.';

function stripMarkup(s) {
  return (s || '').replace(/\*+/g, '').trim();
}

function isBulletLine(line) {
  return /^[✦•●\-–—]/.test(String(line || '').trim());
}

/** Remove bullet lines and markdown bullets from experience copy. */
export function stripBulletsFromText(text) {
  if (!text) return '';
  return text
    .split('\n')
    .filter((line) => !isBulletLine(line))
    .join('\n')
    .replace(/^\s*✦\s+/gm, '')
    .trim();
}

/**
 * Split body into quote (first paragraph) and message (rest), ignoring bullets.
 */
export function splitExperienceBody(body) {
  const cleaned = stripBulletsFromText(body);
  if (!cleaned) return { quote: '', message: '' };

  const parts = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) {
    return { quote: stripMarkup(parts[0]), message: '' };
  }
  return {
    quote: stripMarkup(parts[0]),
    message: parts.slice(1).map(stripMarkup).join('\n\n'),
  };
}

export function parseExperienceMoment(section, { fallbackQuote, fallbackMessage } = {}) {
  const titleQuote = stripMarkup(section?.title);
  const heading = stripMarkup(section?.subtitle) || DEFAULT_HEADING;
  const cleanedBody = stripBulletsFromText(section?.body || '');
  const fromBody = splitExperienceBody(cleanedBody);

  if (titleQuote) {
    return {
      quote: titleQuote,
      heading,
      message: cleanedBody || fallbackMessage || DEFAULT_MESSAGE,
    };
  }

  if (fromBody.quote && fromBody.message) {
    return {
      quote: fromBody.quote,
      heading,
      message: fromBody.message,
    };
  }

  if (fromBody.quote && fromBody.quote.length > 120) {
    return {
      quote: fromBody.quote,
      heading,
      message: fallbackMessage || DEFAULT_MESSAGE,
    };
  }

  return {
    quote: fallbackQuote || DEFAULT_QUOTE,
    heading,
    message: cleanedBody || fromBody.quote || fallbackMessage || DEFAULT_MESSAGE,
  };
}

export { DEFAULT_HEADING, DEFAULT_QUOTE, DEFAULT_MESSAGE };
