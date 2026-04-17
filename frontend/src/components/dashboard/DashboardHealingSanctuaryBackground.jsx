import React, { useMemo } from 'react';

const IMG = `${process.env.PUBLIC_URL || ''}/dashboard-healing-sanctuary.png`;

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

/**
 * Full-bleed photo background for dashboard overview: gentle left-floral sway,
 * drifting petals, golden steam overlay, particles, and soft moving leaf-light.
 */
export function DashboardHealingSanctuaryBackground({ storageScope = 'student' }) {
  const seed = `healing-sanctuary-${storageScope}`;
  const rand = useMemo(() => seededRand(seed), [seed]);

  const petals = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        id: i,
        left: 4 + rand() * 38,
        delay: rand() * -28,
        duration: 38 + rand() * 32,
        size: 5 + rand() * 7,
        rot: -40 + rand() * 80,
        dx: -30 + rand() * 60,
        hue: rand() > 0.5 ? '236, 72, 153' : '124, 58, 237',
      })),
    [rand]
  );

  const particles = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: rand() * 100,
        top: rand() * 100,
        size: 1.2 + rand() * 2.8,
        duration: 16 + rand() * 22,
        delay: -rand() * 24,
        mx: `${-18 + rand() * 36}px`,
        my: `${-22 + rand() * 44}px`,
        gold: rand() > 0.42,
      })),
    [rand]
  );

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#e8dff7]"
      data-testid="dashboard-healing-sanctuary-bg"
      aria-hidden
    >
      <img src={IMG} alt="" className="absolute inset-0 h-full w-full object-cover object-center select-none" />

      <div
        className="pointer-events-none absolute inset-0"
        style={{ clipPath: 'inset(0 56% 0 0)' }}
      >
        <div className="dashboard-healing-floral-sway absolute inset-0 h-full w-full">
          <img src={IMG} alt="" className="absolute inset-0 h-full w-full object-cover object-left" />
        </div>
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
              ['--a']: p.gold ? 0.55 : 0.38,
              background: p.gold
                ? 'radial-gradient(circle, rgba(255, 220, 160, 0.95) 0%, rgba(212, 175, 55, 0.35) 100%)'
                : 'radial-gradient(circle, rgba(230, 210, 255, 0.9) 0%, rgba(167, 139, 250, 0.3) 100%)',
              boxShadow: p.gold
                ? '0 0 6px rgba(255, 215, 140, 0.45)'
                : '0 0 5px rgba(196, 181, 253, 0.4)',
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
              background: `linear-gradient(145deg, rgba(${p.hue}, 0.55), rgba(${p.hue}, 0.15))`,
              boxShadow: '0 1px 3px rgba(76, 29, 149, 0.12)',
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
            <linearGradient id="dh-steam-g" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(255, 248, 220, 0.95)" />
              <stop offset="45%" stopColor="rgba(255, 220, 160, 0.65)" />
              <stop offset="100%" stopColor="rgba(255, 235, 200, 0.15)" />
            </linearGradient>
            <filter id="dashboard-healing-steam-blur" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.1" result="b" />
              <feColorMatrix
                in="b"
                type="matrix"
                values="1 0 0 0 0  0.95 0 0 0 0  0.75 0 0 0 0  0 0 0 0.85 0"
              />
            </filter>
          </defs>
          <g filter="url(#dashboard-healing-steam-blur)" style={{ opacity: 0.88 }}>
            <path
              className="dashboard-healing-steam-strand"
              style={{ animationDelay: '0s' }}
              d="M 58 188 Q 68 150 54 118 Q 48 88 62 58 Q 72 32 56 8"
              fill="none"
              stroke="url(#dh-steam-g)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              className="dashboard-healing-steam-strand"
              style={{ animationDelay: '-2.2s' }}
              d="M 72 190 Q 62 148 78 122 Q 88 92 70 62 Q 58 34 74 12"
              fill="none"
              stroke="url(#dh-steam-g)"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            <path
              className="dashboard-healing-steam-strand"
              style={{ animationDelay: '-4.5s' }}
              d="M 48 188 Q 56 152 44 128 Q 38 98 52 68 Q 64 38 48 14"
              fill="none"
              stroke="url(#dh-steam-g)"
              strokeWidth="1.6"
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

export default DashboardHealingSanctuaryBackground;
