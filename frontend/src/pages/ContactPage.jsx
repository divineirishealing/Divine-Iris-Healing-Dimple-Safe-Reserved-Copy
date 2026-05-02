import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import Header from '../components/Header';
import { resolveImageUrl } from '../lib/imageUtils';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { Mail, Phone, Share2, Loader2 } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { HEADING, LABEL, GOLD, CONTAINER } from '../lib/designTokens';
import { Facebook, Instagram, Youtube, Linkedin } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COUNTRIES = [
  { code: "IN", name: "India", phone: "+91" }, { code: "AE", name: "UAE", phone: "+971" },
  { code: "US", name: "United States", phone: "+1" }, { code: "GB", name: "United Kingdom", phone: "+44" },
  { code: "CA", name: "Canada", phone: "+1" }, { code: "AU", name: "Australia", phone: "+61" },
  { code: "SG", name: "Singapore", phone: "+65" }, { code: "DE", name: "Germany", phone: "+49" },
  { code: "FR", name: "France", phone: "+33" }, { code: "SA", name: "Saudi Arabia", phone: "+966" },
  { code: "QA", name: "Qatar", phone: "+974" }, { code: "PK", name: "Pakistan", phone: "+92" },
  { code: "BD", name: "Bangladesh", phone: "+880" }, { code: "LK", name: "Sri Lanka", phone: "+94" },
  { code: "MY", name: "Malaysia", phone: "+60" }, { code: "JP", name: "Japan", phone: "+81" },
  { code: "ZA", name: "South Africa", phone: "+27" }, { code: "NP", name: "Nepal", phone: "+977" },
  { code: "KW", name: "Kuwait", phone: "+965" }, { code: "OM", name: "Oman", phone: "+968" },
  { code: "BH", name: "Bahrain", phone: "+973" }, { code: "PH", name: "Philippines", phone: "+63" },
  { code: "ID", name: "Indonesia", phone: "+62" }, { code: "TH", name: "Thailand", phone: "+66" },
  { code: "KE", name: "Kenya", phone: "+254" }, { code: "NG", name: "Nigeria", phone: "+234" },
  { code: "EG", name: "Egypt", phone: "+20" }, { code: "TR", name: "Turkey", phone: "+90" },
  { code: "IT", name: "Italy", phone: "+39" }, { code: "ES", name: "Spain", phone: "+34" },
  { code: "NL", name: "Netherlands", phone: "+31" }, { code: "NZ", name: "New Zealand", phone: "+64" },
].sort((a, b) => a.name.localeCompare(b.name));

const applyStyle = (styleObj, defaults = {}) => {
  if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
  return { ...defaults, ...(styleObj.font_size && { fontSize: styleObj.font_size }), ...(styleObj.font_color && { color: styleObj.font_color }), ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }), ...(styleObj.font_style && { fontStyle: styleObj.font_style }) };
};

const FONT_LATO = { fontFamily: "'Lato', sans-serif" };
const INPUT_CLASS = "w-full border border-gray-300 bg-white px-4 py-3 text-sm placeholder:text-gray-400 placeholder:uppercase placeholder:tracking-wider placeholder:text-xs focus:outline-none focus:border-[#D4AF37] transition-colors";

const InfoCard = ({ icon: Icon, title, children }) => (
  <div data-testid={`contact-card-${title.toLowerCase().replace(/\s/g, '-')}`}
    className="bg-white flex flex-col items-center justify-center py-10 px-6 border-t-2"
    style={{ borderTopColor: GOLD }}>
    <Icon size={28} strokeWidth={1.5} style={{ color: GOLD }} className="mb-4" />
    <h3 className="text-sm font-bold tracking-[0.15em] uppercase mb-3" style={{ ...FONT_LATO, color: '#1a1a1a' }}>{title}</h3>
    {children}
  </div>
);

