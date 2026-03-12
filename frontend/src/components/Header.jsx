import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Facebook, Instagram, Youtube, Linkedin, ChevronDown, ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SpotifyIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
);

const PinterestIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>
);

const socialIcons = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  spotify: SpotifyIcon,
  pinterest: PinterestIcon,
};

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { itemCount } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProgramsOpen, setIsProgramsOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
    axios.get(`${API}/programs`).then(r => setPrograms(r.data.filter(p => p.visible !== false))).catch(() => {});
  }, []);

  const activeSocials = settings ? [
    { key: 'facebook', url: settings.social_facebook, show: settings.show_facebook !== false },
    { key: 'instagram', url: settings.social_instagram, show: settings.show_instagram !== false },
    { key: 'youtube', url: settings.social_youtube, show: settings.show_youtube !== false },
    { key: 'linkedin', url: settings.social_linkedin, show: settings.show_linkedin !== false },
    { key: 'spotify', url: settings.social_spotify, show: settings.show_spotify === true },
    { key: 'pinterest', url: settings.social_pinterest, show: settings.show_pinterest === true },
  ].filter(s => s.show && s.url) : [
    { key: 'facebook', url: 'https://facebook.com', show: true },
    { key: 'instagram', url: 'https://instagram.com', show: true },
    { key: 'youtube', url: 'https://youtube.com', show: true },
    { key: 'linkedin', url: 'https://linkedin.com', show: true },
  ];

  const handleNavClick = (path) => {
    setIsMenuOpen(false);
    setIsProgramsOpen(false);
    if (path.startsWith('/#')) {
      if (location.pathname === '/') {
        const el = document.getElementById(path.replace('/#', ''));
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else { navigate(path); }
    } else { navigate(path); }
  };

  const SocialIcon = ({ sKey, size = 18, className = '' }) => {
    const Icon = socialIcons[sKey];
    if (!Icon) return null;
    return <Icon size={size} className={className} />;
  };

  return (
    <>
      <header data-testid="site-header" className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <button data-testid="menu-toggle-btn" onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 text-white hover:text-[#D4AF37] transition-colors">
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            <span className="text-[10px] font-medium tracking-[0.2em]">MENU</span>
          </button>
          <div className="flex items-center gap-4">
            <button data-testid="cart-icon-btn" onClick={() => navigate('/cart')} className="relative text-white/80 hover:text-[#D4AF37] transition-colors">
              <ShoppingCart size={18} />
              {itemCount > 0 && (
                <span data-testid="cart-count-badge" className="absolute -top-2 -right-2 bg-[#D4AF37] text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {itemCount}
                </span>
              )}
            </button>
            <div className="hidden md:flex items-center gap-4">
              {activeSocials.map(s => (
                <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-[#D4AF37] transition-colors">
                  <SocialIcon sKey={s.key} size={16} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </header>

      {isMenuOpen && (
        <div data-testid="menu-overlay" className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #8B6914 0%, #D4AF37 30%, #C5A028 50%, #8B6914 100%)' }}>
          <button data-testid="menu-close-btn" onClick={() => setIsMenuOpen(false)} className="absolute top-6 left-6 flex items-center gap-2 text-white hover:text-yellow-200 transition-colors">
            <X size={20} /><span className="text-[10px] font-medium tracking-[0.2em]">CLOSE</span>
          </button>
          <div className="absolute top-6 right-6 flex items-center gap-4">
            <button data-testid="cart-icon-menu" onClick={() => { setIsMenuOpen(false); navigate('/cart'); }} className="relative text-white/80 hover:text-white transition-colors">
              <ShoppingCart size={18} />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-[#D4AF37] text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{itemCount}</span>
              )}
            </button>
            {activeSocials.map(s => (
              <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors">
                <SocialIcon sKey={s.key} size={16} />
              </a>
            ))}
          </div>
          <nav className="text-center space-y-5">
            {[
              {label:'HOME',path:'/'},
              {label:'ABOUT',path:'/about'},
              {label:'SERVICES',path:'/services'},
              {label:'UPCOMING SESSIONS',path:'/sessions'},
              {label:'MEDIA',path:'/media'},
              {label:'TRANSFORMATIONS',path:'/transformations'},
              ...(settings?.blog_page_visible ? [{label:'BLOG',path:'/blog'}] : []),
            ].map(item => (
              <button key={item.label} onClick={() => handleNavClick(item.path)} className="block w-full text-white text-xl md:text-2xl font-light tracking-[0.15em] hover:text-yellow-200 transition-colors">{item.label}</button>
            ))}
            <div>
              <button onClick={() => setIsProgramsOpen(!isProgramsOpen)} className="text-white text-xl md:text-2xl font-light tracking-[0.15em] hover:text-yellow-200 transition-colors inline-flex items-center gap-2">
                PROGRAMS <ChevronDown size={18} className={`transition-transform ${isProgramsOpen ? 'rotate-180' : ''}`} />
              </button>
              {isProgramsOpen && (
                <div className="mt-2 space-y-1.5">
                  {programs.map(p => (
                    <button key={p.id} onClick={() => handleNavClick(`/program/${p.id}`)} className="block w-full text-white/80 text-xs tracking-wider hover:text-white transition-colors">{p.title}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => handleNavClick('/contact')} className="block w-full text-white text-xl md:text-2xl font-light tracking-[0.15em] hover:text-yellow-200 transition-colors">CONTACT</button>
          </nav>
        </div>
      )}
    </>
  );
};

export default Header;
