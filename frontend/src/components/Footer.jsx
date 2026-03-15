import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Facebook, Instagram, Youtube, Linkedin, Mail, Phone, X, Send, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { BODY, GOLD, CONTAINER } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SpotifyIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
);

const PinterestIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>
);

const TikTokIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48v-7.1a8.16 8.16 0 005.58 2.2V11.3a4.85 4.85 0 01-3.58-1.56 4.83 4.83 0 01-1.25-3.05V6.69z"/></svg>
);

const AppleMusicIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.7.283C18.96.106 18.197.035 17.424.024c-.105 0-.21-.013-.318-.024H6.9c-.106.013-.21.024-.317.024A12.19 12.19 0 003.64.283 5.022 5.022 0 001.77.89C.652 1.622-.093 2.622-.41 3.934a9.23 9.23 0 00-.24 2.19c0 .105-.013.21-.024.318v11.028c.013.105.024.21.024.318.05.775.17 1.542.39 2.19.56 1.64 1.72 2.76 3.36 3.27.63.2 1.29.3 1.95.33.41.03.82.04 1.23.04h10.48c.41 0 .82-.01 1.23-.04a7.17 7.17 0 001.95-.33c1.64-.51 2.8-1.63 3.36-3.27.22-.648.34-1.415.39-2.19 0-.105.013-.21.024-.318V6.442c-.013-.105-.024-.21-.024-.318zM17.73 12c0 .67-.04 1.34-.12 2s-.22 1.29-.43 1.88a4.73 4.73 0 01-2.77 2.77c-.59.21-1.21.35-1.88.43a14.6 14.6 0 01-2 .12 14.6 14.6 0 01-2-.12 6.3 6.3 0 01-1.88-.43 4.73 4.73 0 01-2.77-2.77c-.21-.59-.35-1.21-.43-1.88a14.6 14.6 0 01-.12-2 14.6 14.6 0 01.12-2c.08-.66.22-1.29.43-1.88a4.73 4.73 0 012.77-2.77c.59-.21 1.21-.35 1.88-.43a14.6 14.6 0 012-.12 14.6 14.6 0 012 .12c.66.08 1.29.22 1.88.43a4.73 4.73 0 012.77 2.77c.21.59.35 1.21.43 1.88.08.66.12 1.33.12 2z"/></svg>
);

const SoundCloudIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.282c.013.06.045.094.104.094.06 0 .09-.037.104-.094l.2-1.282-.2-1.332c-.014-.064-.044-.094-.105-.094m1.79-1.065c-.067 0-.12.054-.127.127l-.208 2.364.208 2.276c.007.073.06.127.127.127s.12-.054.127-.127l.24-2.276-.24-2.364c-.007-.073-.06-.127-.127-.127m.896-.407c-.076 0-.14.066-.146.146l-.19 2.771.19 2.358c.006.08.07.146.146.146.076 0 .14-.066.148-.146l.213-2.358-.213-2.771c-.008-.08-.072-.146-.148-.146m.895-.186c-.086 0-.156.072-.162.162l-.176 2.957.176 2.421c.006.09.076.162.162.162s.156-.072.162-.162l.2-2.421-.2-2.957c-.006-.09-.076-.162-.162-.162m.897-.046c-.094 0-.172.081-.178.178l-.162 3.003.162 2.456c.006.097.084.178.178.178.094 0 .172-.08.178-.178l.184-2.456-.184-3.003c-.006-.097-.084-.178-.178-.178m.9.01c-.102 0-.187.087-.192.192l-.15 2.993.15 2.473c.005.105.09.192.192.192.101 0 .186-.087.192-.192l.168-2.473-.168-2.993c-.006-.105-.09-.192-.192-.192m.888-.355c-.113 0-.205.094-.21.21l-.135 3.338.135 2.486c.005.117.097.21.21.21.112 0 .205-.094.21-.21l.153-2.486-.153-3.338c-.005-.116-.098-.21-.21-.21m.897-.168c-.12 0-.22.103-.224.224l-.12 3.506.12 2.498c.004.121.104.224.224.224.12 0 .22-.103.224-.224l.137-2.498-.137-3.506c-.004-.12-.104-.224-.224-.224m.9-.031c-.128 0-.233.107-.236.236l-.108 3.537.108 2.498c.003.128.108.236.236.236.127 0 .232-.108.236-.236l.122-2.498-.122-3.537c-.004-.128-.109-.236-.236-.236m.887-.316c-.14 0-.253.116-.256.257l-.094 3.853.094 2.492c.003.14.116.256.256.256.14 0 .254-.116.257-.256l.106-2.492-.106-3.853c-.003-.14-.117-.257-.257-.257m.9.002c-.147 0-.268.125-.27.27l-.083 3.851.083 2.483c.002.146.123.27.27.27s.268-.124.27-.27l.094-2.483-.094-3.851c-.002-.145-.123-.27-.27-.27m.897.168c-.155 0-.283.13-.285.285l-.07 3.683.07 2.463c.002.155.13.285.285.285.154 0 .282-.13.285-.285l.078-2.463-.078-3.683c-.003-.155-.131-.285-.285-.285m.902-.191c-.163 0-.298.137-.3.3l-.057 3.874.057 2.45c.002.163.137.3.3.3.163 0 .297-.137.3-.3l.064-2.45-.064-3.874c-.003-.163-.137-.3-.3-.3m3.254-.327A3.87 3.87 0 0016.877 8.3a9.706 9.706 0 00-1.682-.152c-.34 0-.612.274-.612.612v8.05c0 .338.27.614.606.62h5.052a2.79 2.79 0 002.79-2.79 2.79 2.79 0 00-2.79-2.79"/></svg>
);

