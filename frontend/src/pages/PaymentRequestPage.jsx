import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { formatDateDMonYyyyUpper } from '@/lib/utils';
import { Sparkles, ShieldCheck, AlertTriangle, Loader2, CreditCard, Calendar } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SITE_NAME = 'Divine Iris Healing';

const CUR_SYMBOL = { aed: 'AED ', usd: '$', inr: '₹', eur: '€', gbp: '£' };

function formatBatchYmd(iso) {
  if (!iso) return '';
  return formatDateDMonYyyyUpper(iso) || '';
}

function installmentStepLabel(req, n) {
  const plan = (req?.installment_plan || 'equal').toLowerCase();
  if (plan === 'quarter_then_monthly') {
    if (n === 1) return 'EMI 1 (25%)';
    return `EMI ${n} of 10`;
  }
  if (plan === 'down_then_emi') {
    if (n === 1) {
      const pct = req?.installment_down_pct != null ? Number(req.installment_down_pct) : 25;
      return `Down payment (${pct}%)`;
    }
    const emiTotal = req?.installment_emi_count || 9;
    return `EMI ${n - 1} of ${emiTotal}`;
  }
  return `Installment ${n}`;
}

function installmentScheduleHint(req) {
  const plan = (req?.installment_plan || 'equal').toLowerCase();
  if (plan === 'quarter_then_monthly') {
    return 'EMI 1 is 25% of total; EMIs 2–10 split the remaining 75% equally';
  }
  if (plan === 'down_then_emi') {
    const pct = req?.installment_down_pct != null ? Number(req.installment_down_pct) : 25;
    const emi = req?.installment_emi_count || 9;
    return `${pct}% down payment, then ${emi} equal EMIs`;
  }
  return '';
}

function paymentCatalogLine(req) {
  if (!req?.item_type) return '';
  const parts = [];
  if (req.item_title) parts.push(req.item_title);
  if (req.item_type === 'annual_package' && req.chosen_tier_label) {
    parts.push(req.chosen_tier_label);
  } else if (req.chosen_tier_label) parts.push(req.chosen_tier_label);
  if (req.chosen_start_date) {
    parts.push(formatBatchYmd(req.chosen_start_date));
    if (req.chosen_end_date) parts.push(`→ ${formatBatchYmd(req.chosen_end_date)}`);
  }
  if (req.session_date) parts.push(formatBatchYmd(req.session_date));
  return parts.filter(Boolean).join(' · ');
}

/* ─── Success sub-page ─────────────────────────────────────────── */
const SuccessView = ({ req }) => (
  <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-gradient-to-b from-emerald-50 to-white">
    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
      <ShieldCheck size={32} className="text-emerald-600" />
    </div>
    <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
    <p className="text-gray-500 text-sm mb-1">Thank you for your payment.</p>
    <p className="text-gray-700 font-medium mt-1">{req?.title}</p>
    <p className="text-emerald-700 text-xl font-bold mt-3">
      {CUR_SYMBOL[req?.currency?.toLowerCase()] || ''}{(req?.total_amount ?? req?.amount ?? 0).toLocaleString()}
    </p>
    <p className="text-xs text-gray-400 mt-6">A confirmation will be sent to your email.</p>
  </div>
);

const PartialInstallmentView = ({ req, payId, onContinue }) => {
  const symbol = CUR_SYMBOL[req?.currency?.toLowerCase()] || '';
  const paid = req?.installments_paid ?? 0;
  const total = req?.num_installments ?? 0;
  const remaining = req?.installments_remaining ?? Math.max(0, total - paid);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-gradient-to-b from-amber-50 to-white">
      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-6">
        <ShieldCheck size={32} className="text-amber-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Installment received</h1>
      <p className="text-gray-600 text-sm mb-1">{req?.title}</p>
      <p className="text-amber-800 font-semibold mt-2">
        {paid} of {total} installments paid
      </p>
      <p className="text-gray-500 text-xs mt-2">
        Total {symbol}{(req?.total_amount ?? req?.amount ?? 0).toLocaleString()}
        {remaining > 0 ? ` · ${remaining} remaining` : ''}
      </p>
      {remaining > 0 && (
        <button
          type="button"
          onClick={onContinue}
          className="mt-6 px-6 py-3 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'linear-gradient(135deg, #635bff, #4c47d1)' }}
        >
          Pay next installment ({symbol}{(req?.checkout_amount ?? 0).toLocaleString()})
        </button>
      )}
      <p className="text-xs text-gray-400 mt-6 max-w-sm">
        Bookmark this page or use the same link from your email when the next installment is due.
      </p>
    </div>
  );
};

