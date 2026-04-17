import React from 'react';
import { PhotoHealingSanctuaryBackground } from './PhotoHealingSanctuaryBackground';
import { IllustratedHealingSanctuaryBackground } from './IllustratedHealingSanctuaryBackground';

/**
 * Dashboard “Sacred Home” backdrop.
 * - photo (default): exact artwork from /dashboard-healing-sanctuary.png + soft breeze motion.
 * - illustrated: lightweight SVG stand-in — set REACT_APP_HEALING_SANCTUARY_MODE=illustrated
 */
function healingSanctuaryMode() {
  const v = (process.env.REACT_APP_HEALING_SANCTUARY_MODE || '').toLowerCase().trim();
  if (v === 'illustrated' || v === 'svg' || v === 'code') return 'illustrated';
  return 'photo';
}

export function DashboardHealingSanctuaryBackground(props) {
  return healingSanctuaryMode() === 'photo' ? (
    <PhotoHealingSanctuaryBackground {...props} />
  ) : (
    <IllustratedHealingSanctuaryBackground {...props} />
  );
}

export default DashboardHealingSanctuaryBackground;
