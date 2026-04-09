/** Default copy for Transformations page section headers (below hero, “All” tab). Stored in page_heroes.transformations. */
export const TRANSFORMATIONS_SECTION_DEFAULTS = {
  stories_kicker: 'Their Words',
  stories_title: 'Healing Stories',
  video_kicker: 'Watch & Feel',
  video_title: 'Video Testimonials',
  gallery_kicker: 'See the Change',
  gallery_title: 'Transformation Gallery',
};

export function resolveTransformationsSection(hero = {}) {
  const h = hero;
  const d = TRANSFORMATIONS_SECTION_DEFAULTS;
  const t = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    stories_kicker: t(h.stories_kicker) || d.stories_kicker,
    stories_title: t(h.stories_title) || d.stories_title,
    video_kicker: t(h.video_kicker) || d.video_kicker,
    video_title: t(h.video_title) || d.video_title,
    gallery_kicker: t(h.gallery_kicker) || d.gallery_kicker,
    gallery_title: t(h.gallery_title) || d.gallery_title,
  };
}