/* ─── Main pay page ────────────────────────────────────────────── */
export default function PaymentRequestPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const [req, setReq]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [paying, setPaying]     = useState(false);
  const [payError, setPayError] = useState('');
  const [success, setSuccess]   = useState(false);
  const [partialSuccess, setPartialSuccess] = useState(false);

  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    axios.get(`${API}/payment-requests/${id}`)
      .then(r => {
        setReq(r.data);
        if (r.data.recipient_name) setName(r.data.recipient_name);
        if (r.data.recipient_email) setEmail(r.data.recipient_email);
        if (r.data.status === 'paid') setSuccess(true);
      })
      .catch(() => setError('This payment link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [id]);

  /* poll after Stripe redirect back */
  useEffect(() => {
    const sid = searchParams.get('session_id');
    if (!sid) return;
    const poll = async () => {
      try {
        const r = await axios.get(`${API}/payment-requests/${id}/status?session_id=${encodeURIComponent(sid)}`);
        if (r.data.status === 'paid') {
          setSuccess(true);
          setPartialSuccess(false);
        } else if (r.data.status === 'partially_paid') {
          setReq((prev) => ({ ...prev, ...r.data }));
          setPartialSuccess(true);
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [id, searchParams]);

  const handleStripe = async () => {
    if (!name.trim() || !email.trim()) {
      setPayError('Please enter your name and email.');
      return;
    }
    setPayError('');
    setPaying(true);
    try {
      const r = await axios.post(`${API}/payment-requests/${id}/checkout`, {
        payer_name: name.trim(),
        payer_email: email.trim(),
      });
      if (r.data?.url) {
        window.location.href = r.data.url;
        return;
      }
      setPayError('Could not open Stripe checkout. Please try again.');
      setPaying(false);
    } catch (e) {
      setPayError(e?.response?.data?.detail || 'Could not initiate Stripe payment. Please try again.');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <AlertTriangle size={40} className="text-amber-400 mb-4" />
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Link Unavailable</h1>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  if (success || req?.status === 'paid') {
    return <SuccessView req={req} />;
  }

  if (partialSuccess && req?.installments_remaining > 0) {
    return (
      <PartialInstallmentView
        req={req}
        payId={id}
        onContinue={() => {
          setPartialSuccess(false);
          window.history.replaceState({}, '', `/pay/${id}`);
        }}
      />
    );
  }

  if (req?.status === 'cancelled') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <AlertTriangle size={40} className="text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Link Cancelled</h1>
        <p className="text-gray-500 text-sm">This payment link has been cancelled. Please contact us.</p>
      </div>
    );
  }

  const symbol = CUR_SYMBOL[req.currency?.toLowerCase()] || `${req.currency?.toUpperCase()} `;
  const checkoutAmount = req.checkout_amount ?? req.amount;
  const showInstallments = req.installments_enabled && (req.num_installments || 0) > 1;
  const instCurrent = req.installment_current || 1;
  const instTotal = req.num_installments || 1;
  const instPaid = req.installments_paid || 0;
  const instStepLabel = installmentStepLabel(req, instCurrent);
  const scheduleHint = installmentScheduleHint(req);
  const isDownEmi = ['quarter_then_monthly', 'down_then_emi'].includes((req.installment_plan || '').toLowerCase());

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-[#f3edff] to-white flex items-start justify-center px-4 py-16 pt-28">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-purple-100 overflow-hidden">
            <div
              className="px-6 py-7 text-center"
              style={{ background: 'linear-gradient(135deg, #1e1230 0%, #2d1458 100%)' }}
            >
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#D4AF37] font-medium mb-3">
                <Sparkles size={11} /> {SITE_NAME}
              </div>
              <h1 className="text-white text-xl font-bold leading-snug mb-3">{req.title}</h1>
              {paymentCatalogLine(req) && (
                <p className="text-[#D4AF37]/90 text-xs font-medium flex items-center justify-center gap-1.5 mb-2">
                  <Calendar size={12} />
                  {paymentCatalogLine(req)}
                </p>
              )}
              {req.description && (
                <p className="text-white/70 text-sm leading-relaxed">{req.description}</p>
              )}
              <div className="mt-4 text-3xl font-bold" style={{ color: '#D4AF37' }}>
                {showInstallments ? (
                  <>
                    {symbol}{Number(checkoutAmount).toLocaleString()}
                    <span className="block text-sm font-medium text-white/70 mt-1">
                      {instStepLabel} · {instCurrent} of {instTotal}
                    </span>
                    {isDownEmi && scheduleHint && (
                      <span className="block text-[10px] font-normal text-white/45 mt-0.5">
                        {scheduleHint}
                      </span>
                    )}
                    <span className="block text-[10px] font-normal text-white/50 mt-0.5">
                      Total {symbol}{Number(req.total_amount ?? req.amount).toLocaleString()}
                      {instPaid > 0 ? ` · ${instPaid} paid` : ''}
                    </span>
                  </>
                ) : (
                  <>{symbol}{req.amount.toLocaleString()}</>
                )}
              </div>
              <p className="text-white/40 text-[10px] mt-1 uppercase tracking-wider">{req.currency?.toUpperCase()}</p>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              {payError && (
                <p className="text-red-500 text-xs flex items-center gap-1">
                  <AlertTriangle size={12} /> {payError}
                </p>
              )}

              <button
                type="button"
                onClick={handleStripe}
                disabled={paying}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #635bff, #4c47d1)' }}
              >
                {paying
                  ? <><Loader2 size={16} className="animate-spin" /> Redirecting to Stripe…</>
                  : (
                    <>
                      <CreditCard size={16} />
                      {showInstallments
                        ? `Pay ${instStepLabel.toLowerCase()} · ${symbol}${Number(checkoutAmount).toLocaleString()}`
                        : `Pay with Stripe · ${symbol}${Number(checkoutAmount).toLocaleString()}`}
                    </>
                  )}
              </button>

              <p className="text-center text-[10px] text-gray-400 flex items-center justify-center gap-1">
                <ShieldCheck size={11} /> Secured by Stripe · card, UPI &amp; international payments
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            Having trouble? Contact{' '}
            <a href="mailto:hello@divineirishealing.com" className="text-purple-500 hover:underline">
              hello@divineirishealing.com
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
