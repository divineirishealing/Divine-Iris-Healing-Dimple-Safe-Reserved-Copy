import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Clock, Wifi, MapPin, Quote, ChevronLeft, ChevronRight, Send, MessageCircle, ShoppingCart } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { useCurrency } from '../context/CurrencyContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../hooks/use-toast';
import { renderMarkdown } from '../lib/renderMarkdown';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { HEADING, SUBTITLE } from '../lib/designTokens';
import { resolveImageUrl } from '../lib/imageUtils';
import StarField from '../components/ui/StarField';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const DARK_PURPLE_GRADIENTS = {
  light: 'linear-gradient(160deg, #1a0e2e 0%, #221445 20%, #2e165a 40%, #3b1a6e 60%, #4c1d95 80%, #3b1a6e 100%)',
  medium: 'linear-gradient(160deg, #1a0e2e 0%, #2a1252 20%, #3b1a6e 40%, #4c1d95 60%, #5b21b6 80%, #4c1d95 100%)',
  strong: 'linear-gradient(160deg, #1a0e2e 0%, #301660 20%, #4c1d95 40%, #5b21b6 55%, #7c3aed 75%, #5b21b6 100%)',
};

const LIGHT_PURPLE_GRADIENTS = {
  light: 'linear-gradient(160deg, #faf8ff 0%, #f8f4ff 30%, #fdf8f3 60%, #fffcf7 100%)',
  medium: 'linear-gradient(160deg, #f3edff 0%, #ece4ff 30%, #f5eef8 60%, #faf5f0 100%)',
  strong: 'linear-gradient(160deg, #ede5ff 0%, #e0d0ff 30%, #efe6f8 60%, #f5efea 100%)',
};

const applyStyle = (styleObj, defaults = {}) => {
  if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
  return { ...defaults, ...(styleObj.font_family && { fontFamily: styleObj.font_family }), ...(styleObj.font_size && { fontSize: styleObj.font_size }), ...(styleObj.font_color && { color: styleObj.font_color }), ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }), ...(styleObj.font_style && { fontStyle: styleObj.font_style }) };
};

