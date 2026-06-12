import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSiteSettings } from '../context/SiteSettingsContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { renderMarkdown } from '../lib/renderMarkdown';
import { mergeBlueprintSection } from '../data/blueprintImmersionDefaults';
import { HEADING, BODY, CONTAINER } from '../lib/designTokens';
import { ChevronDown, ChevronUp, Quote, Sparkles, ArrowLeft } from 'lucide-react';

const SacredKeyCard = ({ keyItem }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-purple-100/80 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-purple-50/40 transition-colors"
      >
        <span className="text-2xl flex-shrink-0">{keyItem.emoji}</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900" style={{ ...BODY, fontWeight: 600 }}>
            {keyItem.title}
          </h4>
          {keyItem.tagline && (
            <p className="text-xs text-purple-700/80 mt-0.5 italic">{keyItem.tagline}</p>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0 mt-1" />
               : <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-1" />}
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

const BlueprintImmersionDetailPage = () => {
  const navigate = useNavigate();
  const { settings } = useSiteSettings();

  const rawSection = useMemo(() => {
    const sections = settings?.homepage_sections || [];
    return sections.find((s) => s.id === 'blueprint_immersion') || {};
  }, [settings]);

  const config = useMemo(() => mergeBlueprintSection(rawSection), [rawSection]);

  const visibleKeys = (config.sacred_keys || []).filter((k) => k.visible !== false);
  const visibleTestimonials = (config.testimonials || []).filter((t) => t.visible !== false);

  const handleBookNow = () => {
    if (config.cta_link) navigate(config.cta_link);
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-[#f3edff] to-white pb-20">
        {/* Hero */}
        <div className="py-16 px-4 text-center max-w-3xl mx-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 mb-8 transition-colors"
          >
            <ArrowLeft size={15} /> Back
          </button>

          {config.package_title && (
            <h1
              className="mb-3"
              style={{ ...HEADING, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: '#5b21b6' }}
            >
              {config.package_title}
            </h1>
          )}
          {config.package_subtitle && (
            <p className="text-base text-purple-700/80 italic mb-5">{config.package_subtitle}</p>
          )}
          {config.headline && (
            <p
              className="text-base text-gray-700 font-medium leading-relaxed max-w-2xl mx-auto"
              style={{ ...BODY, fontSize: '1.05rem' }}
            >
              {config.headline}
            </p>
          )}
        </div>

        <div className={CONTAINER}>
          {/* Intro body */}
          {config.intro_body && (
            <div
              className="text-center text-sm text-gray-600 leading-relaxed mb-14 whitespace-pre-wrap max-w-2xl mx-auto"
              style={{ ...BODY, lineHeight: 1.9 }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(config.intro_body) }}
            />
          )}

          {/* Five Sacred Keys */}
          {config.show_sacred_keys !== false && visibleKeys.length > 0 && (
            <div className="max-w-3xl mx-auto mb-16">
              <h2
                className="text-center mb-8"
                style={{ ...HEADING, fontSize: 'clamp(1.25rem, 2.5vw, 1.6rem)', color: '#8B6914' }}
              >
                {config.sacred_keys_heading || 'The Five Sacred Keys'}
              </h2>
              <div className="space-y-3">
                {visibleKeys.map((keyItem) => (
                  <SacredKeyCard key={keyItem.id} keyItem={keyItem} />
                ))}
              </div>
            </div>
          )}

          {/* Testimonials */}
          {config.show_testimonials !== false && visibleTestimonials.length > 0 && (
            <div className="max-w-5xl mx-auto mb-14">
              <h2
                className="text-center mb-8"
                style={{ ...HEADING, fontSize: 'clamp(1.25rem, 2.5vw, 1.6rem)', color: '#8B6914' }}
              >
                {config.testimonials_heading || 'What Clients Say'}
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {visibleTestimonials.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white rounded-xl p-5 border border-purple-100/60 shadow-sm relative"
                  >
                    <Quote size={18} className="text-purple-200 absolute top-3 left-3" />
                    <p className="text-sm text-gray-600 italic pl-6 leading-relaxed">
                      &ldquo;{t.quote}&rdquo;
                    </p>
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
            <p className="max-w-3xl mx-auto text-center text-[10px] text-gray-400 leading-relaxed mb-10">
              {config.disclaimer}
            </p>
          )}

          {/* CTA */}
          {config.cta_text && (
            <div className="text-center">
              <button
                type="button"
                onClick={handleBookNow}
                className="inline-flex items-center gap-2 px-10 py-4 rounded-full font-semibold tracking-wide uppercase shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] text-sm"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: '#fff' }}
              >
                <Sparkles size={16} />
                {config.cta_text}
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
};

export default BlueprintImmersionDetailPage;
