import React, { useState, useId } from 'react';
import { SANCTUARY_MUG_QUOTES } from './sanctuaryCozyQuotes';

const HERO_SRC = `${process.env.PUBLIC_URL || ''}/dashboard/sanctuary-cozy-hero.png`;

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
 * Iris Path–style field: warm lavender, iris left, mug + book right (reference art).
 * Reference PNG is a full mockup — we crop left / right so only the scenic design shows,
 * not the sample UI in the middle. Dynamic gold script on the mug; heart steam overlay.
 */
export function SanctuaryCozyOverviewBackground({ storageScope = 'student' }) {
  const steamGlowId = useId().replace(/:/g, '');
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
      {/* Base — golden-hour lavender (matches reference lighting) */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 92% 8%, rgba(255, 228, 190, 0.42) 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 8% 85%, rgba(216, 180, 254, 0.35) 0%, transparent 55%),
            radial-gradient(ellipse 90% 45% at 50% 100%, rgba(245, 230, 255, 0.5) 0%, transparent 60%),
            linear-gradient(165deg, #ebe3f7 0%, #f8f2ff 38%, #fff8f0 72%, #f3ebfc 100%)
          `,
        }}
      />

      {/* Scenic halves — hides mockup UI band in the center of the reference image */}
      <div className="absolute inset-0 z-[1] overflow-hidden">
        <div className="absolute inset-[-6%_-3%_-10%_-3%] flex">
          <div className="relative h-full w-[48%] max-md:w-[52%] overflow-hidden">
            <div className="sanctuary-cozy-overview-floral absolute inset-[-4%_-18%_-6%_-12%]">
              <img
                src={HERO_SRC}
                alt=""
                draggable={false}
                className="absolute h-[112%] max-md:h-[118%] bottom-0 left-0 w-auto min-w-[320%] max-w-none object-cover object-left pointer-events-none select-none"
                style={{ objectPosition: '8% 38%' }}
              />
            </div>
          </div>
          <div
            className="h-full w-[4%] max-md:w-[2%] shrink-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(253, 251, 255, 0.85) 0%, rgba(244, 235, 255, 0.75) 45%, rgba(250, 245, 255, 0.9) 100%)',
            }}
          />
          <div className="relative h-full flex-1 overflow-hidden">
            <div className="sanctuary-cozy-overview-floral-delayed absolute inset-[-4%_-12%_-6%_-18%]">
              <img
                src={HERO_SRC}
                alt=""
                draggable={false}
                className="absolute h-[112%] max-md:h-[118%] bottom-0 right-0 w-auto min-w-[320%] max-w-none object-cover object-right pointer-events-none select-none"
                style={{ objectPosition: '92% 42%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Soft scrim — readability + downplays any seam */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(255, 252, 248, 0.5) 0%, rgba(255, 250, 252, 0.18) 25%, rgba(253, 248, 255, 0.05) 48%, rgba(248, 242, 255, 0.12) 100%)',
        }}
      />
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 58% 50% at 50% 40%, rgba(255, 253, 250, 0.55) 0%, transparent 62%)',
        }}
      />

      <div
        className="absolute inset-0 z-[2] opacity-[0.03] mix-blend-multiply pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '180px',
        }}
      />

      {/* Heart steam + soft wisps — right still-life (mug) */}
      <div className="absolute inset-0 z-[3] pointer-events-none overflow-hidden">
        <svg
          className="absolute h-[min(42vh,300px)] w-[min(88vw,380px)]"
          style={{
            right: 'clamp(4%, 8vw, 14%)',
            bottom: 'clamp(9%, 15vh, 22%)',
          }}
          viewBox="0 0 200 200"
          preserveAspectRatio="xMidYMax meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id={steamGlowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g transform="translate(100, 192)">
            <g className="sanctuary-cozy-steam-heart" filter={`url(#${steamGlowId})`}>
              <path
                d="M 0 14 C -22 -10 -38 12 -20 34 C -8 48 0 56 0 56 C 0 56 8 48 20 34 C 38 12 22 -10 0 14 Z"
                fill="rgba(255,255,255,0.38)"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1"
                transform="scale(1.15)"
              />
            </g>
          </g>
          <g transform="translate(124, 182)">
            <g className="sanctuary-cozy-overview-steam" style={{ animationDelay: '-1.1s' }}>
              <path
                d="M 0 0 Q 8 -22 2 -48 Q -6 -74 -2 -102"
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          </g>
          <g transform="translate(78, 184)">
            <g className="sanctuary-cozy-overview-steam" style={{ animationDelay: '-2.4s' }}>
              <path
                d="M 0 0 Q -10 -20 -2 -44 Q 8 -70 2 -98"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          </g>
        </svg>
      </div>

      {/* Mug quote — lavender glass, gold script (Iris Path reference) */}
      <div
        className="absolute z-[4] flex items-center justify-center pointer-events-none"
        style={{
          right: 'clamp(5%, 10vw, 12%)',
          left: 'auto',
          bottom: 'clamp(7.5rem, 19vh, 12.5rem)',
          width: 'clamp(10rem, 28vw, 15.5rem)',
          minHeight: 'clamp(4rem, 12vh, 7rem)',
          padding: '0.5rem 0.65rem',
          borderRadius: '46% 46% 52% 52% / 40% 40% 58% 58%',
          background: 'linear-gradient(165deg, rgba(250, 245, 255, 0.82) 0%, rgba(235, 225, 252, 0.72) 100%)',
          boxShadow:
            'inset 0 1px 3px rgba(255,255,255,0.85), 0 4px 20px rgba(91, 33, 182, 0.08)',
          border: '1px solid rgba(255,255,255,0.5)',
        }}
      >
        <p
          className="sanctuary-cozy-overview-quote m-0 w-full text-center font-normal leading-snug px-0.5"
          style={{
            fontSize: 'clamp(0.82rem, 2.35vw, 1.22rem)',
          }}
        >
          {quote}
        </p>
      </div>
    </div>
  );
}

export default SanctuaryCozyOverviewBackground;
