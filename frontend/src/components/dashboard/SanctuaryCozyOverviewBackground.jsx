import React, { useState } from 'react';
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
 * Dashboard overview: full-bleed studio poster (iris, lavender, white mug, book, candle)
 * with the same lavender/cream palette, gentle motion, rising steam SVG, and dynamic mug quote.
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
      {/* Base wash — matches poster lavender wall when image loads */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 70% at 50% 20%, rgba(245, 240, 255, 0.95) 0%, rgba(230, 210, 250, 0.5) 45%, transparent 70%), linear-gradient(165deg, #ede4f7 0%, #f8f4ff 35%, #fdf8f5 70%, #f3ecfc 100%)',
        }}
      />

      {/* Photo layer — studio poster still life; whole scene breathes like a light breeze */}
      <div className="absolute inset-0 z-[1] overflow-hidden">
        <div className="sanctuary-cozy-hero-breeze absolute inset-[-5%_-4%_-8%_-4%]">
          <img
            src={HERO_SRC}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_72%] select-none"
            draggable={false}
          />
        </div>
      </div>

      {/* Light scrim — keeps dashboard copy readable without washing out purples */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(255, 252, 250, 0.52) 0%, rgba(255, 250, 252, 0.22) 18%, rgba(253, 248, 255, 0.06) 42%, rgba(248, 242, 255, 0.14) 100%)',
        }}
      />
      <div
        className="absolute inset-0 z-[2] pointer-events-none opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 55% 40% at 70% 88%, rgba(124, 58, 237, 0.08) 0%, transparent 65%)',
        }}
      />

      {/* Grain */}
      <div
        className="absolute inset-0 z-[2] opacity-[0.035] mix-blend-multiply pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '180px',
        }}
      />

      {/* Animated steam — sits over the mug; positions tuned for this poster crop */}
      <div className="absolute inset-0 z-[3] pointer-events-none overflow-hidden">
        <svg
          className="absolute w-[min(100%,520px)] h-[min(45vh,320px)]"
          style={{
            left: 'clamp(38%, 44vw, 52%)',
            bottom: 'clamp(10%, 14vh, 20%)',
            transform: 'translateX(-40%)',
          }}
          viewBox="0 0 200 180"
          preserveAspectRatio="xMidYMax meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform="translate(96, 168)">
            <g className="sanctuary-cozy-overview-steam" style={{ animationDelay: '0s' }}>
              <path
                d="M 0 0 Q 10 -28 2 -58 Q -8 -90 -4 -122"
                fill="none"
                stroke="rgba(255,255,255,0.82)"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </g>
          </g>
          <g transform="translate(118, 172)">
            <g className="sanctuary-cozy-overview-steam" style={{ animationDelay: '-1.3s' }}>
              <path
                d="M 0 0 Q -14 -26 -2 -54 Q 10 -82 -4 -118"
                fill="none"
                stroke="rgba(255,255,255,0.72)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
          </g>
          <g transform="translate(78, 170)">
            <g className="sanctuary-cozy-overview-steam" style={{ animationDelay: '-2.5s' }}>
              <path
                d="M 0 0 Q 6 -22 -6 -48 Q -12 -78 -8 -108"
                fill="none"
                stroke="rgba(255,255,255,0.62)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          </g>
        </svg>
      </div>

      {/* Mug quote — frosted patch over printed mug text; dynamic line */}
      <div
        className="absolute z-[4] flex items-center justify-center pointer-events-none"
        style={{
          left: '50%',
          bottom: 'clamp(7rem, 17vh, 11rem)',
          transform: 'translateX(-50%)',
          width: 'clamp(10.5rem, 32vw, 15rem)',
          minHeight: 'clamp(4.25rem, 11vh, 6.5rem)',
          padding: '0.45rem 0.65rem',
          borderRadius: '42% 42% 48% 48% / 38% 38% 55% 55%',
          background: 'linear-gradient(165deg, rgba(255,255,255,0.94) 0%, rgba(252, 250, 255, 0.88) 100%)',
          boxShadow:
            'inset 0 1px 2px rgba(255,255,255,0.95), 0 2px 12px rgba(91, 33, 182, 0.07)',
        }}
      >
        <p
          className="sanctuary-cozy-overview-quote m-0 w-full text-center font-normal leading-snug px-0.5"
          style={{
            fontSize: 'clamp(0.88rem, 2.5vw, 1.28rem)',
          }}
        >
          {quote}
        </p>
      </div>
    </div>
  );
}

export default SanctuaryCozyOverviewBackground;
