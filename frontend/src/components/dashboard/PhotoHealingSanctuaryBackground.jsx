import React, { useMemo, useId } from 'react';

const IMG = `${process.env.PUBLIC_URL || ''}/dashboard-healing-sanctuary.png`;

const BREEZE_LAYERS = [
  {
    anim: 'dashboard-healing-breeze-deep',
    mask: 'linear-gradient(108deg, rgb(0,0,0) 0%, rgba(0,0,0,0.58) 17%, rgba(0,0,0,0.2) 32%, transparent 46%)',
    blur: 1.15,
    opacity: 0.17,
    mix: 'soft-light',
  },
  {
    anim: 'dashboard-healing-breeze-mid',
    mask: 'linear-gradient(102deg, rgb(0,0,0) 0%, rgba(0,0,0,0.42) 26%, rgba(0,0,0,0.1) 40%, transparent 54%)',
    blur: 2.1,
    opacity: 0.12,
    mix: 'overlay',
  },
  {
    anim: 'dashboard-healing-breeze-light',
    mask: 'radial-gradient(ellipse 72% 88% at 4% 76%, rgb(0,0,0) 0%, rgba(0,0,0,0.32) 44%, transparent 70%)',
    blur: 1.7,
    opacity: 0.13,
    mix: 'soft-light',
  },
];

function mulberry32(a) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return mulberry32(h >>> 0);
}

