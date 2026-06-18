import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Sparkles, ShieldCheck, AlertTriangle, Loader2, CreditCard, IndianRupee } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SITE_NAME = 'Divine Iris Healing';

const CUR_SYMBOL = { aed: 'AED ', usd: '$', inr: '₹', eur: '€', gbp: '£' };

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Razorpay'));
    document.body.appendChild(s);
  });
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
      {CUR_SYMBOL[req?.currency?.toLowerCase()] || ''}{(req?.amount || 0).toLocaleString()}
    </p>
    <p className="text-xs text-gray-400 mt-6">A confirmation will be sent to your email.</p>
  </div>
);

/* ─── Main pay page ────────────────────────────────────────────── */
export default function PaymentRequestPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [req, setReq]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [paying, setPaying]     = useState(false);
  const [payError, setPayError] = useState('');
  const [success, setSuccess]   = useState(false);

  /* payer info (pre-filled from link if set) */
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');

  /* razorpay config */
  const [rzConfig, setRzConfig] = useState({ enabled: false, key_id: null });

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

    axios.get(`${API}/payments/razorpay/config`)
      .then(r => setRzConfig(r.data || {}))
      .catch(() => {});
  }, [id]);

  /* poll after Stripe redirect back */
  useEffect(() => {
    const sid = searchParams.get('session_id');
    if (!sid) return;
    const poll = async () => {
      try {
        const r = await axios.get(`${API}/payment-requests/${id}/status?session_id=${encodeURIComponent(sid)}`);
        if (r.data.status === 'paid') setSuccess(true);
      } catch {}
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [id, searchParams]);

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

  if (req?.status === 'cancelled') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <AlertTriangle size={40} className="text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Link Cancelled</h1>
        <p className="text-gray-500 text-sm">This payment link has been cancelled. Please contact us.</p>
      </div>
    );
  }

  const symbol = CUR_SYMBOL[req.currency?.toLowerCase()] || req.currency?.toUpperCase() + ' ';
  const isINR  = req.currency?.toLowerCase() === 'inr';
  const showRazorpay = isINR && rzConfig?.enabled;

  /* ── Stripe pay ── */
  const handleStripe = async () => {
    if (!name.trim() || !email.trim()) {
      setPayError('Please enter your name and email.');
      return;
    }
    setPayError('');
    setPaying(true);
    try {
      const r = await axios.post(`${API}/payment-requests/${id}/checkout`, { payer_name: name, payer_email: email });
      window.location.href = r.data.url;
    } catch (e) {
      setPayError(e?.response?.data?.detail || 'Could not initiate payment. Please try again.');
      setPaying(false);
    }
  };

  /* ── Razorpay pay ── */
  const handleRazorpay = async () => {
    if (!name.trim() || !email.trim()) {
      setPayError('Please enter your name and email.');
      return;
    }
    setPayError('');
    setPaying(true);
    try {
      await loadRazorpayScript();
      const { data: co } = await axios.post(`${API}/payment-requests/${id}/checkout-razorpay`);
      const options = {
        key: co.key_id,
        amount: co.amount,
        currency: co.currency,
        order_id: co.order_id,
        name: SITE_NAME,
        description: co.title,
        method: { upi: true, card: true, netbanking: true, wallet: true },
        prefill: { name, email },
        handler: async (response) => {
          try {
            await axios.post(`${API}/payment-requests/${id}/razorpay-verify`, {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              payer_name:  name,
              payer_email: email,
            });
            setSuccess(true);
          } catch (err) {
            setPayError(err?.response?.data?.detail || 'Payment verification failed. Contact support.');
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => {
        setPayError('Payment did not complete. Please try again.');
        setPaying(false);
      });
      rzp.open();
    } catch (err) {
      setPayError(err?.response?.data?.detail || err.message || 'Could not start payment.');
      setPaying(false);
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-[#f3edff] to-white flex items-start justify-center px-4 py-16 pt-28">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-purple-100 overflow-hidden">
            {/* Header band */}
            <div
              className="px-6 py-7 text-center"
              style={{ background: 'linear-gradient(135deg, #1e1230 0%, #2d1458 100%)' }}
            >
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#D4AF37] font-medium mb-3">
                <Sparkles size={11} /> {SITE_NAME}
              </div>
              <h1 className="text-white text-xl font-bold leading-snug mb-3">{req.title}</h1>
              {req.description && (
                <p className="text-white/70 text-sm leading-relaxed">{req.description}</p>
              )}
              <div className="mt-4 text-3xl font-bold" style={{ color: '#D4AF37' }}>
                {symbol}{req.amount.toLocaleString()}
              </div>
              <p className="text-white/40 text-[10px] mt-1 uppercase tracking-wider">{req.currency?.toUpperCase()}</p>
            </div>

            {/* Form */}
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

              {/* Pay buttons */}
              {showRazorpay ? (
                /* INR: offer both Razorpay (preferred) and Stripe */
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleRazorpay}
                    disabled={paying}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #3395ff, #0066cc)' }}
                  >
                    {paying ? <Loader2 size={16} className="animate-spin" /> : <IndianRupee size={16} />}
                    Pay with UPI / Card (India)
                  </button>
                  <button
                    type="button"
                    onClick={handleStripe}
                    disabled={paying}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #635bff, #4c47d1)' }}
                  >
                    {paying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                    Pay with Card (International)
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStripe}
                  disabled={paying}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)' }}
                >
                  {paying
                    ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
                    : <><CreditCard size={16} /> Pay {symbol}{req.amount.toLocaleString()}</>}
                </button>
              )}

              <p className="text-center text-[10px] text-gray-400 flex items-center justify-center gap-1">
                <ShieldCheck size={11} /> Secured by Stripe · SSL encrypted
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
