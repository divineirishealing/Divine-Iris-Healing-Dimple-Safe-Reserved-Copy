import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../hooks/use-toast';
import { Monitor, Calendar, Clock, AlertTriangle, Wifi, ShoppingCart, Check, Bell, Heart, Gift, Users } from 'lucide-react';

// Map common timezone abbreviations to UTC offset in hours
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

// Map country codes to their primary timezone and abbreviation
const COUNTRY_TZ = {
  'IN': { offset: 5.5, abbr: 'IST' }, 'AE': { offset: 4, abbr: 'GST' },
  'US': { offset: -5, abbr: 'EST' }, 'GB': { offset: 0, abbr: 'GMT' },
  'CA': { offset: -5, abbr: 'EST' }, 'AU': { offset: 10, abbr: 'AEST' },
  'SG': { offset: 8, abbr: 'SGT' }, 'DE': { offset: 1, abbr: 'CET' },
  'SA': { offset: 3, abbr: 'AST' }, 'QA': { offset: 3, abbr: 'AST' },
  'PK': { offset: 5, abbr: 'PKT' }, 'BD': { offset: 6, abbr: 'BST' },
  'MY': { offset: 8, abbr: 'MYT' }, 'JP': { offset: 9, abbr: 'JST' },
  'FR': { offset: 1, abbr: 'CET' }, 'LK': { offset: 5.5, abbr: 'IST' },
  'ZA': { offset: 2, abbr: 'SAST' }, 'NP': { offset: 5.75, abbr: 'NPT' },
  'KW': { offset: 3, abbr: 'AST' }, 'OM': { offset: 4, abbr: 'GST' },
  'BH': { offset: 3, abbr: 'AST' }, 'PH': { offset: 8, abbr: 'PHT' },
  'ID': { offset: 7, abbr: 'WIB' }, 'TH': { offset: 7, abbr: 'ICT' },
  'KE': { offset: 3, abbr: 'EAT' }, 'NG': { offset: 1, abbr: 'WAT' },
  'EG': { offset: 2, abbr: 'EET' }, 'TR': { offset: 3, abbr: 'TRT' },
  'IT': { offset: 1, abbr: 'CET' }, 'ES': { offset: 1, abbr: 'CET' },
  'NL': { offset: 1, abbr: 'CET' }, 'NZ': { offset: 12, abbr: 'NZST' },
};

// Parse a time string like "9PM", "9:30 PM", "21:00" into { hours, minutes }
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

