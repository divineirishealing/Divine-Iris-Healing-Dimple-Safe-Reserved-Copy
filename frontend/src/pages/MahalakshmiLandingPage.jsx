import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Calendar, Clock, Loader2, Lock, Monitor, Sparkles } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useSeoPage } from '../context/SeoPageContext';
import { useCurrency } from '../context/CurrencyContext';
import { resolveImageUrl } from '../lib/imageUtils';
import { HEADING, BODY, GOLD, LABEL } from '../lib/designTokens';

export const MAHALAKSHMI_PROGRAM_ID = '4e564441-9f90-400b-ae44-b192fedf2f15';

const SECTION_TITLE = {
  ...HEADING,
  fontWeight: 700,
  color: GOLD,
};
import lakshmiImage from '../assets/shri-mahalakshmi.jpg';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAYS = [
  {
    day: 'Day 1',
    name: 'Kama',
    hindi: 'काम',
    title: 'Heal Unfulfilled Desires',
    body: 'Work on the restlessness, dissatisfaction, and emotional patterns that keep you chasing more without feeling fulfilled.',
    shift: 'From endless wanting to conscious abundance.',
  },
  {
    day: 'Day 2',
    name: 'Krodha',
    hindi: 'क्रोध',
    title: 'Release Anger & Frustration',
    body: 'Address emotional patterns around financial stress, disappointment, resentment, and unmet expectations.',
    shift: 'From frustration to inner peace.',
  },
  {
    day: 'Day 3',
    name: 'Lobha',
    hindi: 'लोभ',
    title: 'Heal Scarcity & Fear of Not Having Enough',
    body: 'Explore the fear of loss, lack, and never having enough. Cultivate gratitude, healthy receiving, and a more balanced relationship with wealth.',
    shift: 'From scarcity to sufficiency.',
  },
  {
    day: 'Day 4',
    name: 'Moha',
    hindi: 'मोह',
    title: 'Release Limiting Attachments',
    body: 'Work on attachments to past financial experiences, material security, and beliefs that keep you feeling stuck.',
    shift: 'From attachment to freedom.',
  },
  {
    day: 'Day 5',
    name: 'Mada',
    hindi: 'मद',
    title: 'Heal Worthiness & Ego Patterns',
    body: 'Address the need to prove your worth, discomfort with receiving, and beliefs that may limit your confidence around money.',
    shift: 'From proving your worth to owning it.',
  },
  {
    day: 'Day 6',
    name: 'Matsarya',
    hindi: 'मत्सर्य',
    title: 'Heal Envy & Comparison',
    body: 'Release the emotional burden of comparing your financial journey with others and cultivate self-trust and appreciation.',
    shift: 'From comparison to your own abundance journey.',
  },
];

const FOR_YOU = [
  'You feel stuck in recurring financial or emotional patterns.',
  'You struggle with scarcity thinking, guilt, or fear around money.',
  'You find it difficult to receive, save, or feel secure.',
  'You want to work on self-worth and your relationship with abundance.',
  'You wish to celebrate Diwali through a meaningful spiritual healing experience.',
];

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

