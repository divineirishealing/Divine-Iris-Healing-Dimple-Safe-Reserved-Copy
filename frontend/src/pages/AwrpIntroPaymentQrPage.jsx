import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AdLandingHeader } from '../components/AdLandingChrome';
import LandingPageQrCode from '../components/LandingPageQrCode';
import { useSeoPage } from '../context/SeoPageContext';
import { HEADING, GOLD } from '../lib/designTokens';
import {
  AWRP_INTRO_LANDING_PATH_INDIA,
  AWRP_INTRO_PROGRAM_ID,
  AWRP_INTRO_PROGRAM_TITLE,
  findAwrpIntroProgram,
  isAwrpIntroProgram,
} from '../lib/awrpIntroProgram';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AWRP_PURPLE = '#6d2d91';

/**
 * Standalone print/share page — QR opens the India landing where Razorpay checkout runs.
 * Not linked from the public landing (use this URL in ads collateral only).
 */
export default function AwrpIntroPaymentQrPage() {
  const [searchParams] = useSearchParams();
  const { setPageSeo, clearPageSeo } = useSeoPage();
  const [program, setProgram] = useState(null);

  useEffect(() => {
    const applyProgram = (data) => {
      if (data && isAwrpIntroProgram(data)) setProgram(data);
    };
    if (AWRP_INTRO_PROGRAM_ID) {
      axios
        .get(`${API}/programs/${AWRP_INTRO_PROGRAM_ID}`)
        .then((r) => applyProgram(r.data))
        .catch(() => {
          axios.get(`${API}/programs`).then((r) => setProgram(findAwrpIntroProgram(r.data)));
        });
      return;
    }
    axios.get(`${API}/programs`).then((r) => {
      setProgram(findAwrpIntroProgram(r.data));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setPageSeo({
      title: `${AWRP_INTRO_PROGRAM_TITLE} — payment QR`,
      description: 'Scan to open the AWRP Intro Call booking and Razorpay payment page.',
      noIndex: true,
    });
    return () => clearPageSeo();
  }, [setPageSeo, clearPageSeo]);

  const indiaAmount = Number(program?.offer_price_inr) > 0
    ? Number(program.offer_price_inr)
    : (Number(program?.price_inr) > 0 ? Number(program.price_inr) : 2500);
  const priceText = `₹${indiaAmount.toLocaleString()}`;

  const paymentLandingUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const target = new URL(AWRP_INTRO_LANDING_PATH_INDIA, window.location.origin);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
    utmKeys.forEach((key) => {
      const v = searchParams.get(key);
      if (v) target.searchParams.set(key, v);
    });
    if (!target.searchParams.get('utm_medium')) {
      target.searchParams.set('utm_medium', 'qr');
    }
    return target.href;
  }, [searchParams]);

  const pageSelfUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}${window.location.search}`;
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#2b241c]" data-testid="awrp-intro-payment-qr-page">
      <AdLandingHeader accentColor={AWRP_PURPLE} />
      <main className="container mx-auto px-6 py-12 md:py-16 max-w-md text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-[#6b5a45] mb-2">Divine Iris Healing</p>
        <h1 className="text-2xl md:text-3xl mb-2" style={{ ...HEADING, color: AWRP_PURPLE }}>
          {program?.title || AWRP_INTRO_PROGRAM_TITLE}
        </h1>
        <p className="text-lg font-semibold mb-1" style={{ color: '#1c1230' }}>
          Pay {priceText} via Razorpay
        </p>
        <p className="text-sm text-[#6b5a45] mb-10 leading-relaxed">
          Scan the code to open the secure booking page on your phone, enter your details, and complete payment (UPI, card, or netbanking).
        </p>

        {paymentLandingUrl ? (
          <LandingPageQrCode
            url={paymentLandingUrl}
            title="Scan to book and pay"
            size={220}
            downloadName="awrp-intro-india-payment-qr"
          />
        ) : null}

        <div className="mt-10 space-y-3 text-sm">
          <Link
            to={AWRP_INTRO_LANDING_PATH_INDIA}
            className="inline-block rounded-full px-8 py-3 font-semibold text-[#1c1230]"
            style={{ background: GOLD }}
          >
            Open booking page
          </Link>
          <p className="text-[11px] text-gray-500 leading-relaxed max-w-sm mx-auto">
            This is not a direct UPI collect QR. Each payment is completed on the booking page through Razorpay.
          </p>
        </div>

        {pageSelfUrl ? (
          <p className="mt-12 text-[10px] text-gray-400 break-all font-mono" title="Share this page to print or save the QR">
            QR page: {pageSelfUrl}
          </p>
        ) : null}
      </main>
    </div>
  );
}