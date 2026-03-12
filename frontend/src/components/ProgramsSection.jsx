import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../hooks/use-toast';
import { ShoppingCart, Check } from 'lucide-react';
import { HEADING, BODY, GOLD, CONTAINER, applySectionStyle } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProgramCard = ({ program }) => {
  const navigate = useNavigate();
  const { getPrice, getOfferPrice, symbol } = useCurrency();
  const { addItem, items } = useCart();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const tiers = program.duration_tiers || [];
  const hasTiers = program.is_flagship && tiers.length > 0;
  const tier = hasTiers ? tiers[selectedTier] : null;

  const isAnnual = tier && (
    tier.label.toLowerCase().includes('annual') ||
    tier.label.toLowerCase().includes('year') ||
    tier.duration_unit === 'year'
  );
  const price = getPrice(program, hasTiers ? selectedTier : null);
  const offerPrice = getOfferPrice(program, hasTiers ? selectedTier : null);
  const showContact = isAnnual && price === 0;
  const inCart = items.some(i => i.programId === program.id && i.tierIndex === selectedTier);

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

  return (
    <div data-testid={`program-card-${program.id}`}
      className="group bg-white rounded-lg overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 flex flex-col">
      <div className="relative h-48 overflow-hidden cursor-pointer" onClick={() => navigate(`/program/${program.id}`)}>
        <img src={resolveImageUrl(program.image)} alt={program.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&h=400&fit=crop'; }} />
        {/* Mode badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {program.enable_online !== false && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-500/90 text-white backdrop-blur-sm">Online (Zoom)</span>
          )}
          {program.enable_offline !== false && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-teal-600/90 text-white backdrop-blur-sm">Offline (Remote, Not In-Person)</span>
          )}
          {program.enable_in_person && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/90 text-white backdrop-blur-sm">In Person</span>
          )}
        </div>
        {program.offer_text && (
          <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] px-2.5 py-1 rounded-full font-bold">
            {program.offer_text}
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-sm font-semibold text-gray-900 mb-2 leading-tight cursor-pointer" style={{ ...BODY, fontWeight: 600, color: '#1a1a1a', fontSize: '0.95rem' }}
          onClick={() => navigate(`/program/${program.id}`)}>{program.title}</h3>
        <p className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-2 flex-1" style={{ ...BODY, fontSize: '0.8rem' }}>{program.description}</p>

        {hasTiers && (
          <div data-testid={`tier-selector-${program.id}`} className="flex gap-1 mb-3">
            {tiers.map((t, i) => (
              <button key={i} data-testid={`tier-btn-${program.id}-${i}`}
                onClick={() => setSelectedTier(i)}
                className={`flex-1 text-[10px] py-1.5 rounded-full border transition-all ${
                  selectedTier === i ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-500 border-gray-200 hover:border-[#D4AF37]'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {showContact ? (
          <div className="mt-auto">
            <button onClick={() => navigate(`/contact?program=${program.id}&title=${encodeURIComponent(program.title)}&tier=Annual`)} data-testid={`contact-btn-${program.id}`}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white text-xs py-2.5 rounded-full transition-colors tracking-wider">
              Contact for Pricing
            </button>
          </div>
        ) : program.enrollment_open === false ? (
          <div className="mt-auto">
            <button onClick={() => navigate(`/program/${program.id}`)} data-testid={`know-more-btn-${program.id}`}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white text-xs py-2.5 rounded-full transition-all tracking-wider uppercase font-medium shadow-sm">
              Know More
            </button>
          </div>
        ) : (
          <div className="mt-auto">
            <div className="flex items-baseline gap-2 mb-3">
              {offerPrice > 0 ? (
                <>
                  <span className="text-[#D4AF37] font-bold text-sm">{symbol} {offerPrice.toLocaleString()}</span>
                  <span className="line-through text-gray-400 text-xs">{symbol} {price.toLocaleString()}</span>
                </>
              ) : price > 0 ? (
                <span className="text-[#D4AF37] font-bold text-sm">{symbol} {price.toLocaleString()}</span>
              ) : (
                <span className="text-gray-500 text-xs italic">Contact for pricing</span>
              )}
            </div>
            <div className="flex gap-2">
              {price > 0 && (
                <button onClick={handleAddToCart} data-testid={`add-to-cart-${program.id}`}
                  disabled={inCart || justAdded}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[10px] tracking-wider transition-all uppercase font-medium border ${
                    inCart || justAdded
                      ? 'bg-green-50 text-green-600 border-green-200'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37] hover:text-[#D4AF37]'
                  }`}>
                  {inCart || justAdded ? <><Check size={12} /> In Cart</> : <><ShoppingCart size={12} /> Cart</>}
                </button>
              )}
              <button onClick={() => navigate(`/enroll/program/${program.id}?tier=${selectedTier}`)} data-testid={`enroll-btn-${program.id}`}
                className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-2 rounded-full text-[10px] tracking-wider transition-all uppercase font-medium">
                Enroll Now
              </button>
            </div>
          </div>
        )}
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
      if (r.data?.length > 0) setPrograms(r.data);
    }).catch(() => {});
    axios.get(`${API}/settings`).then(r => {
      setHero(r.data?.page_heroes?.programs || {});
    }).catch(() => {});
  }, []);

  if (programs.length === 0) return null;

  const title = hero.title_text || sectionConfig?.title || 'Flagship Programs';
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
          {programs.slice(0, 6).map(p => <ProgramCard key={p.id} program={p} />)}
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
