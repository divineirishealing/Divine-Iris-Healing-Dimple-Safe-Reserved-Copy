import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const IRIS_IMAGE = 'https://divineirishealing.com/assets/images/personal_sessions/1772606496_19c12e333a98b4e53349.png';

function ServicesPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await axios.get(`${API}/sessions?visible_only=true`);
      setSessions(response.data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Thin gold divider line under header */}
      <div className="pt-16">
        <div className="h-[3px] bg-[#D4AF37] w-12 mx-auto"></div>
      </div>

      {/* Main two-column layout */}
      <div className="max-w-[1100px] mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row">

          {/* Left Sidebar - Session Index List */}
          <aside
            data-testid="services-sidebar"
            className="w-full md:w-[340px] md:min-w-[340px] border border-gray-200 rounded-sm bg-white md:mr-10 mb-8 md:mb-0"
          >
            {sessions.map((session) => (
              <button
                key={session.id}
                data-testid={`service-tab-${session.id}`}
                onClick={() => setSelectedSession(session)}
                className={`w-full flex items-center justify-between px-5 py-[14px] text-left transition-all border-b border-gray-100 group ${
                  selectedSession?.id === session.id
                    ? 'border-l-[3px] border-l-[#D4AF37] bg-white'
                    : 'border-l-[3px] border-l-transparent hover:bg-gray-50'
                }`}
              >
                <span
                  className={`text-[13.5px] leading-snug ${
                    selectedSession?.id === session.id
                      ? 'text-gray-900 font-medium'
                      : 'text-gray-700'
                  }`}
                  style={{ fontFamily: "'Lato', sans-serif" }}
                >
                  {session.title}
                </span>
                <ChevronRight
                  size={15}
                  className={`flex-shrink-0 ml-4 ${
                    selectedSession?.id === session.id
                      ? 'text-[#D4AF37]'
                      : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
              </button>
            ))}
          </aside>

          {/* Right Content Area */}
          <main data-testid="service-detail" className="flex-1">

            {/* Fixed header - "Claim your Personal space" iris image */}
            <div className="mb-10">
              <img
                src={IRIS_IMAGE}
                alt="Claim your Personal space"
                className="w-full max-w-[550px] h-auto object-contain"
              />
            </div>

            {/* Session details - shown below the header image when clicked */}
            {selectedSession && (
              <div className="animate-fade-in">
                {/* Session title - UPPERCASE */}
                <h3
                  data-testid="service-detail-title"
                  className="mb-6"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontWeight: 400,
                    fontSize: '22px',
                    color: '#1a1a1a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {selectedSession.title}
                </h3>

                {/* Description */}
                <p
                  className="mb-8 max-w-[650px]"
                  style={{
                    fontFamily: "'Lato', sans-serif",
                    fontSize: '14.5px',
                    color: '#555',
                    lineHeight: '1.85',
                  }}
                >
                  {selectedSession.description}
                </p>

                {/* Pricing + Book Now */}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  {(selectedSession.price_usd > 0 || selectedSession.price_inr > 0) ? (
                    <div className="flex items-baseline gap-3">
                      {selectedSession.price_usd > 0 && (
                        <span className="text-2xl font-bold text-[#D4AF37]">${selectedSession.price_usd}</span>
                      )}
                      {selectedSession.price_inr > 0 && selectedSession.price_usd > 0 && (
                        <span className="text-gray-400">|</span>
                      )}
                      {selectedSession.price_inr > 0 && (
                        <span className="text-lg text-gray-600">&#8377;{selectedSession.price_inr}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500 italic">Contact for pricing</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => navigate(`/session/${selectedSession.id}`)}
                    data-testid="view-details-book-btn"
                    className="bg-[#1a1a1a] hover:bg-[#333] text-white px-10 py-4 rounded-full text-[11px] tracking-[0.2em] transition-all duration-300 uppercase font-medium"
                  >
                    View Details & Book
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <Footer />
      <FloatingButtons />
    </div>
  );
}

export default ServicesPage;
