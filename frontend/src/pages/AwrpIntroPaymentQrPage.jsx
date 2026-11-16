import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
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

export default function AwrpIntroPaymentQrPage() {
  const { setPageSeo, clearPageSeo } = useSeoPage();
  const [program, setProgram] = useState(null);
  const [plink, setPlink] = useState(null);
  const [plinkError, setPlinkError] = useState('');
  const [plinkLoading, setPlinkLoading] = useState(true);

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
      title: `${AWRP_INTRO_PROGRAM_TITLE} — Razorpay payment QR`,
      description: 'Scan the official Razorpay payment link QR for the AWRP Intro Call.',
      noIndex: true,
    });
    return () => clearPageSeo();
  }, [setPageSeo, clearPageSeo]);

  useEffect(() => {
    setPlinkLoading(true);
    setPlinkError('');
    axios
      .get(`${API}/landing/awrp-intro/razorpay-payment-link`)
      .then((r) => setPlink(r.data))
      .catch((err) => {
        setPlink(null);
        setPlinkError(err.response?.data?.detail || 'Could not load Razorpay payment link.');
      })
      .finally(() => setPlinkLoading(false));
  }, []);

  const indiaAmount = Number(program?.offer_price_inr) > 0
    ? Number(program.offer_price_inr)
    : (Number(program?.price_inr) > 0 ? Number(program.price_inr) : 2500);
  const priceText = `₹${(plink?.amount_inr ?? indiaAmount).toLocaleString()}`;
  const qrUrl = (plink?.short_url || '').trim();

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
        <p className="text-sm text-[#6b5a45] mb-8 leading-relaxed">
          Scan this <strong>Razorpay payment link</strong> QR. After payment you get the same confirmation email and WhatsApp links as the booking page.
        </p>

        {plinkLoading ? (
          <div className="py-12 flex flex-col items-center gap-3 text-gray-500">
            <Loader2 className="animate-spin text-[#6d2d91]" size={28} />
            <span className="text-sm">Preparing Razorpay QR…</span>
          </div>
        ) : null}

        {!plinkLoading && qrUrl ? (
          <LandingPageQrCode
            url={qrUrl}
            title="Official Razorpay payment QR"
            size={220}
            downloadName="awrp-intro-razorpay-payment-qr"
          />
        ) : null}

        {!plinkLoading && !qrUrl ? (
          <p className="text-sm text-red-600 mb-6" data-testid="plink-error">
            {plinkError || 'Razorpay payment link is unavailable. Check API keys in admin.'}
          </p>
        ) : null}

        {qrUrl ? (
          <p className="text-[10px] text-gray-400 break-all font-mono mt-4">{qrUrl}</p>
        ) : null}

        <div className="mt-10 space-y-3 text-sm">
          <Link
            to={AWRP_INTRO_LANDING_PATH_INDIA}
            className="inline-block rounded-full px-8 py-3 font-semibold text-[#1c1230]"
            style={{ background: GOLD }}
          >
            Use booking form instead
          </Link>
          <p className="text-[11px] text-gray-500 leading-relaxed max-w-sm mx-auto">
            Razorpay will ask for name, email, and phone on their payment page. For Meta ads tracking, you can still send people to the full landing URL.
          </p>
        </div>
      </main>
    </div>
  );
}