// Convert timing from source timezone to viewer's local time
// detectedCountry: country code from IP geolocation (e.g. 'AU' for Australia)
const convertTimingToLocal = (timing, timeZone, detectedCountry) => {
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

  // Use detected country timezone if available, otherwise fall back to browser timezone
  let localOffset, localTzAbbr;
  const countryTz = detectedCountry ? COUNTRY_TZ[detectedCountry] : null;
  if (countryTz) {
    localOffset = countryTz.offset;
    localTzAbbr = countryTz.abbr;
  } else {
    localOffset = -(new Date().getTimezoneOffset()) / 60;
    localTzAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
  }

  // Check if viewer is in the same timezone as source
  const isSameTz = Math.abs(localOffset - srcOffset) < 0.1;

  const localTimes = parts.map(p => convertToOffset(parseTimeStr(p.trim()), srcOffset, localOffset));
  const localStr = localTimes.filter(Boolean).map(t => formatTime(t.hours, t.minutes)).join(' - ');

  return {
    local: isSameTz ? '' : localStr,
    localTz: isSameTz ? '' : (localTzAbbr || ''),
    srcTz: timeZone || '',
  };
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function normalizePid(id) {
  if (id == null || id === '') return '';
  return String(id).trim();
}

/** Group admin “upcoming card” quotes by program id (visible-only list from API). */
function buildProgramCardQuotesMap(rows) {
  const byProgram = {};
  for (const row of rows || []) {
    const pid = normalizePid(row.program_id);
    if (!pid) continue;
    if (!byProgram[pid]) byProgram[pid] = [];
    byProgram[pid].push({
      order: row.order ?? 0,
      text: (row.text || '').trim(),
      name: (row.author || '').trim(),
      role: (row.role || '').trim(),
    });
  }
  for (const k of Object.keys(byProgram)) {
    byProgram[k].sort((a, b) => (a.order || 0) - (b.order || 0));
    byProgram[k] = byProgram[k].filter((q) => q.text.length > 0).map(({ text, name, role }) => ({ text, name, role }));
  }
  return byProgram;
}

/** Fallback: visible template testimonials linked to this program (Transformations / program page same rules). */
function testimonialsForProgram(all, program) {
  if (!program || !Array.isArray(all) || all.length === 0) return [];
  const id = normalizePid(program.id);
  const title = (program.title || '').trim().toLowerCase();
  const matched = all.filter((t) => {
    if (t.type !== 'template') return false;
    if (normalizePid(t.program_id) === id) return true;
    const tags = t.program_tags || [];
    if (Array.isArray(tags) && tags.some((tag) => normalizePid(tag) === id)) return true;
    const pn = (t.program_name || '').trim().toLowerCase();
    if (title && pn && pn === title) return true;
    return false;
  });
  const withQuote = matched.filter((t) => (t.text || '').trim().length > 12);
  withQuote.sort((a, b) => (a.order || 0) - (b.order || 0));
  return withQuote.slice(0, 8);
}

/** Text-only quote under the card — no jewel header / stars / full testimonial chrome */
const UpcomingCardQuoteText = ({ text, name, role, programId }) => {
  const displayText = (text || '').trim();
  if (!displayText) return null;
  const footerName = (name || '').trim();
  const footerRole = (role || '').trim();
  const attribution = [footerName, footerRole].filter(Boolean);
  return (
    <div
      data-testid={`upcoming-card-testimonial-${programId}`}
      className="border-t border-[#D4AF37]/25 bg-gradient-to-b from-amber-50/50 to-transparent px-3 py-2.5"
    >
      <p
        className="text-center italic leading-snug text-gray-800 tracking-wide"
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(0.92rem, 3.2vw, 1.05rem)',
          fontWeight: 600,
        }}
      >
        &ldquo;{displayText}&rdquo;
      </p>
      {attribution.length > 0 && (
        <p
          className="text-center text-[0.65rem] text-gray-500 mt-1.5"
          style={{ fontFamily: "'Lato', sans-serif" }}
        >
          {attribution.join(' · ')}
        </p>
      )}
    </div>
  );
};

/* Rotating snippets — plain text only */
const CardTestimonialRotate = ({ quotes, programId }) => {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!quotes || quotes.length <= 1) return;
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % quotes.length);
        setVisible(true);
      }, 500);
    }, 5500);
    return () => clearInterval(cycle);
  }, [quotes]);

  if (!quotes || quotes.length === 0) return null;

  const t = quotes[index];
  const quote = (t.text || '').trim();
  if (!quote) return null;

  return (
    <div
      className="transition-all duration-500 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(5px)',
      }}
    >
      <UpcomingCardQuoteText text={quote} name={t.name} role={t.role} programId={programId} />
    </div>
  );
};

/* ─── FOMO Subtitle Rotator ─── */
const FomoSubtitle = ({ messages, style }) => {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!messages || messages.length <= 1) return;
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % messages.length);
        setVisible(true);
      }, 600);
    }, 3500);
    return () => clearInterval(cycle);
  }, [messages]);

  if (!messages || messages.length === 0) return null;

  return (
    <p
      data-testid="fomo-subtitle"
      className="text-sm text-gray-900 mt-3 transition-all duration-500 ease-in-out"
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(6px)',
      }}
    >
      {messages[index]}
    </p>
  );
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

/** Tier toggle text: keeps flagship cards (e.g. MMM, Stress Release) the same height — long "Annual Program" → "Annual". */
function compactTierButtonLabel(raw) {
  if (raw == null || typeof raw !== 'string') return '—';
  const t = raw.trim();
  if (!t) return '—';
  const L = t.toLowerCase();
  if (L.includes('annual') || (L.includes('year') && L.includes('program'))) return 'Annual';
  if (L.includes('year-long') || L === 'year') return 'Annual';
  if (t.length <= 16) return t;
  return `${t.slice(0, 14)}…`;
}

/** Gold duration pill on card image: annual tracks show a short label instead of a long day count. */
function durationPillDisplay(isAnnualTier, durationStr) {
  if (!durationStr) return '';
  if (isAnnualTier) return 'Annual';
  const L = String(durationStr).toLowerCase();
  if (L.includes('annual') || /\b12\s*months?\b/.test(L) || /\b1\s*year\b/.test(L)) return 'Annual';
  return durationStr;
}

