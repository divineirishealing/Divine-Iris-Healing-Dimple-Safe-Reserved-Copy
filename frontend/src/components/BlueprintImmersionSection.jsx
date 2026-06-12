import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';
import { HEADING, BODY, CONTAINER, GOLD, applySectionStyle } from '../lib/designTokens';
import { renderMarkdown } from '../lib/renderMarkdown';
import { mergeBlueprintSection } from '../data/blueprintImmersionDefaults';
import { Sparkles, ChevronDown, ChevronUp, Quote } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SacredKeyCard = ({ keyItem }) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="bg-white rounded-xl border border-purple-100/80 shadow-sm overflow-hidden"
      data-testid={`sacred-key-${keyItem.id}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-purple-50/40 transition-colors"
      >
        <span className="text-2xl flex-shrink-0" aria-hidden>{keyItem.emoji}</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900" style={{ ...BODY, fontWeight: 600 }}>
            {keyItem.title}
          </h4>
          {keyItem.tagline && (
            <p className="text-xs text-purple-700/80 mt-0.5 italic">{keyItem.tagline}</p>
          )}
        </div>
        {open ? (
          <ChevronUp size={16} className="text-gray-400 flex-shrink-0 mt-1" />
        ) : (
          <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-1" />
        )}
      </button>
      {open && keyItem.body && (
        <div
          className="px-4 pb-4 pt-0 text-xs text-gray-600 leading-relaxed border-t border-purple-50 whitespace-pre-wrap"
          style={{ ...BODY, fontSize: '0.8rem', lineHeight: 1.75 }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(keyItem.body) }}
        />
      )}
    </div>
  );
};

const ServiceCard = ({ service, sessionMap, sectionConfig }) => {
  const navigate = useNavigate();
  const { getPrice, getOfferPrice, formatPrice } = useCurrency();

  const session = service.session_id ? sessionMap[service.session_id] : null;
  const title = service.title || session?.title || 'Exclusive Session';
  const description = service.description || session?.description || '';
  const image = service.image || session?.image;
  const categoryLabel =
    service.category_label ||
    sectionConfig?.service_category_label ||
    '1:1 Session';
  const detailPath = service.link || (session ? `/session/${session.id}` : null);
  const enrollPath =
    service.enroll_link ||
    (session ? `/enroll/session/${session.id}` : null) ||
    sectionConfig?.cta_link ||
    null;

  const offerPrc = session ? getOfferPrice(session) : 0;
  const originalPrc = session ? getPrice(session) : 0;
  const showOffer = offerPrc > 0 && offerPrc < originalPrc;
  const features = Array.isArray(service.features)
    ? service.features
    : (service.features || '').split('\n').map((s) => s.trim()).filter(Boolean);

  const handleKnowMore = () => {
    if (detailPath) navigate(detailPath);
    else {
      const el = document.getElementById('blueprint-package-detail');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleBookNow = () => {
    if (enrollPath && enrollPath.startsWith('/')) navigate(enrollPath);
    else if (enrollPath) window.location.href = enrollPath;
    else {
      const el = document.getElementById('blueprint-pricing');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      data-testid={`blueprint-service-${service.id}`}
      className="group bg-white rounded-xl overflow-hidden shadow-lg transition-all duration-300 border border-gray-100 flex flex-col hover:shadow-2xl"
    >
      <div
        className="relative h-48 overflow-hidden cursor-pointer"
        onClick={handleKnowMore}
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
        <p className="text-[#D4AF37] text-[10px] tracking-wider mb-0.5 uppercase">{categoryLabel}</p>
        <h3
          className="text-base font-semibold text-gray-900 leading-tight cursor-pointer mb-1.5"
          style={{ ...BODY, fontWeight: 600, fontSize: '0.95rem' }}
          onClick={handleKnowMore}
        >
          {title}
        </h3>
        {description && (
          <p className="text-gray-500 text-xs leading-relaxed mb-2 line-clamp-3 flex-1" style={{ ...BODY, fontSize: '0.8rem' }}>
            {description.replace(/<[^>]+>/g, '')}
          </p>
        )}
        {features.length > 0 && (
          <ul className="text-[11px] text-gray-500 space-y-1 mb-3">
            {features.slice(0, 3).map((f, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-purple-500">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mb-3 mt-auto">
          {service.price_label && !session && (
            <span className="text-xl font-bold text-purple-700">{service.price_label}</span>
          )}
          {session && (originalPrc > 0 || offerPrc > 0) && (
            <div>
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
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleKnowMore}
            className="flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold tracking-wide uppercase border-2 border-purple-600 text-purple-700 hover:bg-purple-50 transition-colors"
            data-testid={`blueprint-know-more-${service.id}`}
          >
            {service.cta_label || 'Know More'}
          </button>
          <button
            type="button"
            onClick={handleBookNow}
            className="flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold tracking-wide uppercase text-white transition-colors hover:opacity-95"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)' }}
            data-testid={`blueprint-enroll-${service.id}`}
          >
            {service.enroll_label || 'Book Now'}
          </button>
        </div>
      </div>
    </div>
  );
};

const BlueprintImmersionSection = ({ sectionConfig = {} }) => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const config = useMemo(() => mergeBlueprintSection(sectionConfig), [sectionConfig]);

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

  const visibleServices = (config.services || []).filter((s) => s.visible !== false);
  const visibleKeys = (config.sacred_keys || []).filter((k) => k.visible !== false);
  const visibleTestimonials = (config.testimonials || []).filter((t) => t.visible !== false);

  const title = config.title;
  const subtitle = config.subtitle;
  const kicker = config.kicker;

  if (visibleServices.length === 0 && config.show_when_empty === false) return null;

  const handleCta = () => {
    if (config.cta_link) navigate(config.cta_link);
    else {
      const el = document.getElementById('blueprint-pricing');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section id="blueprint-immersion" data-testid="blueprint-immersion-section" className="py-12">
      <div className={CONTAINER}>
        {config.show_kicker !== false && kicker && (
          <p
            className="text-center text-[10px] tracking-[0.25em] uppercase mb-2"
            style={{ color: GOLD, fontFamily: "'Lato', sans-serif", letterSpacing: '0.2em' }}
          >
            {kicker}
          </p>
        )}
        {config.show_title !== false && (
          <h2
            className="text-center mb-3 max-w-3xl mx-auto"
            style={applySectionStyle(config.title_style, {
              ...HEADING,
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            })}
          >
            {title}
          </h2>
        )}
        {config.show_subtitle !== false && subtitle && (
          <p
            className="text-center text-sm text-gray-500 mb-8 max-w-2xl mx-auto leading-relaxed"
            style={applySectionStyle(config.subtitle_style, { ...BODY })}
          >
            {subtitle}
          </p>
        )}

        {/* Package header */}
        <div id="blueprint-package-detail" className="max-w-3xl mx-auto text-center mb-10 scroll-mt-24">
          {config.package_title && (
            <h3
              className="text-xl md:text-2xl mb-2"
              style={{ ...HEADING, fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', color: '#5b21b6' }}
              data-testid="blueprint-package-title"
            >
              {config.package_title}
            </h3>
          )}
          {config.package_subtitle && (
            <p className="text-sm text-purple-700/90 italic mb-4">{config.package_subtitle}</p>
          )}
          {config.headline && (
            <p
              className="text-base text-gray-700 font-medium leading-relaxed px-4"
              style={{ ...BODY, fontSize: '1rem' }}
              data-testid="blueprint-headline"
            >
              {config.headline}
            </p>
          )}
        </div>

        {/* Intro */}
        {config.intro_body && (
          <div
            className="max-w-2xl mx-auto text-center text-sm text-gray-600 leading-relaxed mb-12 whitespace-pre-wrap space-y-4"
            style={{ ...BODY, lineHeight: 1.85 }}
            data-testid="blueprint-intro"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(config.intro_body) }}
          />
        )}

        {/* Five Sacred Keys */}
        {config.show_sacred_keys !== false && visibleKeys.length > 0 && (
          <div className="max-w-3xl mx-auto mb-14">
            <h3
              className="text-center mb-6"
              style={{ ...HEADING, fontSize: '1.35rem', color: '#8B6914' }}
            >
              {config.sacred_keys_heading || 'The Five Sacred Keys'}
            </h3>
            <div className="space-y-3">
              {visibleKeys.map((keyItem) => (
                <SacredKeyCard key={keyItem.id} keyItem={keyItem} />
              ))}
            </div>
          </div>
        )}

        {/* Pricing / services */}
        <div id="blueprint-pricing" className="scroll-mt-24">
          {visibleServices.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-14">
              {visibleServices.map((svc) => (
                <ServiceCard key={svc.id} service={svc} sessionMap={sessionMap} sectionConfig={config} />
              ))}
            </div>
          ) : (
            config.show_when_empty !== false && (
              <p className="text-center text-gray-400 text-sm italic mb-14">Sessions coming soon.</p>
            )
          )}
        </div>

        {/* Testimonials */}
        {config.show_testimonials !== false && visibleTestimonials.length > 0 && (
          <div className="max-w-5xl mx-auto mb-12">
            <h3
              className="text-center mb-6"
              style={{ ...HEADING, fontSize: '1.35rem', color: '#8B6914' }}
            >
              {config.testimonials_heading || 'What Clients Say'}
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {visibleTestimonials.map((t) => (
                <div
                  key={t.id}
                  className="bg-white/80 rounded-xl p-5 border border-purple-100/60 relative"
                  data-testid={`blueprint-testimonial-${t.id}`}
                >
                  <Quote size={18} className="text-purple-200 absolute top-3 left-3" />
                  <p className="text-sm text-gray-600 italic pl-6 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  {t.author && (
                    <p className="text-xs text-purple-700 font-medium mt-2 pl-6">— {t.author}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        {config.show_disclaimer !== false && config.disclaimer && (
          <p
            className="max-w-3xl mx-auto text-center text-[10px] text-gray-400 leading-relaxed mb-8"
            data-testid="blueprint-disclaimer"
          >
            {config.disclaimer}
          </p>
        )}

        {/* CTA */}
        {config.cta_text && (
          <div className="text-center">
            <button
              type="button"
              onClick={handleCta}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold tracking-wide uppercase text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #f5d77a, #D4AF37)', color: '#3d2200' }}
              data-testid="blueprint-cta"
            >
              <Sparkles size={16} />
              {config.cta_text}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default BlueprintImmersionSection;
