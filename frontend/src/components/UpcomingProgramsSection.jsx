import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../hooks/use-toast';
import { Monitor, Calendar, Clock, AlertTriangle, Wifi, ShoppingCart, Check, Bell } from 'lucide-react';

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

  // Parse date string, handling ordinal suffixes like "27th", "1st"
  const parseDate = (d) => {
    if (!d) return null;
    const cleaned = d.replace(/(\d+)(st|nd|rd|th)/gi, '$1').replace(',', '');
    const dt = new Date(cleaned);
    return isNaN(dt.getTime()) ? null : dt;
  };

  // Auto-calculate duration from start_date and end_date (inclusive: both start and end days count)
  const autoDuration = (() => {
    const s = parseDate(program.start_date);
    const e = parseDate(program.end_date);
    if (!s || !e) return program.duration && program.duration !== '90 days' ? program.duration : '';
    const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1; // inclusive
    if (diffDays <= 0) return '';
    return `${diffDays} Days`;
  })();

  // Format date to standard: "27 Mar 2026"
  const fmtDate = (d) => {
    const dt = parseDate(d);
    if (!dt) return d || '';
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Convert timing to viewer's local time
  const timingConverted = convertTimingToLocal(program.timing, program.time_zone);

  // Use tier-specific dates if available, otherwise fall back to program dates
  const activeTier = hasTiers ? tiers[selectedTier] : null;
  const displayStartDate = (activeTier?.start_date) || program.start_date;
  const displayEndDate = (activeTier?.end_date) || program.end_date;

  const enrollStatus = program.enrollment_status || (program.enrollment_open !== false ? 'open' : 'closed');
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

  return (
    <div data-testid={`upcoming-card-${program.id}`}
      className={`group bg-white rounded-xl overflow-hidden shadow-lg transition-all duration-300 border border-gray-100 flex flex-col ${enrollStatus === 'closed' ? 'opacity-60' : 'hover:shadow-2xl'}`}>
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
            {/* Top-right: Dates (tier-aware), Times, Duration */}
            {(displayStartDate || program.timing || autoDuration) && (
              <div data-testid={`card-image-datetime-${program.id}`} className="absolute top-3 right-3 flex flex-col items-end gap-1">
                {displayStartDate && (
                  <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <Calendar size={10} className="flex-shrink-0" /> Starts: {fmtDate(displayStartDate)}
                  </span>
                )}
                {displayEndDate && (
                  <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <Calendar size={10} className="flex-shrink-0" /> Ends: {fmtDate(displayEndDate)}
                  </span>
                )}
                {program.timing && (
                  <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <Clock size={10} className="flex-shrink-0" /> {program.timing} {timingConverted.srcTz}
                  </span>
                )}
                {timingConverted.local && (
                  <span className="bg-blue-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <Clock size={10} className="flex-shrink-0" /> {timingConverted.local} {timingConverted.localTz}
                  </span>
                )}
                {autoDuration && (
                  <span className="bg-[#D4AF37] backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm">{autoDuration}</span>
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
        <h3 className="text-base font-semibold text-gray-900 mb-1.5 leading-tight">{program.title}</h3>
        <p className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-2 flex-1">{program.description}</p>

        {enrollStatus === 'open' ? (
          <>
            {/* Tier Selector */}
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
          /* Coming Soon — Express Your Interest */
          <div className="border-t pt-3 mt-auto">
            {!notifySubmitted ? (
              <div data-testid={`express-interest-form-${program.id}`}>
                <p className="text-xs text-blue-600 font-medium mb-2">Get notified when enrollment opens</p>
                <div className="flex gap-1.5">
                  <input type="email" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)}
                    placeholder="Your email" className="flex-1 border border-gray-200 rounded-full px-3 py-1.5 text-[11px] focus:outline-none focus:border-blue-400" />
                  <button onClick={handleNotifyMe} data-testid={`express-interest-btn-${program.id}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-full text-[10px] tracking-wider uppercase font-medium transition-colors">
                    Express Interest
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-green-600 font-medium text-center py-2" data-testid={`express-interest-success-${program.id}`}>
                You'll be notified when enrollment opens!
              </p>
            )}
            <button onClick={() => navigate(`/program/${program.id}`)} data-testid={`upcoming-know-more-${program.id}`}
              className="w-full mt-2 bg-[#1a1a1a] hover:bg-[#333] text-white py-2 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
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
export { UpcomingCard };
