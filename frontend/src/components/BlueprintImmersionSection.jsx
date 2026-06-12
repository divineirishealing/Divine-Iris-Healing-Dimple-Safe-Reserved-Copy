import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';
import { HEADING, BODY, CONTAINER, GOLD, applySectionStyle } from '../lib/designTokens';
import { renderMarkdown } from '../lib/renderMarkdown';
import { mergeBlueprintSection } from '../data/blueprintImmersionDefaults';
import { Sparkles, ChevronDown, ChevronUp, Quote } from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';

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

const BlueprintPackageModal = ({ open, onOpenChange, config, onBookNow }) => {
  const visibleKeys = (config.sacred_keys || []).filter((k) => k.visible !== false);
  const visibleTestimonials = (config.testimonials || []).filter((t) => t.visible !== false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-purple-100"
        data-testid="blueprint-detail-modal"
      >
        <div className="p-6 sm:p-8">
          {config.package_title && (
            <h3
              className="text-center text-xl md:text-2xl mb-2"
              style={{ ...HEADING, color: '#5b21b6' }}
              data-testid="blueprint-package-title"
            >
              {config.package_title}
            </h3>
          )}
          {config.package_subtitle && (
            <p className="text-center text-sm text-purple-700/90 italic mb-4">{config.package_subtitle}</p>
          )}
          {config.headline && (
            <p
              className="text-center text-base text-gray-700 font-medium leading-relaxed mb-6"
              style={{ ...BODY }}
              data-testid="blueprint-headline"
            >
              {config.headline}
            </p>
          )}

          {config.intro_body && (
            <div
              className="text-center text-sm text-gray-600 leading-relaxed mb-8 whitespace-pre-wrap"
              style={{ ...BODY, lineHeight: 1.85 }}
              data-testid="blueprint-intro"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(config.intro_body) }}
            />
          )}

          {config.show_sacred_keys !== false && visibleKeys.length > 0 && (
            <div className="mb-8">
              <h4
                className="text-center mb-4"
                style={{ ...HEADING, fontSize: '1.2rem', color: '#8B6914' }}
              >
                {config.sacred_keys_heading || 'The Five Sacred Keys'}
              </h4>
              <div className="space-y-3">
                {visibleKeys.map((keyItem) => (
                  <SacredKeyCard key={keyItem.id} keyItem={keyItem} />
                ))}
              </div>
            </div>
          )}

          {config.show_testimonials !== false && visibleTestimonials.length > 0 && (
            <div className="mb-6">
              <h4
                className="text-center mb-4"
                style={{ ...HEADING, fontSize: '1.2rem', color: '#8B6914' }}
              >
                {config.testimonials_heading || 'What Clients Say'}
              </h4>
              <div className="space-y-3">
                {visibleTestimonials.map((t) => (
                  <div
                    key={t.id}
                    className="bg-purple-50/50 rounded-xl p-4 border border-purple-100/60 relative"
                    data-testid={`blueprint-testimonial-${t.id}`}
                  >
                    <Quote size={16} className="text-purple-200 absolute top-3 left-3" />
                    <p className="text-sm text-gray-600 italic pl-6 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                    {t.author && (
                      <p className="text-xs text-purple-700 font-medium mt-2 pl-6">— {t.author}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {config.show_disclaimer !== false && config.disclaimer && (
            <p
              className="text-center text-[10px] text-gray-400 leading-relaxed mb-6"
              data-testid="blueprint-disclaimer"
            >
              {config.disclaimer}
            </p>
          )}

          {config.cta_text && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onBookNow?.();
                }}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold tracking-wide uppercase shadow-lg hover:shadow-xl transition-all"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: '#fff' }}
                data-testid="blueprint-modal-book"
              >
                <Sparkles size={16} />
                {config.cta_text}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ServiceCard = ({ service, sessionMap, sectionConfig, onKnowMore }) => {
  const navigate = useNavigate();
  const { getPrice, getOfferPrice, formatPrice } = useCurrency();

  const session = service.session_id ? sessionMap[service.session_id] : null;
  const title = service.title || session?.title || 'Exclusive Session';
  const image = service.image || session?.image;
  const categoryLabel =
    service.category_label ||
    sectionConfig?.service_category_label ||
    '1:1 Session';
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
    if (service.link) {
      navigate(service.link);
      return;
    }
    onKnowMore?.();
  };

  const handleBookNow = () => {
    if (enrollPath && enrollPath.startsWith('/')) navigate(enrollPath);
    else if (enrollPath) window.location.href = enrollPath;
    else onKnowMore?.();
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
  const [detailOpen, setDetailOpen] = useState(false);
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

  const title = config.title;
  const subtitle = config.subtitle;
  const kicker = config.kicker;

  if (visibleServices.length === 0 && config.show_when_empty === false) return null;

  const handleBookNow = () => {
    if (config.cta_link) navigate(config.cta_link);
  };

  const cardCols =
    visibleServices.length === 1
      ? 'grid max-w-sm mx-auto'
      : visibleServices.length === 2
        ? 'grid md:grid-cols-2 max-w-2xl mx-auto'
        : 'grid md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto';

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
            className="text-center text-sm text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed"
            style={applySectionStyle(config.subtitle_style, { ...BODY })}
          >
            {subtitle}
          </p>
        )}

        <div id="blueprint-pricing" className="scroll-mt-24">
          {visibleServices.length > 0 ? (
            <div className={`${cardCols} gap-6`}>
              {visibleServices.map((svc) => (
                <ServiceCard
                  key={svc.id}
                  service={svc}
                  sessionMap={sessionMap}
                  sectionConfig={config}
                  onKnowMore={() => setDetailOpen(true)}
                />
              ))}
            </div>
          ) : (
            config.show_when_empty !== false && (
              <p className="text-center text-gray-400 text-sm italic">Sessions coming soon.</p>
            )
          )}
        </div>
      </div>

      {detailOpen && (
        <BlueprintPackageModal
          open={detailOpen}
          onOpenChange={setDetailOpen}
          config={config}
          onBookNow={handleBookNow}
        />
      )}
    </section>
  );
};

export default BlueprintImmersionSection;
