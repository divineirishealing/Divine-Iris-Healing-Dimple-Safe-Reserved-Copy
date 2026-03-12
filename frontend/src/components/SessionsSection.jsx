import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronRight, ChevronLeft, Clock, Wifi, MapPin, Quote, Calendar as CalendarIcon } from 'lucide-react';
import { HEADING, BODY, GOLD, CONTAINER, applySectionStyle } from '../lib/designTokens';
import { useCurrency } from '../context/CurrencyContext';
import { renderMarkdown } from '../lib/renderMarkdown';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/* ---- Mini Calendar Component ---- */
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
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return availableSet.has(dateStr);
  };

  const isSelected = (day) => {
    if (!day || !selectedDate) return false;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === selectedDate;
  };

  const isPast = (day) => {
    if (!day) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return new Date(year, month, day) < today;
  };

  return (
    <div data-testid="session-calendar" className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCurrentMonth(new Date(year, month - 1))} className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
        <span className="text-sm font-medium text-white tracking-wide">{monthName}</span>
        <button onClick={() => setCurrentMonth(new Date(year, month + 1))} className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-[9px] text-white/40 font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          const available = isAvailable(day);
          const selected = isSelected(day);
          const past = isPast(day);
          return (
            <button
              key={i}
              disabled={!day || past || !available}
              onClick={() => {
                if (day && available) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  onSelectDate(dateStr);
                }
              }}
              className={`h-8 w-full rounded-md text-[11px] transition-all ${
                !day ? '' :
                selected ? 'bg-white text-purple-900 font-bold shadow-lg' :
                available && !past ? 'bg-white/15 text-white hover:bg-white/30 cursor-pointer font-medium' :
                past ? 'text-white/15' :
                'text-white/25'
              }`}
            >
              {day || ''}
            </button>
          );
        })}
      </div>
      {availableDates.length > 0 && (
        <div className="mt-2 flex items-center gap-2 text-[9px] text-white/50">
          <div className="w-3 h-3 rounded bg-white/15" /> Available dates
        </div>
      )}
    </div>
  );
};

