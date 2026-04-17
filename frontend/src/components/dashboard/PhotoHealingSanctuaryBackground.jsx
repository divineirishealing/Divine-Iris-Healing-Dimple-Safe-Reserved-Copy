import React, { useMemo, useId } from 'react';

const IMG = `${process.env.PUBLIC_URL || ''}/dashboard-healing-sanctuary.png`;

const BREEZE_LAYERS = [
  {
    anim: 'dashboard-healing-breeze-deep',
    mask: 'linear-gradient(108deg, rgb(0,0,0) 0%, rgba(0,0,0,0.62) 16%, rgba(0,0,0,0.22) 30%, transparent 44%)',
    blur: 1.1,
    opacity: 0.22,
    mix: 'soft-light',
  },
  {
    anim: 'dashboard-healing-breeze-mid',
    mask: 'linear-gradient(102deg, rgb(0,0,0) 0%, rgba(0,0,0,0.45) 24%, rgba(0,0,0,0.12) 38%, transparent 52%)',
    blur: 2,
    opacity: 0.15,
    mix: 'overlay',
  },
  {
    anim: 'dashboard-healing-breeze-light',
    mask: 'radial-gradient(ellipse 72% 88% at 4% 76%, rgb(0,0,0) 0%, rgba(0,0,0,0.35) 42%, transparent 68%)',
    blur: 1.6,
    opacity: 0.17,
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
      Array.from({ length: 11 }, (_, i) => ({
        id: i,
        left: 3 + rand() * 40,
        delay: rand() * -40,
        duration: 52 + rand() * 48,
        size: 4 + rand() * 6,
        rot: -35 + rand() * 70,
        dx: -22 + rand() * 44,
        hue: rand() > 0.5 ? '236, 72, 153' : '124, 58, 237',
      })),
    [rand]
  );

  const particles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: rand() * 100,
        top: rand() * 100,
        size: 1 + rand() * 2.2,
        duration: 24 + rand() * 28,
        delay: -rand() * 32,
        mx: `${-12 + rand() * 24}px`,
        my: `${-14 + rand() * 28}px`,
        gold: rand() > 0.42,
      })),
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
        className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-[0.22] dashboard-healing-sunray"
        style={{
          background:
            'radial-gradient(ellipse 85% 70% at 96% 4%, rgba(255, 232, 200, 0.55) 0%, transparent 52%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.38] dashboard-healing-leaf-shadow"
        style={{
          background: `
            radial-gradient(ellipse 45% 28% at 72% 8%, rgba(76, 29, 149, 0.22) 0%, transparent 70%),
            radial-gradient(ellipse 38% 22% at 58% 12%, rgba(91, 33, 182, 0.18) 0%, transparent 68%),
            radial-gradient(ellipse 52% 30% at 88% 18%, rgba(109, 40, 217, 0.14) 0%, transparent 72%)
          `,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 dashboard-healing-center-veil"
        style={{
          background:
            'radial-gradient(ellipse 48% 58% at 50% 48%, rgba(253, 250, 255, 0.38) 0%, transparent 62%)',
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
              ['--a']: p.gold ? 0.48 : 0.32,
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
              ['--dx']: `${p.dx}px`,
              ['--rot']: `${p.rot}deg`,
              background: `linear-gradient(155deg, rgba(${p.hue}, 0.42), rgba(${p.hue}, 0.08))`,
              boxShadow: '0 1px 4px rgba(76, 29, 149, 0.08)',
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
          <g filter={`url(#dh-steam-blur-${sid})`} style={{ opacity: 0.86 }}>
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
              style={{ animationDelay: '-3s' }}
              d="M 72 190 Q 62 148 78 122 Q 88 92 70 62 Q 58 34 74 12"
              fill="none"
              stroke={`url(#dh-steam-g-${sid})`}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            <path
              className="dashboard-healing-steam-strand"
              style={{ animationDelay: '-6.2s' }}
              d="M 48 188 Q 56 152 44 128 Q 38 98 52 68 Q 64 38 48 14"
              fill="none"
              stroke={`url(#dh-steam-g-${sid})`}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              className="dashboard-healing-steam-strand-alt"
              style={{ animationDelay: '-1.6s' }}
              d="M 64 188 Q 54 158 66 128 Q 74 96 60 64 Q 50 36 68 10"
              fill="none"
              stroke={`url(#dh-steam-g-${sid})`}
              strokeWidth="1.35"
              strokeLinecap="round"
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
