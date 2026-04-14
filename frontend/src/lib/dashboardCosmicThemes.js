/**
 * Maps dashboard routes to cosmic visual themes (Milky Way, nebulae, constellations, etc.)
 * and human-readable mood copy for the shell.
 */

export const COSMIC_CANVAS_DEFAULT = {
  starDelta: 0,
  maxD: 118,
  lineBlue: [160, 190, 255],
  lineGoldMult: 0.45,
  warmStarBoost: 0,
  lineAlphaMult: 1,
};

/** @type {Record<string, { label: string; sub?: string; milkyOpacity: string; milkyGradient: string; nebula1: string; nebula2: string; baseBg: string; planetA: Record<string, string | number>; planetB: Record<string, string | number>; planetC: Record<string, string | number>; canvas: Partial<typeof COSMIC_CANVAS_DEFAULT> }>} */
export const DASHBOARD_COSMIC_THEMES = {
  milky_way: {
    label: 'Milky Way',
    sub: 'Overview nexus',
    milkyOpacity: '0.5',
    milkyGradient: `linear-gradient(90deg,
      transparent 0%,
      rgba(167, 139, 250, 0.1) 18%,
      rgba(216, 180, 254, 0.18) 40%,
      rgba(255, 248, 252, 0.08) 50%,
      rgba(196, 181, 253, 0.14) 60%,
      rgba(124, 58, 237, 0.08) 82%,
      transparent 100%)`,
    nebula1:
      'radial-gradient(ellipse at 40% 40%, rgba(196, 181, 253, 0.35) 0%, rgba(109, 40, 217, 0.12) 48%, transparent 72%)',
    nebula2:
      'radial-gradient(circle at 32% 48%, rgba(212, 175, 55, 0.14) 0%, rgba(167, 139, 250, 0.18) 38%, transparent 68%)',
    baseBg: `
            radial-gradient(ellipse 120% 80% at 50% -8%, rgba(76, 29, 149, 0.35) 0%, transparent 52%),
            radial-gradient(ellipse 90% 58% at 100% 28%, rgba(91, 33, 182, 0.22) 0%, transparent 50%),
            radial-gradient(ellipse 72% 52% at 0% 72%, rgba(139, 92, 246, 0.18) 0%, transparent 46%),
            linear-gradient(165deg, #0d0618 0%, #140a28 22%, #1a0a3e 48%, #10081f 72%, #0a0514 100%)`,
    planetA: {
      background:
        'radial-gradient(circle at 32% 28%, rgba(200, 180, 255, 0.5), rgba(80, 50, 140, 0.2) 38%, rgba(20, 10, 40, 0.05) 62%, transparent 72%)',
      boxShadow: '0 0 100px rgba(100, 70, 180, 0.15), inset -20px -20px 50px rgba(0,0,0,0.25)',
    },
    planetB: {
      background:
        'radial-gradient(circle at 40% 35%, rgba(255, 220, 180, 0.35), rgba(180, 120, 60, 0.12) 50%, transparent 70%)',
      boxShadow: '0 0 60px rgba(212, 175, 55, 0.12)',
    },
    planetC: {
      background:
        'radial-gradient(circle at 50% 40%, rgba(100, 200, 255, 0.25), rgba(30, 60, 120, 0.1) 55%, transparent 72%)',
      boxShadow: '0 0 40px rgba(80, 160, 255, 0.1)',
    },
    canvas: { ...COSMIC_CANVAS_DEFAULT },
  },

  nebula_garden: {
    label: 'Orion nebula',
    sub: 'Soul Garden',
    milkyOpacity: '0.28',
    milkyGradient: `linear-gradient(95deg,
      transparent 0%,
      rgba(34, 120, 90, 0.08) 25%,
      rgba(120, 200, 160, 0.12) 50%,
      rgba(80, 60, 140, 0.08) 75%,
      transparent 100%)`,
    nebula1:
      'radial-gradient(ellipse at 45% 45%, rgba(60, 180, 130, 0.2) 0%, rgba(40, 80, 120, 0.1) 50%, transparent 72%)',
    nebula2:
      'radial-gradient(circle at 75% 30%, rgba(139, 92, 246, 0.14) 0%, rgba(34, 100, 80, 0.1) 45%, transparent 70%)',
    baseBg: `
            radial-gradient(ellipse 100% 70% at 20% 20%, rgba(30, 90, 70, 0.25) 0%, transparent 50%),
            radial-gradient(ellipse 80% 60% at 90% 60%, rgba(60, 40, 100, 0.2) 0%, transparent 50%),
            linear-gradient(165deg, #030812 0%, #061a14 35%, #0a1028 70%, #040810 100%)`,
    planetA: {
      background:
        'radial-gradient(circle at 35% 30%, rgba(130, 240, 200, 0.35), rgba(30, 100, 80, 0.18) 45%, transparent 70%)',
      boxShadow: '0 0 90px rgba(60, 200, 150, 0.12)',
    },
    planetB: {
      background:
        'radial-gradient(circle at 45% 40%, rgba(180, 255, 220, 0.22), rgba(80, 120, 200, 0.1) 55%, transparent 72%)',
      boxShadow: '0 0 50px rgba(100, 200, 255, 0.1)',
    },
    planetC: {
      background:
        'radial-gradient(circle at 50% 40%, rgba(167, 139, 250, 0.22), rgba(40, 30, 80, 0.12) 55%, transparent 72%)',
      boxShadow: '0 0 45px rgba(139, 92, 246, 0.12)',
    },
    canvas: { starDelta: 12, lineBlue: [140, 220, 200], lineGoldMult: 0.35, warmStarBoost: 0.08 },
  },

  constellation_grid: {
    label: 'Constellation grid',
    sub: 'Schedule & calendar',
    milkyOpacity: '0.32',
    milkyGradient: `linear-gradient(88deg,
      transparent 0%,
      rgba(100, 140, 220, 0.1) 35%,
      rgba(200, 210, 255, 0.14) 50%,
      rgba(80, 100, 180, 0.09) 65%,
      transparent 100%)`,
    nebula1:
      'radial-gradient(ellipse at 50% 35%, rgba(80, 120, 220, 0.18) 0%, rgba(20, 30, 60, 0.08) 50%, transparent 72%)',
    nebula2:
      'radial-gradient(circle at 15% 70%, rgba(212, 175, 55, 0.1) 0%, rgba(60, 80, 160, 0.08) 50%, transparent 68%)',
    baseBg: `
            radial-gradient(ellipse 90% 50% at 50% 0%, rgba(40, 60, 120, 0.4) 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 100% 100%, rgba(30, 40, 90, 0.25) 0%, transparent 50%),
            linear-gradient(165deg, #020618 0%, #0c1228 40%, #080c20 100%)`,
    planetA: {
      background:
        'radial-gradient(circle at 30% 28%, rgba(180, 200, 255, 0.45), rgba(40, 60, 140, 0.2) 42%, transparent 70%)',
      boxShadow: '0 0 85px rgba(100, 140, 255, 0.14)',
    },
    planetB: {
      background:
        'radial-gradient(circle at 40% 38%, rgba(212, 175, 55, 0.28), rgba(80, 60, 120, 0.12) 52%, transparent 72%)',
      boxShadow: '0 0 55px rgba(212, 175, 55, 0.14)',
    },
    planetC: {
      background:
        'radial-gradient(circle at 50% 42%, rgba(120, 180, 255, 0.3), rgba(25, 45, 90, 0.12) 55%, transparent 72%)',
      boxShadow: '0 0 38px rgba(120, 180, 255, 0.12)',
    },
    canvas: { starDelta: 5, maxD: 132, lineBlue: [150, 200, 255], lineGoldMult: 0.55, lineAlphaMult: 1.15 },
  },

  stellar_progress: {
    label: 'Stellar field',
    sub: 'Daily progress',
    milkyOpacity: '0.22',
    milkyGradient: `linear-gradient(100deg,
      transparent 0%,
      rgba(255, 200, 120, 0.06) 40%,
      rgba(255, 240, 200, 0.1) 50%,
      rgba(200, 160, 255, 0.07) 60%,
      transparent 100%)`,
    nebula1:
      'radial-gradient(ellipse at 30% 40%, rgba(255, 190, 120, 0.14) 0%, rgba(100, 60, 140, 0.08) 48%, transparent 72%)',
    nebula2:
      'radial-gradient(circle at 85% 25%, rgba(255, 220, 180, 0.1) 0%, rgba(140, 100, 200, 0.09) 45%, transparent 70%)',
    baseBg: `
            radial-gradient(ellipse 110% 60% at 50% -5%, rgba(80, 50, 120, 0.35) 0%, transparent 52%),
            radial-gradient(ellipse 60% 40% at 0% 80%, rgba(120, 80, 40, 0.15) 0%, transparent 50%),
            linear-gradient(165deg, #0a0612 0%, #1a1020 38%, #0c1022 100%)`,
    planetA: {
      background:
        'radial-gradient(circle at 38% 32%, rgba(255, 210, 150, 0.4), rgba(140, 80, 60, 0.15) 48%, transparent 70%)',
      boxShadow: '0 0 95px rgba(255, 180, 100, 0.12)',
    },
    planetB: {
      background:
        'radial-gradient(circle at 42% 36%, rgba(255, 255, 220, 0.25), rgba(180, 140, 200, 0.1) 52%, transparent 72%)',
      boxShadow: '0 0 48px rgba(255, 230, 180, 0.1)',
    },
    planetC: {
      background:
        'radial-gradient(circle at 48% 40%, rgba(200, 160, 255, 0.28), rgba(60, 40, 100, 0.12) 55%, transparent 72%)',
      boxShadow: '0 0 42px rgba(200, 160, 255, 0.12)',
    },
    canvas: { starDelta: 35, maxD: 108, lineBlue: [255, 210, 180], lineGoldMult: 0.65, warmStarBoost: 0.12 },
  },

  galactic_core: {
    label: 'Galactic core',
    sub: 'Bhaad portal',
    milkyOpacity: '0.5',
    milkyGradient: `linear-gradient(92deg,
      transparent 0%,
      rgba(140, 80, 160, 0.12) 30%,
      rgba(255, 200, 255, 0.16) 50%,
      rgba(212, 175, 55, 0.12) 65%,
      transparent 100%)`,
    nebula1:
      'radial-gradient(ellipse at 50% 42%, rgba(180, 100, 200, 0.28) 0%, rgba(60, 20, 80, 0.15) 45%, transparent 68%)',
    nebula2:
      'radial-gradient(circle at 20% 30%, rgba(212, 175, 55, 0.18) 0%, rgba(120, 60, 160, 0.12) 50%, transparent 70%)',
    baseBg: `
            radial-gradient(ellipse 80% 70% at 50% 50%, rgba(80, 30, 100, 0.45) 0%, transparent 60%),
            radial-gradient(ellipse 100% 50% at 50% 100%, rgba(40, 10, 50, 0.35) 0%, transparent 55%),
            linear-gradient(165deg, #120818 0%, #2a1040 45%, #0a0614 100%)`,
    planetA: {
      background:
        'radial-gradient(circle at 35% 30%, rgba(240, 180, 255, 0.55), rgba(100, 40, 120, 0.25) 40%, transparent 68%)',
      boxShadow: '0 0 120px rgba(200, 100, 220, 0.2)',
    },
    planetB: {
      background:
        'radial-gradient(circle at 40% 35%, rgba(255, 220, 140, 0.4), rgba(160, 80, 120, 0.15) 50%, transparent 72%)',
      boxShadow: '0 0 70px rgba(212, 175, 55, 0.18)',
    },
    planetC: {
      background:
        'radial-gradient(circle at 50% 38%, rgba(255, 150, 200, 0.3), rgba(80, 20, 60, 0.15) 55%, transparent 72%)',
      boxShadow: '0 0 50px rgba(255, 120, 180, 0.12)',
    },
    canvas: { starDelta: 8, maxD: 124, lineBlue: [220, 160, 240], lineGoldMult: 0.7, warmStarBoost: 0.1, lineAlphaMult: 1.1 },
  },

  star_cluster: {
    label: 'Open cluster',
    sub: 'Soul Tribe',
    milkyOpacity: '0.3',
    milkyGradient: `linear-gradient(85deg,
      transparent 0%,
      rgba(255, 160, 200, 0.1) 35%,
      rgba(200, 160, 255, 0.14) 52%,
      rgba(255, 200, 220, 0.08) 70%,
      transparent 100%)`,
    nebula1:
      'radial-gradient(ellipse at 55% 38%, rgba(255, 140, 200, 0.2) 0%, rgba(120, 80, 180, 0.1) 48%, transparent 72%)',
    nebula2:
      'radial-gradient(circle at 25% 65%, rgba(255, 180, 230, 0.12) 0%, rgba(100, 80, 200, 0.1) 48%, transparent 70%)',
    baseBg: `
            radial-gradient(ellipse 70% 60% at 70% 20%, rgba(120, 60, 120, 0.3) 0%, transparent 52%),
            radial-gradient(ellipse 90% 50% at 30% 80%, rgba(80, 40, 100, 0.22) 0%, transparent 50%),
            linear-gradient(165deg, #100818 0%, #1a0c28 42%, #0c0618 100%)`,
    planetA: {
      background:
        'radial-gradient(circle at 33% 30%, rgba(255, 180, 220, 0.45), rgba(140, 60, 120, 0.18) 45%, transparent 70%)',
      boxShadow: '0 0 100px rgba(255, 140, 200, 0.14)',
    },
    planetB: {
      background:
        'radial-gradient(circle at 40% 36%, rgba(220, 180, 255, 0.35), rgba(120, 80, 200, 0.12) 52%, transparent 72%)',
      boxShadow: '0 0 58px rgba(200, 160, 255, 0.14)',
    },
    planetC: {
      background:
        'radial-gradient(circle at 48% 40%, rgba(255, 200, 240, 0.25), rgba(100, 50, 100, 0.1) 55%, transparent 72%)',
      boxShadow: '0 0 44px rgba(255, 180, 220, 0.1)',
    },
    canvas: { starDelta: 20, maxD: 112, lineBlue: [255, 180, 220], lineGoldMult: 0.4, warmStarBoost: 0.06 },
  },

  aurora_finance: {
    label: 'Aurora belt',
    sub: 'Sacred Exchange',
    milkyOpacity: '0.26',
    milkyGradient: `linear-gradient(93deg,
      transparent 0%,
      rgba(212, 175, 55, 0.1) 28%,
      rgba(255, 235, 180, 0.14) 50%,
      rgba(180, 200, 255, 0.09) 72%,
      transparent 100%)`,
    nebula1:
      'radial-gradient(ellipse at 40% 45%, rgba(212, 175, 55, 0.16) 0%, rgba(60, 80, 140, 0.1) 50%, transparent 72%)',
    nebula2:
      'radial-gradient(circle at 80% 40%, rgba(100, 180, 255, 0.12) 0%, rgba(212, 175, 55, 0.1) 45%, transparent 70%)',
    baseBg: `
            radial-gradient(ellipse 100% 55% at 50% 0%, rgba(40, 50, 100, 0.38) 0%, transparent 54%),
            radial-gradient(ellipse 60% 45% at 0% 100%, rgba(100, 80, 30, 0.18) 0%, transparent 50%),
            linear-gradient(165deg, #050818 0%, #101828 40%, #080c18 100%)`,
    planetA: {
      background:
        'radial-gradient(circle at 32% 28%, rgba(255, 230, 160, 0.45), rgba(120, 90, 40, 0.15) 45%, transparent 70%)',
      boxShadow: '0 0 90px rgba(212, 175, 55, 0.2)',
    },
    planetB: {
      background:
        'radial-gradient(circle at 42% 36%, rgba(180, 210, 255, 0.3), rgba(60, 80, 140, 0.12) 52%, transparent 72%)',
      boxShadow: '0 0 52px rgba(140, 180, 255, 0.12)',
    },
    planetC: {
      background:
        'radial-gradient(circle at 50% 40%, rgba(255, 215, 140, 0.28), rgba(80, 100, 160, 0.1) 55%, transparent 72%)',
      boxShadow: '0 0 40px rgba(255, 215, 160, 0.12)',
    },
    canvas: { starDelta: 0, maxD: 118, lineBlue: [200, 210, 255], lineGoldMult: 0.85, warmStarBoost: 0.15 },
  },

  terra_profile: {
    label: 'Home world',
    sub: 'Profile',
    milkyOpacity: '0.24',
    milkyGradient: `linear-gradient(90deg,
      transparent 0%,
      rgba(80, 180, 200, 0.08) 38%,
      rgba(120, 220, 200, 0.12) 50%,
      rgba(60, 120, 180, 0.08) 62%,
      transparent 100%)`,
    nebula1:
      'radial-gradient(ellipse at 45% 40%, rgba(60, 180, 160, 0.18) 0%, rgba(30, 60, 100, 0.1) 50%, transparent 72%)',
    nebula2:
      'radial-gradient(circle at 70% 70%, rgba(100, 200, 255, 0.12) 0%, rgba(40, 100, 120, 0.1) 48%, transparent 70%)',
    baseBg: `
            radial-gradient(ellipse 90% 60% at 50% 10%, rgba(30, 80, 100, 0.35) 0%, transparent 54%),
            radial-gradient(ellipse 70% 50% at 100% 80%, rgba(20, 60, 80, 0.2) 0%, transparent 50%),
            linear-gradient(165deg, #030c14 0%, #061c22 38%, #040a12 100%)`,
    planetA: {
      background:
        'radial-gradient(circle at 35% 32%, rgba(120, 220, 200, 0.4), rgba(30, 90, 100, 0.2) 45%, transparent 70%)',
      boxShadow: '0 0 85px rgba(80, 200, 190, 0.14)',
    },
    planetB: {
      background:
        'radial-gradient(circle at 40% 36%, rgba(180, 230, 255, 0.28), rgba(40, 100, 140, 0.12) 52%, transparent 72%)',
      boxShadow: '0 0 50px rgba(120, 200, 255, 0.12)',
    },
    planetC: {
      background:
        'radial-gradient(circle at 48% 40%, rgba(100, 200, 180, 0.26), rgba(25, 70, 90, 0.12) 55%, transparent 72%)',
      boxShadow: '0 0 40px rgba(100, 220, 200, 0.1)',
    },
    canvas: { starDelta: 8, maxD: 115, lineBlue: [140, 220, 230], lineGoldMult: 0.38, warmStarBoost: 0.04 },
  },

  /** Full-screen purple wash — no canvas; white cards sit on top */
  immersive_purple: {
    label: 'Immersive sanctuary',
    sub: 'Violet field',
    milkyOpacity: '0',
    milkyGradient: 'transparent',
    nebula1: 'transparent',
    nebula2: 'transparent',
    baseBg: 'transparent',
    planetA: { background: 'transparent', boxShadow: 'none' },
    planetB: { background: 'transparent', boxShadow: 'none' },
    planetC: { background: 'transparent', boxShadow: 'none' },
    canvas: { ...COSMIC_CANVAS_DEFAULT },
  },

  /** Luminous dawn / amethyst field — overview “Sacred Home” (matches static v2 mockup) */
  sacred_home_light: {
    label: 'Sacred home',
    sub: 'Luminous overview',
    milkyOpacity: '0',
    milkyGradient: 'transparent',
    nebula1: 'transparent',
    nebula2: 'transparent',
    baseBg: 'transparent',
    planetA: { background: 'transparent', boxShadow: 'none' },
    planetB: { background: 'transparent', boxShadow: 'none' },
    planetC: { background: 'transparent', boxShadow: 'none' },
    canvas: { ...COSMIC_CANVAS_DEFAULT },
  },

  deep_space: {
    label: 'Deep space',
    sub: 'Journey',
    milkyOpacity: '0.2',
    milkyGradient: `linear-gradient(90deg,
      transparent 0%,
      rgba(80, 100, 160, 0.06) 40%,
      rgba(140, 160, 220, 0.1) 50%,
      transparent 100%)`,
    nebula1:
      'radial-gradient(ellipse at 50% 45%, rgba(60, 70, 120, 0.15) 0%, rgba(20, 25, 50, 0.08) 50%, transparent 72%)',
    nebula2:
      'radial-gradient(circle at 10% 30%, rgba(212, 175, 55, 0.08) 0%, rgba(50, 50, 100, 0.08) 50%, transparent 70%)',
    baseBg: `
            radial-gradient(ellipse 100% 60% at 50% 0%, rgba(30, 35, 70, 0.4) 0%, transparent 55%),
            linear-gradient(165deg, #020510 0%, #0a0c1a 50%, #030508 100%)`,
    planetA: {
      background:
        'radial-gradient(circle at 32% 28%, rgba(160, 170, 220, 0.35), rgba(40, 45, 90, 0.15) 48%, transparent 72%)',
      boxShadow: '0 0 80px rgba(100, 110, 180, 0.1)',
    },
    planetB: {
      background:
        'radial-gradient(circle at 40% 35%, rgba(212, 175, 55, 0.22), rgba(80, 70, 40, 0.1) 52%, transparent 72%)',
      boxShadow: '0 0 45px rgba(212, 175, 55, 0.1)',
    },
    planetC: {
      background:
        'radial-gradient(circle at 50% 40%, rgba(120, 160, 255, 0.2), rgba(30, 40, 80, 0.1) 55%, transparent 72%)',
      boxShadow: '0 0 35px rgba(120, 160, 255, 0.08)',
    },
    canvas: { ...COSMIC_CANVAS_DEFAULT },
  },
};

/**
 * @param {string} variant
 */
export function resolveCosmicTheme(variant) {
  const t = DASHBOARD_COSMIC_THEMES[variant] || DASHBOARD_COSMIC_THEMES.deep_space;
  return {
    ...t,
    canvas: { ...COSMIC_CANVAS_DEFAULT, ...t.canvas },
  };
}

/**
 * @param {string} pathname
 * @returns {keyof typeof DASHBOARD_COSMIC_THEMES}
 */
export function getDashboardCosmicVariant(pathname) {
  const p = pathname || '';
  if (!p.startsWith('/dashboard')) return 'deep_space';
  /** Light “Sacred Home” shell only on overview; other routes keep violet field. */
  if (p === '/dashboard' || p === '/dashboard/') return 'sacred_home_light';
  return 'immersive_purple';
}

export function getDashboardCosmicTheme(pathname) {
  const key = getDashboardCosmicVariant(pathname);
  return DASHBOARD_COSMIC_THEMES[key] || DASHBOARD_COSMIC_THEMES.deep_space;
}
