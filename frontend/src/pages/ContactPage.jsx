import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../hooks/use-toast';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { Loader2, Send } from 'lucide-react';
import { HEADING, SUBTITLE, BODY, GOLD, LABEL, CONTAINER } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const applyStyle = (styleObj, defaults = {}) => {
  if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
  return { ...defaults, ...(styleObj.font_family && { fontFamily: styleObj.font_family }), ...(styleObj.font_size && { fontSize: styleObj.font_size }), ...(styleObj.font_color && { color: styleObj.font_color }), ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }), ...(styleObj.font_style && { fontStyle: styleObj.font_style }) };
};

function ContactPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);

  const programId = searchParams.get('program') || '';
  const programTitle = searchParams.get('title') || '';
  const tierLabel = searchParams.get('tier') || '';
  const isQuote = !!programId;

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', inquiry_type: '', inquiry_detail: '', message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
    axios.get(`${API}/programs`).then(r => setPrograms(r.data.filter(p => p.visible !== false))).catch(() => {});
    axios.get(`${API}/sessions`).then(r => setSessions(r.data.filter(s => s.title && s.visible !== false))).catch(() => {});
  }, []);

  useEffect(() => {
    if (isQuote && programTitle) {
      setFormData(prev => ({
        ...prev,
        inquiry_type: 'program',
        inquiry_detail: programTitle,
        message: `I am interested in the ${tierLabel || 'Annual'} plan for ${programTitle}. Please share the pricing details.`
      }));
    }
  }, [isQuote, programTitle, tierLabel]);

  const inquiryOptions = [
    { value: '', label: 'Select inquiry type' },
    { value: 'program', label: 'About a Program' },
    { value: 'session', label: 'About a Personal Session' },
    { value: 'other', label: 'Other' },
  ];

  const detailOptions = formData.inquiry_type === 'program'
    ? programs.map(p => ({ value: p.title, label: p.title }))
    : formData.inquiry_type === 'session'
      ? sessions.map(s => ({ value: s.title, label: s.title }))
      : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      return toast({ title: 'Please fill required fields', variant: 'destructive' });
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/enrollment/quote-request`, {
        name: formData.name, email: formData.email, phone: formData.phone,
        program_id: programId, program_title: formData.inquiry_detail || programTitle,
        tier_label: tierLabel,
        message: `[${formData.inquiry_type || 'General'}${formData.inquiry_detail ? ` - ${formData.inquiry_detail}` : ''}] ${formData.message}`,
      });
      toast({ title: "Request submitted!", description: "We'll get back to you within 24 hours." });
      setFormData({ name: '', email: '', phone: '', inquiry_type: '', inquiry_detail: '', message: '' });
    } catch {
      toast({ title: "Submitted!", description: "We'll get back to you soon." });
      setFormData({ name: '', email: '', phone: '', inquiry_type: '', inquiry_detail: '', message: '' });
    } finally { setSubmitting(false); }
  };

  const hero = settings?.page_heroes?.contact || {};

  return (
    <>
      <Header />
      <div className="min-h-screen bg-white">
        {/* Hero - matching program page style */}
        <section className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6 pt-20"
          style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #1a1a1add 50%, #1a1a1a 100%)' }}>
          <h1 data-testid="contact-hero-title" className="mb-4 max-w-4xl" style={applyStyle(hero.title_style, { ...HEADING, color: GOLD, fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontVariant: 'small-caps', letterSpacing: '0.05em', lineHeight: 1.3 })}>
            {hero.title_text || (isQuote ? 'Request a Quote' : 'Express Your Interest')}
          </h1>
          <p className="mb-6" style={applyStyle(hero.subtitle_style, { ...LABEL, color: '#fff' })}>
            {hero.subtitle_text || (isQuote
              ? `Get custom pricing for ${programTitle || 'this program'}`
              : 'Ready to begin your healing journey? Let us know how we can help.')}
          </p>
          <div className="w-14 h-0.5" style={{ background: GOLD }} />
        </section>

        <div className={`${CONTAINER} py-12`}>
          <div className="max-w-3xl mx-auto">
            {isQuote && programTitle && (
              <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl p-4 mb-6 text-center">
                <p className="text-sm text-gray-700"><strong>Program:</strong> {programTitle}</p>
                {tierLabel && <p className="text-xs text-[#D4AF37] mt-1">Duration: {tierLabel}</p>}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-xl p-8 md:p-12">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <Input data-testid="contact-name" type="text" required value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter your full name" className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                  <Input data-testid="contact-email" type="email" required value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Enter your email" className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <Input data-testid="contact-phone" type="tel" value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Enter your phone number" className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Inquiry About</label>
                  <select data-testid="contact-inquiry-type" value={formData.inquiry_type}
                    onChange={e => setFormData({ ...formData, inquiry_type: e.target.value, inquiry_detail: '' })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#D4AF37] transition-colors bg-white">
                    {inquiryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                {(formData.inquiry_type === 'program' || formData.inquiry_type === 'session') && detailOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {formData.inquiry_type === 'program' ? 'Select Program' : 'Select Session'}
                    </label>
                    <select data-testid="contact-inquiry-detail" value={formData.inquiry_detail}
                      onChange={e => setFormData({ ...formData, inquiry_detail: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#D4AF37] transition-colors bg-white">
                      <option value="">Select...</option>
                      {detailOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                  <Textarea data-testid="contact-message" required value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us about what you're looking for..." rows={5} className="w-full" />
                </div>
                <div className="flex gap-4">
                  <Button data-testid="contact-submit" type="submit" disabled={submitting}
                    className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-6">
                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Send size={16} className="mr-2" /> {isQuote ? 'Request Quote' : 'Submit Inquiry'}</>}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate(-1)} className="px-8">Back</Button>
                </div>
              </form>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Other Ways to Reach Us</h3>
                <div className="space-y-3 text-gray-600">
                  <p><strong>Email:</strong> <a href="mailto:support@divineirishealing.com" className="text-[#D4AF37] hover:underline">support@divineirishealing.com</a></p>
                  <p><strong>Phone:</strong> <a href="tel:+971553325778" className="text-[#D4AF37] hover:underline">+971 55 332 5778</a></p>
                  <p><strong>WhatsApp:</strong> <a href="https://wa.me/971553325778" target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline">Chat with us</a></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      <FloatingButtons />
    </>
  );
}

export default ContactPage;
