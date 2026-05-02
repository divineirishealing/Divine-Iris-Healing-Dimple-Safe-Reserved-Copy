/* =====================================================
   DIVINE IRIS — Global Design Tokens
   Fonts/colors/sizes follow CSS variables from SiteSettings (Global Styles).
   Variables are set on document.documentElement in SiteSettingsContext.
   ===================================================== */

/* Section headings — uses admin "Heading font" + "Heading color" + root rem scale */
export const HEADING = {
  fontFamily: 'var(--heading-font, "Cinzel", Georgia, serif)',
  fontWeight: 700,
  color: 'var(--heading-color, #1a1a1a)',
};

/* Subtitles — body font + body color (muted via opacity in components when needed) */
export const SUBTITLE = {
  fontFamily: 'var(--body-font, "Lato", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
  fontWeight: 300,
  color: 'var(--body-color, #999999)',
  fontSize: '0.85rem',
};

/* Body copy — admin "Body font", "Body color", sizes scale with html font-size */
export const BODY = {
  fontFamily: 'var(--body-font, "Lato", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
  fontWeight: 400,
  color: 'var(--body-color, #555555)',
  fontSize: '0.9rem',
  lineHeight: '1.85',
};

/* Gold accent */
export const GOLD = '#D4AF37';
export const GOLD_DARK = '#b8962e';

/* Label (uppercase tracking) */
export const LABEL = {
  fontFamily: 'var(--body-font, "Lato", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
  fontWeight: 600,
  fontSize: '0.6rem',
  letterSpacing: '0.3em',
  textTransform: 'uppercase',
  color: GOLD,
};

/* Page container max-width + padding */
export const CONTAINER = 'container mx-auto px-6 md:px-8 lg:px-12';
export const NARROW = 'max-w-4xl mx-auto';
export const WIDE = 'max-w-5xl mx-auto';

/* Section spacing */
export const SECTION_PY = 'py-12';


/** Apply section config style overrides */
export const applySectionStyle = (styleObj, defaults = {}) => {
  if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
  return {
    ...defaults,
    ...(styleObj.font_family && { fontFamily: styleObj.font_family }),
    ...(styleObj.font_size && { fontSize: styleObj.font_size }),
    ...(styleObj.font_color && { color: styleObj.font_color }),
    ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }),
    ...(styleObj.font_style && { fontStyle: styleObj.font_style }),
  };
};
