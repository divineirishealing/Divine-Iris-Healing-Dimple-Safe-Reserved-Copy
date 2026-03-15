import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Facebook, Instagram, Youtube, Linkedin, ChevronDown, ShoppingCart, Clock, Sparkles } from 'lucide-react';
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

const OfferCountdown = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!endDate) return;
    const update = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [endDate]);
  return <span>Avail before: {timeLeft}</span>;
};

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [programs, setPrograms] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
    axios.get(`${API}/programs`).then(r => setPrograms(r.data.filter(p => p.visible !== false))).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setProgramsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeSocials = settings ? [
    { key: 'facebook', url: settings.social_facebook, show: settings.show_facebook !== false },
    { key: 'instagram', url: settings.social_instagram, show: settings.show_instagram !== false },
    { key: 'youtube', url: settings.social_youtube, show: settings.show_youtube !== false },
    { key: 'linkedin', url: settings.social_linkedin, show: settings.show_linkedin !== false },
    { key: 'spotify', url: settings.social_spotify, show: settings.show_spotify === true },
    { key: 'pinterest', url: settings.social_pinterest, show: settings.show_pinterest === true },
  ].filter(s => s.show && s.url) : [];

  const DEFAULT_NAV = [
    { label: 'Home', href: '/', position: 'left', visible: true },
    { label: 'About', href: '/about', position: 'left', visible: true },
    { label: 'Contact', href: '/contact', position: 'right', visible: true },
    { label: 'Services', href: '/sessions', position: 'left', visible: true },
    { label: 'Transformations', href: '/transformations', position: 'left', visible: true },
    { label: 'Upcoming Sessions', href: '/#upcoming', position: 'left', visible: true },
    { label: 'Programs', href: '/#programs', position: 'left', visible: true },
  ];

  const headerNav = (settings?.header_nav_items?.length ? settings.header_nav_items : DEFAULT_NAV).filter(i => i.visible !== false);
  const leftNav = headerNav.filter(i => i.position !== 'right');
  const rightNav = headerNav.filter(i => i.position === 'right');
  const showProgramsDropdown = settings?.header_show_programs_dropdown !== false;

  // Exclusive offer config
  const offer = settings?.exclusive_offer || {};
  const offerEnabled = offer.enabled && offer.text;
  const hasCountdown = offerEnabled && offer.end_date;

  const handleNav = (path) => {
    setMobileOpen(false);
    setProgramsOpen(false);
    if (path.startsWith('/#')) {
      if (location.pathname === '/') {
        const el = document.getElementById(path.replace('/#', ''));
        if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 60; window.scrollTo({ top: y, behavior: 'smooth' }); }
      } else { navigate(path); }
    } else { navigate(path); window.scrollTo(0, 0); }
  };

  const SocialIcon = ({ sKey, size = 16 }) => {
    const Icon = socialIcons[sKey];
    if (!Icon) return null;
    return <Icon size={size} />;
  };

  const flagshipPrograms = programs.filter(p => p.is_flagship);
  const upcomingPrograms = programs.filter(p => p.is_upcoming);

  const NavButton = ({ item }) => (
    <button onClick={() => handleNav(item.href || item.path)} data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
      className="text-white/80 hover:text-[#D4AF37] text-[11px] tracking-[0.12em] uppercase font-medium px-3 py-2 transition-colors whitespace-nowrap">
      {item.label}
    </button>
  );

  return (
    <>
      <header data-testid="site-header" className="fixed top-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-md">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-1">
              <button data-testid="menu-toggle-btn" onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden text-white hover:text-[#D4AF37] transition-colors p-1">
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              <nav className="hidden lg:flex items-center gap-1">
                {leftNav.map(item => <NavButton key={item.label} item={item} />)}

                {showProgramsDropdown && (
                  <div ref={dropdownRef} className="relative">
                    <button onClick={() => setProgramsOpen(!programsOpen)} data-testid="nav-programs-dropdown"
                      className="text-white/80 hover:text-[#D4AF37] text-[11px] tracking-[0.12em] uppercase font-medium px-3 py-2 transition-colors inline-flex items-center gap-1 whitespace-nowrap">
                      Flagship Programs <ChevronDown size={12} className={`transition-transform duration-200 ${programsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {programsOpen && (
                      <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-black/90 backdrop-blur-md rounded-lg shadow-2xl border border-white/10 py-2 z-50">
                        {flagshipPrograms.length > 0 && (
                          <>
                            <p className="px-4 py-1 text-[9px] text-[#D4AF37] uppercase tracking-widest font-semibold">Flagship</p>
                            {flagshipPrograms.map(p => (
                              <button key={p.id} onClick={() => handleNav(`/program/${p.id}`)}
                                className="block w-full text-left px-4 py-2 text-white/70 text-xs hover:text-[#D4AF37] hover:bg-white/5 transition-colors">
                                {p.title}
                              </button>
                            ))}
                          </>
                        )}
                        {upcomingPrograms.length > 0 && (
                          <>
                            <p className="px-4 py-1 mt-1 text-[9px] text-[#D4AF37] uppercase tracking-widest font-semibold">Upcoming</p>
                            {upcomingPrograms.map(p => (
                              <button key={p.id} onClick={() => handleNav(`/program/${p.id}`)}
                                className="block w-full text-left px-4 py-2 text-white/70 text-xs hover:text-[#D4AF37] hover:bg-white/5 transition-colors">
                                {p.title}
                              </button>
                            ))}
                          </>
                        )}
                        {programs.filter(p => !p.is_flagship && !p.is_upcoming).length > 0 && (
                          <>
                            <p className="px-4 py-1 mt-1 text-[9px] text-[#D4AF37] uppercase tracking-widest font-semibold">All Programs</p>
                            {programs.filter(p => !p.is_flagship && !p.is_upcoming).map(p => (
                              <button key={p.id} onClick={() => handleNav(`/program/${p.id}`)}
                                className="block w-full text-left px-4 py-2 text-white/70 text-xs hover:text-[#D4AF37] hover:bg-white/5 transition-colors">
                                {p.title}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-1">
              <nav className="hidden lg:flex items-center gap-1">
                {rightNav.map(item => <NavButton key={item.label} item={item} />)}
              </nav>
              <button data-testid="cart-icon-btn" onClick={() => navigate('/cart')} className="relative text-white/80 hover:text-[#D4AF37] transition-colors ml-2">
                <ShoppingCart size={18} />
                {itemCount > 0 && (
                  <span data-testid="cart-count-badge" className="absolute -top-2 -right-2 bg-[#D4AF37] text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                    {itemCount}
                  </span>
                )}
              </button>
              <div className="hidden md:flex items-center gap-3 ml-3">
                {activeSocials.map(s => (
                  <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-[#D4AF37] transition-colors">
                    <SocialIcon sKey={s.key} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Offer Banner Strip - below header */}
      {offerEnabled && (
        <div data-testid="offer-banner" className={`fixed left-0 right-0 z-40 flex items-center justify-center gap-3 py-1.5 cursor-pointer transition-all ${hasCountdown ? 'bg-gradient-to-r from-red-700 via-red-600 to-red-700' : 'bg-gradient-to-r from-[#1a1a1a] via-[#2a2218] to-[#1a1a1a]'}`}
          style={{ top: '56px', fontFamily: "'Lato', sans-serif" }}
          onClick={() => handleNav('/#upcoming')}>
          <Sparkles size={12} className={hasCountdown ? 'text-yellow-300' : 'text-[#D4AF37]'} />
          <span className={`text-[10px] font-bold tracking-[0.15em] uppercase ${hasCountdown ? 'text-white' : 'text-[#D4AF37]'}`}>
            {offer.text}
          </span>
          {hasCountdown && (
            <>
              <span className="text-red-300 text-[10px]">|</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-yellow-200 tracking-wider">
                <Clock size={10} />
                <OfferCountdown endDate={offer.end_date} />
              </span>
            </>
          )}
          <span className={`text-[9px] tracking-wider uppercase ${hasCountdown ? 'text-red-200' : 'text-white/50'}`}>
            &rarr;
          </span>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div data-testid="mobile-menu" className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md pt-16 overflow-y-auto">
          <button data-testid="menu-close-btn" onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-white hover:text-[#D4AF37] transition-colors">
            <X size={24} />
          </button>
          <nav className="flex flex-col items-center gap-4 pt-8">
            {headerNav.map(item => (
              <div key={item.label}>
                <button onClick={() => handleNav(item.href || item.path)}
                  className="text-white/80 hover:text-[#D4AF37] text-sm tracking-[0.15em] uppercase font-light transition-colors">
                  {item.label}
                </button>
              </div>
            ))}
            {showProgramsDropdown && (
              <>
                <button onClick={() => setProgramsOpen(!programsOpen)}
                  className="text-white/80 hover:text-[#D4AF37] text-sm tracking-[0.15em] uppercase font-light transition-colors inline-flex items-center gap-2">
                  Flagship Programs <ChevronDown size={14} className={`transition-transform ${programsOpen ? 'rotate-180' : ''}`} />
                </button>
                {programsOpen && programs.map(p => (
                  <button key={p.id} onClick={() => handleNav(`/program/${p.id}`)}
                    className="text-white/50 hover:text-[#D4AF37] text-xs tracking-wider transition-colors pl-4">
                    {p.title}
                  </button>
                ))}
              </>
            )}
            <div className="flex items-center gap-4 mt-6 pt-6 border-t border-white/10">
              {activeSocials.map(s => (
                <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-[#D4AF37] transition-colors">
                  <SocialIcon sKey={s.key} size={18} />
                </a>
              ))}
            </div>
          </nav>
        </div>
      )}
    </>
  );
};

export default Header;
