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

  // For non-upcoming programs: clean card, no dates/times/countdown
  const isUpcoming = program.is_upcoming;

  return (
    <div data-testid={`program-card-${program.id}`}
      className={`group bg-white rounded-xl overflow-hidden shadow-lg transition-all duration-300 border border-gray-100 flex flex-col ${program.enrollment_open === false ? 'opacity-60' : 'hover:shadow-2xl'}`}>
      <div className="relative h-48 overflow-hidden cursor-pointer" onClick={() => navigate(`/program/${program.id}`)}>
        <img src={resolveImageUrl(program.image)} alt={program.title}
          className={`w-full h-full object-cover transition-transform duration-500 ${program.enrollment_open !== false ? 'group-hover:scale-105' : 'grayscale-[40%]'}`}
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
        {/* Big closure badge when enrollment is OFF */}
        {program.enrollment_open === false && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="bg-gray-900/90 text-white text-sm font-bold px-5 py-2.5 rounded-full tracking-wider uppercase shadow-xl border border-white/20">
              {program.closure_text || 'Registration Closed'}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <p className="text-[#D4AF37] text-[10px] tracking-wider mb-0.5 uppercase">{program.category}</p>
        <h3 className="text-base font-semibold text-gray-900 mb-1.5 leading-tight cursor-pointer" style={{ ...BODY, fontWeight: 600, color: '#1a1a1a', fontSize: '0.95rem' }}
          onClick={() => navigate(`/program/${program.id}`)}>{program.title}</h3>
        <p className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-2 flex-1" style={{ ...BODY, fontSize: '0.8rem' }}>{program.description}</p>

        <div className="border-t pt-3 mt-auto flex gap-1.5">
          <button onClick={() => navigate(`/program/${program.id}`)}
            data-testid={`know-more-btn-${program.id}`}
            className="flex-1 bg-[#1a1a1a] hover:bg-[#333] text-white py-2.5 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
            Know More
          </button>
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
      if (r.data?.length > 0) setPrograms(r.data.filter(p => !p.is_upcoming));
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
