/**
 * Normalize imported program document text for DocumentBody rendering.
 * Promotes likely headlines to **bold** and standardises bullets — safe for legacy drafts too.
 */

const MAJOR_HEADLINE =
  /^(what|who|why|how|when|where|program|your|the|module|section|chapter)\s/i;
const NUMBERED = /^\d+\.\s+/;

function stripMarkup(s) {
  return (s || '').replace(/\*+/g, '').trim();
}

export function looksLikeMajorHeadline(text) {
  const t = stripMarkup(text);
  if (!t || t.length > 100) return false;
  if (/^\*\*.+\*\*$/.test((text || '').trim())) return true;
  if (t.endsWith('?')) return true;
  if (MAJOR_HEADLINE.test(t) && t.length < 85) return true;
  if (NUMBERED.test(t)) return false;
  if (t.length < 60 && !/[.!,;:]$/.test(t)) {
    const words = t.split(/\s+/);
    if (words.length <= 10 && /^[A-Z0-9]/.test(t)) return true;
  }
  return false;
}

export function looksLikeSubheadline(text) {
  const t = stripMarkup(text);
  if (!t || t.length > 130) return false;
  if (/^\*\*.+\*\*$/.test((text || '').trim())) return true;
  if (NUMBERED.test(t)) return true;
  if (/^(in|for|options|format|who can|ideal for|benefits|features)\s/i.test(t) && t.length < 90) return true;
  if (t.length < 75 && !t.endsWith('.') && /^[A-Z]/.test(t) && t.split(/\s+/).length <= 8) return true;
  return false;
}

export function organizeDocumentBody(body) {
  if (!body) return '';
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out = [];

  for (const para of paragraphs) {
    if (/^\*\*.+\*\*$/s.test(para)) {
      out.push(para);
      continue;
    }

    const lines = para.split('\n');
    if (lines.length === 1) {
      const line = lines[0].trim();
      if (looksLikeMajorHeadline(line)) {
        out.push(`**${stripMarkup(line)}**`);
        continue;
      }
      if (looksLikeSubheadline(line)) {
        out.push(`**${stripMarkup(line)}**`);
        continue;
      }
    }

    const promoted = lines.map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (/^\*\*/.test(t)) return t;
      if (/^[✦•●\-–—]/.test(t)) {
        return t.startsWith('✦') ? t : `✦ ${t.replace(/^[•●\-–—]\s*/, '')}`;
      }
      if (looksLikeMajorHeadline(t) || looksLikeSubheadline(t)) {
        return `**${stripMarkup(t)}**`;
      }
      return line;
    });

    out.push(promoted.join('\n'));
  }

  return out.join('\n\n');
}