export default function MahalakshmiLandingPage({ surface = 'india' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setPageSeo, clearPageSeo } = useSeoPage();
  const { getPrice, getOfferPrice, symbol } = useCurrency();
  const [program, setProgram] = useState(null);
  const isIndia = surface !== 'website';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState('online');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API}/programs/${MAHALAKSHMI_PROGRAM_ID}`).then((r) => setProgram(r.data)).catch(() => {});
  }, []);

  const indiaAmount = Number(program?.offer_price_inr) > 0
    ? Number(program.offer_price_inr)
    : (Number(program?.price_inr) > 0 ? Number(program.price_inr) : 666);
  const websiteAmount = program ? Number(getOfferPrice(program) || getPrice(program) || 0) : 0;
  const priceText = isIndia
    ? `₹${indiaAmount.toLocaleString()}`
    : (websiteAmount > 0 ? `${symbol}${websiteAmount.toLocaleString()}` : '');
  const heroImage = program?.image ? (resolveImageUrl(program.image) || lakshmiImage) : lakshmiImage;

  useEffect(() => {
    window.scrollTo(0, 0);
    setPageSeo({
      title: 'Shri Mahalakshmi Akshaya Samriddhi',
      description: 'The 6-Day Diwali Money Healing & Abundance Activation with Divine Iris, 4–9 November 2026. Online on Zoom and offline remote. Energy exchange ₹666.',
    });
    return () => clearPageSeo();
  }, [setPageSeo, clearPageSeo]);

  const scrollToReserve = () => {
    document.getElementById('reserve')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pay = async (event) => {
    event.preventDefault();
    if (!isIndia) {
      if (!websiteAmount) {
        setError('Add the AED or USD price for this workshop in Programs. The India page uses the INR price.');
        return;
      }
      navigate(`/enroll/program/${MAHALAKSHMI_PROGRAM_ID}`);
      return;
    }
    setError('');
    setBusy(true);
    try {
      await loadRazorpayScript();
      const { data: co } = await axios.post(`${API}/landing/shri-mahalakshmi/checkout`, {
        name,
        email,
        phone,
        attendance_mode: mode,
        utm_source: searchParams.get('utm_source') || '',
        utm_medium: searchParams.get('utm_medium') || '',
        utm_campaign: searchParams.get('utm_campaign') || '',
        utm_content: searchParams.get('utm_content') || '',
      });
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
            await axios.post(`${API}/payments/razorpay/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            navigate(`/payment/success?session_id=${encodeURIComponent(co.session_id)}`);
          } catch (err) {
            setError(err.response?.data?.detail || 'Payment verification failed. Please contact us with your payment reference.');
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
      setError(typeof first === 'string' ? first : err.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#2b241c]">
      <Header />
      <main>
        <section className="relative overflow-hidden bg-[#1c1230] pt-24 text-white">
          <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(circle at 20% 20%, rgba(212,175,55,0.35), transparent 40%), radial-gradient(circle at 80% 0%, rgba(155,89,182,0.45), transparent 42%)' }} />
          <div className="relative container mx-auto px-6 md:px-8 py-12 md:py-16 max-w-6xl grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-10 items-center">
            <img
              src={heroImage}
              alt="Shri Mahalakshmi seated on a lotus, offering blessings and abundance"
              className="w-full max-h-[720px] object-cover object-top rounded-3xl shadow-2xl border border-white/10"
            />
            <div className="text-center lg:text-left">
              <p style={LABEL} className="mb-4">Presented by Divine Iris — Soulful Healing Studio</p>
              <p className="text-2xl md:text-3xl mb-3" style={{ ...HEADING, color: '#F5E6B0' }}>श्री महालक्ष्मी अक्षय समृद्धि</p>
              <h1 className="text-3xl md:text-5xl leading-tight mb-4" style={{ ...HEADING, color: '#ffffff' }}>
                Shri Mahalakshmi Akshaya Samriddhi
              </h1>
              <p className="text-lg md:text-xl mb-6" style={{ ...BODY, color: '#F5E6B0' }}>The 6-Day Diwali Money Healing & Abundance Activation</p>
              <p className="text-base md:text-lg mb-4" style={{ ...BODY, color: 'rgba(255,255,255,0.92)' }}>
                Heal Within. Align With Abundance. Welcome Samriddhi.
              </p>
              <p className="text-sm md:text-base mb-4" style={{ ...BODY, color: 'rgba(255,255,255,0.82)' }}>
                This Diwali, go beyond lighting diyas. Illuminate the inner patterns that may be holding you back from experiencing greater peace, prosperity, and abundance.
              </p>
              <p className="text-sm md:text-base mb-6" style={{ ...BODY, color: 'rgba(255,255,255,0.82)' }}>
                A sacred six-day healing journey inspired by Shri Mahalakshmi and the six inner enemies described in Hindu philosophy.
              </p>
              <p className="text-sm text-[#F5E6B0] mb-8">Release limiting patterns. Heal your relationship with money. Open yourself to new possibilities.</p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-3 text-xs md:text-sm mb-8">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2"><Calendar size={14} /> 4th Nov – 9th Nov, 2026</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2"><Clock size={14} /> 9:15pm – 10:00pm IST</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2"><Monitor size={14} /> Online (Zoom) & Offline (Remote)</span>
              </div>
              <button type="button" onClick={scrollToReserve} data-testid="hero-reserve-btn" className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold tracking-wide text-[#1c1230]" style={{ background: GOLD }}>
                Reserve your place · {priceText || 'your currency'}
              </button>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-6 md:px-8 py-14 max-w-3xl">
          <p style={SECTION_TITLE} className="text-3xl md:text-4xl mb-4">Why this Diwali?</p>
          <h2 className="text-3xl mb-4" style={HEADING}>We clean our homes to welcome Goddess Lakshmi. But what about the emotional patterns we carry within?</h2>
          <p className="mb-4" style={BODY}>Fear of not having enough. Guilt around receiving. Constant comparison. Feeling undeserving of wealth.</p>
          <p className="mb-4" style={BODY}>This Diwali, turn your attention inward. Through dedicated energy-healing practices, work towards releasing unhelpful emotional patterns, strengthening your sense of self-worth, and cultivating a healthier relationship with money and abundance.</p>
          <p style={BODY}>When your inner world changes, new possibilities can begin to emerge.</p>
        </section>

        <section className="bg-white border-y border-[#eadfca]">
          <div className="container mx-auto px-6 md:px-8 py-14 max-w-5xl">
            <p style={SECTION_TITLE} className="text-3xl md:text-4xl mb-4 text-center">Six days. Six inner healing journeys.</p>
            <h2 className="text-3xl text-center mb-3" style={HEADING}>Each day focuses on one of the six inner enemies</h2>
            <p className="text-center mb-8 max-w-2xl mx-auto" style={BODY}>Shad-Ripu, and the qualities we wish to cultivate in their place.</p>
            <div className="grid md:grid-cols-2 gap-4">
              {DAYS.map((day) => (
                <article key={day.day} className="rounded-2xl border border-[#eadfca] bg-[#faf7f2] p-5">
                  <p className="text-[11px] tracking-[0.22em] uppercase mb-1" style={{ color: GOLD }}>{day.day}</p>
                  <h3 className="text-xl mb-1" style={HEADING}>{day.name} <span className="text-base font-normal">| {day.hindi}</span></h3>
                  <p className="font-medium mb-2">{day.title}</p>
                  <p className="text-sm mb-3" style={BODY}>{day.body}</p>
                  <p className="text-sm" style={{ color: '#6b4c9a' }}>{day.shift}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-6 md:px-8 py-14 max-w-3xl">
          <p style={SECTION_TITLE} className="text-3xl md:text-4xl mb-4">Invoke the grace of Shri Mahalakshmi</p>
          <h2 className="text-3xl mb-4" style={HEADING}>Wealth, prosperity, auspiciousness, and flourishing</h2>
          <p className="mb-4" style={BODY}>This Diwali, dedicate six days to inner healing, spiritual alignment, and cultivating the qualities that support a more abundant life.</p>
          <ul className="space-y-2 mb-4" style={BODY}>
            <li className="flex gap-2"><Sparkles size={16} className="mt-1 shrink-0" color={GOLD} /> Energy-healing practices</li>
            <li className="flex gap-2"><Sparkles size={16} className="mt-1 shrink-0" color={GOLD} /> Focused work on emotional and money-related patterns</li>
            <li className="flex gap-2"><Sparkles size={16} className="mt-1 shrink-0" color={GOLD} /> Healing intentions centred on worthiness, receiving, and prosperity</li>
            <li className="flex gap-2"><Sparkles size={16} className="mt-1 shrink-0" color={GOLD} /> A sacred Diwali experience inspired by Shri Mahalakshmi</li>
          </ul>
          <p style={BODY}>Heal the patterns within. Honour the blessings around you. Make space for new possibilities.</p>
        </section>

        <section className="bg-[#1c1230] text-white">
          <div className="container mx-auto px-6 md:px-8 py-14 max-w-3xl">
            <p style={SECTION_TITLE} className="text-3xl md:text-4xl mb-4">This experience is for you if…</p>
            <ul className="space-y-3">
              {FOR_YOU.map((line) => (
                <li key={line} className="flex gap-3 text-white/90" style={BODY}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: GOLD }} />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="reserve" className="container mx-auto px-6 md:px-8 py-16 max-w-xl">
          <p style={SECTION_TITLE} className="text-3xl md:text-4xl mb-4 text-center">This Diwali, begin within</p>
          <h2 className="text-3xl text-center mb-3" style={HEADING}>Six days. Six inner obstacles. One intention: Samriddhi.</h2>
          <p className="text-center mb-3" style={BODY}>The 6-Day Diwali Money Healing & Abundance Activation</p>
          <p className="text-center mb-8" style={BODY}>
            Let this Diwali be an opportunity to release what no longer serves you, reconnect with your inner strength, and move towards a more conscious relationship with wealth and well-being.
          </p>
          <form onSubmit={pay} className="rounded-3xl border border-[#eadfca] bg-white p-6 md:p-8 shadow-sm" data-testid="mahalakshmi-reserve-form">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-500">Energy exchange</p>
              <p className="text-4xl" style={HEADING}>{priceText || '—'}</p>
              <p className="text-xs text-gray-500 mt-1">4th Nov – 9th Nov, 2026 · 9:15pm – 10:00pm IST</p>
            </div>
            <label className="block text-xs font-semibold tracking-wide mb-1" htmlFor="lk-name">Full name</label>
            <input id="lk-name" required value={name} onChange={(e) => setName(e.target.value)} className="w-full mb-4 rounded-xl border border-[#eadfca] px-3 py-2.5 text-sm" data-testid="lk-name" />
            <label className="block text-xs font-semibold tracking-wide mb-1" htmlFor="lk-email">Email</label>
            <input id="lk-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mb-4 rounded-xl border border-[#eadfca] px-3 py-2.5 text-sm" data-testid="lk-email" />
            <label className="block text-xs font-semibold tracking-wide mb-1" htmlFor="lk-phone">WhatsApp number</label>
            <input id="lk-phone" required inputMode="tel" placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full mb-4 rounded-xl border border-[#eadfca] px-3 py-2.5 text-sm" data-testid="lk-phone" />
            <p className="text-xs font-semibold tracking-wide mb-2">How will you attend?</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {[
                ['online', 'Online (Zoom)'],
                ['offline', 'Offline (Remote)'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  data-testid={`lk-mode-${value}`}
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{
                    borderColor: mode === value ? GOLD : '#eadfca',
                    background: mode === value ? '#fff8e8' : '#fff',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-red-600 mb-3" data-testid="lk-error">{error}</p>}
            <button type="submit" disabled={busy} data-testid="lk-pay-btn" className="w-full rounded-full py-3 text-sm font-semibold text-[#1c1230] disabled:opacity-60" style={{ background: GOLD }}>
              {busy ? <span className="inline-flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Opening Razorpay…</span> : (isIndia ? `Pay ${priceText} with Razorpay` : `Continue · ${priceText || 'set price in Programs'}`)}
            </button>
            <p className="mt-3 text-center text-[11px] text-gray-400 inline-flex items-center justify-center gap-1 w-full">
              <Lock size={11} /> {isIndia ? 'UPI, cards, and netbanking. India payments via Razorpay.' : 'Continues to secure checkout in your currency.'}
            </p>
          </form>
        </section>
      </main>
      <div className="h-16 md:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#eadfca] bg-white/95 px-4 py-3 md:hidden">
        <button type="button" onClick={scrollToReserve} className="w-full rounded-full py-3 text-sm font-semibold text-[#1c1230]" style={{ background: GOLD }}>
          Reserve · {priceText || 'pay'}
        </button>
      </div>
      <Footer />
    </div>
  );
}
