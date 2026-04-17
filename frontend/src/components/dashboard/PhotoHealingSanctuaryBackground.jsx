import React from 'react';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { resolveImageUrl } from '../../lib/imageUtils';

const FALLBACK_VIDEO = `${process.env.PUBLIC_URL || ''}/dashboard-healing-sanctuary.mp4`;
const POSTER = `${process.env.PUBLIC_URL || ''}/dashboard-healing-sanctuary.png`;

/**
 * Full-bleed Sacred Home backdrop: admin-uploaded loop if set, else bundled MP4.
 * Video is shown as authored (no particles, steam, or breeze layers).
 */
export function PhotoHealingSanctuaryBackground() {
  const { settings } = useSiteSettings();
  const raw = settings?.dashboard_sanctuary_video_url;
  const resolved = raw ? resolveImageUrl(raw) : '';
  const src = resolved || FALLBACK_VIDEO;

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#e8dff7]"
      data-testid="dashboard-healing-sanctuary-bg"
      data-healing-variant="video"
      aria-hidden
    >
      <video
        src={src}
        poster={POSTER}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover object-center select-none"
      />
    </div>
  );
}

export default PhotoHealingSanctuaryBackground;
