import React from 'react';
import { PhotoHealingSanctuaryBackground } from './PhotoHealingSanctuaryBackground';
import { IllustratedHealingSanctuaryBackground } from './IllustratedHealingSanctuaryBackground';

/**
 * Dashboard “Sacred Home” backdrop.
 * - illustrated (default): full SVG/CSS scene — motion is stem-cluster sway, wind lines, steam.
 * - photo: your PNG + soft feather-mask breeze layers.
 *
 * Override: REACT_APP_HEALING_SANCTUARY_MODE=photo
 */
function healingSanctuaryMode() {
  const v = (process.env.REACT_APP_HEALING_SANCTUARY_MODE || '').toLowerCase().trim();
  if (v === 'photo' || v === 'raster' || v === 'image') return 'photo';
  return 'illustrated';
}

export function DashboardHealingSanctuaryBackground(props) {
  return healingSanctuaryMode() === 'photo' ? (
    <PhotoHealingSanctuaryBackground {...props} />
  ) : (
    <IllustratedHealingSanctuaryBackground {...props} />
  );
}

export default DashboardHealingSanctuaryBackground;
