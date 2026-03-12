import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { renderMarkdown } from '../lib/renderMarkdown';
import { HEADING, BODY, GOLD, CONTAINER } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const applyHeroStyle = (styleObj, defaults = {}) => {
  if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
  return { ...defaults, ...(styleObj.font_family && { fontFamily: styleObj.font_family }), ...(styleObj.font_size && { fontSize: styleObj.font_size }), ...(styleObj.font_color && { color: styleObj.font_color }), ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }), ...(styleObj.font_style && { fontStyle: styleObj.font_style }) };
};

const CURRENCY_BADGES = { inr: 'INR', usd: 'USD', aed: 'AED', eur: 'EUR', gbp: 'GBP' };

const SponsorSection = () => {
  const [settings, setSettings] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { currency, symbol } = useCurrency();

  useEffect(() => { axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {}); }, []);

  const hero = settings?.page_heroes?.sponsor || {};
  const badge = CURRENCY_BADGES[currency] || currency.toUpperCase();

  const handleVerify = () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email');
      return;
    }
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
    <section id="sponsor" data-testid="sponsor-section" className="py-20 bg-white">
      <div className={CONTAINER}>
        <div className="grid md:grid-cols-2 gap-0 max-w-5xl mx-auto">
          {/* Left Column */}
          <div className="bg-gray-50 p-10 md:p-14 flex flex-col justify-center">
            <h2 className="mb-2 leading-tight" style={applyHeroStyle(hero.title_style, { ...HEADING, fontSize: 'clamp(1.5rem, 3vw, 2rem)' })}>
              {hero.title_text || 'Why Sponsor?'}
            </h2>
            <div className="w-10 h-0.5 mb-8" style={{ background: GOLD }} />

            <p className="mb-6 leading-relaxed" style={applyHeroStyle(hero.subtitle_style, { ...BODY, lineHeight: '1.8' })}>
              {hero.subtitle_text || 'Healing flows when we support each other.'}
            </p>

            <div className="space-y-5 mb-8" style={{ ...BODY, lineHeight: '1.8' }}>
              <p>Be the Sponsor allows anyone to contribute towards someone else's healing — anonymously or openly.</p>
              <p dangerouslySetInnerHTML={{ __html: renderMarkdown('It is not charity, it is *conscious support.*') }} />
              <p>When one heals, the collective heals.</p>
            </div>

            <p className="italic mt-auto" style={{ color: GOLD, fontFamily: "'Lato', sans-serif", fontSize: '0.95rem' }}>
              "Because healing should never wait for money."
            </p>
          </div>

          {/* Right Column - Contribution Form */}
          <div className="border border-[#e8d9a0] p-8 md:p-10" data-testid="contribution-form">
            {!showForm ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <h3 className="mb-4" style={{ ...HEADING, fontSize: '1.3rem', letterSpacing: '0.08em' }}>MAKE A CONTRIBUTION</h3>
                <div className="w-10 h-0.5 mb-8" style={{ background: GOLD }} />
                <p className="text-gray-500 text-sm mb-10 max-w-xs" style={BODY}>Support someone's healing journey with a contribution of any amount.</p>
                <button data-testid="become-sponsor-btn" onClick={() => setShowForm(true)}
                  className="inline-block text-white px-10 py-3 text-xs tracking-[0.15em] uppercase transition-all duration-300 shadow-lg hover:shadow-xl"
                  style={{ background: GOLD }}>
                  Become a Sponsor
                </button>
              </div>
            ) : (
              <div>
                <h3 className="mb-1 text-center" style={{ ...HEADING, fontSize: '1.1rem', letterSpacing: '0.1em' }}>MAKE A CONTRIBUTION</h3>
                <div className="w-10 h-0.5 mx-auto mb-6" style={{ background: GOLD }} />

                {error && <p className="text-red-500 text-xs mb-3 text-center" data-testid="sponsor-error">{error}</p>}

                <div className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-600 tracking-wider uppercase block mb-1">Full Name</label>
                    <input data-testid="sponsor-name" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name"
                      className="w-full border border-gray-200 rounded px-4 py-2.5 text-sm focus:outline-none focus:border-[#D4AF37] transition-colors" />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-600 tracking-wider uppercase block mb-1">Email Address</label>
                    <div className="flex gap-2">
                      <input data-testid="sponsor-email" value={email} onChange={e => { setEmail(e.target.value); setEmailVerified(false); }} placeholder="name@example.com"
                        className="flex-1 border border-gray-200 rounded px-4 py-2.5 text-sm focus:outline-none focus:border-[#D4AF37] transition-colors" />
                      <button data-testid="sponsor-verify-btn" onClick={handleVerify}
                        className={`px-5 py-2.5 text-xs font-semibold tracking-wider uppercase transition-all ${emailVerified ? 'bg-green-500 text-white' : 'text-white'}`}
                        style={!emailVerified ? { background: GOLD } : {}}>
                        {emailVerified ? 'Verified' : 'Verify'}
                      </button>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-600 tracking-wider uppercase block mb-1">Amount</label>
                    <div className="flex border border-gray-200 rounded overflow-hidden focus-within:border-[#D4AF37] transition-colors">
                      <span className="px-3 py-2.5 text-sm font-semibold flex items-center" style={{ background: GOLD, color: '#fff' }}>{badge}</span>
                      <input data-testid="sponsor-amount" type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount"
                        className="flex-1 px-4 py-2.5 text-sm focus:outline-none border-0" />
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-600 tracking-wider uppercase block mb-1">Message (Optional)</label>
                    <textarea data-testid="sponsor-message" value={message} onChange={e => setMessage(e.target.value)} placeholder="Write a message..." rows={3}
                      className="w-full border border-gray-200 rounded px-4 py-2.5 text-sm focus:outline-none focus:border-[#D4AF37] transition-colors resize-y" />
                  </div>

                  {/* Anonymous checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input data-testid="sponsor-anonymous" type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-sm text-gray-600">Make my contribution anonymous</span>
                  </label>

                  {/* Submit */}
                  <button data-testid="sponsor-submit-btn" onClick={handleSubmit} disabled={loading}
                    className="w-full py-3.5 text-xs font-semibold tracking-[0.15em] uppercase transition-all duration-300 text-white disabled:opacity-50"
                    style={{ background: loading ? '#999' : GOLD }}>
                    {loading ? 'Processing...' : 'Proceed to Payment'}
                  </button>

                  <p className="text-center text-[10px] text-gray-400 flex items-center justify-center gap-1">
                    <Lock size={10} /> Secure Payment via Stripe
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SponsorSection;
