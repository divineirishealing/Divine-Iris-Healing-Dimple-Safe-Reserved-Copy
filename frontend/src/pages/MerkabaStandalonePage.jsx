import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import MerkabaWeightReleasePage from '../components/dashboard/MerkabaWeightReleasePage';

/**
 * Standalone personal Merkaba — not under /dashboard, not linked from the main site nav.
 * URL: /merkaba
 */
const MerkabaStandalonePage = () => (
  <div
    className="min-h-screen font-lato antialiased"
    style={{
      background: 'linear-gradient(165deg, #020006 0%, #0a0418 38%, #030008 100%)',
    }}
    data-testid="merkaba-standalone"
  >
    <Helmet>
      <title>Divine Merkaba · personal</title>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
    <div className="max-w-6xl mx-auto px-3 md:px-6 pt-3 pb-16">
      <p className="text-center text-[10px] text-white/35 mb-3">
        <span className="text-white/50">Your link:</span>{' '}
        <code className="text-[#D4AF37]/80 text-[10px] break-all sm:break-normal">
          {typeof window !== 'undefined' ? `${window.location.origin}/merkaba` : '/merkaba'}
        </code>
        <span className="mx-2 text-white/20">|</span>
        <Link to="/" className="text-violet-300/70 hover:text-violet-200 underline-offset-2 hover:underline">
          divineirishealing.com home
        </Link>
      </p>
      <MerkabaWeightReleasePage />
    </div>
  </div>
);

export default MerkabaStandalonePage;
