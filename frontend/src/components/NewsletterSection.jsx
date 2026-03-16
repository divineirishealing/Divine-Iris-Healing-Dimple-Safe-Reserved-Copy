import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import { HEADING, BODY, GOLD, CONTAINER, applySectionStyle } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NewsletterSection = ({ sectionConfig }) => {
  const [email, setEmail] = useState('');
  const [settings, setSettings] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
  }, []);

  const s = settings || {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (email) {
      try {
        await axios.post(`${API}/newsletter`, { email });
        toast({ title: "Successfully Subscribed!", description: "Thank you for joining our community." });
        setEmail('');
      } catch (error) {
        if (error.response?.status === 400) {
          toast({ title: "Already Subscribed", description: "This email is already subscribed.", variant: "destructive" });
        } else {
          toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
        }
      }
    }
  };

  return (
    <section data-testid="newsletter-section" className="py-12" style={{ background: 'linear-gradient(180deg, #f3edff 0%, #f5f0ff 25%, #faf8ff 50%, #ffffff 80%, #ffffff 100%)' }}>
      <div className={CONTAINER}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="mb-6" style={applySectionStyle(sectionConfig?.title_style, { ...HEADING, color: '#8B6914', fontSize: 'clamp(1.5rem, 3vw, 2rem)' })}>
            {sectionConfig?.title || s.newsletter_heading || 'Join Our Community'}
          </h2>
          <p className="mb-8 leading-relaxed" style={BODY}>
            {s.newsletter_description || 'Sign up to receive updates on upcoming workshops, new courses and more information'}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <input type="email" placeholder="ENTER YOUR EMAIL ADDRESS" value={email} onChange={(e) => setEmail(e.target.value)}
              data-testid="newsletter-email-input"
              className="max-w-md w-full px-6 py-3 rounded-full border border-gray-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none text-sm tracking-wider" required />
            <button type="submit" data-testid="newsletter-subscribe-btn"
              className="bg-[#D4AF37] hover:bg-[#b8962e] text-white px-8 py-3 rounded-full text-sm whitespace-nowrap transition-all duration-300 shadow-lg hover:shadow-xl tracking-wider">
              {s.newsletter_button_text || 'Subscribe'}
            </button>
          </form>

          <p className="text-gray-500 text-xs mt-6">
            {s.newsletter_footer_text || 'By subscribing, you agree to our Privacy Policy and Terms of Use.'}
          </p>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
