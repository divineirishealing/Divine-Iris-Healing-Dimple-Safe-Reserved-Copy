/** Defaults for written-story quote text on /transformations only (grid + modal). */
export const WRITTEN_QUOTE_STYLE_DEFAULTS = {
  fontFamily: "'Lato', sans-serif",
  fontSize: 'clamp(1.05rem, 2.15vw, 1.2rem)',
  lineHeight: 1.88,
  color: '#1e0a4e',
  fontStyle: 'italic',
  fontWeight: 500,
};

/**
 * Merge admin `page_heroes.transformations.written_story_quote_style` (snake_case)
 * into a React `style` object (camelCase).
 */
export function applyWrittenQuoteStyle(heroStyle, defaults = WRITTEN_QUOTE_STYLE_DEFAULTS) {
  const s = heroStyle && typeof heroStyle === 'object' ? heroStyle : {};
  if (!Object.keys(s).length) return { ...defaults };

  const out = { ...defaults };
  if (s.font_family) out.fontFamily = s.font_family;
  if (s.font_size) out.fontSize = s.font_size;
  if (s.font_color) out.color = s.font_color;
  if (s.font_weight) {
    if (s.font_weight === 'bold') out.fontWeight = 700;
    else if (s.font_weight === 'normal' || s.font_weight === '400') out.fontWeight = 400;
    else {
      const n = Number(s.font_weight);
      out.fontWeight = Number.isFinite(n) ? n : s.font_weight;
    }
  }
  if (s.font_style) out.fontStyle = s.font_style;
  if (s.line_height !== undefined && s.line_height !== null && String(s.line_height).trim() !== '') {
    const n = parseFloat(String(s.line_height), 10);
    out.lineHeight = Number.isFinite(n) ? n : s.line_height;
  }
  if (s.letter_spacing !== undefined && s.letter_spacing !== '') out.letterSpacing = s.letter_spacing;
  if (s.text_align) out.textAlign = s.text_align;
  return out;
}
