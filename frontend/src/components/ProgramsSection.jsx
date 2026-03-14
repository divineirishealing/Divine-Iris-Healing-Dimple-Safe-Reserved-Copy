import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../hooks/use-toast';
import { ShoppingCart, Check, Calendar, Clock, Bell } from 'lucide-react';
import { HEADING, BODY, GOLD, CONTAINER, applySectionStyle } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FlagshipCard = ({ program }) => {
  const navigate = useNavigate();
  const { getPrice, getOfferPrice, symbol } = useCurrency();
  const { addItem, items } = useCart();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySubmitted, setNotifySubmitted] = useState(false);

  const tiers = program.duration_tiers || [];
  const hasTiers = tiers.length > 0 && program.show_tiers_on_card !== false;
  const tier = hasTiers ? tiers[selectedTier] : null;

  const isAnnual = tier && (tier.label.toLowerCase().includes('annual') || tier.label.toLowerCase().includes('year') || tier.duration_unit === 'year');
  const price = getPrice(program, hasTiers ? selectedTier : null);
  const offerPrice = getOfferPrice(program, hasTiers ? selectedTier : null);
  const showContact = isAnnual && price === 0;
  const inCart = items.some(i => i.programId === program.id && i.tierIndex === selectedTier);
  const showPricing = program.show_pricing_on_card !== false;

  const enrollStatus = program.enrollment_status || (program.enrollment_open !== false ? 'open' : 'closed');

  const handleAddToCart = () => {
    const added = addItem(program, selectedTier);
    if (added) {
      setJustAdded(true);
      toast({ title: `${program.title} added to cart`, description: `${tier?.label || 'Standard'} plan` });
      setTimeout(() => setJustAdded(false), 2000);
    } else {
      toast({ title: 'Already in cart', description: 'This program + tier is already in your cart', variant: 'destructive' });
    }
  };

  const handleNotifyMe = async () => {
    if (!notifyEmail) return;
    try {
      await axios.post(`${API}/notify-me`, { email: notifyEmail, program_id: program.id, program_title: program.title });
      setNotifySubmitted(true);
      toast({ title: 'Subscribed!', description: "We'll notify you when enrollment opens." });
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  // Tier-specific dates
  const activeTier = hasTiers ? tiers[selectedTier] : null;
  const displayStartDate = (activeTier?.start_date) || program.start_date;
  const displayEndDate = (activeTier?.end_date) || program.end_date;

  const parseDate = (d) => {
    if (!d) return null;
    const cleaned = d.replace(/(\d+)(st|nd|rd|th)/gi, '$1').replace(',', '');
    const dt = new Date(cleaned);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const fmtDate = (d) => {
    const dt = parseDate(d);
    if (!dt) return d || '';
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div data-testid={`program-card-${program.id}`}
      className="group bg-white rounded-xl overflow-hidden shadow-lg transition-all duration-300 border border-gray-100 flex flex-col hover:shadow-2xl">
      <div className="relative h-48 overflow-hidden cursor-pointer" onClick={() => navigate(`/program/${program.id}`)}>
        <img src={resolveImageUrl(program.image)} alt={program.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&h=400&fit=crop'; }} />
        {/* Mode badges — always shown */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {program.enable_online !== false && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-blue-500 text-white w-fit">Online (Zoom)</span>
          )}
          {program.enable_offline !== false && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-teal-600 text-white w-fit">Offline (Remote, Not In-Person)</span>
          )}
          {program.enable_in_person && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-teal-600 text-white w-fit">In-Person</span>
          )}
        </div>
        {/* Coming Soon badge on image */}
        {enrollStatus === 'coming_soon' && (
          <div className="absolute inset-0 bg-black/15 flex items-center justify-center">
            <span data-testid={`coming-soon-badge-${program.id}`} className="bg-blue-600/90 text-white text-sm font-bold px-6 py-2.5 rounded-full tracking-wider uppercase shadow-xl border border-white/20 animate-pulse">
              Coming Soon
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <p className="text-[#D4AF37] text-[10px] tracking-wider mb-0.5 uppercase">{program.category}</p>
        <h3 className="text-base font-semibold text-gray-900 mb-1.5 leading-tight cursor-pointer" style={{ ...BODY, fontWeight: 600, color: '#1a1a1a', fontSize: '0.95rem' }}
          onClick={() => navigate(`/program/${program.id}`)}>{program.title}</h3>
        <p className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-2 flex-1" style={{ ...BODY, fontSize: '0.8rem' }}>{program.description}</p>

        {/* Tier Selector — always available for flagship programs */}
        {hasTiers && (
          <div data-testid={`flagship-tier-selector-${program.id}`} className="mb-3">
            <div className="flex gap-1">
              {tiers.map((t, i) => (
                <button key={i} data-testid={`flagship-tier-btn-${program.id}-${i}`}
                  onClick={() => setSelectedTier(i)}
                  className={`flex-1 text-[10px] py-1.5 rounded-full border transition-all ${
                    selectedTier === i ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-500 border-gray-200 hover:border-[#D4AF37]'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pricing — toggleable */}
        {showPricing && enrollStatus === 'open' && (
          <div className="mb-2">
            {showContact ? (
              <p className="text-gray-500 text-[10px]">Custom pricing — contact us</p>
            ) : (
              <div className="flex items-baseline gap-2">
                {offerPrice > 0 ? (
                  <>
                    <span className="text-lg font-bold text-[#D4AF37]">{symbol} {offerPrice.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 line-through">{symbol} {price.toLocaleString()}</span>
                  </>
                ) : price > 0 ? (
                  <span className="text-lg font-bold text-gray-900">{symbol} {price.toLocaleString()}</span>
                ) : (
                  <span className="text-lg font-bold text-green-600">FREE</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Coming Soon — Notify Me */}
        {enrollStatus === 'coming_soon' && (
          <div className="mb-2">
            {!notifySubmitted ? (
              <div data-testid={`notify-me-form-flagship-${program.id}`}>
                <p className="text-xs text-blue-600 font-medium mb-1.5">Get notified when enrollment opens</p>
                <div className="flex gap-1.5">
                  <input type="email" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)}
                    placeholder="Your email" className="flex-1 border border-gray-200 rounded-full px-3 py-1.5 text-[11px] focus:outline-none focus:border-blue-400" />
                  <button onClick={handleNotifyMe} data-testid={`notify-me-btn-flagship-${program.id}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-[10px] tracking-wider uppercase font-medium transition-colors">
                    Notify Me
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-green-600 font-medium py-1" data-testid={`notify-success-flagship-${program.id}`}>
                You'll be notified when enrollment opens!
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="border-t pt-3 mt-auto">
          {enrollStatus === 'open' ? (
            <div className="flex gap-1.5">
              <button onClick={() => navigate(`/program/${program.id}`)}
                data-testid={`know-more-btn-${program.id}`}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#333] text-white py-2.5 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
                Know More
              </button>
              {showPricing && price > 0 && !showContact && (
                <>
                  <button onClick={handleAddToCart} data-testid={`flagship-add-cart-${program.id}`}
                    disabled={inCart || justAdded}
                    className={`flex items-center justify-center px-2.5 py-2 rounded-full text-[10px] transition-all font-medium border ${
                      inCart || justAdded ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37] hover:text-[#D4AF37]'
                    }`}>
                    {inCart || justAdded ? <Check size={11} /> : <ShoppingCart size={11} />}
                  </button>
                  <button onClick={() => navigate(`/enroll/program/${program.id}?tier=${selectedTier}`)} data-testid={`flagship-enroll-${program.id}`}
                    className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-2 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
                    Enroll Now
                  </button>
                </>
              )}
            </div>
          ) : (
            <button onClick={() => navigate(`/program/${program.id}`)}
              data-testid={`know-more-btn-${program.id}`}
              className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white py-2.5 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
              Know More
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ProgramsSection = ({ sectionConfig }) => {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [hero, setHero] = useState({});

  useEffect(() => {
    axios.get(`${API}/programs?visible_only=true`).then(r => {
      if (r.data?.length > 0) setPrograms(r.data.filter(p => !p.is_upcoming && !p.is_group_program));
    }).catch(() => {});
    axios.get(`${API}/settings`).then(r => {
      setHero(r.data?.page_heroes?.programs || {});
    }).catch(() => {});
  }, []);

  if (programs.length === 0) return null;

  const title = hero.title_text || sectionConfig?.title || 'Programs';
  const subtitle = hero.subtitle_text || sectionConfig?.subtitle || '';
  const titleStyle = Object.keys(hero.title_style || {}).length > 0 ? hero.title_style : sectionConfig?.title_style;
  const subtitleStyle = Object.keys(hero.subtitle_style || {}).length > 0 ? hero.subtitle_style : sectionConfig?.subtitle_style;

  return (
    <section id="programs" data-testid="programs-section" className="py-12 bg-white">
      <div className={CONTAINER}>
        <h2 className="text-center mb-4" style={applySectionStyle(titleStyle, { ...HEADING, fontSize: 'clamp(1.5rem, 3vw, 2rem)' })}>{title}</h2>
        {(subtitle || (!programs.some(p => p.enable_in_person) && !sectionConfig)) && (
          <p className="text-center text-xs text-gray-400 mb-16" style={applySectionStyle(subtitleStyle, {})}>{subtitle || 'All sessions are conducted online via Zoom or through remote distance healing — no in-person sessions at this time.'}</p>
        )}
        {!subtitle && programs.some(p => p.enable_in_person) && <div className="mb-16" />}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {programs.slice(0, 6).map(p => <FlagshipCard key={p.id} program={p} />)}
        </div>
        {programs.length > 6 && (
          <div className="text-center mt-12">
            <button onClick={() => navigate('/programs')} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white px-8 py-3 rounded-full text-sm transition-all duration-300 shadow-lg tracking-wider">
              View All Programs
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProgramsSection;