/* ---- Calendar Component ---- */
const BookingCalendar = ({ calendar = {}, selectedDate, onSelectDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const availableSet = useMemo(() => new Set(calendar.available_dates || []), [calendar.available_dates]);
  const minAdvance = calendar.min_advance_days || 7;
  const blockWeekends = calendar.block_weekends !== false;

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const isAvailable = (day) => {
    if (!day) return false;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return availableSet.has(dateStr);
  };
  const isSelected = (day) => {
    if (!day || !selectedDate) return false;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` === selectedDate;
  };
  const isPast = (day) => {
    if (!day) return false;
    const minDate = new Date(); minDate.setHours(0,0,0,0); minDate.setDate(minDate.getDate() + minAdvance);
    return new Date(year, month, day) < minDate;
  };
  const isWeekend = (day) => {
    if (!day) return false;
    const dow = new Date(year, month, day).getDay();
    return blockWeekends && (dow === 0 || dow === 6);
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20" data-testid="session-detail-calendar">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth(new Date(year, month - 1))} className="p-1.5 rounded-full hover:bg-white/10 text-white/60"><ChevronLeft size={18} /></button>
        <span className="text-sm font-semibold text-white tracking-wide">{monthName}</span>
        <button onClick={() => setCurrentMonth(new Date(year, month + 1))} className="p-1.5 rounded-full hover:bg-white/10 text-white/60"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className={`text-[10px] font-medium py-1 ${d === 'Su' || d === 'Sa' ? 'text-red-300/50' : 'text-white/40'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const available = isAvailable(day);
          const selected = isSelected(day);
          const past = isPast(day);
          const weekend = isWeekend(day);
          const disabled = !day || past || weekend || !available;
          return (
            <button key={i} disabled={disabled}
              onClick={() => { if (day && available && !weekend && !past) onSelectDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`); }}
              className={`h-9 w-full rounded-lg text-xs transition-all ${
                !day ? '' :
                weekend ? 'text-red-300/30 cursor-not-allowed' :
                selected ? 'bg-[#D4AF37] text-[#1a1a1a] font-bold shadow-lg' :
                available && !past ? 'bg-white/15 text-white hover:bg-[#D4AF37]/40 cursor-pointer font-medium' :
                past ? 'text-white/15' : 'text-white/20'
              }`}
            >{day || ''}</button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[10px] text-white/40">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white/15 border border-white/20" /> Available</span>
        <span>Min {minAdvance} days advance</span>
      </div>
    </div>
  );
};

/* ---- Question Form ---- */
const QuestionForm = ({ sessionId, sessionTpl, whiteTheme }) => {
  const [form, setForm] = useState({ name: '', email: '', question: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.question) return;
    setSending(true);
    try {
      await axios.post(`${BACKEND_URL}/api/session-extras/questions`, { ...form, session_id: sessionId });
      setSent(true);
    } catch { /* silent */ }
    setSending(false);
  };

  if (sent) return (
    <div className="text-center py-8 px-6">
      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
        <MessageCircle size={20} className="text-purple-600" />
      </div>
      <p className={`font-medium text-sm mb-1 ${whiteTheme ? 'text-gray-800' : 'text-white'}`}>Thank you for your question!</p>
      <p className={`text-xs ${whiteTheme ? 'text-gray-500' : 'text-white/50'}`}>You will receive a response within 7 working days.</p>
    </div>
  );

  const inputClass = whiteTheme
    ? 'w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400'
    : 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37]/50';

  return (
    <form onSubmit={submit} className="space-y-3" data-testid="session-question-form">
      <p className={`text-xs mb-2 ${whiteTheme ? 'text-gray-500' : 'text-white/70'}`}>{sessionTpl?.question_intro_text || "Have a question? We'll respond within 7 working days."}</p>
      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" required
        className={inputClass} style={applyStyle(sessionTpl?.question_label_style)} />
      <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" placeholder="Your email" required
        className={inputClass} style={applyStyle(sessionTpl?.question_label_style)} />
      <textarea value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} placeholder="Your question..." required rows={3}
        className={`${inputClass} resize-none`} style={applyStyle(sessionTpl?.question_label_style)} />
      <button type="submit" disabled={sending}
        className="w-full py-2.5 rounded-lg text-xs tracking-wider uppercase font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center justify-center gap-2"
        data-testid="submit-question-btn">
        <Send size={12} /> {sending ? 'Sending...' : 'Send Question'}
      </button>
    </form>
  );
};

function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPrice, formatPrice } = useCurrency();
  const { settings } = useSiteSettings();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [calendar, setCalendar] = useState({});
  const [testimonials, setTestimonials] = useState([]);
  const [currentT, setCurrentT] = useState(0);
  const { addSessionItem } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    if (settings && settings.sessions_page_visible === false) navigate('/', { replace: true });
  }, [settings, navigate]);

  const loadData = useCallback(async () => {
    try {
      const [sesRes, calRes, tRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/sessions/${id}`),
        axios.get(`${BACKEND_URL}/api/session-extras/calendar`),
        axios.get(`${BACKEND_URL}/api/session-extras/testimonials?session_id=${id}`),
      ]);
      setSession(sesRes.data);
      setCalendar(calRes.data);
      setTestimonials(tRes.data);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const modeLabel = (mode) => {
    if (mode === 'offline') return 'In-Person';
    if (mode === 'both') return 'Online & In-Person';
    return 'Online';
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><p className="text-gray-400 text-xs">Loading...</p></div>;
  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Session Not Found</h2>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-purple-600 text-white rounded-full text-sm">Back to Home</button>
      </div>
    </div>
  );

  const hero = settings?.page_heroes?.sessions || {};
  const sessionTpl = settings?.page_heroes?.session_template || {};
  const timeSlots = calendar.time_slots || session.time_slots || [];

  const purpleIntensity = sessionTpl.page_purple || 'medium';
  const heroGradient = DARK_PURPLE_GRADIENTS[purpleIntensity] || DARK_PURPLE_GRADIENTS.medium;
  const bodyGradient = LIGHT_PURPLE_GRADIENTS[purpleIntensity] || LIGHT_PURPLE_GRADIENTS.medium;
  const heroStarCount = purpleIntensity === 'strong' ? 100 : purpleIntensity === 'light' ? 50 : 80;

  // Visibility helpers
  const vis = sessionTpl.visibility || {};
  const isVisible = (section, key) => {
    const items = vis[section];
    if (!items || !Array.isArray(items)) return true;
    const item = items.find(i => i.key === key);
    return item ? item.visible !== false : true;
  };
  const getOrder = (section) => {
    const items = vis[section];
    if (!items || !Array.isArray(items)) return null;
    return items.filter(i => i.visible !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(i => i.key);
  };

  // Admin-controlled colors
  const accentColor = sessionTpl.accent_color || '#D4AF37';
  const starColor = sessionTpl.star_color || '#D4AF37';
  const buttonBg = sessionTpl.button_bg || '#D4AF37';
  const buttonText = sessionTpl.button_text || '#1a1a1a';
  const badgeBg = sessionTpl.badge_bg || '#ffffff';
  const badgeTextColor = sessionTpl.badge_text || '#ffffff';
  const calendarAccent = sessionTpl.calendar_accent || '#D4AF37';
  const calendarBg = sessionTpl.calendar_bg || heroGradient;

  // Hero elements map
  const heroElements = {
    back_button: (
      <button key="back" onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/60 hover:text-white text-xs mb-8 transition-colors" data-testid="back-btn">
        <ArrowLeft size={16} /> Back
      </button>
    ),
    session_type_badge: (
      <span key="type" className="text-[10px] px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 border"
        style={{ backgroundColor: `${badgeBg}25`, color: badgeTextColor, borderColor: `${badgeTextColor}40` }}>
        {session.session_mode === 'offline' ? <MapPin size={12} /> : <Wifi size={12} />}
        {modeLabel(session.session_mode)}
      </span>
    ),
    duration_badge: session.duration ? (
      <span key="dur" className="text-[10px] px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 border"
        style={{ backgroundColor: `${badgeBg}25`, color: badgeTextColor, borderColor: `${badgeTextColor}40` }}>
        <Clock size={10} /> {session.duration}
      </span>
    ) : null,
    title: (
      <h1 key="title" className="mb-3" data-testid="session-detail-title"
        style={applyStyle(sessionTpl.hero_title_style || sessionTpl.title_style, { ...HEADING, color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontVariant: 'small-caps', letterSpacing: '0.08em' })}>
        {session.title}
      </h1>
    ),
    gold_line: <div key="line" className="w-16 h-0.5 mb-4" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />,
    price: formatPrice(getPrice(session)) ? (
      <span key="price" className="text-xl font-bold" style={applyStyle(sessionTpl.hero_price_style, { color: accentColor })}>{formatPrice(getPrice(session))}</span>
    ) : null,
  };

  const heroOrder = getOrder('detail_hero') || ['back_button','session_type_badge','duration_badge','title','gold_line','price'];
  // Group badges together
  const renderHeroItems = () => {
    const items = [];
    let badgesRendered = false;
    heroOrder.forEach(key => {
      if (key === 'session_type_badge' || key === 'duration_badge') {
        if (!badgesRendered) {
          badgesRendered = true;
          const showType = heroOrder.includes('session_type_badge');
          const showDur = heroOrder.includes('duration_badge');
          if (showType || showDur) {
            items.push(
              <div key="badges" className="flex items-center gap-3 mb-4">
                {showType && heroElements.session_type_badge}
                {showDur && heroElements.duration_badge}
              </div>
            );
          }
        }
      } else if (key === 'back_button') {
        items.push(heroElements.back_button);
      } else {
        if (heroElements[key]) items.push(heroElements[key]);
      }
    });
    return items;
  };

  // Body elements map
  const bodyLeftElements = {
    about_section: (
      <div key="about">
        <h2 className="text-lg font-semibold mb-4" style={applyStyle(sessionTpl.title_style, { fontFamily: "'Cinzel', serif", color: '#4c1d95' })}>About This Session</h2>
        <div className="text-sm leading-relaxed" style={applyStyle(sessionTpl.description_style, { color: '#4a4a5a', fontFamily: "'Lato', sans-serif" })}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(session.description) }} />
      </div>
    ),
    testimonials: testimonials.length > 0 ? (
      <div key="test" data-testid="session-testimonials">
        <h2 className="text-lg font-semibold mb-6" style={applyStyle(sessionTpl.testimonial_heading_style || sessionTpl.testimonial_style, { fontFamily: "'Cinzel', serif", color: '#4c1d95', fontStyle: 'italic' })}>
          What Clients Say
        </h2>
        <div className="space-y-4">
          {testimonials.slice(0, 6).map((t, idx) => (
            <div key={t.id} data-testid={`session-testimonial-${idx}`}
              className="relative bg-purple-50/50 border border-purple-100 rounded-xl p-5">
              <Quote size={20} className="text-purple-200 absolute top-3 left-3" />
              <p className="text-gray-600 text-sm leading-relaxed italic pl-6 mb-3"
                style={applyStyle(sessionTpl.testimonial_style)}>{t.text}</p>
              <div className="flex items-center gap-3 pl-6">
                {t.client_photo && <img src={resolveImageUrl(t.client_photo)} alt="" className="w-8 h-8 rounded-full object-cover border border-purple-200" />}
                <span className="text-xs text-purple-700/80 font-medium">{t.client_name || 'Anonymous'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : null,
    info_cards: (() => {
      const card1Title = sessionTpl.card1_title || 'What to Expect';
      const card1Items = sessionTpl.card1_items?.length ? sessionTpl.card1_items : ['Personalized healing approach','Safe and supportive environment','Immediate energetic shifts','Practical guidance for integration'];
      const card2Title = sessionTpl.card2_title || 'Who Is This For';
      const card2Items = sessionTpl.card2_items?.length ? sessionTpl.card2_items : ['Anyone seeking deep healing','Those ready for transformation','Individuals committed to growth','Open to energetic work'];
      const headingStyle = applyStyle(sessionTpl.info_card_heading_style, { color: '#4c1d95', fontFamily: "'Cinzel', serif" });
      const textStyle = applyStyle(sessionTpl.info_card_text_style, {});
      return (
        <div key="cards" className="grid md:grid-cols-2 gap-5">
          <div className="bg-purple-50/40 border border-purple-100 p-5 rounded-xl">
            <h3 className="text-sm font-semibold mb-3" style={headingStyle}>{card1Title}</h3>
            <ul className="space-y-2 text-gray-600 text-xs">
              {card1Items.filter(Boolean).map((item, i) => (
                <li key={i} className="flex items-start gap-2" style={textStyle}><span className="mt-0.5" style={{ color: accentColor }}>&#10038;</span> {item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-purple-50/40 border border-purple-100 p-5 rounded-xl">
            <h3 className="text-sm font-semibold mb-3" style={headingStyle}>{card2Title}</h3>
            <ul className="space-y-2 text-gray-600 text-xs">
              {card2Items.filter(Boolean).map((item, i) => (
                <li key={i} className="flex items-start gap-2" style={textStyle}><span className="mt-0.5" style={{ color: accentColor }}>&#10038;</span> {item}</li>
              ))}
            </ul>
          </div>
        </div>
      );
    })(),
  };

  const bodyRightElements = {
    booking_sidebar: (
      <div key="booking" className="rounded-2xl overflow-hidden relative" data-testid="booking-section"
        style={{ background: typeof calendarBg === 'string' && calendarBg.startsWith('linear') ? calendarBg : `linear-gradient(180deg, ${calendarBg} 0%, ${calendarBg}ee 100%)` }}>
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 50" preserveAspectRatio="none" style={{ height: '40px', opacity: 0.12 }}>
          <path d="M0,25 C100,50 200,0 300,25 C350,37 380,15 400,25 L400,50 L0,50 Z" fill={calendarAccent}>
            <animate attributeName="d" dur="8s" repeatCount="indefinite" values="M0,25 C100,50 200,0 300,25 C350,37 380,15 400,25 L400,50 L0,50 Z;M0,30 C100,10 200,40 300,20 C350,10 380,35 400,30 L400,50 L0,50 Z;M0,25 C100,50 200,0 300,25 C350,37 380,15 400,25 L400,50 L0,50 Z" />
          </path>
        </svg>
        <StarField count={15} color={calendarAccent} />
        <div className="relative z-10 p-5">
          <p className="text-[10px] font-medium uppercase tracking-widest mb-4" style={applyStyle(sessionTpl.calendar_heading_style, { color: calendarAccent })}>Book Your Session</p>
          <BookingCalendar calendar={calendar} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          {timeSlots.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] text-white/50 font-medium mb-2 uppercase tracking-wider">Select a Time</p>
              <div className="flex flex-wrap gap-2">
                {timeSlots.map((slot, i) => (
                  <span key={i} onClick={() => setSelectedTimeSlot(slot)}
                    className={`px-3 py-1.5 rounded-full text-[10px] border cursor-pointer transition-all ${
                      selectedTimeSlot === slot ? 'bg-white/25 text-white border-white/50 font-semibold' : 'bg-white/10 text-white/70 border-white/15 hover:bg-white/15'
                    }`}
                    data-testid={`detail-time-slot-${i}`}>
                    {slot}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2 mt-5">
            <button onClick={() => navigate(`/enroll/session/${session.id}`)} data-testid="book-now-btn"
              className="w-full py-3.5 rounded-full text-sm tracking-widest uppercase font-medium transition-all duration-300 shadow-lg hover:scale-[1.02]"
              style={{ background: `linear-gradient(135deg, ${buttonBg}, ${buttonBg}dd)`, color: buttonText }}>
              Book Now
            </button>
            <button onClick={() => {
                const added = addSessionItem(session, selectedDate, selectedTimeSlot);
                if (added) toast({ title: `${session.title} added to cart` });
                else toast({ title: 'Already in cart', variant: 'destructive' });
              }}
              data-testid="add-session-cart-detail-btn"
              className="w-full py-3 rounded-full text-[11px] tracking-[0.15em] uppercase font-medium transition-all duration-300 border-2 flex items-center justify-center gap-2 hover:scale-[1.02]"
              style={{ borderColor: `${buttonBg}80`, color: buttonBg, background: 'transparent' }}>
              <ShoppingCart size={14} /> Add to Cart
            </button>
          </div>
        </div>
      </div>
    ),
    question_form: (
      <div key="qform" className="rounded-2xl overflow-hidden p-5 border border-purple-100 bg-purple-50/30">
        <p className="text-[10px] text-purple-700 font-medium uppercase tracking-widest mb-3"
          style={applyStyle(sessionTpl.question_heading_style, { color: '#6d28d9' })}>
          <MessageCircle size={12} className="inline mr-1" /> Ask a Question
        </p>
        <QuestionForm sessionId={id} sessionTpl={sessionTpl} whiteTheme />
      </div>
    ),
  };

  const bodyOrder = getOrder('detail_body') || ['about_section','testimonials','info_cards','booking_sidebar','question_form'];
  const leftKeys = ['about_section', 'testimonials', 'info_cards'];
  const rightKeys = ['booking_sidebar', 'question_form'];
  const orderedLeftKeys = bodyOrder.filter(k => leftKeys.includes(k));
  const orderedRightKeys = bodyOrder.filter(k => rightKeys.includes(k));

  return (
    <>
      <Header />
      <div className="min-h-screen" style={{ background: bodyGradient }}>
        {/* Hero — Iris Purple Glossy with Golden Sprinkles */}
        <div className="relative pt-20 pb-20 overflow-hidden" data-testid="session-hero"
          style={{ background: heroGradient }}>
          {/* Golden star particles */}
          <StarField count={heroStarCount} color={starColor} />
          {/* Glossy iris overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(139, 92, 246, 0.3), transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(212, 175, 55, 0.08), transparent 50%)',
          }} />
          {/* Subtle golden wave at bottom */}
          <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ height: '60px' }}>
            <path d="M0,40 C360,80 720,10 1080,50 C1260,65 1380,25 1440,40 L1440,80 L0,80 Z" fill="rgba(212, 175, 55, 0.08)" />
            <path d="M0,50 C240,30 480,70 720,40 C960,10 1200,60 1440,30 L1440,80 L0,80 Z" fill="rgba(212, 175, 55, 0.04)" />
          </svg>

          <div className="container mx-auto px-6 md:px-8 lg:px-12 relative z-10">
            <div className="max-w-3xl">
              {renderHeroItems()}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-6 md:px-8 lg:px-12 py-12">
          <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-10">
            {/* Left — About + Testimonials */}
            <div className="lg:col-span-3 space-y-8">
              {orderedLeftKeys.map(key => bodyLeftElements[key])}
            </div>

            {/* Right Sidebar — Booking + Question */}
            <div className="lg:col-span-2 space-y-5">
              {orderedRightKeys.map(key => bodyRightElements[key])}
              <p className="text-[10px] text-gray-400 text-center leading-relaxed px-4">
                {sessionTpl.footer_note || 'Sessions conducted online via Zoom or in-person by appointment. Each session is customized to your unique healing needs.'}
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      <FloatingButtons />
    </>
  );
}

export default SessionDetailPage;