/** Raster sanctuary artwork + feather-masked breeze (no external deps). */
export function PhotoHealingSanctuaryBackground({ storageScope = 'student' }) {
  const seed = `healing-sanctuary-${storageScope}`;
  const rand = useMemo(() => seededRand(seed), [seed]);
  const sid = useId().replace(/:/g, '');

  const petals = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        id: i,
        left: 2 + rand() * 38,
        delay: rand() * -55,
        duration: 72 + rand() * 56,
        size: 3.5 + rand() * 5.5,
        dx: Math.round(-36 + rand() * 72),
        rotN: Math.round(-65 + rand() * 130),
        hue: rand() > 0.48 ? '236, 72, 153' : '124, 58, 237',
      })),
    [rand]
  );

  const particles = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const a = 6 + rand() * 9;
        const b = 5 + rand() * 8;
        return {
          id: i,
          left: rand() * 100,
          top: rand() * 100,
          size: 0.85 + rand() * 2,
          duration: 38 + rand() * 36,
          delay: -rand() * 40,
          mx: `${(rand() - 0.5) * a}px`,
          my: `${(rand() - 0.5) * b}px`,
          mx2: `${(rand() - 0.5) * a * 1.1}px`,
          my2: `${(rand() - 0.5) * b * 1.1}px`,
          mx3: `${(rand() - 0.5) * a * 0.85}px`,
          my3: `${(rand() - 0.5) * b * 0.85}px`,
          gold: rand() > 0.4,
        };
      }),
    [rand]
  );

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#e8dff7]"
      data-testid="dashboard-healing-sanctuary-bg"
      data-healing-variant="photo"
      aria-hidden
    >
      <img
        src={IMG}
        alt=""
        className="dashboard-healing-base-drift absolute inset-0 h-full w-full object-cover object-center select-none"
      />

      <div className="dashboard-healing-breeze-stack pointer-events-none absolute inset-0">
        {BREEZE_LAYERS.map((layer, i) => (
          <div
            key={i}
            className={`pointer-events-none absolute inset-0 ${layer.anim} will-change-transform`}
            style={{
              WebkitMaskImage: layer.mask,
              maskImage: layer.mask,
              WebkitMaskSize: '100% 100%',
              maskSize: '100% 100%',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              opacity: layer.opacity,
              mixBlendMode: layer.mix,
            }}
          >
            <img
              src={IMG}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-left"
              style={{ filter: `blur(${layer.blur}px)` }}
            />
          </div>
        ))}
      </div>

      <div
        className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-[0.2] dashboard-healing-sunray"
        style={{
          background:
            'radial-gradient(ellipse 88% 72% at 94% 5%, rgba(255, 232, 200, 0.52) 0%, transparent 54%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.34] dashboard-healing-leaf-shadow"
        style={{
          background: `
            radial-gradient(ellipse 45% 28% at 72% 8%, rgba(76, 29, 149, 0.2) 0%, transparent 70%),
            radial-gradient(ellipse 38% 22% at 58% 12%, rgba(91, 33, 182, 0.16) 0%, transparent 68%),
            radial-gradient(ellipse 52% 30% at 88% 18%, rgba(109, 40, 217, 0.12) 0%, transparent 72%)
          `,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.28] dashboard-healing-leaf-shadow-alt"
        style={{
          background: `
            radial-gradient(ellipse 38% 22% at 46% 14%, rgba(67, 56, 120, 0.16) 0%, transparent 66%),
            radial-gradient(ellipse 44% 26% at 84% 20%, rgba(76, 29, 149, 0.11) 0%, transparent 70%)
          `,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 dashboard-healing-center-veil"
        style={{
          background:
            'radial-gradient(ellipse 50% 60% at 50% 48%, rgba(255, 254, 255, 0.5) 0%, rgba(253, 250, 255, 0.22) 45%, transparent 64%)',
        }}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <span
            key={p.id}
            className="dashboard-healing-particle absolute rounded-full"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              ['--mx']: p.mx,
              ['--my']: p.my,
              ['--mx2']: p.mx2,
              ['--my2']: p.my2,
              ['--mx3']: p.mx3,
              ['--my3']: p.my3,
              ['--a']: p.gold ? 0.44 : 0.28,
              background: p.gold
                ? 'radial-gradient(circle, rgba(255, 220, 160, 0.85) 0%, rgba(212, 175, 55, 0.28) 100%)'
                : 'radial-gradient(circle, rgba(230, 210, 255, 0.75) 0%, rgba(167, 139, 250, 0.22) 100%)',
              boxShadow: p.gold
                ? '0 0 8px rgba(255, 215, 140, 0.35)'
                : '0 0 7px rgba(196, 181, 253, 0.28)',
              filter: 'blur(0.35px)',
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {petals.map((p) => (
          <span
            key={p.id}
            className="dashboard-healing-petal absolute rounded-[50%_40%]"
            style={{
              left: `${p.left}%`,
              top: '-4vh',
              width: p.size,
              height: p.size * 1.35,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ['--dx']: p.dx,
              ['--rot-n']: p.rotN,
              background: `linear-gradient(155deg, rgba(${p.hue}, 0.38), rgba(${p.hue}, 0.06))`,
              boxShadow: '0 1px 4px rgba(76, 29, 149, 0.06)',
            }}
          />
        ))}
      </div>

      <div
        className="pointer-events-none absolute z-[1]"
        style={{
          right: '4%',
          bottom: '8%',
          width: 'min(340px, 34vw)',
          height: 'min(52vh, 420px)',
        }}
      >
        <svg
          className="h-full w-full overflow-visible"
          viewBox="0 0 120 200"
          preserveAspectRatio="xMidYMax meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`dh-steam-g-${sid}`} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(255, 248, 220, 0.95)" />
              <stop offset="45%" stopColor="rgba(255, 220, 160, 0.65)" />
              <stop offset="100%" stopColor="rgba(255, 235, 200, 0.15)" />
            </linearGradient>
            <filter id={`dh-steam-blur-${sid}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.35" result="b" />
              <feColorMatrix
                in="b"
                type="matrix"
                values="1 0 0 0 0  0.95 0 0 0 0  0.75 0 0 0 0  0 0 0 0.82 0"
              />
            </filter>
          </defs>
          <g filter={`url(#dh-steam-blur-${sid})`} style={{ opacity: 0.84 }}>
            <path
              className="dashboard-healing-steam-strand"
              style={{ animationDelay: '0s' }}
              d="M 58 188 Q 68 150 54 118 Q 48 88 62 58 Q 72 32 56 8"
              fill="none"
              stroke={`url(#dh-steam-g-${sid})`}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              className="dashboard-healing-steam-strand"
              style={{ animationDelay: '-4.2s' }}
              d="M 72 190 Q 62 148 78 122 Q 88 92 70 62 Q 58 34 74 12"
              fill="none"
              stroke={`url(#dh-steam-g-${sid})`}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            <path
              className="dashboard-healing-steam-strand"
              style={{ animationDelay: '-8.5s' }}
              d="M 48 188 Q 56 152 44 128 Q 38 98 52 68 Q 64 38 48 14"
              fill="none"
              stroke={`url(#dh-steam-g-${sid})`}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              className="dashboard-healing-steam-strand-alt"
              style={{ animationDelay: '-2.1s' }}
              d="M 64 188 Q 54 158 66 128 Q 74 96 60 64 Q 50 36 68 10"
              fill="none"
              stroke={`url(#dh-steam-g-${sid})`}
              strokeWidth="1.35"
              strokeLinecap="round"
            />
            <path
              className="dashboard-healing-steam-heart"
              style={{ animationDelay: '-5.5s' }}
              d="M 60 188 Q 54 172 56 158 Q 60 148 64 158 Q 68 148 72 158 Q 74 172 68 182 Q 64 188 60 188"
              fill="none"
              stroke={`url(#dh-steam-g-${sid})`}
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px',
          mixBlendMode: 'soft-light',
        }}
      />
    </div>
  );
}

export default PhotoHealingSanctuaryBackground;