function ContactPage() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { country: detectedCountry } = useCurrency();
  const [settings, setSettings] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);

  const programTitle = searchParams.get('title') || '';
  const tierLabel = searchParams.get('tier') || '';

  const [phoneCode, setPhoneCode] = useState('+971');
  const [waCode, setWaCode] = useState('+971');
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', whatsapp: '',
    question_about: '', question_detail: '', message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
    axios.get(`${API}/programs`).then(r => setPrograms(r.data.filter(p => p.visible !== false))).catch(() => {});
    axios.get(`${API}/sessions`).then(r => setSessions(r.data.filter(s => s.title && s.visible !== false))).catch(() => {});
  }, []);

  useEffect(() => {
    if (detectedCountry) {
      const c = COUNTRIES.find(c => c.code === detectedCountry);
      if (c) { setPhoneCode(c.phone); setWaCode(c.phone); }
    }
  }, [detectedCountry]);

  useEffect(() => {
    if (programTitle) {
      setFormData(prev => ({
        ...prev, question_about: 'flagship_program', question_detail: programTitle,
        message: `I am interested in the ${tierLabel || 'Annual'} plan for ${programTitle}. Please share the pricing details.`
      }));
    }
  }, [programTitle, tierLabel]);

  const s = settings || {};
  const hero = s.page_heroes?.contact || {};

  const socialLinks = [
    { key: 'facebook', url: s.social_facebook, show: s.show_facebook !== false, Icon: Facebook },
    { key: 'instagram', url: s.social_instagram, show: s.show_instagram !== false, Icon: Instagram },
    { key: 'youtube', url: s.social_youtube, show: s.show_youtube !== false, Icon: Youtube },
    { key: 'linkedin', url: s.social_linkedin, show: s.show_linkedin !== false, Icon: Linkedin },
  ].filter(l => l.show && l.url);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      return toast({ title: 'Please fill required fields', variant: 'destructive' });
    }
    if (!formData.phone.trim()) {
      return toast({ title: 'Phone number is required', variant: 'destructive' });
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/enrollment/quote-request`, {
        name: formData.name, email: formData.email,
        phone: `${phoneCode}${formData.phone}`,
        program_title: formData.question_detail || programTitle,
        tier_label: tierLabel,
        message: `[${formData.question_about === 'flagship_program' ? 'Program' : formData.question_about === 'personal_session' ? 'Session' : 'Other'}${formData.question_detail ? `: ${formData.question_detail}` : ''}] ${formData.whatsapp ? `[WhatsApp: ${waCode}${formData.whatsapp}] ` : ''}${formData.message}`,
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen" style={{ background: '#f8f5f0' }}>
        {/* Hero */}
        <section data-testid="contact-hero" className="relative min-h-[50vh] flex flex-col items-center justify-center text-center px-6 pt-20"
          style={{ background: hero.hero_image ? 'transparent' : 'linear-gradient(180deg, #1a1a1a 0%, #1a1a1add 50%, #1a1a1a 100%)' }}>
          {hero.hero_image && <div className="absolute inset-0" style={{ backgroundImage: `url(${resolveImageUrl(hero.hero_image)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
          {hero.hero_image && <div className="absolute inset-0" style={{ background: '#000', opacity: (hero.overlay_opacity || 60) / 100 }} />}
          <h1 data-testid="contact-hero-title" className="relative z-10 text-white mb-4 max-w-4xl" style={applyStyle(hero.title_style, { ...HEADING, color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontVariant: 'small-caps', letterSpacing: '0.05em', lineHeight: 1.3 })}>
            {hero.title_text || 'Get in Touch'}
          </h1>
          <p className="relative z-10 mb-6" style={applyStyle(hero.subtitle_style, { ...LABEL, color: GOLD })}>
            {hero.subtitle_text || "Ready to begin your healing journey? Let us know how we can help."}
          </p>
          <div className="relative z-10 w-14 h-0.5" style={{ background: GOLD }} />
        </section>

        {/* Three Info Blocks */}
        <div className={`${CONTAINER} -mt-8 relative z-10 mb-16`}>
          <div className="grid md:grid-cols-3 gap-0 max-w-3xl mx-auto shadow-lg" data-testid="contact-info-blocks">
            <InfoCard icon={Mail} title="Email Us">
              <a href={`mailto:${s.footer_email || 'support@divineirishealing.com'}`}
                className="text-sm text-gray-600 hover:text-[#D4AF37] transition-colors" style={FONT_LATO}>
                {s.footer_email || 'support@divineirishealing.com'}
              </a>
            </InfoCard>
            <InfoCard icon={Phone} title="WhatsApp">
              <a href={`https://wa.me/${(s.footer_phone || '+971553325778').replace(/[^0-9]/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-[#D4AF37] transition-colors" style={FONT_LATO}>
                {s.footer_phone || '+971553325778'}
              </a>
            </InfoCard>
            <InfoCard icon={Share2} title="Follow Us">
              <div className="flex gap-3">
                {socialLinks.map(({ key, url, Icon }) => (
                  <a key={key} href={url} target="_blank" rel="noopener noreferrer"
                    data-testid={`contact-social-${key}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-80"
                    style={{ background: GOLD }}>
                    <Icon size={14} />
                  </a>
                ))}
              </div>
            </InfoCard>
          </div>
        </div>

        {/* Form Section */}
        <div className={`${CONTAINER} pb-16`}>
          <div className="max-w-3xl mx-auto bg-white rounded-sm shadow-lg p-10 md:p-14" data-testid="contact-form-card">
            {submitted ? (
              <div className="text-center py-12" data-testid="contact-form-success">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5" style={{ border: `2px solid ${GOLD}` }}>
                  <Mail size={22} style={{ color: GOLD }} />
                </div>
                <h2 className="mb-3" style={{ ...HEADING, fontSize: '1.6rem', fontVariant: 'small-caps', color: '#1a1a1a' }}>Thank You</h2>
                <div className="w-10 h-0.5 mx-auto mb-5" style={{ background: GOLD }} />
                <p className="text-sm text-gray-600 leading-relaxed" style={FONT_LATO}>
                  Your message has been received. We will respond within 7–10 days.
                </p>
                <button data-testid="contact-send-another" onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', phone: '', whatsapp: '', question_about: '', question_detail: '', message: '' }); }}
                  className="mt-8 px-8 py-3 text-xs font-semibold tracking-[0.15em] uppercase text-white transition-all duration-300"
                  style={{ background: '#1a1a1a', ...FONT_LATO }}>
                  Send Another Message
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-center mb-2" style={{ ...HEADING, fontSize: '1.6rem', fontVariant: 'small-caps', color: '#1a1a1a' }}>
                  Send us a Message
                </h2>
                <div className="w-10 h-0.5 mx-auto mb-10" style={{ background: GOLD }} />

                <form onSubmit={handleSubmit} className="space-y-5" data-testid="contact-form">
                  {/* Row 1: Name + Email */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <input data-testid="contact-name" type="text" required value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="YOUR NAME *" className={INPUT_CLASS} style={FONT_LATO} />
                    <input data-testid="contact-email" type="email" required value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="EMAIL ADDRESS *" className={INPUT_CLASS} style={FONT_LATO} />
                  </div>

                  {/* Row 2: Phone (mandatory) + WhatsApp (optional) */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex">
                      <select data-testid="contact-phone-code" value={phoneCode}
                        onChange={e => setPhoneCode(e.target.value)}
                        className="border border-gray-300 border-r-0 bg-gray-50 px-2 py-3 text-xs focus:outline-none focus:border-[#D4AF37] transition-colors min-w-[80px]"
                        style={FONT_LATO}>
                        {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone} {c.code}</option>)}
                      </select>
                      <input data-testid="contact-phone" type="tel" required value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                        placeholder="PHONE NUMBER *" className={`${INPUT_CLASS} flex-1`} style={FONT_LATO} />
                    </div>
                    <div className="flex">
                      <select data-testid="contact-wa-code" value={waCode}
                        onChange={e => setWaCode(e.target.value)}
                        className="border border-gray-300 border-r-0 bg-gray-50 px-2 py-3 text-xs focus:outline-none focus:border-[#D4AF37] transition-colors min-w-[80px]"
                        style={FONT_LATO}>
                        {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone} {c.code}</option>)}
                      </select>
                      <input data-testid="contact-whatsapp" type="tel" value={formData.whatsapp}
                        onChange={e => setFormData({ ...formData, whatsapp: e.target.value.replace(/[^0-9]/g, '') })}
                        placeholder="WHATSAPP (OPTIONAL)" className={`${INPUT_CLASS} flex-1`} style={FONT_LATO} />
                    </div>
                  </div>

                  {/* Row 3: Have a question about (cascading) */}
                  <select data-testid="contact-question-about" value={formData.question_about}
                    onChange={e => setFormData({ ...formData, question_about: e.target.value, question_detail: '' })}
                    className={`${INPUT_CLASS} bg-white`} style={FONT_LATO}>
                    <option value="">HAVE A QUESTION ABOUT? (OPTIONAL)</option>
                    <option value="flagship_program">Flagship Program</option>
                    <option value="personal_session">Personal Session</option>
                    <option value="other">Other</option>
                  </select>
                  {formData.question_about === 'flagship_program' && programs.length > 0 && (
                    <select data-testid="contact-question-detail" value={formData.question_detail}
                      onChange={e => setFormData({ ...formData, question_detail: e.target.value })}
                      className={`${INPUT_CLASS} bg-white`} style={FONT_LATO}>
                      <option value="">SELECT PROGRAM</option>
                      {programs.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                    </select>
                  )}
                  {formData.question_about === 'personal_session' && sessions.length > 0 && (
                    <select data-testid="contact-question-detail" value={formData.question_detail}
                      onChange={e => setFormData({ ...formData, question_detail: e.target.value })}
                      className={`${INPUT_CLASS} bg-white`} style={FONT_LATO}>
                      <option value="">SELECT SESSION</option>
                      {sessions.map(s => <option key={s.id} value={s.title}>{s.title}</option>)}
                    </select>
                  )}

                  {/* Message */}
                  <textarea data-testid="contact-message" value={formData.message}
                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                    placeholder="HOW CAN WE ASSIST YOU?" rows={5}
                    className={`${INPUT_CLASS} resize-y`} style={FONT_LATO} />

                  {/* Submit */}
                  <div className="text-center pt-2">
                    <button data-testid="contact-submit" type="submit" disabled={submitting}
                      className="px-14 py-3.5 text-xs font-semibold tracking-[0.15em] uppercase text-white transition-all duration-300 hover:opacity-90 disabled:opacity-50"
                      style={{ background: '#1a1a1a', ...FONT_LATO }}>
                      {submitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Send Message'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
      <FloatingButtons />
    </>
  );
}

export default ContactPage;
