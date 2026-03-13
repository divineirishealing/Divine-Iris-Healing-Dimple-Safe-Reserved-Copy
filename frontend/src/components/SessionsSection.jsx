import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronRight, ChevronLeft, Clock, Wifi, MapPin, Quote, Calendar as CalendarIcon } from 'lucide-react';
import { HEADING, BODY, GOLD, CONTAINER, applySectionStyle } from '../lib/designTokens';
import { useCurrency } from '../context/CurrencyContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { renderMarkdown } from '../lib/renderMarkdown';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PURPLE_GRADIENTS = {
  light: 'linear-gradient(160deg, #faf8ff 0%, #f8f4ff 30%, #fdf8f3 60%, #fffcf7 100%)',
  medium: 'linear-gradient(160deg, #f3edff 0%, #ece4ff 30%, #f5eef8 60%, #faf5f0 100%)',
  strong: 'linear-gradient(160deg, #ede5ff 0%, #e0d0ff 30%, #efe6f8 60%, #f5efea 100%)',
};

/* ---- Mini Calendar Component (Light Theme) ---- */
const MiniCalendar = ({ availableDates = [], onSelectDate, selectedDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const isAvailable = (day) => {
    if (!day) return false;
    return availableSet.has(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  };
  const isSelected = (day) => {
    if (!day || !selectedDate) return false;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` === selectedDate;
  };
  const isPast = (day) => {
    if (!day) return false;
    const minDate = new Date(); minDate.setHours(0,0,0,0); minDate.setDate(minDate.getDate() + 7);
    return new Date(year, month, day) < minDate;
  };
  const isWeekend = (day) => {
    if (!day) return false;
    const dow = new Date(year, month, day).getDay();
    return dow === 0 || dow === 6;
  };

  return (
    <div data-testid="session-calendar" className="bg-white rounded-xl p-4 border border-purple-100/60 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCurrentMonth(new Date(year, month - 1))} className="p-1 rounded-full hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors"><ChevronLeft size={16} /></button>
        <span className="text-sm font-medium text-gray-700 tracking-wide">{monthName}</span>
        <button onClick={() => setCurrentMonth(new Date(year, month + 1))} className="p-1 rounded-full hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className={`text-[9px] font-medium py-1 ${d === 'Su' || d === 'Sa' ? 'text-red-300' : 'text-gray-400'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          const available = isAvailable(day);
          const selected = isSelected(day);
          const past = isPast(day);
          const weekend = isWeekend(day);
          const disabled = !day || past || weekend || !available;
          return (
            <button key={i} disabled={disabled}
              onClick={() => {
                if (day && available && !weekend && !past) onSelectDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
              }}
              className={`h-8 w-full rounded-md text-[11px] transition-all ${
                !day ? '' :
                weekend ? 'text-red-200 cursor-not-allowed' :
                selected ? 'bg-purple-600 text-white font-bold shadow-md' :
                available && !past ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer font-medium' :
                past ? 'text-gray-200' : 'text-gray-300'
              }`}
            >{day || ''}</button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[9px] text-gray-400">
        {availableDates.length > 0 && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-50 border border-purple-200" /> Available</span>}
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50" /> Weekend</span>
        <span>Min 7 days advance</span>
      </div>
    </div>
  );
};

const SessionsSection = ({ sectionConfig }) => {
  const navigate = useNavigate();
  const { getPrice, formatPrice } = useCurrency();
  const { settings } = useSiteSettings();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const sessionTpl = settings?.page_heroes?.session_template || {};
  const purpleIntensity = sessionTpl.homepage_purple || 'medium';
  const purpleGradient = PURPLE_GRADIENTS[purpleIntensity] || PURPLE_GRADIENTS.medium;
  const buttonBg = sessionTpl.button_bg || '#D4AF37';
  const buttonText = sessionTpl.button_text || '#1a1a1a';

  // Visibility helpers — defaults match admin panel
  const HOMEPAGE_LIST_DEFAULTS = { session_name: true, session_type: false, duration: false };
  const vis = sessionTpl.visibility || {};
  const getVisible = (section, key) => {
    const items = vis[section];
    if (!items || !Array.isArray(items) || items.length === 0) {
      if (section === 'homepage_list') return HOMEPAGE_LIST_DEFAULTS[key] ?? true;
      return true;
    }
    const item = items.find(i => i.key === key);
    return item ? item.visible !== false : true;
  };
  const getOrder = (section) => {
    const items = vis[section];
    if (!items || !Array.isArray(items) || items.length === 0) return null;
    return items.filter(i => i.visible !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(i => i.key);
  };

  useEffect(() => { loadSessions(); }, []);

  const loadSessions = async () => {
    try {
      const response = await axios.get(`${API}/sessions?visible_only=true`);
      if (response.data && response.data.length > 0) setSessions(response.data);
    } catch (error) { console.error('Error loading sessions:', error); }
  };

  const modeIcon = (mode) => {
    if (mode === 'offline') return <MapPin size={12} />;
    if (mode === 'both') return <><Wifi size={12} /><MapPin size={12} /></>;
    return <Wifi size={12} />;
  };
  const modeLabel = (mode) => {
    if (mode === 'offline') return 'In-Person';
    if (mode === 'both') return 'Online & In-Person';
    return 'Online';
  };

  return (
    <section id="sessions" data-testid="sessions-section" className="py-12 relative overflow-hidden"
      style={{ background: purpleGradient }}>

      {/* Iris flower petal shapes — soft purple */}
      <div className="absolute top-[-60px] right-[-40px] w-[320px] h-[320px] rounded-full opacity-[0.08]"
        style={{ background: 'radial-gradient(ellipse, #7c3aed, transparent 70%)' }} />
      <div className="absolute top-[20%] right-[5%] w-[200px] h-[280px] rounded-[50%] opacity-[0.06] rotate-[25deg]"
        style={{ background: 'radial-gradient(ellipse, #a855f7, transparent 70%)' }} />
      <div className="absolute bottom-[-50px] left-[-30px] w-[260px] h-[260px] rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(ellipse, #8b5cf6, transparent 70%)' }} />
      <div className="absolute top-[60%] left-[8%] w-[150px] h-[220px] rounded-[50%] opacity-[0.05] rotate-[-15deg]"
        style={{ background: 'radial-gradient(ellipse, #c084fc, transparent 70%)' }} />

      {/* Subtle gold shimmer line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] opacity-20" style={{ background: 'linear-gradient(90deg, transparent 10%, #D4AF37 50%, transparent 90%)' }} />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] opacity-15" style={{ background: 'linear-gradient(90deg, transparent 10%, #D4AF37 50%, transparent 90%)' }} />

      <div className={`${CONTAINER} relative z-10`}>
        {/* Section Title */}
        <div className="text-center mb-10">
          <h2 style={applySectionStyle(sectionConfig?.title_style, { ...HEADING, color: '#4c1d95', fontStyle: 'italic', fontSize: 'clamp(1.5rem, 3vw, 2rem)' })} data-testid="sessions-section-title">
            {sectionConfig?.title || 'Book Personal Session'}
          </h2>
          {sectionConfig?.subtitle && (
            <p className="text-xs mt-3 max-w-lg mx-auto" style={applySectionStyle(sectionConfig?.subtitle_style, { color: '#8b7ca8' })}>{sectionConfig.subtitle}</p>
          )}
          <div className="h-[2px] w-12 mx-auto mt-4" style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)' }} />
        </div>

        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">

          {/* Left — Session List */}
          <aside className="w-full lg:w-[340px] lg:min-w-[340px] flex-shrink-0" data-testid="sessions-list">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-purple-100/50 shadow-sm overflow-hidden">
              <div className="max-h-[520px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    data-testid={`session-tab-${session.id}`}
                    onClick={() => { setSelectedSession(session); setSelectedDate(null); }}
                    className={`w-full text-left px-5 py-4 transition-all border-b border-purple-50 group ${
                      selectedSession?.id === session.id
                        ? 'bg-purple-50/80 border-l-[3px] border-l-purple-500'
                        : 'border-l-[3px] border-l-transparent hover:bg-purple-25 hover:bg-purple-50/30'
                    }`}
                  >
                    {getVisible('homepage_list', 'session_name') && (
                      <span className={`block text-[13px] leading-snug ${(getVisible('homepage_list', 'session_type') || getVisible('homepage_list', 'duration')) ? 'mb-1' : ''} ${
                        selectedSession?.id === session.id ? 'text-purple-900 font-semibold' : 'text-gray-700'
                      }`}
                        style={sessionTpl.title_style ? applySectionStyle(sessionTpl.title_style, { fontFamily: "'Lato', sans-serif" }) : { fontFamily: "'Lato', sans-serif" }}
                      >
                        {session.title}
                      </span>
                    )}
                    {(getVisible('homepage_list', 'session_type') || getVisible('homepage_list', 'duration')) && (
                      <div className="flex items-center gap-2 text-gray-400 text-[10px]">
                        {getVisible('homepage_list', 'session_type') && (
                          <span className="flex items-center gap-1">{modeIcon(session.session_mode)} {modeLabel(session.session_mode)}</span>
                        )}
                        {getVisible('homepage_list', 'duration') && session.duration && (
                          <span className="flex items-center gap-1"><Clock size={10} /> {session.duration}</span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Right — Details Panel */}
          <main className="flex-1 min-w-0">
            {!selectedSession ? (
              <div className="h-full flex items-center justify-center min-h-[400px]">
                <div className="text-center px-8">
                  <div className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(212,175,55,0.08))' }}>
                    <CalendarIcon size={32} className="text-purple-400" />
                  </div>
                  <h3 className="text-purple-900/80 text-lg font-light mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Choose Your Healing Journey
                  </h3>
                  <p className="text-gray-400 text-sm max-w-xs mx-auto leading-relaxed">
                    Select a session from the left to explore details, read testimonials, and book your personal appointment.
                  </p>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in space-y-6" data-testid={`session-detail-${selectedSession.id}`}>
                {(getOrder('homepage_detail') || ['session_type_badge','duration_badge','title','description','testimonial','price','calendar','time_slots','book_button']).map(key => {
                  if (key === 'session_type_badge' || key === 'duration_badge') {
                    // Render badges together on first encounter
                    if (key === 'duration_badge') return null; // handled with session_type_badge
                    const showType = getVisible('homepage_detail', 'session_type_badge');
                    const showDur = getVisible('homepage_detail', 'duration_badge');
                    if (!showType && !showDur) return null;
                    return (
                      <div key="badges" className="flex items-center gap-2">
                        {showType && (
                          <span className={`text-[10px] px-3 py-1 rounded-full font-medium flex items-center gap-1 ${
                            selectedSession.session_mode === 'offline' ? 'bg-teal-50 text-teal-600' :
                            selectedSession.session_mode === 'both' ? 'bg-purple-50 text-purple-600' :
                            'bg-blue-50 text-blue-600'
                          }`}>
                            {modeIcon(selectedSession.session_mode)} {modeLabel(selectedSession.session_mode)}
                          </span>
                        )}
                        {showDur && selectedSession.duration && (
                          <span className="text-[10px] px-3 py-1 rounded-full bg-gray-50 text-gray-500 flex items-center gap-1">
                            <Clock size={10} /> {selectedSession.duration}
                          </span>
                        )}
                      </div>
                    );
                  }
                  if (key === 'title') return (
                    <h3 key="title" className="text-gray-900 text-xl" style={sessionTpl.title_style ? applySectionStyle(sessionTpl.title_style, { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, letterSpacing: '0.02em' }) : { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, letterSpacing: '0.02em' }}
                      data-testid="selected-session-title">
                      {selectedSession.title}
                    </h3>
                  );
                  if (key === 'description') return (
                    <p key="desc" className="text-gray-500 text-sm leading-relaxed max-w-[600px]"
                      style={selectedSession.description_style ? applySectionStyle(selectedSession.description_style, {}) : { fontFamily: "'Lato', sans-serif", lineHeight: '1.85' }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedSession.description) }}
                      data-testid="selected-session-description" />
                  );
                  if (key === 'testimonial' && selectedSession.testimonial_text) return (
                    <div key="test" className="bg-gradient-to-br from-purple-50/60 to-amber-50/30 rounded-xl p-5 border border-purple-100/40 relative" data-testid="session-testimonial">
                      <Quote size={20} className="text-purple-200 absolute top-3 left-3" />
                      <p className="text-gray-600 text-[13px] leading-relaxed italic pl-6"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedSession.testimonial_text) }} />
                    </div>
                  );
                  if (key === 'price') return (
                    <div key="price">
                      {formatPrice(getPrice(selectedSession)) ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-purple-700">{formatPrice(getPrice(selectedSession))}</span>
                          <span className="text-gray-400 text-xs">per session</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Contact for pricing</span>
                      )}
                    </div>
                  );
                  if (key === 'calendar') return (
                    <MiniCalendar key="cal" availableDates={selectedSession.available_dates || []} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
                  );
                  if (key === 'time_slots' && selectedSession.time_slots?.length > 0) return (
                    <div key="slots">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Available Times</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedSession.time_slots.map((slot, i) => (
                          <span key={i} className="px-3 py-1.5 rounded-full text-xs bg-purple-50 text-purple-600 border border-purple-100 hover:bg-purple-100 cursor-pointer transition-all" data-testid={`time-slot-${i}`}>
                            {slot}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                  if (key === 'book_button') return (
                    <button key="book" onClick={() => navigate(`/session/${selectedSession.id}`)} data-testid="book-session-btn"
                      className="w-full py-3.5 rounded-full text-[11px] tracking-[0.2em] uppercase font-medium transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]"
                      style={{ background: `linear-gradient(135deg, ${buttonBg}, ${buttonBg}dd)`, color: buttonText }}>
                      View Details & Book
                    </button>
                  );
                  return null;
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
};

export default SessionsSection;
