import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSiteSettings } from '../context/SiteSettingsContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { renderMarkdown } from '../lib/renderMarkdown';
import { mergeBlueprintSection } from '../data/blueprintImmersionDefaults';
import { HEADING, BODY, LABEL } from '../lib/designTokens';
import { ChevronDown, ChevronUp, Quote, Sparkles, ArrowLeft } from 'lucide-react';

/* ─── Accent colours ─────────────────────────────────────────── */
const PURPLE      = '#7c3aed';
const PURPLE_DARK = '#1e1230';
const GOLD        = '#D4AF37';

/* ─── Accordion card for a Sacred Key ────────────────────────── */
const SacredKeyCard = ({ keyItem }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-4 px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <span className="text-2xl flex-shrink-0 mt-0.5">{keyItem.emoji}</span>
        <div className="flex-1 min-w-0">
          <h4
            className="text-base font-semibold text-white"
            style={{ ...HEADING, fontSize: '1rem', color: '#fff' }}
          >
            {keyItem.title}
          </h4>
          {keyItem.tagline && (
            <p className="text-xs mt-0.5 italic" style={{ color: GOLD }}>{keyItem.tagline}</p>
          )}
        </div>
        {open
          ? <ChevronUp  size={16} className="flex-shrink-0 mt-1 text-white/50" />
          : <ChevronDown size={16} className="flex-shrink-0 mt-1 text-white/50" />}
      </button>
      {open && keyItem.body && (
        <div
          className="px-5 pb-5 pt-1 text-sm text-white/75 leading-relaxed border-t border-white/10 whitespace-pre-wrap"
          style={{ ...BODY, fontSize: '0.85rem', lineHeight: 1.85 }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(keyItem.body) }}
        />
      )}
    </div>
  );
};

/* ─── Gold divider ────────────────────────────────────────────── */
const GoldLine = ({ className = 'mb-8' }) => (
  <div className={`flex items-center justify-center gap-3 ${className}`}>
    <div className="h-px w-16 opacity-60" style={{ background: GOLD }} />
    <span style={{ color: GOLD, fontSize: '0.6rem' }}>✦</span>
    <div className="h-px w-16 opacity-60" style={{ background: GOLD }} />
  </div>
);

