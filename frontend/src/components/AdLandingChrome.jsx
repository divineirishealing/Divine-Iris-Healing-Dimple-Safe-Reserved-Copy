import React from 'react';
import { HEADING, BODY } from '../lib/designTokens';

/** Minimal chrome for India ad landings — no site nav, cart, login, or internal routes. */
export function AdLandingHeader({ accentColor = '#6d2d91' }) {
  return (
    <header
      className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#eadfca] py-3 px-4"
      data-testid="ad-landing-header"
    >
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-sm md:text-base tracking-[0.2em] uppercase" style={{ ...HEADING, color: accentColor }}>
          Divine Iris · Soulful Healing Studio
        </p>
      </div>
    </header>
  );
}

export function AdLandingFooter({ children, dark = false }) {
  return (
    <footer
      className={`py-8 px-6 text-center text-xs leading-relaxed ${dark ? 'text-white/75 bg-[#1c1230]' : 'text-[#6b5a45]'}`}
      data-testid="ad-landing-footer"
    >
      {children}
    </footer>
  );
}

export function AdLandingSuccessShell({ children }) {
  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#2b241c]">
      <AdLandingHeader />
      <main className="pt-6 pb-16 px-4">{children}</main>
      <AdLandingFooter dark>
        <p style={BODY}>Thank you for registering. Check your email for confirmation details.</p>
        <p className="mt-3 opacity-80">Divine Iris · Soulful Healing Studio</p>
      </AdLandingFooter>
    </div>
  );
}