const SessionsSection = ({ sectionConfig }) => {
  const navigate = useNavigate();
  const { getPrice, formatPrice } = useCurrency();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

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
      style={{ background: 'linear-gradient(135deg, #1e1033 0%, #2d1b69 25%, #4c1d95 50%, #6d28d9 75%, #7c3aed 100%)' }}>
      {/* Decorative orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #c084fc, transparent 70%)' }} />

      <div className={`${CONTAINER} relative z-10`}>
        {/* Section Title */}
        <div className="text-center mb-10">
          <h2 style={applySectionStyle(sectionConfig?.title_style, { ...HEADING, color: '#fff', fontStyle: 'italic', fontSize: 'clamp(1.5rem, 3vw, 2rem)' })} data-testid="sessions-section-title">
            {sectionConfig?.title || 'Book Personal Session'}
          </h2>
          {sectionConfig?.subtitle && (
            <p className="text-xs mt-3 max-w-lg mx-auto" style={applySectionStyle(sectionConfig?.subtitle_style, { color: 'rgba(255,255,255,0.6)' })}>{sectionConfig.subtitle}</p>
          )}
          <div className="h-[2px] w-12 mx-auto mt-4" style={{ background: 'linear-gradient(90deg, transparent, #c084fc, transparent)' }} />
        </div>

        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">

          {/* Left — Session List */}
          <aside className="w-full lg:w-[340px] lg:min-w-[340px] flex-shrink-0" data-testid="sessions-list">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
              <div className="max-h-[520px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    data-testid={`session-tab-${session.id}`}
                    onClick={() => { setSelectedSession(session); setSelectedDate(null); }}
                    className={`w-full text-left px-5 py-4 transition-all border-b border-white/5 group ${
                      selectedSession?.id === session.id
                        ? 'bg-white/15 border-l-[3px] border-l-purple-300'
                        : 'border-l-[3px] border-l-transparent hover:bg-white/8'
                    }`}
                  >
                    <span className={`block text-[13px] leading-snug mb-1 ${
                      selectedSession?.id === session.id ? 'text-white font-semibold' : 'text-white/80'
                    }`}
                      style={session.title_style ? applySectionStyle(session.title_style, {}) : { fontFamily: "'Lato', sans-serif" }}
                    >
                      {session.title}
                    </span>
                    <div className="flex items-center gap-2 text-white/40 text-[10px]">
                      <span className="flex items-center gap-1">{modeIcon(session.session_mode)} {modeLabel(session.session_mode)}</span>
                      {session.duration && <span className="flex items-center gap-1"><Clock size={10} /> {session.duration}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Right — Details Panel */}
          <main className="flex-1 min-w-0">
            {!selectedSession ? (
              /* Empty state — inviting gradient card */
              <div className="h-full flex items-center justify-center min-h-[400px]">
                <div className="text-center px-8">
                  <div className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(192,132,252,0.3), rgba(167,139,250,0.15))' }}>
                    <CalendarIcon size={32} className="text-purple-200" />
                  </div>
                  <h3 className="text-white/90 text-lg font-light mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Choose Your Healing Journey
                  </h3>
                  <p className="text-white/40 text-sm max-w-xs mx-auto leading-relaxed">
                    Select a session from the left to explore details, read testimonials, and book your personal appointment.
                  </p>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in space-y-6" data-testid={`session-detail-${selectedSession.id}`}>
                {/* Session Header */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] px-3 py-1 rounded-full font-medium flex items-center gap-1 ${
                      selectedSession.session_mode === 'offline' ? 'bg-teal-500/20 text-teal-200' :
                      selectedSession.session_mode === 'both' ? 'bg-purple-300/20 text-purple-200' :
                      'bg-blue-400/20 text-blue-200'
                    }`}>
                      {modeIcon(selectedSession.session_mode)} {modeLabel(selectedSession.session_mode)}
                    </span>
                    {selectedSession.duration && (
                      <span className="text-[10px] px-3 py-1 rounded-full bg-white/10 text-white/60 flex items-center gap-1">
                        <Clock size={10} /> {selectedSession.duration}
                      </span>
                    )}
                  </div>
                  <h3 className="text-white text-xl mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, letterSpacing: '0.02em' }}
                    data-testid="selected-session-title">
                    {selectedSession.title}
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed max-w-[600px]"
                    style={selectedSession.description_style ? applySectionStyle(selectedSession.description_style, {}) : { fontFamily: "'Lato', sans-serif", lineHeight: '1.85' }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedSession.description) }}
                    data-testid="selected-session-description"
                  />
                </div>

                {/* Testimonial */}
                {selectedSession.testimonial_text && (
                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 relative" data-testid="session-testimonial">
                    <Quote size={20} className="text-purple-300/40 absolute top-3 left-3" />
                    <p className="text-white/70 text-[13px] leading-relaxed italic pl-6"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedSession.testimonial_text) }} />
                  </div>
                )}

                {/* Pricing */}
                <div>
                  {formatPrice(getPrice(selectedSession)) ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold" style={{ color: '#c084fc' }}>{formatPrice(getPrice(selectedSession))}</span>
                      <span className="text-white/40 text-xs">per session</span>
                    </div>
                  ) : (
                    <span className="text-sm text-white/50 italic">Contact for pricing</span>
                  )}
                </div>

                {/* Calendar + Time Slots */}
                <div className="grid md:grid-cols-2 gap-5">
                  <MiniCalendar
                    availableDates={selectedSession.available_dates || []}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                  <div className="space-y-4">
                    {(selectedSession.time_slots && selectedSession.time_slots.length > 0) && (
                      <div>
                        <p className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Available Times</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedSession.time_slots.map((slot, i) => (
                            <span key={i} className="px-3 py-1.5 rounded-full text-xs bg-white/10 text-white/80 border border-white/10 hover:bg-white/20 cursor-pointer transition-all" data-testid={`time-slot-${i}`}>
                              {slot}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => navigate(`/session/${selectedSession.id}`)}
                      data-testid="book-session-btn"
                      className="w-full py-3.5 rounded-full text-[11px] tracking-[0.2em] uppercase font-medium transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff' }}
                    >
                      View Details & Book
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
};

export default SessionsSection;
