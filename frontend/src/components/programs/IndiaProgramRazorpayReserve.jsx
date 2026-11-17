import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Lock, Monitor, Wifi } from 'lucide-react';
import { GOLD, HEADING } from '../../lib/designTokens';
import { websiteVisibleTierEntries } from '../../lib/programTierVisibility';
import { getApiUrl } from '../../lib/config';
import { programInrListPrice, programInrOfferPrice } from '../../lib/indiaProgramLanding';

const apiBase = () => getApiUrl();

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay'));
    document.body.appendChild(s);
  });
}

/**
 * India Razorpay checkout block — embedded on full program detail (surface=india-razorpay).
 */
export default function IndiaProgramRazorpayReserve({
  program,
  tierIndex,
  onTierIndexChange,
  accent = GOLD,
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const programId = program?.id;

  const [quote, setQuote] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState('online');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const tierEntries = useMemo(
    () => (program ? websiteVisibleTierEntries(program) : []),
    [program],
  );

  const hybrid =
    program?.program_type === 'hybrid' ||
    program?.program_type === 'both' ||
    String(program?.attendance_modes || '').includes('offline');

  const fetchQuote = useCallback(
    async (tier) => {
      if (!programId) return null;
      const { data } = await axios.get(`${apiBase()}/landing/india-program/${programId}/quote`, {
        params: { tier_index: tier },
      });
      return data;
    },
    [programId],
  );

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    (async () => {
      try {
        const q = await fetchQuote(tierIndex);
        if (!cancelled) setQuote(q);
      } catch {
        if (!cancelled) setQuote(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, tierIndex, fetchQuote]);

  /** Same INR as hero / homepage cards — not GST-stacked cart math. */
  const catalogInr = useMemo(() => {
    if (!program) return 0;
    const offer = programInrOfferPrice(program, tierIndex);
    if (offer > 0) return offer;
    return programInrListPrice(program, tierIndex);
  }, [program, tierIndex]);

  const payableInr = useMemo(() => {
    const fromQuote = quote?.charged_inr != null ? Number(quote.charged_inr) : null;
    if (catalogInr > 0) {
      if (fromQuote != null && fromQuote > catalogInr + 0.01) return catalogInr;
      return fromQuote != null && fromQuote > 0 ? fromQuote : catalogInr;
    }
    return fromQuote;
  }, [catalogInr, quote?.charged_inr]);

  const priceText = payableInr != null && payableInr > 0 ? `₹${Number(payableInr).toLocaleString()}` : '—';

  const pay = async (event) => {
    event.preventDefault();
    if (!quote?.razorpay_enabled) {
      setError('Razorpay is not configured. Please contact support.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await loadRazorpayScript();
      const { data: co } = await axios.post(`${apiBase()}/landing/india-program/${programId}/checkout`, {
        name,
        email,
        phone,
        tier_index: tierIndex,
        attendance_mode: mode,
        utm_source: searchParams.get('utm_source') || '',
        utm_medium: searchParams.get('utm_medium') || '',
        utm_campaign: searchParams.get('utm_campaign') || '',
        utm_content: searchParams.get('utm_content') || '',
      });
      const expectedPaise = catalogInr > 0 ? Math.round(catalogInr * 100) : null;
      if (expectedPaise != null && co?.amount != null && Math.abs(Number(co.amount) - expectedPaise) > 1) {
        setError(
          `Payment total must be ₹${Number(catalogInr).toLocaleString()} (same as the program card). `
          + 'Refresh the page and try again, or contact support if this persists.',
        );
        setBusy(false);
        return;
      }
      const rzp = new window.Razorpay({
        key: co.key_id,
        amount: co.amount,
        currency: co.currency,
        order_id: co.order_id,
        name: 'Divine Iris Healing',
        description: co.description,
        method: { upi: true, card: true, netbanking: true, wallet: true },
        prefill: { name: co.name, email: co.email, contact: co.phone },
        handler: async (response) => {
          try {
            await axios.post(`${apiBase()}/payments/razorpay/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            navigate(`/payment/success?session_id=${encodeURIComponent(co.session_id)}`);
          } catch (err) {
            setError(
              err.response?.data?.detail || 'Payment verification failed. Contact us with your payment reference.',
            );
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on('payment.failed', () => {
        setError('Payment was not completed.');
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const first = Array.isArray(detail) ? detail[0]?.msg : detail;
      setError(typeof first === 'string' ? first : err.message || 'Something went wrong.');
      setBusy(false);
    }
  };

  if (!program) return null;

  return (
    <section
      id="india-razorpay-reserve"
      className="py-14 md:py-16 bg-[#f8f8f8]"
      data-testid="india-razorpay-reserve-section"
    >
      <div className="container mx-auto px-4 max-w-lg">
        <h2 className="text-center text-2xl md:text-3xl mb-2" style={{ ...HEADING, color: accent }}>
          Reserve your seat
        </h2>
        <p className="text-center text-sm text-gray-600 mb-8">
          India checkout — pay securely with Razorpay (UPI, cards, netbanking)
        </p>

        <div className="rounded-2xl border bg-white p-6 md:p-8 shadow-sm" style={{ borderColor: `${accent}55` }}>
          <p className="text-center text-3xl mb-6" style={{ ...HEADING, color: accent }}>
            {priceText}
          </p>

          {tierEntries.length > 1 && (
            <>
              <label className="block text-xs font-semibold mb-1 text-gray-700">Pricing option</label>
              <select
                className="w-full mb-4 rounded-xl border px-3 py-2.5 text-sm"
                value={tierIndex}
                onChange={(e) => onTierIndexChange?.(parseInt(e.target.value, 10))}
                data-testid="india-landing-tier"
              >
              {tierEntries.map(({ tier, catalogIndex }) => (
                <option key={catalogIndex} value={catalogIndex}>
                  {tier?.label || `Option ${catalogIndex + 1}`}
                </option>
              ))}
              </select>
            </>
          )}

          {hybrid && (
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMode('online')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium ${
                  mode === 'online' ? 'bg-white' : 'border-gray-200'
                }`}
                style={mode === 'online' ? { borderColor: accent, background: `${accent}12` } : undefined}
              >
                <Monitor size={14} /> Online (Zoom)
              </button>
              <button
                type="button"
                onClick={() => setMode('offline')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium ${
                  mode === 'offline' ? 'bg-white' : 'border-gray-200'
                }`}
                style={mode === 'offline' ? { borderColor: accent, background: `${accent}12` } : undefined}
              >
                <Wifi size={14} /> Offline (Remote)
              </button>
            </div>
          )}

          <form onSubmit={pay} className="space-y-3" data-testid="india-program-razorpay-form">
            <input
              required
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            />
            <input
              required
              inputMode="tel"
              placeholder="Phone (+91 …)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            />
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <button
              type="submit"
              disabled={busy || !quote?.razorpay_enabled}
              className="w-full rounded-full py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-white disabled:opacity-60"
              style={{ background: accent }}
              data-testid="india-program-pay-btn"
            >
              {busy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Opening Razorpay…
                </span>
              ) : (
                `Pay ${priceText} with Razorpay`
              )}
            </button>
            <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
              <Lock size={11} />
              Secure payment
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}