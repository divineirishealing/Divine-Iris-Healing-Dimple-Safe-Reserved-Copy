import React, { useMemo, useId } from 'react';

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

function IrisBloom({ ox = 0, oy = 0, rot = 0, scale = 1 }) {
  return (
    <g transform={`translate(${ox},${oy}) rotate(${rot}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="26" ry="11" fill="#5b21b6" opacity="0.9" transform="rotate(-16)" />
      <ellipse cx="7" cy="-4" rx="24" ry="10" fill="#7c3aed" opacity="0.87" transform="rotate(42)" />
      <ellipse cx="-9" cy="3" rx="21" ry="9" fill="#6d28d9" opacity="0.9" transform="rotate(-46)" />
      <ellipse cx="0" cy="-2" rx="9" ry="7" fill="#fbbf24" opacity="0.9" />
    </g>
  );
}

/**
 * Fully coded sanctuary: gradients, SVG iris clusters with stem-origin sway,
 * cozy still-life right, steam, wind lines, particles — no raster asset.
 */
export function IllustratedHealingSanctuaryBackground({ storageScope = 'student' }) {
  const uid = useId().replace(/:/g, '');
  const seed = `illus-sanctuary-${storageScope}`;
  const rand = useMemo(() => seededRand(seed), [seed]);

  const petals = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        left: 2 + rand() * 42,
        delay: rand() * -50,
        duration: 68 + rand() * 52,
        size: 3.5 + rand() * 5.5,
        dx: Math.round(-34 + rand() * 68),
        rotN: Math.round(-60 + rand() * 120),
        hue: rand() > 0.48 ? '236, 72, 153' : '124, 58, 237',
      })),
    [rand]
  );

  const particles = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => {
        const a = 6 + rand() * 9;
        const b = 5 + rand() * 8;
        return {
          id: i,
          left: rand() * 100,
          top: rand() * 100,
          size: 0.9 + rand() * 2.4,
          duration: 36 + rand() * 34,
          delay: -rand() * 36,
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

  const lavDots = useMemo(() => {
    const r = seededRand(`${seed}-lav`);
    return Array.from({ length: 36 }, (_, i) => ({
      i,
      x: 40 + (i % 9) * 24 + (i % 4) * 3,
      y: 220 + Math.floor(i / 9) * 48 + r() * 8,
    }));
  }, [seed]);

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#ebe3f7]"
      data-testid="dashboard-healing-sanctuary-bg"
      data-healing-variant="illustrated"
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 88% 58% at 50% 38%, rgba(252, 250, 255, 0.97) 0%, rgba(238, 228, 252, 0.94) 42%, rgba(225, 212, 245, 0.96) 100%),
            radial-gradient(ellipse 70% 45% at 8% 75%, rgba(196, 181, 253, 0.35) 0%, transparent 58%),
            radial-gradient(ellipse 55% 40% at 94% 18%, rgba(255, 228, 210, 0.38) 0%, transparent 52%),
            linear-gradient(168deg, #f3ecff 0%, #faf6ff 40%, #fff9fb 72%, #f0e8fa 100%)
          `,
        }}
      />

      <div
        className="pointer-events-none absolute rounded-full blur-3xl opacity-45"
        style={{
          width: 'min(44vw, 460px)',
          height: 'min(44vw, 460px)',
          left: '-10%',
          top: '14%',
          background: 'radial-gradient(circle, rgba(167, 139, 250, 0.45) 0%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute rounded-full blur-3xl opacity-40"
        style={{
          width: 'min(40vw, 400px)',
          height: 'min(40vw, 400px)',
          right: '-8%',
          bottom: '6%',
          background: 'radial-gradient(circle, rgba(253, 224, 200, 0.42) 0%, transparent 72%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-[0.24] dashboard-healing-sunray"
        style={{
          background:
            'radial-gradient(ellipse 82% 68% at 94% 6%, rgba(255, 232, 200, 0.55) 0%, transparent 50%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.34] dashboard-healing-leaf-shadow"
        style={{
          background: `
            radial-gradient(ellipse 46% 26% at 74% 10%, rgba(76, 29, 149, 0.2) 0%, transparent 70%),
            radial-gradient(ellipse 40% 22% at 56% 14%, rgba(91, 33, 182, 0.16) 0%, transparent 68%)
          `,
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
              ['--a']: p.gold ? 0.42 : 0.27,
              background: p.gold
                ? 'radial-gradient(circle, rgba(255, 220, 160, 0.82) 0%, rgba(212, 175, 55, 0.26) 100%)'
                : 'radial-gradient(circle, rgba(230, 210, 255, 0.72) 0%, rgba(167, 139, 250, 0.2) 100%)',
              boxShadow: p.gold ? '0 0 7px rgba(255, 215, 140, 0.32)' : '0 0 6px rgba(196, 181, 253, 0.26)',
              filter: 'blur(0.35px)',
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-[min(64vh,620px)]">
        <svg
          className="absolute bottom-0 left-1/2 h-full w-[min(1550px,235%)] max-w-none -translate-x-[calc(50%+min(8vw,5.5rem))]"
          viewBox="0 0 1000 520"
          preserveAspectRatio="xMidYMax meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`illus-book-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5b21b6" />
              <stop offset="100%" stopColor="#4c1d95" />
            </linearGradient>
            <linearGradient id={`illus-mug-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f8f8ff" />
              <stop offset="45%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#ebe4f7" />
            </linearGradient>
            <linearGradient id={`illus-knit-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#5b21b6" />
            </linearGradient>
            <linearGradient id={`illus-coffee-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3d2b1f" />
              <stop offset="50%" stopColor="#5c4033" />
              <stop offset="100%" stopColor="#2a1a12" />
            </linearGradient>
            <linearGradient id={`illus-steam-${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(255, 248, 220, 0.92)" />
              <stop offset="50%" stopColor="rgba(255, 220, 160, 0.55)" />
              <stop offset="100%" stopColor="rgba(255, 235, 200, 0.12)" />
            </linearGradient>
            <radialGradient id={`illus-lantern-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255, 200, 120, 0.55)" />
              <stop offset="70%" stopColor="rgba(120, 80, 40, 0.15)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <filter id={`illus-shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#4c1d95" floodOpacity="0.16" />
            </filter>
            <filter id={`illus-steam-blur-${uid}`} x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b" />
              <feColorMatrix
                in="b"
                type="matrix"
                values="1 0 0 0 0  0.95 0 0 0 0  0.75 0 0 0 0  0 0 0 0.8 0"
              />
            </filter>
          </defs>

          <g opacity="0.5" className="dash-illus-wind-group">
            <path
              className="dash-illus-wind-line"
              d="M 10 440 Q 70 380 45 300 Q 25 220 75 140"
              fill="none"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              className="dash-illus-wind-line"
              style={{ animationDelay: '-6s' }}
              d="M 35 460 Q 95 400 55 310 Q 30 230 95 150"
              fill="none"
              stroke="rgba(196,181,253,0.2)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              className="dash-illus-wind-line"
              style={{ animationDelay: '-11s' }}
              d="M 0 380 Q 50 320 38 250 Q 20 180 55 100"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>

          <ellipse cx="900" cy="95" rx="48" ry="38" fill={`url(#illus-lantern-${uid})`} opacity="0.85" />
          <rect x="878" y="72" width="36" height="48" rx="4" fill="#2d2640" opacity="0.55" />
          <ellipse cx="896" cy="78" rx="10" ry="6" fill="rgba(255,220,160,0.5)" />

          <path
            d="M 520 520 Q 540 460 580 440 Q 720 400 1000 420 L 1000 520 Z"
            fill={`url(#illus-knit-${uid})`}
            opacity="0.88"
          />
          <path
            d="M 560 500 Q 650 470 820 465 Q 950 475 1000 490 L 1000 520 L 540 520 Z"
            fill="#6d28d9"
            opacity="0.12"
          />

          <g filter={`url(#illus-shadow-${uid})`} transform="translate(620, 278)">
            <rect x="0" y="40" width="200" height="38" rx="3" fill={`url(#illus-book-${uid})`} opacity="0.96" />
            <rect x="4" y="36" width="192" height="9" rx="2" fill="#faf5ff" opacity="0.88" />
          </g>

          <g filter={`url(#illus-shadow-${uid})`} transform="translate(638, 168)">
            <path
              d="M 12 32 Q 12 8 48 8 L 132 8 Q 168 8 168 32 L 168 168 Q 168 196 150 208 L 30 208 Q 12 196 12 168 Z"
              fill={`url(#illus-mug-${uid})`}
              stroke="rgba(139, 92, 246, 0.14)"
              strokeWidth="1"
            />
            <ellipse cx="90" cy="32" rx="78" ry="14" fill="#ffffff" opacity="0.93" />
            <ellipse cx="90" cy="32" rx="72" ry="10" fill={`url(#illus-coffee-${uid})`} opacity="0.92" />
            <ellipse cx="90" cy="30" rx="52" ry="5" fill="rgba(255, 215, 140, 0.35)" />
            <path
              d="M 168 72 Q 210 72 210 112 Q 210 152 168 152"
              fill="none"
              stroke="#e9d5ff"
              strokeWidth="14"
              strokeLinecap="round"
              opacity="0.88"
            />
          </g>

          <g transform="translate(0, 8)" filter={`url(#illus-steam-blur-${uid})`} opacity="0.88">
            <g transform="translate(700, 142)">
              <path
                className="dashboard-healing-steam-strand"
                style={{ animationDelay: '0s' }}
                d="M 0 0 Q 10 -28 2 -58 Q -6 -88 -4 -118"
                fill="none"
                stroke={`url(#illus-steam-${uid})`}
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </g>
            <g transform="translate(724, 148)">
              <path
                className="dashboard-healing-steam-strand"
                style={{ animationDelay: '-3.2s' }}
                d="M 0 0 Q -12 -26 -3 -54 Q 8 -82 4 -112"
                fill="none"
                stroke={`url(#illus-steam-${uid})`}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </g>
            <g transform="translate(748, 152)">
              <path
                className="dashboard-healing-steam-strand-alt"
                style={{ animationDelay: '-1.8s' }}
                d="M 0 0 Q 8 -22 -4 -46 Q -12 -74 -6 -108"
                fill="none"
                stroke={`url(#illus-steam-${uid})`}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </g>
          </g>

          <g
            className="dash-illus-cluster-slow"
            style={{ transformOrigin: '165px 418px', transformBox: 'fill-box' }}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path
                key={`st-a-${i}`}
                d={`M ${72 + i * 26} 420 Q ${62 + i * 26} ${310 - i * 10} ${80 + i * 24} ${195 + (i % 3) * 18}`}
                fill="none"
                stroke="#78716c"
                strokeWidth="1.1"
                opacity="0.32"
              />
            ))}
            {lavDots.slice(0, 24).map((d) => (
              <circle key={`lav-a-${d.i}`} cx={d.x} cy={d.y} r="2" fill="#7c3aed" opacity="0.5" />
            ))}
            <IrisBloom ox={118} oy={298} rot={-8} scale={1.05} />
            <IrisBloom ox={198} oy={332} rot={12} scale={0.92} />
            <IrisBloom ox={268} oy={288} rot={-14} scale={0.88} />
          </g>

          <g
            className="dash-illus-cluster-mid"
            style={{ transformOrigin: '92px 445px', transformBox: 'fill-box' }}
          >
            <path d="M 92 420 Q 82 300 95 210 Q 88 160 102 120" fill="none" stroke="#78716c" strokeWidth="1" opacity="0.28" />
            <IrisBloom ox={95} oy={218} rot={22} scale={0.78} />
            <IrisBloom ox={58} oy={348} rot={-18} scale={0.72} />
          </g>

          <g
            className="dash-illus-cluster-fast"
            style={{ transformOrigin: '310px 402px', transformBox: 'fill-box' }}
          >
            <path d="M 310 420 Q 298 310 318 240 Q 305 180 328 130" fill="none" stroke="#78716c" strokeWidth="1" opacity="0.26" />
            <IrisBloom ox={312} oy={248} rot={-6} scale={0.82} />
            <IrisBloom ox={285} oy={338} rot={16} scale={0.68} />
          </g>
        </svg>
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
              background: `linear-gradient(155deg, rgba(${p.hue}, 0.4), rgba(${p.hue}, 0.06))`,
              boxShadow: '0 1px 4px rgba(76, 29, 149, 0.06)',
            }}
          />
        ))}
      </div>

      <div
        className="pointer-events-none absolute inset-0 dashboard-healing-center-veil"
        style={{
          background:
            'radial-gradient(ellipse 50% 58% at 50% 48%, rgba(253, 250, 255, 0.42) 0%, transparent 62%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px',
          mixBlendMode: 'soft-light',
        }}
      />
    </div>
  );
}

export default IllustratedHealingSanctuaryBackground;
