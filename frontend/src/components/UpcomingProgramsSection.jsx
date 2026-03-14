import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../hooks/use-toast';
import { Monitor, Calendar, Clock, AlertTriangle, Wifi, ShoppingCart, Check } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CountdownTimer = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(deadline));

  function getTimeLeft(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return { expired: true };
    return {
      expired: false,
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  }

  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => setTimeLeft(getTimeLeft(deadline)), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!timeLeft) return null;
  if (timeLeft.expired) return (
    <div data-testid="countdown-expired" className="flex items-center gap-2 text-red-500 text-xs font-medium">
      <AlertTriangle size={14} /><span>Registration Closed</span>
    </div>
  );

  return (
    <div data-testid="countdown-timer" className="flex items-center gap-2">
      <Clock size={14} className="text-red-500 animate-pulse" />
      <div className="flex gap-1.5">
        {timeLeft.days > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">{timeLeft.days}d</span>}
        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">{String(timeLeft.hours).padStart(2,'0')}h</span>
        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">{String(timeLeft.minutes).padStart(2,'0')}m</span>
        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">{String(timeLeft.seconds).padStart(2,'0')}s</span>
      </div>
    </div>
  );
};

const UpcomingCard = ({ program }) => {
  const navigate = useNavigate();
  const { getPrice, getOfferPrice, symbol } = useCurrency();
  const { addItem, items } = useCart();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const tiers = program.duration_tiers || [];
  const hasTiers = program.is_flagship && tiers.length > 0;
  const tier = hasTiers ? tiers[selectedTier] : null;

  const isAnnual = tier && (tier.label.toLowerCase().includes('annual') || tier.label.toLowerCase().includes('year') || tier.duration_unit === 'year');
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
      toast({ title: 'Already in cart', variant: 'destructive' });
    }
  };

  const deadline = program.deadline_date || program.start_date;
  const expired = (() => {
    if (!deadline) return false;
    const t = new Date(deadline);
    return !isNaN(t.getTime()) && t.getTime() < Date.now();
  })();

  return (
    <div data-testid={`upcoming-card-${program.id}`}
      className={`group bg-white rounded-xl overflow-hidden shadow-lg transition-all duration-300 border border-gray-100 flex flex-col ${expired ? 'opacity-75' : 'hover:shadow-2xl'}`}>
      <div className="relative h-52 overflow-hidden cursor-pointer" onClick={() => navigate(`/program/${program.id}`)}>
        <img src={resolveImageUrl(program.image)} alt={program.title}
          className={`w-full h-full object-cover transition-transform duration-500 ${!expired ? 'group-hover:scale-105' : 'grayscale-[30%]'}`}
          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&h=400&fit=crop'; }} />
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {program.enable_online !== false && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium shadow-sm bg-blue-500 text-white">
              <Monitor size={12} /> Online (Zoom)
            </span>
          )}
          {program.enable_offline !== false && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium shadow-sm bg-teal-600 text-white">
              <Wifi size={12} /> Offline (Remote, Not In-Person)
            </span>
          )}
          {program.enable_in_person && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium shadow-sm bg-emerald-500 text-white">
              <Monitor size={12} /> In Person
            </span>
          )}
        </div>
        {!expired && program.offer_text && (
          <div className="absolute top-3 right-3">
            <span className="bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse">{program.offer_text}</span>
          </div>
        )}
        {(expired || program.enrollment_open === false) && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <span className="bg-gray-900/80 text-white text-xs font-bold px-4 py-2 rounded-full tracking-wider uppercase">Registration Closed</span>
          </div>
        )}
        {/* Countdown on bottom of image */}
        {!expired && deadline && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-6">
            <CountdownTimer deadline={deadline} />
          </div>
        )}
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <p className="text-[#D4AF37] text-xs tracking-wider mb-1 uppercase">{program.category}</p>
        <h3 className="text-lg font-semibold text-gray-900 mb-2 leading-tight">{program.title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-3 flex-1">{program.description}</p>

        {/* Dates left | Duration & Time right */}
        {(program.start_date || program.end_date || program.duration || program.timing) && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-500 text-xs mb-3">
            <div className="space-y-1">
              {program.start_date && <div className="flex items-center gap-1.5"><Calendar size={12} /><span>Starts: {program.start_date}</span></div>}
              {program.end_date && <div className="flex items-center gap-1.5"><Calendar size={12} /><span>Ends: {program.end_date}</span></div>}
            </div>
            <div className="space-y-1">
              {program.duration && <div className="flex items-center gap-1.5"><Clock size={12} /><span>{program.duration}</span></div>}
              {program.timing && (
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>{program.timing}{program.time_zone ? ` ${program.time_zone}` : ''}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {program.timing && program.time_zone && (() => {
          try {
            const tzShort = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
            const programTz = program.time_zone;
            if (!programTz.toLowerCase().includes(tzShort.toLowerCase()) && 
                !tzShort.toLowerCase().includes(programTz.split(' ')[0]?.toLowerCase())) {
              const timeMatch = program.timing.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
              if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const ampm = timeMatch[3].toUpperCase();
                if (ampm === 'PM' && hours !== 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
                const tzOffsets = { 'GST': 4, 'Dubai': 4, 'UAE': 4, 'IST': 5.5, 'India': 5.5, 'EST': -5, 'EDT': -4, 'CST': -6, 'CDT': -5, 'PST': -8, 'PDT': -7, 'GMT': 0, 'UTC': 0, 'BST': 1, 'CET': 1, 'AEST': 10, 'JST': 9, 'SGT': 8, 'AST': 3, 'PKT': 5 };
                let programOffset = null;
                for (const [key, val] of Object.entries(tzOffsets)) {
                  if (programTz.toUpperCase().includes(key.toUpperCase())) { programOffset = val; break; }
                }
                if (programOffset !== null) {
                  const now = new Date();
                  const utcMinutes = (hours * 60 + minutes) - (programOffset * 60);
                  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, utcMinutes + now.getTimezoneOffset() * -1);
                  const localTimeStr = localDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                  return <p className="text-blue-500 text-xs mb-3">{localTimeStr} Your Time ({tzShort})</p>;
                }
              }
            }
            return null;
          } catch { return null; }
        })()}

        {!expired && program.offer_text && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-amber-600" />
              <span className="text-amber-800 text-xs font-bold uppercase tracking-wider">Limited Period Offer</span>
            </div>
          </div>
        )}

        {/* Duration Tier Selector */}
        {hasTiers && (
          <div data-testid={`upcoming-tier-selector-${program.id}`} className="mb-3">
            <div className="flex gap-1">
              {tiers.map((t, i) => (
                <button key={i} data-testid={`upcoming-tier-btn-${program.id}-${i}`}
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
        <div className="border-t pt-4 mt-auto">
          {showContact ? (
            <div className="text-center mb-3">
              <p className="text-gray-500 text-xs mb-2">Custom pricing for extended programs</p>
              <button onClick={() => navigate(`/contact?program=${program.id}&title=${encodeURIComponent(program.title)}&tier=Annual`)} data-testid={`upcoming-contact-${program.id}`}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-full text-xs tracking-wider transition-colors uppercase font-medium">
                Contact for Pricing
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-3 mb-3">
                {offerPrice > 0 ? (
                  <>
                    <span className="text-2xl font-bold text-[#D4AF37]">{symbol} {offerPrice.toLocaleString()}</span>
                    <span className="text-sm text-gray-400 line-through">{symbol} {price.toLocaleString()}</span>
                  </>
                ) : price > 0 ? (
                  <span className="text-2xl font-bold text-gray-900">{symbol} {price.toLocaleString()}</span>
                ) : (
                  <span className="text-sm text-gray-500 italic">Contact for pricing</span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate(`/program/${program.id}`)}
                  data-testid={`upcoming-know-more-${program.id}`}
                  className="flex-1 bg-[#1a1a1a] hover:bg-[#333] text-white py-2.5 rounded-full text-xs tracking-wider transition-all duration-300 uppercase font-medium">
                  Know More
                </button>
                {!expired && price > 0 && program.enrollment_open !== false ? (
                  <>
                    <button onClick={handleAddToCart} data-testid={`upcoming-add-cart-${program.id}`}
                      disabled={inCart || justAdded}
                      className={`flex items-center justify-center gap-1 px-3 py-2.5 rounded-full text-xs tracking-wider transition-all uppercase font-medium border ${
                        inCart || justAdded ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37] hover:text-[#D4AF37]'
                      }`}>
                      {inCart || justAdded ? <Check size={12} /> : <ShoppingCart size={12} />}
                    </button>
                    <button onClick={() => navigate(`/enroll/program/${program.id}?tier=${selectedTier}`)}
                      data-testid={`upcoming-enroll-${program.id}`}
                      className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-2.5 rounded-full text-xs tracking-wider transition-all duration-300 uppercase font-medium">
                      Enroll Now
                    </button>
                  </>
                ) : (expired || program.enrollment_open === false) ? (
                  <button disabled data-testid={`upcoming-enroll-disabled-${program.id}`}
                    className="flex-1 bg-gray-300 text-gray-500 py-2.5 rounded-full text-xs tracking-wider uppercase font-medium cursor-not-allowed">
                    Closed
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const UpcomingProgramsSection = ({ sectionConfig, inline }) => {
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    axios.get(`${API}/programs?visible_only=true&upcoming_only=true`)
      .then(r => setPrograms(r.data))
      .catch(err => console.error('Error loading upcoming programs:', err));
  }, []);

  if (programs.length === 0) return null;

  const content = (
    <>
      <div className={inline ? "text-center mb-8" : "text-center mb-14"}>
        <h2 className={inline ? "text-xl md:text-2xl text-gray-900" : "text-3xl md:text-4xl text-gray-900"} style={sectionConfig?.title_style ? { ...(sectionConfig.title_style.font_family && { fontFamily: sectionConfig.title_style.font_family }), ...(sectionConfig.title_style.font_size && !inline && { fontSize: sectionConfig.title_style.font_size }), ...(sectionConfig.title_style.font_color && { color: sectionConfig.title_style.font_color }), ...(sectionConfig.title_style.font_weight && { fontWeight: sectionConfig.title_style.font_weight }), ...(sectionConfig.title_style.font_style && { fontStyle: sectionConfig.title_style.font_style }) } : {}}>{sectionConfig?.title || 'Upcoming Programs'}</h2>
        {!inline && (sectionConfig?.subtitle || (!programs.some(p => p.enable_in_person) && !sectionConfig)) && (
          <p className="text-xs text-gray-400 mt-3" style={sectionConfig?.subtitle_style ? { ...(sectionConfig.subtitle_style.font_color && { color: sectionConfig.subtitle_style.font_color }), ...(sectionConfig.subtitle_style.font_size && { fontSize: sectionConfig.subtitle_style.font_size }), ...(sectionConfig.subtitle_style.font_family && { fontFamily: sectionConfig.subtitle_style.font_family }) } : {}}>{sectionConfig?.subtitle || 'All sessions are conducted online via Zoom or through remote distance healing — no in-person sessions at this time.'}</p>
        )}
      </div>
      <div className={inline ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8"}>
        {programs.map(program => <UpcomingCard key={program.id} program={program} />)}
      </div>
    </>
  );

  if (inline) return <div data-testid="upcoming-programs-section">{content}</div>;

  return (
    <section id="upcoming" data-testid="upcoming-programs-section" className="py-12 bg-white">
      <div className="container mx-auto px-4">
        {content}
      </div>
    </section>
  );
};

export default UpcomingProgramsSection;
