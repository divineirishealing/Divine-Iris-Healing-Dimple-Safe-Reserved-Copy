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
import { HEADING, SUBTITLE, BODY, GOLD, CONTAINER } from '../lib/designTokens';

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

  const programId = searchParams.get('program') || '';
  const programTitle = searchParams.get('title') || '';
  const tierLabel = searchParams.get('tier') || '';
  const isQuote = !!programId;

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isQuote && programTitle) {
      setFormData(prev => ({
        ...prev,
        message: `I am interested in the ${tierLabel || 'Annual'} plan for ${programTitle}. Please share the pricing details.`
      }));
    }
  }, [isQuote, programTitle, tierLabel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      return toast({ title: 'Please fill required fields', variant: 'destructive' });
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/enrollment/quote-request`, {
        name: formData.name, email: formData.email, phone: formData.phone,
        program_id: programId, program_title: programTitle, tier_label: tierLabel,
        message: formData.message,
      });
      toast({ title: "Request submitted!", description: "We'll get back to you within 24 hours." });
      setFormData({ name: '', email: '', phone: '', message: '' });
    } catch {
      toast({ title: "Submitted!", description: "We'll get back to you soon." });
      setFormData({ name: '', email: '', phone: '', message: '' });
    } finally { setSubmitting(false); }
  };

  const hero = settings?.page_heroes?.contact || {};

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-20">
        <div className={`${CONTAINER} py-12`}>
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="mb-4" style={applyStyle(hero.title_style, { ...HEADING, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)' })}>
                {hero.title_text || (isQuote ? 'Request a Quote' : 'Express Your Interest')}
              </h1>
              <p style={applyStyle(hero.subtitle_style, { ...SUBTITLE, fontSize: '0.9rem' })}>
                {hero.subtitle_text || (isQuote
                  ? `Get custom pricing for ${programTitle || 'this program'}`
                  : 'Ready to begin your healing journey? Let us know how we can help.')}
              </p>
            </div>

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
