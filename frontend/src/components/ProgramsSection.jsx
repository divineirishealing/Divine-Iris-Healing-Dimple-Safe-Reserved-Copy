import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../hooks/use-toast';
import { ShoppingCart, Check } from 'lucide-react';
import { HEADING, BODY, CONTAINER, applySectionStyle } from '../lib/designTokens';
import { UpcomingCard } from './UpcomingProgramsSection';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* ── Flagship card (non-replicated) — purple Know More + optional tiers/pricing ── */
const SimpleFlagshipCard = ({ program }) => {
  const navigate = useNavigate();
  const { getPrice, getOfferPrice, symbol } = useCurrency();
  const { addItem, items } = useCart();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  const tiers = program.duration_tiers || [];
  const showTiers = tiers.length > 0 && program.show_tiers_on_card !== false;
  const showPricing = program.show_pricing_on_card !== false;
  const tier = showTiers ? tiers[selectedTier] : null;
  const isAnnual = tier && (tier.label.toLowerCase().includes('annual') || tier.label.toLowerCase().includes('year'));
  const price = getPrice(program, showTiers ? selectedTier : null);
  const offerPrice = getOfferPrice(program, showTiers ? selectedTier : null);
  const showContact = isAnnual && price === 0;
  const inCart = items.some(i => i.programId === program.id && i.tierIndex === selectedTier);
  const enrollStatus = program.enrollment_status || (program.enrollment_open !== false ? 'open' : 'closed');

  const handleAddToCart = () => {
    const added = addItem(program, selectedTier);
    if (added) {
      setJustAdded(true);
      toast({ title: `${program.title} added to cart`, description: `${tier?.label || 'Standard'} plan` });
      setTimeout(() => setJustAdded(false), 2000);
    } else {
      toast({ title: 'Already in cart', variant: 'destructive' });
    }
  };

  return (
    <div data-testid={`program-card-${program.id}`}
      className="group bg-white rounded-xl overflow-hidden shadow-lg transition-all duration-300 border border-gray-100 flex flex-col hover:shadow-2xl">
      {/* Image */}
      <div className="relative h-48 overflow-hidden cursor-pointer" onClick={() => navigate(`/program/${program.id}`)}>
        <img src={resolveImageUrl(program.image)} alt={program.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&h=400&fit=crop'; }} />
        {/* Mode badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {program.enable_online !== false && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-blue-500 text-white w-fit">Online (Zoom)</span>}
          {program.enable_offline !== false && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-teal-600 text-white w-fit">Offline (Remote, Not In-Person)</span>}
          {program.enable_in_person && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-teal-600 text-white w-fit">In-Person</span>}
        </div>
        {enrollStatus === 'coming_soon' && (
          <div className="absolute inset-0 bg-black/15 flex items-center justify-center">
            <span data-testid={`coming-soon-badge-${program.id}`} className="bg-blue-600/90 text-white text-sm font-bold px-6 py-2.5 rounded-full tracking-wider uppercase shadow-xl border border-white/20 animate-pulse">Coming Soon</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <p className="text-[#D4AF37] text-[10px] tracking-wider mb-0.5 uppercase">{program.category}</p>
        <div className="flex items-start gap-2 mb-1.5">
          <h3 className="text-base font-semibold text-gray-900 leading-tight cursor-pointer" style={{ ...BODY, fontWeight: 600, fontSize: '0.95rem' }}
            onClick={() => navigate(`/program/${program.id}`)}>{program.title}</h3>
          {program.highlight_label && (
            <span data-testid={`highlight-badge-${program.id}`}
              className={`flex-shrink-0 inline-flex items-center gap-1 text-[8px] font-bold tracking-wider uppercase px-2 py-1 rounded-full whitespace-nowrap ${program.highlight_style === 'glow' ? 'animate-pulse' : ''}`}
              style={
                program.highlight_style === 'ribbon'
                  ? { background: '#1a1a1a', color: '#D4AF37', letterSpacing: '0.08em', borderLeft: '2px solid #D4AF37', borderRadius: '4px' }
                  : program.highlight_style === 'glow'
                  ? { background: 'linear-gradient(135deg, #fff8e7, #fff3d0)', color: '#b8860b', border: '1px solid #D4AF3755', letterSpacing: '0.06em', boxShadow: '0 0 10px rgba(212,175,55,0.2)' }
                  : { background: 'linear-gradient(135deg, #D4AF37, #f5d77a, #D4AF37)', color: '#3d2200', letterSpacing: '0.06em', boxShadow: '0 2px 6px rgba(212,175,55,0.25)' }
              }>
              {(program.highlight_style !== 'ribbon') && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill={program.highlight_style === 'glow' ? 'none' : '#3d2200'} stroke={program.highlight_style === 'glow' ? '#b8860b' : 'none'} strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              )}
              {program.highlight_label}
            </span>
          )}
        </div>
        <p className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-2 flex-1" style={{ ...BODY, fontSize: '0.8rem' }}>{program.description}</p>

        {/* Tier Selector */}
        {showTiers && (
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

        {/* Pricing */}
        {showPricing && enrollStatus === 'open' && (
          <div className="mb-2">
            {showContact ? (
              <p className="text-gray-500 text-[10px]">Custom pricing — contact us</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-2 flex-wrap">
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
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="border-t pt-3 mt-auto">
          {enrollStatus === 'open' && showPricing && price > 0 && !showContact ? (
            <div className="flex gap-1.5">
              <button onClick={() => navigate(`/program/${program.id}`)}
                data-testid={`know-more-btn-${program.id}`}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
                Know More
              </button>
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
            </div>
          ) : (
            <button onClick={() => navigate(`/program/${program.id}`)}
              data-testid={`know-more-btn-${program.id}`}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
              Know More
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Programs Section (Flagship) ── */
const ProgramsSection = ({ sectionConfig }) => {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [hero, setHero] = useState({});
  useEffect(() => {
    axios.get(`${API}/programs?visible_only=true`).then(r => {
      if (r.data?.length > 0) setPrograms(r.data.filter(p => p.is_flagship && !p.is_group_program));
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
    <section id="programs" data-testid="programs-section" className="py-12">
      <div className={CONTAINER}>
        <h2 className="text-center mb-4" style={applySectionStyle(titleStyle, { ...HEADING, fontSize: 'clamp(1.5rem, 3vw, 2rem)' })}>{title}</h2>
        {subtitle && <p className="text-center text-xs text-gray-400 mb-16" style={applySectionStyle(subtitleStyle, {})}>{subtitle}</p>}
        {!subtitle && <div className="mb-16" />}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {programs.map(p =>
            (p.is_upcoming && p.replicate_to_flagship)
              ? <UpcomingCard key={p.id} program={p} />
              : <SimpleFlagshipCard key={p.id} program={p} />
          )}
        </div>
      </div>
    </section>
  );
};

export default ProgramsSection;
