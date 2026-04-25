import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useToast } from '../hooks/use-toast';
import { Loader2, Lock, IndianRupee } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('No window'));
      return;
    }
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
 * Standalone INR checkout via Razorpay only (no Stripe, no full enrollment wizard).
 * Route: /pay/razorpay/:type/:id  where type is program | session
 * Optional query: ?tier=0 for program tier index
 */
export default function RazorpayLandingPage() {
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const tierRaw = searchParams.get('tier');
  const tierIndex = tierRaw !== null && tierRaw !== '' ? parseInt(tierRaw, 10) : null;
  const safeTier = Number.isFinite(tierIndex) ? tierIndex : null;

  const itemType = (type || '').toLowerCase();

  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (itemType !== 'program' && itemType !== 'session') {
      setPreview(null);
      setLoadingPreview(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingPreview(true);
      try {
        const params = { item_type: itemType, item_id: id };
        if (safeTier !== null) params.tier_index = safeTier;
        const { data } = await axios.get(`${API}/payments/razorpay/landing/preview`, { params });
        if (!cancelled) setPreview(data);
      } catch (e) {
        if (!cancelled) {
          setPreview(null);
          const d = e.response?.data?.detail;
          toast({
            title: 'Unavailable',
            description: typeof d === 'string' ? d : 'This page could not load pricing.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemType, id, safeTier, toast]);

  const handlePay = useCallback(async () => {
    if (!preview?.razorpay_enabled) {
      toast({ title: 'Razorpay is not configured', variant: 'destructive' });
      return;
    }
    if (!name.trim() || !email.trim()) {
      toast({ title: 'Enter your name and email', variant: 'destructive' });
      return;
    }
    setPaying(true);
    try {
      await loadRazorpayScript();
      const { data } = await axios.post(`${API}/payments/razorpay/landing/create-order`, {
        item_type: itemType,
        item_id: id,
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim(),
        tier_index: safeTier,
      });
      const d = data;
      const options = {
        key: d.key_id,
        amount: d.amount,
        currency: d.currency,
        order_id: d.order_id,
        name: 'Divine Iris Healing',
        description: d.description || d.item_title,
        prefill: { name: d.name || name.trim(), email: d.email || email.trim() },
        handler: async (response) => {
          try {
            await axios.post(`${API}/payments/razorpay/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            navigate(`/payment/success?session_id=${encodeURIComponent(d.session_id)}`);
          } catch (e) {
            const msg = e.response?.data?.detail;
            toast({
              title: 'Could not confirm payment',
              description: typeof msg === 'string' ? msg : e.message || 'Contact support with your receipt from Razorpay.',
              variant: 'destructive',
            });
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => {
        toast({ title: 'Payment was not completed', variant: 'destructive' });
        setPaying(false);
      });
      rzp.open();
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast({
        title: 'Could not start payment',
        description: typeof detail === 'string' ? detail : e.message || 'Failed',
        variant: 'destructive',
      });
      setPaying(false);
    }
  }, [preview, name, email, phone, itemType, id, safeTier, navigate, toast]);

  const invalidType = itemType !== 'program' && itemType !== 'session';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-lg mx-auto">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-2 text-sky-800 mb-1">
              <IndianRupee className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">India — Razorpay only</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Quick pay (INR)
            </h1>
            <p className="text-sm text-slate-600 mb-6">
              This page uses Razorpay only — no Stripe. For full enrollment steps (participants, verification), use the
              regular enroll link instead.
            </p>

            {invalidType && (
              <p className="text-sm text-red-600">Invalid link. Use <code className="text-xs">/pay/razorpay/program/…</code> or session.</p>
            )}

            {loadingPreview && !invalidType && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
              </div>
            )}

            {!loadingPreview && preview && !invalidType && (
              <>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 mb-6">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">You are paying for</p>
                  <p className="font-medium text-slate-900">{preview.title}</p>
                  <p className="text-lg font-semibold text-slate-800 mt-2">
                    ₹{Number(preview.inr_total || 0).toLocaleString('en-IN')}
                    <span className="text-xs font-normal text-slate-500 ml-2">incl. as per listing</span>
                  </p>
                  {!preview.razorpay_enabled && (
                    <p className="text-amber-700 text-xs mt-2">Razorpay keys are not set on the server yet.</p>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  <div>
                    <label className="text-xs text-slate-600">Full name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" autoComplete="name" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Phone (optional)</label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" autoComplete="tel" />
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full rounded-full bg-sky-700 hover:bg-sky-800 text-white"
                  disabled={paying || !preview.razorpay_enabled}
                  onClick={handlePay}
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  Pay with Razorpay
                </Button>
              </>
            )}
          </div>
          <p className="text-center text-[11px] text-slate-400 mt-6">
            Divine Iris Healing · secure payment via Razorpay
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
