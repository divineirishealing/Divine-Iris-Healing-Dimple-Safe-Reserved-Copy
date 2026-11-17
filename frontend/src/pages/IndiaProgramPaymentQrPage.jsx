import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { AdLandingHeader } from '../components/AdLandingChrome';
import LandingPageQrCode from '../components/LandingPageQrCode';
import { useSeoPage } from '../context/SeoPageContext';
import { HEADING, GOLD } from '../lib/designTokens';
import { indiaProgramRazorpayPath } from '../lib/indiaProgramLanding';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ACCENT = '#6d2d91';

export default function IndiaProgramPaymentQrPage() {
  const { id: programId } = useParams();
  const { setPageSeo, clearPageSeo } = useSeoPage();
  const [program, setProgram] = useState(null);
  const [plink, setPlink] = useState(null);
  const [plinkError, setPlinkError] = useState('');
  const [plinkLoading, setPlinkLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    axios
      .get(`${API}/programs/${programId}`)
      .then((r) => setProgram(r.data))
      .catch(() => setProgram(null));
  }, [programId]);

  useEffect(() => {
    const title = program?.title || 'Workshop';
    setPageSeo({
      title: `${title} — Razorpay payment QR`,
      description: `Scan the official Razorpay payment link QR for ${title}.`,
      noIndex: true,
    });
    return () => clearPageSeo();
  }, [program?.title, setPageSeo, clearPageSeo]);

  useEffect(() => {
    if (!programId) return undefined;
    setPlinkLoading(true);
    setPlinkError('');
    axios
      .get(`${API}/landing/india-program/${programId}/razorpay-payment-link`)
      .then((r) => setPlink(r.data))
      .catch((err) => {
        setPlink(null);
        setPlinkError(err.response?.data?.detail || 'Could not load Razorpay payment link.');
      })
      .finally(() => setPlinkLoading(false));
  }, [programId]);

  const landingPath = program ? indiaProgramRazorpayPath(program) : `/india/program/${programId}`;
  const displayInr = plink?.amount_inr > 0 ? plink.amount_inr : null;
  const priceText = displayInr != null ? `₹${displayInr.toLocaleString()}` : '…';
  const qrUrl = (plink?.short_url || '').trim();
  const slug = (program?.title || 'workshop').replace(/\s+/g, '-').toLowerCase().slice(0, 40);

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#2b241c]" data-testid="india-program-payment-qr-page">
      <AdLandingHeader accentColor={ACCENT} />
      <main className="container mx-auto px-6 py-12 md:py-16 max-w-md text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-[#6b5a45] mb-2">Divine Iris Healing · India</p>
        <h1 className="text-2xl md:text-3xl mb-2" style={{ ...HEADING, color: ACCENT }}>
          {program?.title || 'Workshop'}
        </h1>
        <p className="text-lg font-semibold mb-1" style={{ color: '#1c1230' }}>
          Pay {priceText} via Razorpay
        </p>
        <p className="text-sm text-[#6b5a45] mb-8 leading-relaxed">
          Scan this <strong>Razorpay payment link</strong> QR. After payment you receive confirmation email and WhatsApp links like on the booking page.
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
            downloadName={`${slug}-razorpay-payment-qr`}
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
            to={landingPath}
            className="inline-block rounded-full px-8 py-3 font-semibold text-[#1c1230]"
            style={{ background: GOLD }}
          >
            Use booking form instead
          </Link>
        </div>
      </main>
    </div>
  );
}