/* ─── Main page ───────────────────────────────────────────────── */
const BlueprintImmersionDetailPage = () => {
  const navigate  = useNavigate();
  const { settings } = useSiteSettings();

  const rawSection = useMemo(() => {
    const sections = settings?.homepage_sections || [];
    return sections.find((s) => s.id === 'blueprint_immersion') || {};
  }, [settings]);

  const config = useMemo(() => mergeBlueprintSection(rawSection), [rawSection]);

  const visibleKeys         = (config.sacred_keys  || []).filter((k) => k.visible !== false);
  const visibleTestimonials = (config.testimonials  || []).filter((t) => t.visible !== false);

  const handleBookNow = () => {
    if (config.cta_link) navigate(config.cta_link);
  };

  return (
    <>
      <Header />

      {/* ══════════════════════════════════════════════════════════
          HERO — full-width dark purple with centred title stack
      ══════════════════════════════════════════════════════════ */}
      <section
        className="relative flex min-h-[60vh] flex-col items-center justify-center px-5 pb-16 pt-28 text-center"
        style={{ background: `linear-gradient(160deg, ${PURPLE_DARK} 0%, #2d1458 60%, #1a0e3a 100%)` }}
      >
        {/* subtle radial glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(ellipse 70% 50% at 50% 40%, ${PURPLE}55 0%, transparent 70%)` }}
        />

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Back button */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-10 transition-colors uppercase tracking-widest"
          >
            <ArrowLeft size={13} /> Back
          </button>

          {/* Kicker */}
          <p
            className="mb-4 text-xs uppercase tracking-[0.25em] font-medium"
            style={{ color: GOLD, ...LABEL }}
          >
            {config.kicker || 'Exclusive 1:1 Personalised Sessions'}
          </p>

          {/* Title */}
          {config.package_title && (
            <h1
              className="mb-5 text-white"
              style={{
                ...HEADING,
                fontSize: 'clamp(2rem, 5vw, 3.2rem)',
                lineHeight: 1.2,
                letterSpacing: '0.03em',
              }}
            >
              {config.package_title}
            </h1>
          )}

          {/* Gold divider */}
          <GoldLine className="mb-6" />

          {/* Subtitle */}
          {config.package_subtitle && (
            <p
              className="text-base italic mb-6"
              style={{ color: GOLD, ...BODY, fontSize: '1.1rem', opacity: 0.9 }}
            >
              {config.package_subtitle}
            </p>
          )}

          {/* Headline */}
          {config.headline && (
            <p
              className="text-sm md:text-base text-white/80 leading-relaxed max-w-2xl mx-auto"
              style={{ ...BODY, lineHeight: 1.9 }}
            >
              {config.headline}
            </p>
          )}

          {/* CTA in hero */}
          {config.cta_text && (
            <button
              type="button"
              onClick={handleBookNow}
              className="mt-10 inline-flex items-center gap-2 px-10 py-4 rounded-full font-semibold tracking-wide uppercase shadow-xl hover:shadow-2xl transition-all hover:scale-[1.03] text-sm"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #b8962e)`, color: '#1a1a1a' }}
            >
              <Sparkles size={16} />
              {config.cta_text}
            </button>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          INTRO BODY
      ══════════════════════════════════════════════════════════ */}
      {config.intro_body && (
        <section className="py-16 px-5 bg-white text-center">
          <div className="max-w-2xl mx-auto">
            <div
              className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap"
              style={{ ...BODY, lineHeight: 2, fontSize: '0.975rem' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(config.intro_body) }}
            />
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          FIVE SACRED KEYS (dark background)
      ══════════════════════════════════════════════════════════ */}
      {config.show_sacred_keys !== false && visibleKeys.length > 0 && (
        <section
          className="py-20 px-5 text-center"
          style={{ background: `linear-gradient(180deg, #1a0e3a 0%, #2d1458 100%)` }}
        >
          <div className="max-w-3xl mx-auto">
            <p className="text-xs uppercase tracking-[0.25em] mb-3 font-medium" style={{ color: GOLD }}>
              What's Inside
            </p>
            <h2
              className="mb-4 text-white"
              style={{ ...HEADING, fontSize: 'clamp(1.4rem, 3vw, 2rem)', letterSpacing: '0.04em' }}
            >
              {config.sacred_keys_heading || 'The Five Sacred Keys'}
            </h2>
            <GoldLine className="mb-10" />
            <div className="space-y-3 text-left">
              {visibleKeys.map((keyItem) => (
                <SacredKeyCard key={keyItem.id} keyItem={keyItem} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════ */}
      {config.show_testimonials !== false && visibleTestimonials.length > 0 && (
        <section className="py-20 px-5 bg-[#faf8ff] text-center">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs uppercase tracking-[0.25em] mb-3 font-medium" style={{ color: PURPLE }}>
              Transformation Stories
            </p>
            <h2
              className="mb-4"
              style={{ ...HEADING, fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: PURPLE_DARK }}
            >
              {config.testimonials_heading || 'What Clients Say'}
            </h2>
            <GoldLine className="mb-10" />
            <div className="grid md:grid-cols-2 gap-5">
              {visibleTestimonials.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-2xl p-6 border border-purple-100/60 shadow-sm relative text-left"
                >
                  <Quote size={22} className="absolute top-4 left-4 opacity-10" style={{ color: PURPLE }} />
                  <p className="text-sm text-gray-600 italic pl-6 leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  {t.author && (
                    <p className="text-xs font-semibold mt-3 pl-6" style={{ color: PURPLE }}>— {t.author}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          BOTTOM CTA BAND
      ══════════════════════════════════════════════════════════ */}
      {config.cta_text && (
        <section
          className="py-20 px-5 text-center"
          style={{ background: `linear-gradient(135deg, ${PURPLE_DARK} 0%, #2d1458 100%)` }}
        >
          <div className="max-w-xl mx-auto">
            <p className="text-white/70 text-sm mb-2" style={{ ...BODY }}>
              Ready to unfold your soul's path?
            </p>
            <h3
              className="text-white mb-8"
              style={{ ...HEADING, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)' }}
            >
              {config.package_title || 'The Divine Iris Blueprint Immersion'}
            </h3>
            <button
              type="button"
              onClick={handleBookNow}
              className="inline-flex items-center gap-2 px-12 py-4 rounded-full font-bold tracking-widest uppercase shadow-2xl hover:shadow-gold transition-all hover:scale-[1.03] text-sm"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #c9a227)`, color: '#1a1a1a' }}
            >
              <Sparkles size={16} />
              {config.cta_text}
            </button>

            {/* Disclaimer */}
            {config.show_disclaimer !== false && config.disclaimer && (
              <p className="mt-8 text-[10px] text-white/30 leading-relaxed max-w-lg mx-auto">
                {config.disclaimer}
              </p>
            )}
          </div>
        </section>
      )}

      <Footer />
      <FloatingButtons />
    </>
  );
};

export default BlueprintImmersionDetailPage;