const UpcomingCard = ({ program, cardQuotes }) => {
  const navigate = useNavigate();
  const { getPrice, getOfferPrice, symbol, country: detectedCountry } = useCurrency();
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

  // Parse date string, handling ordinal suffixes like "27th", "1st"
  const parseDate = (d) => {
    if (!d) return null;
    const cleaned = d.replace(/(\d+)(st|nd|rd|th)/gi, '$1').replace(',', '');
    const dt = new Date(cleaned);
    return isNaN(dt.getTime()) ? null : dt;
  };

  // Use tier-specific dates if available, otherwise fall back to program dates
  const activeTier = hasTiers ? tiers[selectedTier] : null;
  const displayStartDate = (activeTier?.start_date) || program.start_date;
  const displayEndDate = (activeTier?.end_date) || program.end_date;

  // Duration: use tier's explicit duration first, then calculate from tier dates, then program
  const autoDuration = (() => {
    // 1. Tier explicit duration
    if (activeTier?.duration) return activeTier.duration;
    // 2. Calculate from tier or program dates
    const s = parseDate(displayStartDate);
    const e = parseDate(displayEndDate);
    if (s && e) {
      const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 0) return `${diffDays} Days`;
    }
    // 3. Fallback to program-level duration
    return program.duration || '';
  })();

  const isAnnualTierRow = (t) =>
    !!t &&
    (String(t.label || '')
      .toLowerCase()
      .includes('annual') ||
      String(t.label || '')
        .toLowerCase()
        .includes('year') ||
      t.duration_unit === 'year');
  const durationOnImage = durationPillDisplay(tier ? isAnnualTierRow(tier) : false, autoDuration);

  // Format date to standard: "27 Mar 2026"
  const fmtDate = (d) => {
    const dt = parseDate(d);
    if (!dt) return d || '';
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Convert timing to viewer's local time
  const timingConverted = convertTimingToLocal(program.timing, program.time_zone, detectedCountry);

  const enrollStatus = expired ? 'closed' : (program.enrollment_status || (program.enrollment_open !== false ? 'open' : 'closed'));
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySubmitted, setNotifySubmitted] = useState(false);

  const handleNotifyMe = async () => {
    if (!notifyEmail) return;
    try {
      await axios.post(`${BACKEND_URL}/api/notify-me`, { email: notifyEmail, program_id: program.id, program_title: program.title });
      setNotifySubmitted(true);
      toast({ title: 'Subscribed!', description: "We'll notify you when enrollment opens." });
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const tierGridClass =
    tiers.length <= 1 ? 'grid-cols-1' : tiers.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div data-testid={`upcoming-card-${program.id}`}
      className={`group bg-white rounded-xl overflow-hidden shadow-lg transition-all duration-300 border border-gray-100 flex flex-col h-full ${enrollStatus === 'closed' ? 'opacity-60' : 'hover:shadow-2xl'}`}>
      <div className="relative h-48 overflow-hidden cursor-pointer" onClick={() => navigate(`/program/${program.id}`)}>
        <img src={resolveImageUrl(program.image)} alt={program.title}
          className={`w-full h-full object-cover transition-transform duration-500 ${enrollStatus === 'open' ? 'group-hover:scale-105' : enrollStatus === 'closed' ? 'grayscale-[40%]' : ''}`}
          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&h=400&fit=crop'; }} />

        {enrollStatus === 'open' ? (
          <>
            {/* Top-left: Mode badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1">
              {program.enable_online !== false && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-blue-500 text-white w-fit">Online (Zoom)</span>}
              {program.enable_offline !== false && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-teal-600 text-white w-fit">Offline (Remote, Not In-Person)</span>}
              {program.enable_in_person && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-teal-600 text-white w-fit">In-Person</span>}
            </div>
            {/* Top-right: Dates (tier-aware), Times, Duration — controlled by show_* flags */}
            {(displayStartDate || program.timing || autoDuration) && (
              <div data-testid={`card-image-datetime-${program.id}`} className="absolute top-3 right-3 flex flex-col items-end gap-1">
                {displayStartDate && program.show_start_date_on_card !== false && (
                  <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <Calendar size={10} className="flex-shrink-0" /> Starts: {fmtDate(displayStartDate)}
                  </span>
                )}
                {displayEndDate && program.show_end_date_on_card !== false && (
                  <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <Calendar size={10} className="flex-shrink-0" /> Ends: {fmtDate(displayEndDate)}
                  </span>
                )}
                {program.timing && program.show_timing_on_card !== false && (
                  <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <Clock size={10} className="flex-shrink-0" /> {timingConverted.local ? `${timingConverted.local} ${timingConverted.localTz}` : `${program.timing} ${timingConverted.srcTz}`}
                  </span>
                )}
                {durationOnImage && program.show_duration_on_card !== false && (
                  <span className="bg-[#D4AF37] backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm tracking-wide">
                    {durationOnImage}
                  </span>
                )}
              </div>
            )}
            {/* Bottom overlay: countdown + exclusive offer */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2.5 pt-6">
              <div className="flex items-end justify-between gap-2">
                <div className="flex-shrink-0">{deadline && <CountdownTimer deadline={deadline} />}</div>
                {program.exclusive_offer_enabled && program.exclusive_offer_text && (
                  <span data-testid={`exclusive-offer-${program.id}`} className="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg tracking-wide uppercase animate-pulse">
                    {program.exclusive_offer_text}
                  </span>
                )}
              </div>
            </div>
          </>
        ) : enrollStatus === 'coming_soon' ? (
          /* Coming Soon — badge on image */
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <span data-testid={`coming-soon-badge-${program.id}`} className="bg-blue-600/90 text-white text-sm font-bold px-6 py-2.5 rounded-full tracking-wider uppercase shadow-xl border border-white/20 animate-pulse">
              Coming Soon
            </span>
          </div>
        ) : (
          /* Enrollment OFF — closure badge */
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="bg-gray-900/90 text-white text-sm font-bold px-5 py-2.5 rounded-full tracking-wider uppercase shadow-xl border border-white/20">
              {program.closure_text || 'Registration Closed'}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <p className="text-[#D4AF37] text-[10px] tracking-wider mb-0.5 uppercase">{program.category}</p>
        <div className="flex items-start gap-2 mb-1.5 flex-wrap">
          <h3 className="text-base font-semibold text-gray-900 leading-tight">{program.title}</h3>
          {hasTiers && isAnnual && (
            <span
              data-testid={`annual-tier-label-${program.id}`}
              className="flex-shrink-0 inline-flex items-center rounded-md border border-[#D4AF37]/40 bg-amber-50/95 text-[8px] font-bold uppercase tracking-wider text-[#6b5210] px-2 py-0.5"
            >
              Annual
            </span>
          )}
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
        <p className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-2 flex-1">{program.description}</p>

        {enrollStatus === 'open' ? (
          <>
            {/* Tier Selector */}
            {hasTiers && (
              <div data-testid={`upcoming-tier-selector-${program.id}`} className="mb-3">
                <div className={`grid ${tierGridClass} gap-1`}>
                  {tiers.map((t, i) => (
                    <button                      key={i}
                      data-testid={`upcoming-tier-btn-${program.id}-${i}`}
                      type="button"
                      title={t.label || undefined}
                      onClick={() => setSelectedTier(i)}
                      className={`min-h-[2.25rem] px-1.5 text-[10px] leading-tight rounded-full border transition-all flex items-center justify-center text-center ${
                        selectedTier === i ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#D4AF37]'
                      }`}
                    >
                      <span className="line-clamp-2 break-words">{compactTierButtonLabel(t.label)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Early Bird */}
            {offerPrice > 0 && deadline && (() => {
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

            {/* Pricing + Buttons */}
            <div className="border-t pt-3 mt-auto">
              {showContact ? (
                <div className="text-center mb-2">
                  <p className="text-gray-500 text-[10px] mb-1.5">Custom pricing</p>
                  <button onClick={() => navigate(`/contact?program=${program.id}&title=${encodeURIComponent(program.title)}&tier=Annual`)} data-testid={`upcoming-contact-${program.id}`}
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
                    <button onClick={() => navigate(`/program/${program.id}`)} data-testid={`upcoming-know-more-${program.id}`}
                      className="flex-1 bg-[#1a1a1a] hover:bg-[#333] text-white py-2 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
                      Know More
                    </button>
                    {price > 0 && (
                      <button onClick={handleAddToCart} data-testid={`upcoming-add-cart-${program.id}`}
                        disabled={inCart || justAdded}
                        className={`flex items-center justify-center px-2.5 py-2 rounded-full text-[10px] transition-all font-medium border ${
                          inCart || justAdded ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37] hover:text-[#D4AF37]'
                        }`}>
                        {inCart || justAdded ? <Check size={11} /> : <ShoppingCart size={11} />}
                      </button>
                    )}
                    <button onClick={() => navigate(`/enroll/program/${program.id}?tier=${selectedTier}`)} data-testid={`upcoming-enroll-${program.id}`}
                      className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-2 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
                      {price > 0 ? 'Enroll Now' : 'Register Free'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : enrollStatus === 'coming_soon' ? (
          /* Coming Soon — just Know More */
          <div className="border-t pt-3 mt-auto">
            <button onClick={() => navigate(`/program/${program.id}`)} data-testid={`upcoming-know-more-${program.id}`}
              className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white py-2 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
              Know More
            </button>
          </div>
        ) : (
          /* Enrollment OFF — just Know More + disabled closure button */
          <div className="border-t pt-3 mt-auto flex gap-1.5">
            <button onClick={() => navigate(`/program/${program.id}`)} data-testid={`upcoming-know-more-${program.id}`}
              className="flex-1 bg-[#1a1a1a] hover:bg-[#333] text-white py-2 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
              Know More
            </button>
            <button disabled data-testid={`upcoming-enroll-disabled-${program.id}`}
              className="flex-1 bg-gray-300 text-gray-500 py-2 rounded-full text-[10px] tracking-wider uppercase font-medium cursor-not-allowed">
              {program.closure_text || 'Closed'}
            </button>
          </div>
        )}
      </div>
      {Array.isArray(cardQuotes) && cardQuotes.length > 0 && (
        <CardTestimonialRotate quotes={cardQuotes} programId={program.id} />
      )}
    </div>
  );
};

const SponsorCard = ({ sponsorData }) => {
  const navigate = useNavigate();
  const h = sponsorData || {};
  const imgUrl = h.image ? resolveImageUrl(h.image) : '';
  return (
    <div data-testid="sponsor-card-upcoming"
      className="group bg-white rounded-xl overflow-hidden shadow-lg transition-all duration-300 border border-gray-100 flex flex-col hover:shadow-2xl h-full">
      <div className="relative h-48 overflow-hidden cursor-pointer" onClick={() => navigate('/sponsor')}>
        {imgUrl ? (
          <img src={imgUrl} alt={h.title || 'Become a Sponsor'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full bg-purple-50 flex items-center justify-center">
            <Heart size={40} className="text-purple-300" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-[#D4AF37] text-white w-fit flex items-center gap-1"><Heart size={10} /> Sponsor</span>
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <p className="text-[#D4AF37] text-[10px] tracking-wider mb-0.5 uppercase">{h.subtitle || 'Conscious Support'}</p>
        <h3 className="text-base font-semibold text-gray-900 mb-1.5 leading-tight cursor-pointer hover:text-[#D4AF37] transition-colors" onClick={() => navigate('/sponsor')}>{h.title || 'Sponsor A Life'}</h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-3 flex-1">{h.body_1 || 'Contribute towards someone\'s healing journey — anonymously or intentionally. When one heals, the collective heals.'}</p>
        <div className="mt-auto pt-2">
          <button onClick={() => navigate('/sponsor')} data-testid="sponsor-card-cta"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
            {h.button_text || h.title || 'Sponsor a Life'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ComboBanner = ({ programs, comboRules }) => {
  const { addItem, items } = useCart();
  const { toast } = useToast();

  const names = programs.map(p => p.title.length > 25 ? p.title.slice(0, 25) + '...' : p.title);
  // Sort rules ascending by min_programs
  const rules = [...comboRules].sort((a, b) => a.min_programs - b.min_programs);

  const handleAddAll = () => {
    let added = 0;
    programs.forEach(p => {
      if (!items.some(i => i.programId === p.id)) { addItem(p, 0); added++; }
    });
    toast({ title: added > 0 ? `${added} program${added > 1 ? 's' : ''} added to cart!` : 'Already in cart' });
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-[#D4AF37]/50 bg-gradient-to-r from-[#fdf6e3] via-white to-[#f3e8ff] p-4 mt-4" data-testid="combo-banner">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center shrink-0">
          <ShoppingCart size={18} className="text-[#D4AF37]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900 mb-1">
            {rules[0]?.label || 'Combo Package'} — Save up to {rules[rules.length - 1]?.discount_pct || rules[0]?.discount_pct}%
          </p>
          <div className="space-y-1 mb-2">
            {rules.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[10px] flex items-center justify-center">{r.min_programs}</span>
                <span className="text-gray-600">{r.min_programs} programs together →</span>
                <span className="text-[#D4AF37] font-bold">{r.discount_pct}% off</span>
                <span className="text-[8px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{r.code}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mb-2">
            Available: <strong>{names.join(' + ')}</strong>
          </p>
          <button onClick={handleAddAll} data-testid="combo-add-all"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#D4AF37] hover:bg-[#b8962e] text-white text-xs font-semibold tracking-wide transition-colors">
            <ShoppingCart size={12} /> Add All to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

const CrossSellBanner = ({ rules, programs }) => {
  const { symbol } = useCurrency();

  const allOffers = rules.flatMap(rule => {
    const buyProg = programs.find(p => String(p.id) === String(rule.buy_program_id));
    if (!buyProg) return [];
    const buyTier = rule.buy_tier !== '' && rule.buy_tier !== undefined ? buyProg.duration_tiers?.[rule.buy_tier] : null;
    const buyLabel = buyTier ? `${buyProg.title} (${buyTier.label})` : buyProg.title;
    const targets = rule.targets || (rule.get_program_id ? [{ program_id: rule.get_program_id, discount_value: rule.discount_value, discount_type: rule.discount_type }] : []);
    return targets.map(t => {
      const tp = programs.find(p => String(p.id) === String(t.program_id));
      if (!tp) return null;
      const tier = t.tier !== '' && t.tier !== undefined ? tp.duration_tiers?.[t.tier] : null;
      return { buyLabel, targetTitle: tier ? `${tp.title} (${tier.label})` : tp.title, value: t.discount_value, type: t.discount_type, label: rule.label };
    }).filter(Boolean);
  });

  if (allOffers.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#D4AF37]/30 bg-gradient-to-r from-[#fdf6e3] via-[#fffbf0] to-[#fdf6e3] px-5 py-3 mt-4" data-testid="cross-sell-banners">
      <div className="flex items-start gap-3">
        <Gift size={16} className="text-[#D4AF37] shrink-0 mt-0.5" />
        <div className="space-y-1">
          {allOffers.map((o, i) => (
            <p key={i} className="text-xs text-gray-800">
              Enroll in <strong>{o.buyLabel}</strong> and get <strong className="text-[#D4AF37]">{o.value}{o.type === 'percentage' ? '%' : ` ${symbol}`} off</strong> on <strong>{o.targetTitle}</strong>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

const UpcomingProgramsSection = ({ sectionConfig, inline }) => {
  const [programs, setPrograms] = useState([]);
  const [adminQuoteRows, setAdminQuoteRows] = useState([]);
  const [templateRows, setTemplateRows] = useState([]);
  const [sponsorData, setSponsorData] = useState(null);
  const [sponsorConfig, setSponsorConfig] = useState(null);
  const [comboDiscount, setComboDiscount] = useState(null);
  const [crossSellRules, setCrossSellRules] = useState([]);
  const [groupDiscount, setGroupDiscount] = useState(null);
  useEffect(() => {
    axios.get(`${API}/programs?visible_only=true&upcoming_only=true`)
      .then(r => setPrograms(r.data))
      .catch(err => console.error('Error loading upcoming programs:', err));
    axios.get(`${API}/settings`).then(r => {
      setSponsorData(r.data?.sponsor_home);
      const sc = (r.data?.homepage_sections || []).find(s => s.id === 'sponsor');
      if (sc) setSponsorConfig(sc);
    }).catch(() => {});
    axios.get(`${API}/discounts/settings`).then(r => {
      if (r.data?.enable_combo_discount) {
        const rules = r.data.combo_rules?.length > 0
          ? r.data.combo_rules
          : r.data.combo_discount_pct > 0
            ? [{ min_programs: r.data.combo_min_programs || 2, discount_pct: r.data.combo_discount_pct, code: 'COMBO', label: 'Combo Package' }]
            : [];
        if (rules.length > 0) setComboDiscount({ rules });
      }
      if (r.data?.enable_cross_sell && r.data?.cross_sell_rules?.length > 0) {
        setCrossSellRules(r.data.cross_sell_rules.filter(r => r.enabled !== false));
      }
      if (r.data?.enable_group_discount && r.data?.group_discount_rules?.length > 0) {
        setGroupDiscount(r.data.group_discount_rules);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [qRes, tRes] = await Promise.all([
          axios.get(`${API}/upcoming-card-quotes?visible_only=true`),
          axios.get(`${API}/testimonials?visible_only=true`),
        ]);
        if (cancelled) return;
        setAdminQuoteRows(qRes.data || []);
        setTemplateRows(tRes.data || []);
      } catch (e) {
        if (!cancelled) {
          console.warn('[UpcomingPrograms] Could not load card quotes or testimonials:', e?.response?.status || e?.message || e);
          setAdminQuoteRows([]);
          setTemplateRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const programCardQuotes = useMemo(() => {
    const adminMap = buildProgramCardQuotesMap(adminQuoteRows);
    const out = {};
    for (const p of programs) {
      const k = normalizePid(p.id);
      if (!k) continue;
      const admin = adminMap[k] || [];
      if (admin.length) {
        out[k] = admin;
        continue;
      }
      const fb = testimonialsForProgram(templateRows, p);
      out[k] = fb.map((t) => ({
        text: (t.text || '').trim(),
        name: (t.name || '').trim(),
        role: (t.role || '').trim(),
      }));
    }
    return out;
  }, [programs, adminQuoteRows, templateRows]);

  if (programs.length === 0) return null;

  const statusOrder = { open: 0, coming_soon: 1, closed: 2 };
  const sorted = [...programs].sort((a, b) => {
    const sa = statusOrder[a.enrollment_status || (a.enrollment_open !== false ? 'open' : 'closed')] ?? 1;
    const sb = statusOrder[b.enrollment_status || (b.enrollment_open !== false ? 'open' : 'closed')] ?? 1;
    return sa - sb;
  });

  const openPrograms = sorted.filter(p => {
    const s = p.enrollment_status || (p.enrollment_open !== false ? 'open' : 'closed');
    return s === 'open';
  });

  const applyTitleStyle = (styleObj, defaults) => {
    if (!styleObj) return defaults;
    return { ...defaults, ...(styleObj.font_family && { fontFamily: styleObj.font_family }), ...(styleObj.font_size && !inline && { fontSize: styleObj.font_size }), ...(styleObj.font_color && { color: styleObj.font_color }), ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }), ...(styleObj.font_style && { fontStyle: styleObj.font_style }) };
  };

  const content = (
    <div className={inline ? "" : "max-w-7xl mx-auto"}>
      {inline ? (
        <>
          <div className="text-center mb-8">
            <h2 className="text-xl md:text-2xl text-gray-900" style={applyTitleStyle(sectionConfig?.title_style, {})}>{sectionConfig?.title || 'Upcoming Programs'}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
            {sorted.map((program) => (
              <UpcomingCard
                key={program.id}
                program={program}
                cardQuotes={programCardQuotes[normalizePid(program.id)]}
              />
            ))}
          </div>
        </>
      ) : (
        /* Adaptive grid: columns = program count + 1 (for sponsor), max 4 */
        (() => {
          const totalCols = Math.min(sorted.length + 1, 4);
          const gridClass = totalCols === 2 ? 'lg:grid-cols-2' : totalCols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
          const titleSpan = totalCols === 2 ? 'lg:col-span-1' : totalCols === 3 ? 'lg:col-span-2' : 'lg:col-span-3';
          return (
            <div className={`grid grid-cols-1 ${gridClass} gap-6 items-stretch`}>
              {/* Title row */}
              <div className={`${titleSpan} text-center`}>
                <h2 className="text-3xl md:text-4xl text-gray-900" style={applyTitleStyle(sectionConfig?.title_style, {})}>{sectionConfig?.title || 'Upcoming Programs'}</h2>
                {(() => {
                  const fomoMessages = sectionConfig?.fomo_subtitles?.length > 0
                    ? sectionConfig.fomo_subtitles
                    : sectionConfig?.subtitle
                      ? [sectionConfig.subtitle]
                      : null;
                  const subtitleStyle = sectionConfig?.subtitle_style ? {
                    ...(sectionConfig.subtitle_style.font_color && { color: sectionConfig.subtitle_style.font_color }),
                    ...(sectionConfig.subtitle_style.font_size && { fontSize: sectionConfig.subtitle_style.font_size }),
                    ...(sectionConfig.subtitle_style.font_family && { fontFamily: sectionConfig.subtitle_style.font_family }),
                    ...(sectionConfig.subtitle_style.font_weight && { fontWeight: sectionConfig.subtitle_style.font_weight }),
                  } : {};
                  return fomoMessages ? (
                    <FomoSubtitle messages={fomoMessages} style={subtitleStyle} />
                  ) : null;
                })()}
              </div>
              <div data-testid="sponsor-title-column" className="text-center hidden lg:block">
                <h2 className="text-3xl md:text-4xl text-gray-900" style={applyTitleStyle(sponsorConfig?.title_style, {})}>{sponsorConfig?.title || 'Become a Sponsor'}</h2>
                {sponsorConfig?.subtitle && (
                  <p className="text-sm text-gray-900 mt-3" style={applyTitleStyle(sponsorConfig?.subtitle_style, {})}>{sponsorConfig.subtitle}</p>
                )}
              </div>
              {/* Cards */}
              {sorted.map((program) => (
                <UpcomingCard
                  key={program.id}
                  program={program}
                  cardQuotes={programCardQuotes[normalizePid(program.id)]}
                />
              ))}

              {/* Combo Discount Banner — spans full width below cards on mobile, beside sponsor on desktop */}
              {comboDiscount && openPrograms.length >= (comboDiscount.rules[0]?.min_programs || 2) && (
                <div className="lg:hidden col-span-full" data-testid="combo-banner-mobile">
                  <ComboBanner programs={openPrograms} comboRules={comboDiscount.rules} />
                </div>
              )}
              <div className="h-full">
                {/* Sponsor title for mobile only */}
                <div className="text-center mb-4 lg:hidden">
                  <h2 className="text-2xl sm:text-3xl text-gray-900" style={applyTitleStyle(sponsorConfig?.title_style, {})}>{sponsorConfig?.title || 'Become a Sponsor'}</h2>
                </div>
                <SponsorCard sponsorData={sponsorData} />
              </div>
            </div>
          );
        })()
      )}

      {/* Combo Banner — desktop full width below grid */}
      {!inline && comboDiscount && openPrograms.length >= (comboDiscount.rules[0]?.min_programs || 2) && (
        <div className="hidden lg:block mt-6">
          <ComboBanner programs={openPrograms} comboRules={comboDiscount.rules} />
        </div>
      )}

      {/* Cross-Sell Strips — full width below cards */}
      {!inline && crossSellRules.length > 0 && (
        <div className="mt-4">
          <CrossSellBanner rules={crossSellRules} programs={sorted} />
        </div>
      )}

      {/* Group Discount Banner */}
      {!inline && groupDiscount && groupDiscount.length > 0 && (
        <div className="rounded-xl border border-blue-200/50 bg-gradient-to-r from-blue-50 via-white to-blue-50 px-5 py-3 mt-4" data-testid="group-discount-banner">
          <div className="flex items-start gap-3">
            <Users size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {groupDiscount.map((rule, i) => {
                const progIds = rule.program_ids || [];
                const progNames = progIds.length > 0
                  ? progIds.map(pid => sorted.find(p => String(p.id) === String(pid))?.title).filter(Boolean)
                  : [];
                return (
                  <p key={i} className="text-xs text-gray-800">
                    {rule.label && <strong className="text-blue-700">{rule.label}: </strong>}
                    Enroll <strong className="text-blue-600">{rule.min_participants}+ participants</strong>
                    {progNames.length > 0 ? <> in <strong>{progNames.map(n => n.length > 25 ? n.slice(0, 25) + '..' : n).join(', ')}</strong></> : ''}
                    {' '}and get <strong className="text-blue-600">{rule.discount_pct}% off</strong>
                  </p>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (inline) return <div data-testid="upcoming-programs-section">{content}</div>;

  return (
    <section id="upcoming" data-testid="upcoming-programs-section" className="py-12">
      <div className="container mx-auto px-4">
        {content}
      </div>
    </section>
  );
};

export default UpcomingProgramsSection;
export { UpcomingCard };
