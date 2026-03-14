import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';
import { useToast } from '../hooks/use-toast';
import { HEADING, BODY, CONTAINER, applySectionStyle } from '../lib/designTokens';
import { UpcomingCard } from './UpcomingProgramsSection';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* ── Simple card for non-replicated flagship programs ── */
const SimpleFlagshipCard = ({ program }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySubmitted, setNotifySubmitted] = useState(false);

  const enrollStatus = program.enrollment_status || (program.enrollment_open !== false ? 'open' : 'closed');

  const handleExpressInterest = async () => {
    if (!notifyEmail) return;
    try {
      await axios.post(`${API}/notify-me`, { email: notifyEmail, program_id: program.id, program_title: program.title });
      setNotifySubmitted(true);
      toast({ title: 'Subscribed!', description: "We'll notify you when enrollment opens." });
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
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
        <h3 className="text-base font-semibold text-gray-900 mb-1.5 leading-tight cursor-pointer" style={{ ...BODY, fontWeight: 600, fontSize: '0.95rem' }}
          onClick={() => navigate(`/program/${program.id}`)}>{program.title}</h3>
        <p className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-2 flex-1" style={{ ...BODY, fontSize: '0.8rem' }}>{program.description}</p>

        {/* Coming Soon — Express Your Interest */}
        {enrollStatus === 'coming_soon' && (
          <div className="mb-2">
            {!notifySubmitted ? (
              <div data-testid={`express-interest-form-${program.id}`}>
                <p className="text-xs text-blue-600 font-medium mb-1.5">Get notified when enrollment opens</p>
                <div className="flex gap-1.5">
                  <input type="email" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)}
                    placeholder="Your email" className="flex-1 border border-gray-200 rounded-full px-3 py-1.5 text-[11px] focus:outline-none focus:border-blue-400" />
                  <button onClick={handleExpressInterest} data-testid={`express-interest-btn-${program.id}`}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-full text-[10px] tracking-wider uppercase font-medium transition-colors">
                    Express Interest
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-green-600 font-medium py-1" data-testid={`express-interest-success-${program.id}`}>
                You'll be notified when enrollment opens!
              </p>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="border-t pt-3 mt-auto">
          {enrollStatus === 'coming_soon' ? (
            <button onClick={() => navigate(`/program/${program.id}`)}
              data-testid={`know-more-btn-${program.id}`}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium">
              Know More
            </button>
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
    <section id="programs" data-testid="programs-section" className="py-12 bg-white">
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
