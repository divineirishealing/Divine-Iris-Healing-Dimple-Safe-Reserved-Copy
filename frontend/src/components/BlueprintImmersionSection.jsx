import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';
import { HEADING, BODY, CONTAINER, GOLD, applySectionStyle } from '../lib/designTokens';
import { Sparkles } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ServiceCard = ({ service, sessionMap }) => {
  const navigate = useNavigate();
  const { getPrice, getOfferPrice, formatPrice } = useCurrency();

  const session = service.session_id ? sessionMap[service.session_id] : null;
  const title = service.title || session?.title || 'Exclusive Session';
  const description = service.description || session?.description || '';
  const image = service.image || session?.image;
  const detailPath = service.link || (session ? `/session/${session.id}` : null);
  const enrollPath = session ? `/enroll/session/${session.id}` : service.enroll_link || service.link;

  const offerPrc = session ? getOfferPrice(session) : 0;
  const originalPrc = session ? getPrice(session) : 0;
  const showOffer = offerPrc > 0 && offerPrc < originalPrc;

  return (
    <div
      data-testid={`blueprint-service-${service.id}`}
      className="group bg-white rounded-xl overflow-hidden shadow-lg transition-all duration-300 border border-gray-100 flex flex-col hover:shadow-2xl"
    >
      <div
        className="relative h-48 overflow-hidden cursor-pointer"
        onClick={() => detailPath && navigate(detailPath)}
      >
        <img
          src={resolveImageUrl(image)}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&h=400&fit=crop';
          }}
        />
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-purple-600 text-white w-fit flex items-center gap-1">
            <Sparkles size={10} /> Exclusive
          </span>
        </div>
        {session?.duration && (
          <div className="absolute bottom-3 right-3">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-black/50 text-white backdrop-blur-sm">
              {session.duration}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <p className="text-[#D4AF37] text-[10px] tracking-wider mb-0.5 uppercase">Personalized Session</p>
        <h3
          className="text-base font-semibold text-gray-900 leading-tight cursor-pointer mb-1.5"
          style={{ ...BODY, fontWeight: 600, fontSize: '0.95rem' }}
          onClick={() => detailPath && navigate(detailPath)}
        >
          {title}
        </h3>
        {description && (
          <p
            className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-3 flex-1"
            style={{ ...BODY, fontSize: '0.8rem' }}
          >
            {description.replace(/<[^>]+>/g, '').slice(0, 200)}
          </p>
        )}

        {session && (originalPrc > 0 || offerPrc > 0) && (
          <div className="mb-3">
            {showOffer && session.offer_text && (
              <span className="inline-block text-[8px] px-2 py-0.5 rounded-full font-bold mb-1 bg-amber-100 text-amber-800">
                {session.offer_text}
              </span>
            )}
            <div className="flex items-baseline gap-2">
              {showOffer ? (
                <>
                  <span className="text-lg font-bold text-purple-700">{formatPrice(offerPrc)}</span>
                  <span className="text-sm text-gray-400 line-through">{formatPrice(originalPrc)}</span>
                </>
              ) : (
                <span className="text-lg font-bold text-purple-700">{formatPrice(originalPrc)}</span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-auto pt-2">
          {detailPath && (
            <button
              onClick={() => navigate(detailPath)}
              className="flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold tracking-wide uppercase border-2 border-purple-600 text-purple-700 hover:bg-purple-50 transition-colors"
              data-testid={`blueprint-know-more-${service.id}`}
            >
              {service.cta_label || 'Know More'}
            </button>
          )}
          {enrollPath && (
            <button
              onClick={() => navigate(enrollPath)}
              className="flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold tracking-wide uppercase text-white transition-colors"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)' }}
              data-testid={`blueprint-enroll-${service.id}`}
            >
              {service.enroll_label || 'Book Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const BlueprintImmersionSection = ({ sectionConfig = {} }) => {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    axios
      .get(`${API}/sessions`)
      .then((r) => setSessions(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSessions([]));
  }, []);

  const sessionMap = useMemo(
    () => Object.fromEntries(sessions.map((s) => [s.id, s])),
    [sessions]
  );

  const visibleServices = (sectionConfig.services || []).filter((s) => s.visible !== false);

  const title = sectionConfig.title || 'The Divine Iris Blueprint Immersion';
  const subtitle =
    sectionConfig.subtitle || "Unfolding Your Soul's Path to Ultimate Alignment & Healing";
  const kicker = sectionConfig.kicker || 'Exclusive Personalized Sessions';

  if (visibleServices.length === 0 && sectionConfig.show_when_empty === false) return null;

  return (
    <section id="blueprint-immersion" data-testid="blueprint-immersion-section" className="py-12">
      <div className={CONTAINER}>
        {sectionConfig.show_kicker !== false && kicker && (
          <p
            className="text-center text-[10px] tracking-[0.25em] uppercase mb-2"
            style={{ color: GOLD, fontFamily: "'Lato', sans-serif", letterSpacing: '0.2em' }}
          >
            {kicker}
          </p>
        )}
        {sectionConfig.show_title !== false && (
          <h2
            className="text-center mb-3 max-w-3xl mx-auto"
            style={applySectionStyle(sectionConfig.title_style, {
              ...HEADING,
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            })}
          >
            {title}
          </h2>
        )}
        {sectionConfig.show_subtitle !== false && subtitle && (
          <p
            className="text-center text-sm text-gray-500 mb-12 max-w-2xl mx-auto leading-relaxed"
            style={applySectionStyle(sectionConfig.subtitle_style, { ...BODY })}
          >
            {subtitle}
          </p>
        )}
        {!subtitle && <div className="mb-12" />}

        {visibleServices.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {visibleServices.map((svc) => (
              <ServiceCard key={svc.id} service={svc} sessionMap={sessionMap} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 text-sm italic">Sessions coming soon.</p>
        )}
      </div>
    </section>
  );
};

export default BlueprintImmersionSection;
