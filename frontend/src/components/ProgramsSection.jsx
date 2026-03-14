import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../hooks/use-toast';
import { ShoppingCart, Check, Calendar, Clock, AlertTriangle, Bell } from 'lucide-react';
import { HEADING, BODY, GOLD, CONTAINER, applySectionStyle } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Timezone offsets map
const TZ_OFFSETS = {
  'GST': 4, 'GST Dubai': 4, 'UAE': 4, 'Gulf': 4,
  'IST': 5.5, 'India': 5.5,
  'EST': -5, 'EDT': -4,
  'CST': -6, 'CDT': -5,
  'MST': -7, 'MDT': -6,
  'PST': -8, 'PDT': -7,
  'GMT': 0, 'UTC': 0,
  'BST': 1, 'CET': 1, 'CEST': 2,
  'AEST': 10, 'AEDT': 11,
  'JST': 9, 'KST': 9,
  'SGT': 8, 'HKT': 8, 'CST Asia': 8,
  'NZST': 12, 'NZDT': 13,
};

const parseTimeStr = (str) => {
  if (!str) return null;
  str = str.trim().toUpperCase();
  const match = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2] || '0', 10);
  const ampm = match[3];
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return { hours: h, minutes: m };
};

const convertTimingToLocal = (timing, timeZone) => {
  if (!timing || !timeZone) return { local: '', localTz: '', srcTz: timeZone || '' };
  const tzKey = Object.keys(TZ_OFFSETS).find(k => timeZone.toUpperCase().includes(k.toUpperCase()));
  if (!tzKey && tzKey !== 0) return { local: '', localTz: '', srcTz: timeZone || '' };
  const srcOffset = TZ_OFFSETS[tzKey];
  const parts = timing.split(/\s*[-–—to]+\s*/i);
  const formatTime = (h, m) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return m > 0 ? `${displayH}:${String(m).padStart(2, '0')} ${period}` : `${displayH} ${period}`;
  };
  const convertToOffset = (parsed, fromOffset, toOffset) => {
    if (!parsed) return null;
    let totalMin = parsed.hours * 60 + parsed.minutes - fromOffset * 60 + toOffset * 60;
    totalMin = ((totalMin % 1440) + 1440) % 1440;
    return { hours: Math.floor(totalMin / 60), minutes: totalMin % 60 };
  };
  const localOffset = -(new Date().getTimezoneOffset()) / 60;
  const localTzAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
  const isSameTz = Math.abs(localOffset - srcOffset) < 0.1;
  const localTimes = parts.map(p => convertToOffset(parseTimeStr(p.trim()), srcOffset, localOffset));
  const localStr = localTimes.filter(Boolean).map(t => formatTime(t.hours, t.minutes)).join(' - ');
  return { local: isSameTz ? '' : localStr, localTz: isSameTz ? '' : (localTzAbbr || ''), srcTz: timeZone || '' };
};

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

  const deadline = program.deadline_date || program.start_date;
  const expired = (() => {
    if (!deadline) return false;
    const t = new Date(deadline);
    return !isNaN(t.getTime()) && t.getTime() < Date.now();
  })();

  const parseDate = (d) => {
    if (!d) return null;
    const cleaned = d.replace(/(\d+)(st|nd|rd|th)/gi, '$1').replace(',', '');
    const dt = new Date(cleaned);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const autoDuration = (() => {
    const s = parseDate(program.start_date);
    const e = parseDate(program.end_date);
    if (!s || !e) return program.duration && program.duration !== '90 days' ? program.duration : '';
    const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays <= 0) return '';
    return `${diffDays} Days`;
  })();

  const fmtDate = (d) => {
    const dt = parseDate(d);
    if (!dt) return d || '';
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const timingConverted = convertTimingToLocal(program.timing, program.time_zone);

  return (
    <div data-testid={`program-card-${program.id}`}
      className="group bg-white rounded-xl overflow-hidden shadow-lg transition-all duration-300 border border-gray-100 flex flex-col hover:shadow-2xl">
      <div className="relative h-48 overflow-hidden cursor-pointer" onClick={() => navigate(`/program/${program.id}`)}>
        <img src={resolveImageUrl(program.image)} alt={program.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&h=400&fit=crop'; }} />
        {/* Top-left: Mode badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {program.enable_online !== false && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-blue-500 text-white w-fit">Online (Zoom)</span>
          )}
          {program.enable_offline !== false && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-teal-600 text-white w-fit">Offline (Remote, Not In-Person)</span>
          )}
          {program.enable_in_person && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-teal-600 text-white w-fit">Offline (Remote, Not In-Person)</span>
          )}
        </div>
        {/* Top-right: Dates, Times, then Duration in gold */}
        {(program.start_date || program.timing || autoDuration) && (
          <div data-testid={`card-image-datetime-${program.id}`} className="absolute top-3 right-3 flex flex-col items-end gap-1">
            {program.start_date && (
              <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <Calendar size={10} className="flex-shrink-0" />
                Starts: {fmtDate(program.start_date)}
              </span>
            )}
            {program.end_date && (
              <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <Calendar size={10} className="flex-shrink-0" />
                Ends: {fmtDate(program.end_date)}
              </span>
            )}
            {program.timing && (
              <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <Clock size={10} className="flex-shrink-0" />
                {program.timing} {timingConverted.srcTz}
              </span>
            )}
            {timingConverted.local && (
              <span className="bg-blue-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <Clock size={10} className="flex-shrink-0" />
                {timingConverted.local} {timingConverted.localTz}
              </span>
            )}
            {autoDuration && (
              <span className="bg-[#D4AF37] backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm">
                {autoDuration}
              </span>
            )}
          </div>
        )}
        {/* Bottom overlay: countdown left, exclusive offer right */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2.5 pt-6">
          <div className="flex items-end justify-between gap-2">
            <div className="flex-shrink-0">
              {program.enrollment_open !== false && deadline && (
                <CountdownTimer deadline={deadline} />
              )}
            </div>
            {program.exclusive_offer_enabled && program.exclusive_offer_text && program.enrollment_open !== false && (
              <span data-testid={`exclusive-offer-${program.id}`} className="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg tracking-wide uppercase animate-pulse">
                {program.exclusive_offer_text}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <p className="text-[#D4AF37] text-[10px] tracking-wider mb-0.5 uppercase">{program.category}</p>
        <h3 className="text-base font-semibold text-gray-900 mb-1.5 leading-tight cursor-pointer" style={{ ...BODY, fontWeight: 600, color: '#1a1a1a', fontSize: '0.95rem' }}
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

        {/* Early Bird Countdown */}
        {program.enrollment_open !== false && offerPrice > 0 && deadline && (() => {
          const now = new Date();
          const dl = new Date(deadline);
          if (dl <= now) return null;
          const diff = dl - now;
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          return (
            <div data-testid={`early-bird-countdown-${program.id}`}
              className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3 animate-pulse">
              <Bell size={14} className="text-red-500 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-red-600">{program.offer_text || 'Early Bird'}</span>
                <span className="text-red-500 ml-1.5">ends in {days}d {hours}h {mins}m</span>
              </div>
            </div>
          );
        })()}

        {/* Pricing */}
        <div className="border-t pt-3 mt-auto">
          {showContact ? (
            <div className="text-center mb-2">
              <p className="text-gray-500 text-[10px] mb-1.5">Custom pricing</p>
              <button onClick={() => navigate(`/contact?program=${program.id}&title=${encodeURIComponent(program.title)}&tier=Annual`)} data-testid={`contact-btn-${program.id}`}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2 rounded-full text-[10px] tracking-wider transition-colors uppercase font-medium">
                Contact for Pricing
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-2">
                {offerPrice > 0 ? (
                  <>
                    <span className="text-xl font-bold text-[#D4AF37]">{symbol} {offerPrice.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 line-through">{symbol} {price.toLocaleString()}</span>
                  </>
                ) : price > 0 ? (
                  <span className="text-xl font-bold text-gray-900">{symbol} {price.toLocaleString()}</span>
                ) : (
                  <span className="text-xl font-bold text-green-600">FREE</span>
                )}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => navigate(`/program/${program.id}`)}
                  data-testid={`know-more-btn-${program.id}`}
                  className="flex-1 bg-[#1a1a1a] hover:bg-[#333] text-white py-2 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
                  Know More
                </button>
                {program.enrollment_open !== false ? (
                  <>
                    {price > 0 && (
                      <button onClick={handleAddToCart} data-testid={`add-to-cart-${program.id}`}
                        disabled={inCart || justAdded}
                        className={`flex items-center justify-center px-2.5 py-2 rounded-full text-[10px] transition-all font-medium border ${
                          inCart || justAdded ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37] hover:text-[#D4AF37]'
                        }`}>
                        {inCart || justAdded ? <Check size={11} /> : <ShoppingCart size={11} />}
                      </button>
                    )}
                    <button onClick={() => navigate(`/enroll/program/${program.id}?tier=${selectedTier}`)}
                      data-testid={`enroll-btn-${program.id}`}
                      className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-2 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
                      {price > 0 ? 'Enroll Now' : 'Register Free'}
                    </button>
                  </>
                ) : null}
              </div>
            </>
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
