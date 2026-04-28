import React, { useState, useCallback } from 'react';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { resolveImageUrl } from '../../lib/imageUtils';

const FALLBACK_VIDEO = `${process.env.PUBLIC_URL || ''}/dashboard-healing-sanctuary.mp4`;
const POSTER = `${process.env.PUBLIC_URL || ''}/dashboard-healing-sanctuary.png`;

/** Rich base when video is still loading or unavailable (avoids blank white). */
const SANCTUARY_BASE_BG = {
  background: `
    radial-gradient(ellipse 110% 90% at 10% 15%, rgba(192, 132, 252, 0.45) 0%, transparent 45%),
    radial-gradient(ellipse 90% 70% at 95% 85%, rgba(167, 139, 250, 0.38) 0%, transparent 52%),
    linear-gradient(165deg, #312e81 0%, #5b21b6 38%, #7c3aed 62%, #c4b5fd 92%, #ede9fe 100%)
  `,
};

/**
 * Full-bleed Sacred Home backdrop: admin-uploaded loop if set, else bundled MP4.
 * Falls back to poster image then gradient-only if media fails (no empty white viewport).
 */
export function PhotoHealingSanctuaryBackground() {
  const { settings } = useSiteSettings();
  const raw = settings?.dashboard_sanctuary_video_url;
  const resolved = raw ? resolveImageUrl(raw) : '';
  const src = resolved || FALLBACK_VIDEO;
  const [useImageFallback, setUseImageFallback] = useState(false);

  const onVideoErr = useCallback(() => setUseImageFallback(true), []);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={SANCTUARY_BASE_BG}
      data-testid="dashboard-healing-sanctuary-bg"
      data-healing-variant={useImageFallback ? 'poster-image' : 'video'}
      aria-hidden
    >
      {!useImageFallback ? (
        <video
          src={src}
          poster={POSTER}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover object-center select-none"
          onError={onVideoErr}
        />
      ) : (
        <img
          src={POSTER}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center select-none pointer-events-none"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
  );
}

export default PhotoHealingSanctuaryBackground;
