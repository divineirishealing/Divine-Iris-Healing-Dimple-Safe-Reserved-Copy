import React, { useState } from 'react';
import { SANCTUARY_MUG_QUOTES } from './sanctuaryCozyQuotes';

function mugQuoteStorageKey(scope) {
  const safe = String(scope || 'anon').replace(/[^a-z0-9@._-]/gi, '_').slice(0, 96);
  return `dih_sanctuary_mug_quote_v1_${safe}`;
}

function pickRandomQuote() {
  const i = Math.floor(Math.random() * SANCTUARY_MUG_QUOTES.length);
  return SANCTUARY_MUG_QUOTES[i] || SANCTUARY_MUG_QUOTES[0];
}

function isPageReload() {
  if (typeof performance === 'undefined') return false;
  const nav = performance.getEntriesByType?.('navigation')?.[0];
  return nav?.type === 'reload';
}

/**
 * Soft “Variant 1” morning scene for dashboard overview: lavender & iris (sway),
 * mug + book + steam, handwritten quote — new on full refresh or remount after login;
 * stable while you move between dashboard sub-pages in the same tab.
 */
export function SanctuaryCozyOverviewBackground({ storageScope = 'student' }) {
  const [quote] = useState(() => {
    const sk = mugQuoteStorageKey(storageScope);
    const reload = isPageReload();
    if (!reload && typeof sessionStorage !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(sk);
        if (saved) return saved;
      } catch {
        /* ignore */
      }
    }
    const line = pickRandomQuote();
    try {
      sessionStorage.setItem(sk, line);
    } catch {
      /* ignore */
    }
    return line;
  });

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      data-testid="sanctuary-cozy-overview-bg"
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 55% at 12% 8%, rgba(230, 210, 255, 0.75) 0%, transparent 58%), radial-gradient(ellipse 55% 50% at 92% 12%, rgba(255, 228, 210, 0.55) 0%, transparent 52%), radial-gradient(ellipse 70% 45% at 70% 95%, rgba(255, 240, 220, 0.5) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 0% 85%, rgba(210, 190, 250, 0.4) 0%, transparent 50%), linear-gradient(165deg, #f5efff 0%, #fff9f6 38%, #fdf7ff 72%, #f8f4ff 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '180px',
        }}
      />
      {/* Soft bokeh orbs */}
      <div
        className="absolute rounded-full pointer-events-none blur-3xl opacity-40"
        style={{
          width: 'min(42vw, 420px)',
          height: 'min(42vw, 420px)',
          left: '-8%',
          top: '18%',
          background: 'radial-gradient(circle, rgba(196, 181, 253, 0.5) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute rounded-full pointer-events-none blur-3xl opacity-35"
        style={{
          width: 'min(38vw, 380px)',
          height: 'min(38vw, 380px)',
          right: '-6%',
          bottom: '8%',
          background: 'radial-gradient(circle, rgba(253, 224, 200, 0.45) 0%, transparent 72%)',
        }}
      />

      <div className="absolute left-0 right-0 bottom-0 h-[min(58vh,560px)] pointer-events-none">
        <svg
          className="absolute bottom-0 left-1/2 w-[min(1400px,220%)] max-w-none -translate-x-1/2 h-full"
          viewBox="0 0 1000 520"
          preserveAspectRatio="xMidYMax meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="sanctuary-book" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5b21b6" />
              <stop offset="100%" stopColor="#4c1d95" />
            </linearGradient>
            <linearGradient id="sanctuary-mug-shade" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f8f8ff" />
              <stop offset="45%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#ebe4f7" />
            </linearGradient>
            <filter id="sanctuary-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#4c1d95" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* Book */}
          <g transform="translate(620, 280)">
            <rect x="0" y="40" width="200" height="36" rx="3" fill="url(#sanctuary-book)" opacity="0.95" />
            <rect x="4" y="36" width="192" height="8" rx="2" fill="#faf5ff" opacity="0.85" />
            <rect x="0" y="44" width="200" height="4" fill="#ffffff" opacity="0.35" />
          </g>

          {/* Mug */}
          <g filter="url(#sanctuary-soft-shadow)" transform="translate(638, 168)">
            <path
              d="M 12 32 Q 12 8 48 8 L 132 8 Q 168 8 168 32 L 168 168 Q 168 196 150 208 L 30 208 Q 12 196 12 168 Z"
              fill="url(#sanctuary-mug-shade)"
              stroke="rgba(139, 92, 246, 0.12)"
              strokeWidth="1"
            />
            <ellipse cx="90" cy="32" rx="78" ry="14" fill="#ffffff" opacity="0.92" />
            <ellipse cx="90" cy="32" rx="72" ry="10" fill="#c4b5fd" opacity="0.22" />
            <path
              d="M 168 72 Q 210 72 210 112 Q 210 152 168 152"
              fill="none"
              stroke="#e9d5ff"
              strokeWidth="14"
              strokeLinecap="round"
              opacity="0.9"
            />
          </g>

          {/* Steam wisps — nested group so CSS keyframes translateY does not drop base position */}
          <g transform="translate(700, 140)">
            <g className="sanctuary-cozy-overview-steam" style={{ animationDelay: '0s' }}>
              <path
                d="M 0 0 Q 10 -24 4 -50 Q -2 -78 -8 -104"
                fill="none"
                stroke="rgba(255,255,255,0.78)"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.9"
              />
            </g>
          </g>
          <g transform="translate(726, 146)">
            <g className="sanctuary-cozy-overview-steam" style={{ animationDelay: '-1.4s' }}>
              <path
                d="M 0 0 Q -12 -22 -4 -48 Q 8 -74 2 -102"
                fill="none"
                stroke="rgba(255,255,255,0.68)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          </g>
          <g transform="translate(752, 150)">
            <g className="sanctuary-cozy-overview-steam" style={{ animationDelay: '-2.7s' }}>
              <path
                d="M 0 0 Q 8 -20 -2 -44 Q -10 -70 -6 -98"
                fill="none"
                stroke="rgba(255,255,255,0.58)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          </g>

          {/* Lavender + iris — left */}
          <g className="sanctuary-cozy-overview-floral" transform="translate(-20, 40)">
            {/* Stems */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path
                key={`lav-stem-${i}`}
                d={`M ${80 + i * 28} 420 Q ${70 + i * 28} ${320 - i * 12} ${88 + i * 26} ${200 + (i % 3) * 20}`}
                fill="none"
                stroke="#6b7280"
                strokeWidth="1.2"
                opacity="0.35"
              />
            ))}
            {/* Lavender florets */}
            {[...Array(24)].map((_, i) => {
              const x = 65 + (i % 8) * 22 + (i % 3) * 4;
              const y = 210 + Math.floor(i / 8) * 55 + (i % 5) * 3;
              return (
                <circle key={`lav-dot-${i}`} cx={x} cy={y} r="2.2" fill="#7c3aed" opacity="0.55" />
              );
            })}
            {/* Iris blooms */}
            <g transform="translate(120, 180)">
              <ellipse cx="0" cy="0" rx="28" ry="12" fill="#6d28d9" opacity="0.9" transform="rotate(-15)" />
              <ellipse cx="8" cy="-4" rx="26" ry="11" fill="#7c3aed" opacity="0.88" transform="rotate(35)" />
              <ellipse cx="-10" cy="2" rx="24" ry="10" fill="#5b21b6" opacity="0.92" transform="rotate(-50)" />
              <ellipse cx="0" cy="-2" rx="10" ry="8" fill="#fbbf24" opacity="0.9" />
            </g>
            <g transform="translate(200, 220) scale(0.85)">
              <ellipse cx="0" cy="0" rx="28" ry="12" fill="#5b21b6" opacity="0.88" transform="rotate(10)" />
              <ellipse cx="6" cy="-6" rx="26" ry="11" fill="#7c3aed" opacity="0.85" transform="rotate(55)" />
              <ellipse cx="-8" cy="4" rx="22" ry="9" fill="#6d28d9" opacity="0.9" transform="rotate(-40)" />
              <ellipse cx="0" cy="-2" rx="9" ry="7" fill="#fbbf24" opacity="0.88" />
            </g>
          </g>

          <g className="sanctuary-cozy-overview-floral-delayed" transform="translate(40, 60)">
            <g transform="translate(260, 300)">
              <path
                d="M 0 100 Q -20 40 0 0"
                fill="none"
                stroke="#6b7280"
                strokeWidth="1"
                opacity="0.3"
              />
              <ellipse cx="0" cy="0" rx="22" ry="9" fill="#5b21b6" opacity="0.85" transform="rotate(-20)" />
              <ellipse cx="6" cy="-4" rx="20" ry="8" fill="#7c3aed" opacity="0.82" transform="rotate(40)" />
              <ellipse cx="-6" cy="2" rx="18" ry="8" fill="#6d28d9" opacity="0.88" transform="rotate(-45)" />
              <ellipse cx="0" cy="-1" rx="7" ry="6" fill="#fbbf24" opacity="0.9" />
            </g>
          </g>
        </svg>

        {/* Mug quote — aligned to illustrated mug face */}
        <div
          className="absolute z-[1] flex items-center justify-center text-center px-1"
          style={{
            left: '50%',
            marginLeft: 'clamp(-6rem, -12vw, -4.5rem)',
            bottom: 'clamp(7.5rem, 18vh, 11rem)',
            width: 'clamp(7.5rem, 22vw, 11.5rem)',
            minHeight: 'clamp(4rem, 12vh, 7rem)',
          }}
        >
          <p
            className="sanctuary-cozy-overview-quote m-0 font-normal"
            style={{
              fontSize: 'clamp(0.95rem, 2.4vw, 1.35rem)',
            }}
          >
            {quote}
          </p>
        </div>
      </div>
    </div>
  );
}

export default SanctuaryCozyOverviewBackground;
