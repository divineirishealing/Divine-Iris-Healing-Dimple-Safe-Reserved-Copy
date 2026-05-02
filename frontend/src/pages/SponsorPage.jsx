import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { resolveImageUrl } from '../lib/imageUtils';
import FloatingButtons from '../components/FloatingButtons';
import { useCurrency } from '../context/CurrencyContext';
import { renderMarkdown } from '../lib/renderMarkdown';
import { HEADING, SUBTITLE, BODY, GOLD, LABEL, CONTAINER, SECTION_PY } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const applyStyle = (styleObj, defaults = {}) => {
  if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
  return { ...defaults, ...(styleObj.font_family && { fontFamily: styleObj.font_family }), ...(styleObj.font_size && { fontSize: styleObj.font_size }), ...(styleObj.font_color && { color: styleObj.font_color }), ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }), ...(styleObj.font_style && { fontStyle: styleObj.font_style }), ...(styleObj.text_align && { textAlign: styleObj.text_align }) };
};

const CURRENCY_BADGES = { inr: 'INR', usd: 'USD', aed: 'AED', eur: 'EUR', gbp: 'GBP' };

export default function SponsorPage() {
  const [settings, setSettings] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { currency } = useCurrency();

  useEffect(() => {
    window.scrollTo(0, 0);
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
  }, []);

  const hero = settings?.page_heroes?.sponsor || {};
  const p = settings?.sponsor_page || {};
  const badge = CURRENCY_BADGES[currency] || currency.toUpperCase();

  const handleVerify = () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) { setError('Please enter a valid email'); return; }
    setEmailVerified(true);
    setError('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!emailVerified) { setError('Please verify your email first'); return; }
    if (!amount || parseFloat(amount) <= 0) { setError('Please enter a valid amount'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/payments/sponsor-checkout`, {
        name, email, amount: parseFloat(amount), currency, message, anonymous,
        origin_url: window.location.origin,
      });
      if (res.data.url) window.location.href = res.data.url;
    } catch (err) {
      setError(err.response?.data?.detail || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section data-testid="sponsor-hero" className="relative min-h-[50vh] flex flex-col items-center justify-center text-center px-6 pt-20"
        style={{ background: hero.hero_image ? 'transparent' : 'linear-gradient(180deg, #1a1a1a 0%, #1a1a1add 50%, #1a1a1a 100%)' }}>
        {hero.hero_image && <div className="absolute inset-0" style={{ backgroundImage: `url(${resolveImageUrl(hero.hero_image)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
        {hero.hero_image && <div className="absolute inset-0" style={{ background: '#000', opacity: (hero.overlay_opacity || 60) / 100 }} />}
        <h1 className="relative z-10 text-white mb-4 max-w-4xl" style={applyStyle(hero.title_style, { ...HEADING, color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontVariant: 'small-caps', letterSpacing: '0.05em', lineHeight: 1.3 })}>
          {hero.title_text || 'Shine a Light in a Life'}
        </h1>
        <p className="relative z-10 mb-6" style={applyStyle(hero.subtitle_style, { ...LABEL, color: GOLD })}>
          {hero.subtitle_text || 'Conscious Support for Collective Healing'}
        </p>
        <div className="relative z-10 w-14 h-0.5" style={{ background: GOLD }} />
      </section>

      {/* Two Column: Why Sponsor + Form */}
      <section className={SECTION_PY}>
        <div className={CONTAINER}>
          <div className="grid md:grid-cols-2 gap-0 max-w-5xl mx-auto">
            {/* Left - Why Sponsor */}
            <div className="bg-gray-50 p-10 md:p-14 flex flex-col justify-center">
              <h2 className="mb-2" style={applyStyle(p.why_title_style, { ...HEADING, fontSize: '1.6rem' })}>{p.why_title || 'Why Sponsor?'}</h2>
              <div className="w-10 h-0.5 mb-8" style={{ background: GOLD }} />
              <div className="space-y-5 mb-8" style={applyStyle(p.why_body_style, { ...BODY, lineHeight: '1.8' })}>
                <p dangerouslySetInnerHTML={{ __html: renderMarkdown(p.why_body_1 || 'Be the Sponsor allows anyone to contribute towards someone else\'s healing — anonymously or openly.') }} />
                <p dangerouslySetInnerHTML={{ __html: renderMarkdown(p.why_body_2 || 'It is not charity, it is *conscious support.*') }} />
                <p dangerouslySetInnerHTML={{ __html: renderMarkdown(p.why_body_3 || 'When one heals, the collective heals.') }} />
              </div>
              <p className="italic mt-auto" style={applyStyle(p.quote_style, { color: GOLD, fontFamily: "'Lato', sans-serif", fontSize: '0.95rem' })}>
                "{p.quote || 'Because healing should never wait for money.'}"
              </p>
            </div>

            {/* Right - Contribution Form */}
            <div className="border border-[#e8d9a0] p-8 md:p-10" data-testid="contribution-form">
              <h3 className="mb-1 text-center" style={applyStyle(p.form_title_style, { ...HEADING, fontSize: '1.1rem', letterSpacing: '0.1em' })}>{p.form_title || 'MAKE A CONTRIBUTION'}</h3>
              <div className="w-10 h-0.5 mx-auto mb-6" style={{ background: GOLD }} />

              {error && <p className="text-red-500 text-xs mb-3 text-center" data-testid="sponsor-error">{error}</p>}

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-gray-600 tracking-wider uppercase block mb-1">Full Name</label>
                  <input data-testid="sponsor-name" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name"
                    className="w-full border border-gray-200 rounded px-4 py-2.5 text-sm focus:outline-none focus:border-[#D4AF37] transition-colors" />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-gray-600 tracking-wider uppercase block mb-1">Email Address</label>
                  <div className="flex gap-2">
                    <input data-testid="sponsor-email" value={email} onChange={e => { setEmail(e.target.value); setEmailVerified(false); }} placeholder="name@example.com"
                      className="flex-1 border border-gray-200 rounded px-4 py-2.5 text-sm focus:outline-none focus:border-[#D4AF37] transition-colors" />
                    <button data-testid="sponsor-verify-btn" onClick={handleVerify}
                      className={`px-5 py-2.5 text-xs font-semibold tracking-wider uppercase transition-all rounded ${emailVerified ? 'bg-green-500 text-white' : 'text-white'}`}
                      style={!emailVerified ? { background: GOLD } : {}}>
                      {emailVerified ? 'Verified' : 'Verify'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-gray-600 tracking-wider uppercase block mb-1">Amount</label>
                  <div className="flex border border-gray-200 rounded overflow-hidden focus-within:border-[#D4AF37] transition-colors">
                    <span className="px-3 py-2.5 text-sm font-semibold flex items-center" style={{ background: GOLD, color: '#fff' }}>{badge}</span>
                    <input data-testid="sponsor-amount" type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount"
                      className="flex-1 px-4 py-2.5 text-sm focus:outline-none border-0" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-gray-600 tracking-wider uppercase block mb-1">Message (Optional)</label>
                  <textarea data-testid="sponsor-message" value={message} onChange={e => setMessage(e.target.value)} placeholder="Write a message..." rows={3}
                    className="w-full border border-gray-200 rounded px-4 py-2.5 text-sm focus:outline-none focus:border-[#D4AF37] transition-colors resize-y" />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input data-testid="sponsor-anonymous" type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                  <span className="text-sm text-gray-600">Make my contribution anonymous</span>
                </label>

                <button data-testid="sponsor-submit-btn" onClick={handleSubmit} disabled={loading}
                  className="w-full py-3.5 text-xs font-semibold tracking-[0.15em] uppercase transition-all duration-300 text-white disabled:opacity-50"
                  style={{ background: loading ? '#999' : GOLD }}>
                  {loading ? 'Processing...' : (p.submit_text || 'Proceed to Payment')}
                </button>

                <p className="text-center text-[10px] text-gray-400 flex items-center justify-center gap-1">
                  <Lock size={10} /> Secure Payment via Stripe
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </div>
  );
}