const socialIcons = {
  facebook: { icon: Facebook, color: 'text-gray-400 hover:text-[#D4AF37]' },
  instagram: { icon: Instagram, color: 'text-gray-400 hover:text-[#D4AF37]' },
  youtube: { icon: Youtube, color: 'text-gray-400 hover:text-[#D4AF37]' },
  linkedin: { icon: Linkedin, color: 'text-gray-400 hover:text-[#D4AF37]' },
  spotify: { icon: SpotifyIcon, color: 'text-gray-400 hover:text-[#D4AF37]' },
  pinterest: { icon: PinterestIcon, color: 'text-gray-400 hover:text-[#D4AF37]' },
  tiktok: { icon: TikTokIcon, color: 'text-gray-400 hover:text-[#D4AF37]' },
  apple_music: { icon: AppleMusicIcon, color: 'text-gray-400 hover:text-[#D4AF37]' },
  soundcloud: { icon: SoundCloudIcon, color: 'text-gray-400 hover:text-[#D4AF37]' },
};

const FONT_LATO = { fontFamily: "'Lato', sans-serif" };

const ContactFormDialog = ({ open, onClose, programs, sessions }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', question_about: '', question_detail: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/enrollment/quote-request`, {
        name: formData.name, email: formData.email, phone: formData.phone,
        program_title: formData.question_detail,
        message: `[${formData.question_about === 'flagship_program' ? 'Program' : formData.question_about === 'personal_session' ? 'Session' : 'Other'}${formData.question_detail ? `: ${formData.question_detail}` : ''}] ${formData.message}`,
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally { setSubmitting(false); }
  };

  const handleClose = () => { setSubmitted(false); setFormData({ name: '', email: '', phone: '', question_about: '', question_detail: '', message: '' }); onClose(); };

  const INPUT_CLS = "w-full border border-gray-300 bg-white px-4 py-2.5 text-sm placeholder:text-gray-400 placeholder:uppercase placeholder:tracking-wider placeholder:text-[10px] focus:outline-none focus:border-[#D4AF37] transition-colors";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-white" data-testid="footer-contact-dialog">
        <div className="p-8">
          <DialogTitle className="text-center mb-1" style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '1.3rem', color: '#1a1a1a', fontVariant: 'small-caps' }}>Send us a Message</DialogTitle>
          <div className="w-8 h-0.5 mx-auto mt-2 mb-6" style={{ background: GOLD }} />

          {submitted ? (
            <div className="text-center py-8" data-testid="contact-form-success">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ border: `2px solid ${GOLD}` }}>
                <Send size={18} style={{ color: GOLD }} />
              </div>
              <p className="text-base font-medium text-gray-900 mb-2" style={FONT_LATO}>Thank You</p>
              <p className="text-sm text-gray-500" style={FONT_LATO}>Your message has been received. We will respond within 7-10 days.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input data-testid="footer-contact-name" type="text" required value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="YOUR NAME *" className={INPUT_CLS} style={FONT_LATO} />
                <input data-testid="footer-contact-email" type="email" required value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="EMAIL ADDRESS *" className={INPUT_CLS} style={FONT_LATO} />
              </div>
              <input data-testid="footer-contact-phone" type="tel" value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="PHONE NUMBER (OPTIONAL)" className={INPUT_CLS} style={FONT_LATO} />
              <select data-testid="footer-contact-question-about" value={formData.question_about}
                onChange={e => setFormData({ ...formData, question_about: e.target.value, question_detail: '' })}
                className={`${INPUT_CLS} bg-white`} style={FONT_LATO}>
                <option value="">HAVE A QUESTION ABOUT? (OPTIONAL)</option>
                <option value="flagship_program">Flagship Program</option>
                <option value="personal_session">Personal Session</option>
                <option value="other">Other</option>
              </select>
              {formData.question_about === 'flagship_program' && programs.length > 0 && (
                <select data-testid="footer-contact-question-detail" value={formData.question_detail}
                  onChange={e => setFormData({ ...formData, question_detail: e.target.value })}
                  className={`${INPUT_CLS} bg-white`} style={FONT_LATO}>
                  <option value="">SELECT PROGRAM</option>
                  {programs.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                </select>
              )}
              {formData.question_about === 'personal_session' && sessions.length > 0 && (
                <select data-testid="footer-contact-question-detail" value={formData.question_detail}
                  onChange={e => setFormData({ ...formData, question_detail: e.target.value })}
                  className={`${INPUT_CLS} bg-white`} style={FONT_LATO}>
                  <option value="">SELECT SESSION</option>
                  {sessions.map(s => <option key={s.id} value={s.title}>{s.title}</option>)}
                </select>
              )}
              <textarea data-testid="footer-contact-message" required value={formData.message}
                onChange={e => setFormData({ ...formData, message: e.target.value })}
                placeholder="HOW CAN WE ASSIST YOU?" rows={3}
                className={`${INPUT_CLS} resize-y`} style={FONT_LATO} />
              <div className="text-center pt-1">
                <button data-testid="footer-contact-submit" type="submit" disabled={submitting}
                  className="px-10 py-3 text-xs font-semibold tracking-[0.15em] uppercase text-white transition-all duration-300 disabled:opacity-50"
                  style={{ background: '#1a1a1a', ...FONT_LATO }}>
                  {submitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Send Message'}
                </button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Footer = () => {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    axios.get(`${API}/programs`).then(r => setPrograms(r.data.filter(p => p.visible !== false))).catch(() => {});
    axios.get(`${API}/sessions`).then(r => setSessions(r.data.filter(s => s.title && s.visible !== false))).catch(() => {});
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
  }, []);

  const s = settings || {};

  const DEFAULT_MENU = [
    { label: 'Home', href: '/#home', visible: true },
    { label: 'About', href: '/#about', visible: true },
    { label: 'Services', href: '/sessions', visible: true },
    { label: 'Upcoming Programs', href: '/#upcoming', visible: true },
    { label: 'Flagship Programs', href: '/#programs', visible: true },
    { label: 'Sponsor a Session', href: '/#sponsor', visible: true },
    { label: 'Transformations', href: '/transformations', visible: true },
  ];
  const footerMenuItems = (s.footer_menu_items?.length
    ? s.footer_menu_items.filter(item => item.label?.toLowerCase() !== 'contact')
    : DEFAULT_MENU
  ).filter(item => item.visible !== false);

  const handleMenuClick = (href) => {
    if (href.startsWith('/#')) {
      const sectionId = href.replace('/#', '');
      if (window.location.pathname === '/') {
        const el = document.getElementById(sectionId);
        if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 60; window.scrollTo({ top: y, behavior: 'smooth' }); }
      } else {
        navigate('/');
        setTimeout(() => {
          const el = document.getElementById(sectionId);
          if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 60; window.scrollTo({ top: y, behavior: 'smooth' }); }
        }, 500);
      }
    } else {
      navigate(href);
      window.scrollTo(0, 0);
    }
  };

  const socialLinks = [
    { key: 'facebook', url: s.social_facebook, show: s.show_facebook !== false },
    { key: 'instagram', url: s.social_instagram, show: s.show_instagram !== false },
    { key: 'youtube', url: s.social_youtube, show: s.show_youtube !== false },
    { key: 'linkedin', url: s.social_linkedin, show: s.show_linkedin !== false },
    { key: 'spotify', url: s.social_spotify, show: s.show_spotify === true },
    { key: 'pinterest', url: s.social_pinterest, show: s.show_pinterest === true },
    { key: 'tiktok', url: s.social_tiktok, show: s.show_tiktok === true },
    { key: 'apple_music', url: s.social_apple_music, show: s.show_apple_music === true },
    { key: 'soundcloud', url: s.social_soundcloud, show: s.show_soundcloud === true },
  ].filter(l => l.show && l.url);

  return (
    <>
      <footer id="contact" data-testid="site-footer" className="text-white py-14" style={{ background: '#1a1a1a', ...FONT_LATO }}>
        <div className={CONTAINER}>
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            {/* Brand */}
            <div>
              <h3 className="text-base mb-3 font-light" style={FONT_LATO}>{s.footer_brand_name || 'Divine Iris Healing'}</h3>
              <p className="text-gray-400 text-[11px] leading-relaxed mb-5" style={FONT_LATO}>{s.footer_tagline || 'Delve into the deeper realm of your soul with Divine Iris – Soulful Healing Studio'}</p>
              <div className="flex flex-wrap gap-3">
                {socialLinks.map(link => {
                  const cfg = socialIcons[link.key];
                  if (!cfg) return null;
                  const IconComp = cfg.icon;
                  return (
                    <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#D4AF37] transition-colors" data-testid={`footer-social-${link.key}`}>
                      <IconComp size={16} />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Menu */}
            <div>
              <h4 className="text-xs font-medium mb-3 tracking-wider text-gray-300" style={FONT_LATO}>MENU</h4>
              <ul className="space-y-1.5 text-gray-400 text-[11px]" style={FONT_LATO}>
                {footerMenuItems.map(item => (
                  <li key={item.label}>
                    <button onClick={() => handleMenuClick(item.href)}
                      className="hover:text-[#D4AF37] transition-colors text-left">{item.label}</button>
                  </li>
                ))}
                <li>
                  <button data-testid="footer-contact-btn" onClick={() => setContactOpen(true)}
                    className="hover:text-[#D4AF37] transition-colors text-left">Contact</button>
                </li>
              </ul>
            </div>

            {/* Programs */}
            <div>
              <h4 className="text-xs font-medium mb-3 tracking-wider text-gray-300" style={FONT_LATO}>PROGRAMS</h4>
              <ul className="space-y-1.5 text-gray-400 text-[11px]" style={FONT_LATO}>
                {[...programs].slice(0, 6).sort((a, b) => a.title.length - b.title.length).map(p => (
                  <li key={p.id}>
                    <button data-testid={`footer-program-${p.id}`} onClick={() => { navigate(`/program/${p.id}`); window.scrollTo(0, 0); }}
                      className="hover:text-[#D4AF37] transition-colors text-left">{p.title}</button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-xs font-medium mb-3 tracking-wider text-gray-300" style={FONT_LATO}>CONTACT US</h4>
              <ul className="space-y-2.5 text-gray-400 text-[11px]" style={FONT_LATO}>
                <li>
                  <a href={`mailto:${s.footer_email || 'support@divineirishealing.com'}`} className="hover:text-[#D4AF37] transition-colors flex items-center gap-2" data-testid="footer-email">
                    <Mail size={14} className="text-[#D4AF37] flex-shrink-0" />
                    {s.footer_email || 'support@divineirishealing.com'}
                  </a>
                </li>
                <li>
                  <a href={`tel:${s.footer_phone || '+971553325778'}`} className="hover:text-[#D4AF37] transition-colors flex items-center gap-2" data-testid="footer-phone">
                    <Phone size={14} className="text-[#D4AF37] flex-shrink-0" />
                    {s.footer_phone || '+971553325778'}
                  </a>
                </li>
              </ul>
              {/* Golden divider line */}
              <div className="w-full h-px my-4" style={{ background: GOLD, opacity: 0.4 }} />
              <ul className="space-y-1.5 text-gray-400 text-[11px]" style={FONT_LATO}>
                <li>
                  <button onClick={() => navigate('/terms')} className="hover:text-[#D4AF37] transition-colors" data-testid="footer-terms-link">Terms & Conditions</button>
                </li>
                <li>
                  <button onClick={() => navigate('/privacy')} className="hover:text-[#D4AF37] transition-colors" data-testid="footer-privacy-link">Privacy Policy</button>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-center">
            <p className="text-gray-500 text-[10px]" style={FONT_LATO}>&copy; {s.footer_copyright || '2026 Divine Iris Healing. All Rights Reserved.'}</p>
          </div>
        </div>
      </footer>

      <ContactFormDialog open={contactOpen} onClose={() => setContactOpen(false)} programs={programs} sessions={sessions} />
    </>
  );
};

export default Footer;
