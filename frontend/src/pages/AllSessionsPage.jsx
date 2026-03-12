import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Wifi, MapPin, Clock, Quote, ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { useCurrency } from '../context/CurrencyContext';
import { renderMarkdown } from '../lib/renderMarkdown';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function AllSessionsPage() {
  const navigate = useNavigate();
  const { getPrice, formatPrice } = useCurrency();
  const [sessions, setSessions] = useState([]);

  useEffect(() => { loadSessions(); }, []);

  const loadSessions = async () => {
    try {
      const response = await axios.get(`${API}/sessions?visible_only=true`);
      if (response.data && response.data.length > 0) setSessions(response.data);
    } catch (error) { console.log('Error loading sessions'); }
  };

  const modeLabel = (mode) => {
    if (mode === 'offline') return 'In-Person';
    if (mode === 'both') return 'Online & In-Person';
    return 'Online';
  };

  return (
    <>
      <Header />
      <div className="min-h-screen">
        {/* Hero */}
        <div className="relative pt-20 pb-14 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1e1033 0%, #2d1b69 25%, #4c1d95 50%, #6d28d9 75%, #7c3aed 100%)' }}>
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
          <div className="container mx-auto px-6 md:px-8 lg:px-12 relative z-10 text-center">
            <h1 className="text-3xl md:text-4xl text-white mb-3" style={{ fontFamily: "'Cinzel', serif", fontWeight: 700 }}>
              Personal Healing Sessions
            </h1>
            <p className="text-white/50 text-sm max-w-lg mx-auto">
              Individual sessions tailored to your unique healing journey
            </p>
          </div>
        </div>

        {/* Sessions Grid */}
        <div className="container mx-auto px-6 md:px-8 lg:px-12 py-12">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                data-testid={`session-card-${session.id}`}
                onClick={() => navigate(`/session/${session.id}`)}
                className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1"
              >
                {/* Gradient top bar */}
                <div className="h-2" style={{ background: 'linear-gradient(90deg, #7c3aed, #a855f7, #c084fc)' }} />
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                      session.session_mode === 'offline' ? 'bg-teal-50 text-teal-600' :
                      session.session_mode === 'both' ? 'bg-purple-50 text-purple-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {session.session_mode === 'offline' ? <MapPin size={9} /> : <Wifi size={9} />}
                      {modeLabel(session.session_mode)}
                    </span>
                    {session.duration && (
                      <span className="text-[9px] text-gray-400 flex items-center gap-1"><Clock size={9} /> {session.duration}</span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-2 leading-tight group-hover:text-purple-700 transition-colors" style={{ fontFamily: "'Cinzel', serif" }}>
                    {session.title}
                  </h3>
                  <p className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-2">
                    {session.description}
                  </p>

                  {session.testimonial_text && (
                    <div className="bg-purple-50/50 rounded-lg p-3 mb-3 relative">
                      <Quote size={12} className="text-purple-200 absolute top-2 left-2" />
                      <p className="text-[11px] text-gray-600 italic pl-4 line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(session.testimonial_text) }} />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    {formatPrice(getPrice(session)) ? (
                      <span className="text-sm font-bold text-purple-600">{formatPrice(getPrice(session))}</span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Contact for pricing</span>
                    )}
                    <span className="text-xs text-purple-500 flex items-center gap-1 group-hover:gap-2 transition-all font-medium">
                      View Details <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
      <FloatingButtons />
    </>
  );
}

export default AllSessionsPage;
