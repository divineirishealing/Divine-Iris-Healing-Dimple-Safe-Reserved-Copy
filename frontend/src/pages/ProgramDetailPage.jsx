import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { resolveImageUrl } from '../lib/imageUtils';
import { renderMarkdown } from '../lib/renderMarkdown';
import { useCurrency } from '../context/CurrencyContext';
import { HEADING, SUBTITLE, BODY, GOLD, LABEL, CONTAINER, NARROW, WIDE, SECTION_PY } from '../lib/designTokens';
import {
  SoulfulWrittenCard,
  SoulfulUniformVideoCard,
  SoulfulTestimonialFull,
  templateTestimonialHasPhotos,
} from '../components/SoulfulTestimonialCard';
import { applyWrittenQuoteStyle } from '../lib/transformationsWrittenQuoteStyle';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { useSeoPage } from '../context/SeoPageContext';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ExpressInterestInline = ({ programId, programTitle, accent }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    try {
      await axios.post(`${API}/notify-me`, { email, program_id: programId, program_title: programTitle });
      setSubmitted(true);
    } catch {}
  };

  if (submitted) return <p className="text-green-600 text-sm font-medium" data-testid="express-interest-success">You'll be notified when enrollment opens!</p>;

  if (!showForm) {
    return (
      <button data-testid="express-interest-btn" onClick={() => setShowForm(true)}
        className="text-white px-10 py-3 text-xs tracking-[0.2em] uppercase transition-colors hover:opacity-90" style={{ background: accent }}>
        Express Your Interest
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md" data-testid="express-interest-form">
      <p className="text-sm text-gray-600">Enter your email to get notified when enrollment opens</p>
      <div className="flex gap-2 w-full">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email"
          className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
        <button onClick={handleSubmit} data-testid="express-interest-submit"
          className="text-white px-6 py-2.5 text-xs tracking-[0.15em] uppercase transition-colors hover:opacity-90 rounded-full" style={{ background: accent }}>
          Submit
        </button>
      </div>
    </div>
  );
};

const applyStyle = (styleObj, defaults = {}) => {
  if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
  return {
    ...defaults,
    ...(styleObj.font_family && { fontFamily: styleObj.font_family }),
    ...(styleObj.font_size && { fontSize: styleObj.font_size }),
    ...(styleObj.font_color && { color: styleObj.font_color }),
    ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }),
    ...(styleObj.font_style && { fontStyle: styleObj.font_style }),
    ...(styleObj.text_align && { textAlign: styleObj.text_align }),
  };
};

const getDefaultSections = (program) => [
  { id: 'journey', section_type: 'journey', is_enabled: true, order: 0, title: 'The Journey', subtitle: '', body: program.description || '', image_url: '' },
  { id: 'who_for', section_type: 'who_for', is_enabled: true, order: 1, title: 'Who It Is For?', subtitle: 'A Sacred Invitation for those who resonate', body: '', image_url: '' },
  { id: 'experience', section_type: 'experience', is_enabled: true, order: 2, title: 'Your Experience', subtitle: '', body: '', image_url: '' },
  { id: 'why_now', section_type: 'why_now', is_enabled: true, order: 3, title: 'Why You Need This Now?', subtitle: '', body: '', image_url: '' },
];

function stripForMeta(htmlOrText) {
  if (!htmlOrText) return '';
  return String(htmlOrText)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 165);
}

/** YYYY-MM-DD → readable; otherwise return as stored. */
function formatProgramDateDisplay(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  const d = t.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const dt = new Date(`${d}T12:00:00`);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    }
  }
  return t;
}

function ProgramDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const promoFromQuery = (searchParams.get('promo') || '').trim();
  const { setPageSeo, clearPageSeo } = useSeoPage();
  const { getPrice, getOfferPrice, symbol } = useCurrency();

  const enrollProgramQuery = (tierIdx) => {
    const q = new URLSearchParams();
    if (tierIdx !== undefined && tierIdx !== null && tierIdx !== '') q.set('tier', String(tierIdx));
    if (promoFromQuery) q.set('promo', promoFromQuery);
    const s = q.toString();
    return s ? `?${s}` : '';
  };
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [testimonials, setTestimonials] = useState([]);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedEmbed, setSelectedEmbed]       = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadData();
  }, [id]);

  useEffect(() => {
    if (!program?.title) return;
    const desc = stripForMeta(program.description) || stripForMeta(program.category);
    setPageSeo({
      title: program.title,
      description: desc || undefined,
      ogImage: program.image ? resolveImageUrl(program.image) : undefined,
    });
    return () => clearPageSeo();
  }, [program, setPageSeo, clearPageSeo]);

  const loadData = async () => {
    try {
      const [progRes, settingsRes] = await Promise.all([
        axios.get(`${API}/programs/${id}`),
        axios.get(`${API}/settings`),
      ]);
      setProgram(progRes.data);
      setSettings(settingsRes.data);

      // Fetch by program_id AND by program_name (title match), then deduplicate
      const prog = progRes.data;
      const [byId, byName] = await Promise.all([
        axios.get(`${API}/testimonials?program_id=${id}&visible_only=true`),
        prog?.title
          ? axios.get(`${API}/testimonials?program_name=${encodeURIComponent(prog.title)}&visible_only=true`)
          : Promise.resolve({ data: [] }),
      ]);
      const seen = new Set();
      const merged = [...(byId.data || []), ...(byName.data || [])].filter(t => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
      // Ensure every card on this page always has program_name to display
      const enriched = merged.map(t => ({
        ...t,
        program_name: t.program_name || prog?.title || '',
      }));
      setTestimonials(enriched);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const imgTestimonialsCount = testimonials.filter(t => t.image).length;
  const nextT = () => setCurrentTestimonial(p => (p + 1) % Math.max(imgTestimonialsCount, 1));
  const prevT = () => setCurrentTestimonial(p => (p - 1 + imgTestimonialsCount) % Math.max(imgTestimonialsCount, 1));

  // Auto-play carousel
  const [hoveredCard, setHoveredCard] = useState(null);
  useEffect(() => {
    if (imgTestimonialsCount <= 1) return;
    const timer = setInterval(() => nextT(), 5000);
    return () => clearInterval(timer);
  }, [imgTestimonialsCount, currentTestimonial]);

  const writtenQuoteStyle = useMemo(
    () => applyWrittenQuoteStyle(settings?.page_heroes?.transformations?.written_story_quote_style),
    [settings]
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]"><p className="text-gray-400 text-xs" style={BODY}>Loading...</p></div>;
  if (!program) return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]">
      <div className="text-center">
        <h2 className="text-white text-xl mb-4" style={{ ...HEADING, color: '#fff' }}>Program Not Found</h2>
        <button onClick={() => navigate('/')} className="text-white px-6 py-2 text-xs tracking-[0.2em] uppercase" style={{ background: GOLD }}>Back to Home</button>
      </div>
    </div>
  );

  // Build sections: use global template for structure, per-program data for content
  const sectionTemplate = settings?.program_section_template || [];
  const programSections = program.content_sections || [];

  const sections = (() => {
    if (sectionTemplate.length > 0) {
      // Template-driven: merge template structure with per-program content
      return sectionTemplate
        .filter(t => t.is_enabled !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(tpl => {
          const match = programSections.find(s => s.id === tpl.id || s.section_type === tpl.section_type) || {};
          return {
            id: tpl.id,
            section_type: tpl.section_type,
            title: match.title || tpl.default_title || '',
            subtitle: match.subtitle || tpl.default_subtitle || '',
            body: match.body || '',
            image_url: match.image_url || '',
            image_fit: match.image_fit || 'contain',
            image_position: match.image_position || 'center top',
            is_enabled: true,
            order: tpl.order,
          };
        });
    }
    // Fallback: use program's own sections or defaults
    return (programSections.length > 0)
      ? programSections.filter(s => s.is_enabled).sort((a, b) => (a.order || 0) - (b.order || 0))
      : getDefaultSections(program);
  })();

  const heroScheduleItems = [];
  if (program.duration && String(program.duration).trim()) {
    heroScheduleItems.push({ key: 'dur', label: 'Duration', value: String(program.duration).trim() });
  }
  if (program.start_date && String(program.start_date).trim()) {
    heroScheduleItems.push({ key: 'sd', label: 'Starts', value: formatProgramDateDisplay(program.start_date) });
  }
  if (program.end_date && String(program.end_date).trim()) {
    heroScheduleItems.push({ key: 'ed', label: 'Ends', value: formatProgramDateDisplay(program.end_date) });
  }
  if (program.timing && String(program.timing).trim()) {
    const tz = program.time_zone ? ` · ${String(program.time_zone).trim()}` : '';
    heroScheduleItems.push({ key: 'tm', label: 'Time', value: `${String(program.timing).trim()}${tz}` });
  }

  const showHeroPrice =
    program.show_pricing_on_card !== false &&
    program.enrollment_open !== false &&
    String(program.enrollment_status || 'open').toLowerCase() !== 'closed';
  const tiersLen = program.duration_tiers?.length || 0;
  const heroPriceBase = tiersLen > 0 ? getPrice(program, 0) : getPrice(program);
  const heroPriceOffer = tiersLen > 0 ? getOfferPrice(program, 0) : getOfferPrice(program);
  const heroHasAmount = heroPriceOffer > 0 || heroPriceBase > 0;

  const heroStart = heroScheduleItems.find((r) => r.key === 'sd');
  const heroEnd = heroScheduleItems.find((r) => r.key === 'ed');
  const heroTime = heroScheduleItems.find((r) => r.key === 'tm');
  const heroDur = heroScheduleItems.find((r) => r.key === 'dur');
  const heroLeftShowDuration = !!(heroDur && !heroStart && !heroEnd);
  const showHeroFooter =
    !!(heroStart || heroEnd || heroLeftShowDuration || heroTime || (showHeroPrice && heroHasAmount));

  const SectionTitle = ({ children, style: extra }) => (
    <h2 className="text-center mb-4" style={applyStyle(extra || template.section_title_style, { ...HEADING, fontSize: '1.6rem' })}>{children}</h2>
  );
  const GoldLine = ({ type = 'section' }) => {
    const visKey = `${type}_line_visible`;
    const gapKey = `${type}_line_gap`;
    if (template[visKey] === false) return null;
    const gap = template[gapKey] || '10';
    return <div className="w-12 h-0.5 mx-auto" style={{ background: heroAccent, marginBottom: `${gap}px` }} />;
  };
  const SubtitleText = ({ children, style: extra }) => (
    <p className="text-center mb-8" style={applyStyle(extra || template.section_subtitle_style, { ...SUBTITLE })}>{children}</p>
  );
  const BodyText = ({ children, style: extra, className: cls = '' }) => (
    <p className={`whitespace-pre-wrap ${cls}`} style={applyStyle(extra || template.body_style, { ...BODY })} dangerouslySetInnerHTML={{ __html: renderMarkdown(children || '') }} />
  );

  const renderSection = (section, idx) => {
    const sType = section.section_type || 'custom';

    if (sType === 'journey' || (sType === 'custom' && !section.image_url)) {
      return (
        <section key={section.id || idx} data-testid={`section-${idx}`} className={`${SECTION_PY} bg-white`}>
          <div className={CONTAINER}><div className={NARROW}>
            {section.title && <><SectionTitle style={section.title_style}>{section.title}</SectionTitle><GoldLine /></>}
            {section.subtitle && <SubtitleText style={section.subtitle_style}>{section.subtitle}</SubtitleText>}
            {section.body && <BodyText style={section.body_style} className="text-justify">{section.body}</BodyText>}
          </div></div>
        </section>
      );
    }

    if (sType === 'who_for') {
      const lines = section.body ? section.body.split('\n').filter(l => l.trim()) : [];
      return (
        <section key={section.id || idx} data-testid={`section-${idx}`} className={`${SECTION_PY} bg-[#f8f8f8]`}>
          <div className={CONTAINER}><div className={NARROW}>
            <SectionTitle style={section.title_style}>{section.title || 'Who It Is For?'}</SectionTitle>
            <GoldLine />
            {section.subtitle && <SubtitleText style={section.subtitle_style}>{section.subtitle}</SubtitleText>}
            {lines.length > 0 && (
              <div className="grid md:grid-cols-2 gap-x-16 gap-y-5 max-w-3xl mx-auto">
                {lines.map((line, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 text-lg flex-shrink-0" style={{ color: heroAccent }}>&#10038;</span>
                    <p style={{ ...BODY }} dangerouslySetInnerHTML={{ __html: renderMarkdown(line.replace(/^[-•*]\s*/, '')) }} />
                  </div>
                ))}
              </div>
            )}
          </div></div>
        </section>
      );
    }

    if (sType === 'experience') {
      const globalExpImg = template.experience_image ? resolveImageUrl(template.experience_image) : '';
      const sectionImg = section.image_url ? resolveImageUrl(section.image_url) : globalExpImg;
      return (
        <section key={section.id || idx} data-testid={`section-${idx}`} className={SECTION_PY} style={{ background: '#1a1a1a' }}>
          <div className={CONTAINER}><div className={WIDE}>
            <h2 className="text-center mb-4" style={applyStyle(template.exp_title_style, { ...HEADING, color: heroAccent, fontStyle: 'italic', fontSize: '1.6rem' })}>
              {section.title || 'Your Experience'}
            </h2>
            <GoldLine type="exp" />
            {section.subtitle && <p className="text-center mb-8" style={applyStyle(template.exp_subtitle_style, { ...SUBTITLE, color: '#ccc' })}>{section.subtitle}</p>}
            <div className="grid md:grid-cols-12 gap-12 items-center">
              <div className="md:col-span-5 overflow-hidden rounded-md">
                {sectionImg && <img src={sectionImg} alt="Experience" className="w-full" style={{ objectFit: section.image_fit || 'contain', objectPosition: section.image_position || 'center top', maxHeight: '520px' }} onError={(e) => { e.target.style.display = 'none'; }} />}
              </div>
              <div className="md:col-span-7">
                {section.body && (
                  <div className="border-l-2 pl-6" style={{ borderColor: heroAccent }}>
                    <p className="whitespace-pre-wrap italic" style={applyStyle(template.exp_body_style, { ...BODY, color: '#ddd' })} dangerouslySetInnerHTML={{ __html: renderMarkdown(section.body || '') }} />
                  </div>
                )}
              </div>
            </div>
          </div></div>
        </section>
      );
    }

    if (sType === 'why_now') {
      return (
        <section key={section.id || idx} data-testid={`section-${idx}`} className={`${SECTION_PY} bg-white`}>
          <div className={CONTAINER}><div className={NARROW}>
            {section.title && <><SectionTitle style={section.title_style}>{section.title || 'Why You Need This Now?'}</SectionTitle><GoldLine /></>}
            {section.subtitle && <SubtitleText style={section.subtitle_style}>{section.subtitle}</SubtitleText>}
            {section.body && <BodyText style={section.body_style} className="text-justify">{section.body}</BodyText>}
            {section.image_url && (
              <div className="mt-10 rounded-lg overflow-hidden">
                <img src={resolveImageUrl(section.image_url)} alt={section.title} className="w-full max-h-96" style={{ objectFit: section.image_fit || 'cover', objectPosition: section.image_position || 'center' }} onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
            )}
          </div></div>
        </section>
      );
    }

    if (section.image_url?.trim()) {
      const imgLeft = idx % 2 === 0;
      return (
        <section key={section.id || idx} data-testid={`section-${idx}`} className={`${SECTION_PY} ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8f8f8]'}`}>
          <div className={CONTAINER}><div className={WIDE}>
            {section.title && <><SectionTitle style={section.title_style}>{section.title}</SectionTitle><GoldLine /></>}
            {section.subtitle && <SubtitleText style={section.subtitle_style}>{section.subtitle}</SubtitleText>}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className={imgLeft ? 'order-1' : 'order-1 md:order-2'}>
                <img src={resolveImageUrl(section.image_url)} alt={section.title} className="w-full rounded-lg" style={{ objectFit: section.image_fit || 'cover', objectPosition: section.image_position || 'center' }} onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
              <div className={imgLeft ? 'order-2' : 'order-2 md:order-1'}>
                <BodyText style={section.body_style}>{section.body}</BodyText>
              </div>
            </div>
          </div></div>
        </section>
      );
    }

    return (
      <section key={section.id || idx} data-testid={`section-${idx}`} className={`${SECTION_PY} ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8f8f8]'}`}>
        <div className={CONTAINER}><div className={NARROW}>
          {section.title && <><SectionTitle style={section.title_style}>{section.title}</SectionTitle><GoldLine /></>}
          {section.subtitle && <SubtitleText style={section.subtitle_style}>{section.subtitle}</SubtitleText>}
          {section.body && <BodyText style={section.body_style} className="text-justify">{section.body}</BodyText>}
        </div></div>
      </section>
    );
  };

  // Unified program template — one template controls all program detail pages
  const template = settings?.page_heroes?.program_template || {};
  const heroAccent = template.accent_color || GOLD;
  const heroBg = template.hero_bg || '#1a1a1a';

  // Global pricing style
  const globalPricingStyle = {
    fontFamily: settings?.pricing_font || 'Cinzel, Georgia, serif',
    color: settings?.pricing_color || heroAccent,
    fontWeight: parseInt(settings?.pricing_weight || '700'),
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* HERO — title centered; bottom bar: dates left, time center, investment right (no box) */}
      <section
        data-testid="program-hero"
        className="relative flex min-h-[52vh] flex-col px-5 pb-6 pt-20 md:min-h-[58vh] md:px-10 md:pb-8"
        style={{ background: template.hero_image ? 'transparent' : `linear-gradient(180deg, ${heroBg} 0%, ${heroBg}dd 50%, ${heroBg} 100%)` }}
      >
        {template.hero_image && <div className="absolute inset-0" style={{ backgroundImage: `url(${resolveImageUrl(template.hero_image)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
        {template.hero_image && <div className="absolute inset-0" style={{ background: '#000', opacity: (template.overlay_opacity || 70) / 100 }} />}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <h1 data-testid="program-title" className="mb-4 max-w-4xl text-white" style={applyStyle(template.title_style, { ...HEADING, color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontVariant: 'small-caps', letterSpacing: '0.05em', lineHeight: 1.3 })}>
            {program.title}
          </h1>
          <p className="mb-6" style={applyStyle(template.subtitle_style, { ...LABEL, color: heroAccent })}>{program.category || 'FLAGSHIP PROGRAM'}</p>
          {template.hero_line_visible !== false && <div className="w-14 h-0.5" style={{ background: heroAccent, marginTop: `${template.hero_line_gap || '10'}px` }} />}
        </div>

        {showHeroFooter ? (
          <div
            className="relative z-10 mt-8 grid w-full max-w-5xl grid-cols-1 gap-y-5 self-center sm:grid-cols-3 sm:items-end sm:gap-x-6 md:gap-x-10"
            data-testid="program-hero-schedule-price"
          >
            <div className="min-w-0 text-left sm:pr-2">
              {(heroStart || heroEnd || heroLeftShowDuration) && (
                <div className="flex flex-col gap-3">
                  {heroStart && (
                    <div>
                      <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/38">{heroStart.label}</p>
                      <p className="mt-0.5 text-sm font-normal leading-snug text-white/85 [text-wrap:balance] md:text-base">{heroStart.value}</p>
                    </div>
                  )}
                  {heroEnd && (
                    <div>
                      <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/38">{heroEnd.label}</p>
                      <p className="mt-0.5 text-sm font-normal leading-snug text-white/85 [text-wrap:balance] md:text-base">{heroEnd.value}</p>
                    </div>
                  )}
                  {heroLeftShowDuration && heroDur && (
                    <div>
                      <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/38">{heroDur.label}</p>
                      <p className="mt-0.5 text-sm font-normal leading-snug text-white/85 md:text-base">{heroDur.value}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="min-w-0 text-center sm:px-2">
              {heroTime && (
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/38">{heroTime.label}</p>
                  <p className="mt-0.5 text-sm font-normal leading-snug text-white/85 [text-wrap:balance] md:text-base">{heroTime.value}</p>
                </div>
              )}
            </div>

            <div className="min-w-0 text-right sm:pl-2">
              {showHeroPrice && heroHasAmount && (
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/38">Investment</p>
                  <div className="mt-1 flex flex-col items-end gap-0.5 sm:items-end">
                    {heroPriceOffer > 0 ? (
                      <>
                        <span
                          className="text-lg font-semibold tabular-nums md:text-xl"
                          style={{ ...globalPricingStyle, color: heroAccent, opacity: 0.9 }}
                        >
                          {symbol} {heroPriceOffer.toLocaleString()}
                        </span>
                        {heroPriceBase > heroPriceOffer && (
                          <span className="text-xs text-white/32 line-through md:text-sm">
                            {symbol} {heroPriceBase.toLocaleString()}
                          </span>
                        )}
                      </>
                    ) : (
                      <span
                        className="text-lg font-semibold tabular-nums md:text-xl"
                        style={{ ...globalPricingStyle, color: heroAccent, opacity: 0.9 }}
                      >
                        {symbol} {heroPriceBase.toLocaleString()}
                      </span>
                    )}
                    {tiersLen > 1 && (
                      <p className="mt-1 max-w-[14rem] text-[10px] leading-snug text-white/35">Starting rate for the first option — all tiers below</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {sections.map((section, idx) => renderSection(section, idx))}

      {/* CTA */}
      <section className={`${SECTION_PY} bg-white`} data-testid="cta-section">
        <div className={CONTAINER}>
          <div className="max-w-3xl mx-auto text-center">
            <GoldLine type="cta" />

            {program.show_tiers_on_card !== false && program.duration_tiers?.length > 0 && (
              <div data-testid="duration-tiers" className="max-w-3xl mx-auto mb-10">
                {program.show_pricing_on_card !== false ? (
                  <div className={`grid gap-4 ${program.duration_tiers.length === 3 ? 'sm:grid-cols-3' : program.duration_tiers.length === 2 ? 'sm:grid-cols-2' : 'max-w-xs mx-auto'}`}>
                    {program.duration_tiers.map((tier, tIdx) => {
                      const isAnnual = tier.label?.toLowerCase().includes('annual') || tier.label?.toLowerCase().includes('year') || tier.duration_unit === 'year';
                      const tierPrice = getPrice(program, tIdx);
                      const tierOffer = getOfferPrice(program, tIdx);
                      const showContact = isAnnual && tierPrice === 0;
                      return (
                        <div key={tIdx} data-testid={`tier-${tIdx}`}
                          className="border border-gray-200 hover:border-[#D4AF37] rounded-lg p-5 transition-all duration-300 cursor-pointer group hover:shadow-md"
                          onClick={() => showContact ? navigate(`/contact?program=${program.id}&title=${encodeURIComponent(program.title)}&tier=${tier.label}`) : navigate(`/enroll/program/${program.id}${enrollProgramQuery(tIdx)}`)}>
                          <p className="text-sm font-medium text-gray-900 transition-colors mb-2" style={{ fontFamily: "'Lato', sans-serif" }}>{tier.label}</p>
                          {showContact ? (
                            <div><p className="text-gray-400 text-[10px] mb-3">Contact for customised pricing</p>
                              <span className="inline-block text-white text-[10px] py-2 px-6 tracking-[0.15em] uppercase" style={{ background: heroAccent }}>Contact Us</span></div>
                          ) : (
                            <div><div className="mb-3">
                              {tierOffer > 0 ? (<><p className="text-base font-semibold" style={{ ...globalPricingStyle, fontSize: '1rem' }}>{symbol} {tierOffer.toLocaleString()}</p><p className="text-[10px] text-gray-400 line-through">{symbol} {tierPrice.toLocaleString()}</p></>) : tierPrice > 0 ? (<p className="text-base font-semibold" style={{ ...globalPricingStyle, fontSize: '1rem' }}>{symbol} {tierPrice.toLocaleString()}</p>) : (<p className="text-xs text-gray-400 italic">Contact for customised pricing</p>)}
                            </div><span className="inline-block bg-gray-900 text-white text-[10px] py-2 px-6 tracking-[0.15em] uppercase transition-colors">Select</span></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Pricing invisible — show tier names + single Express Your Interest */
                  <div className="text-center">
                    <div className="flex gap-3 justify-center mb-6">
                      {program.duration_tiers.map((tier, tIdx) => (
                        <span key={tIdx} className="px-4 py-2 border border-gray-200 rounded-full text-sm text-gray-600">{tier.label}</span>
                      ))}
                    </div>
                    <ExpressInterestInline programId={program.id} programTitle={program.title} accent={heroAccent} />
                  </div>
                )}
              </div>
            )}

            {/* Regular pricing when no tiers */}
            {program.show_pricing_on_card !== false && (!program.duration_tiers || program.duration_tiers.length === 0) && program.enrollment_open !== false && (
              <div className="mb-10" data-testid="regular-pricing">
                <div className="max-w-xs mx-auto text-center">
                  {(() => {
                    const basePrice = getPrice(program);
                    const offerP = getOfferPrice(program);
                    const pricingStyle = { ...globalPricingStyle, color: heroAccent };
                    return offerP > 0 ? (
                      <div className="mb-4">
                        <p className="text-2xl font-semibold" style={pricingStyle}>{symbol} {offerP.toLocaleString()}</p>
                        <p className="text-sm text-gray-400 line-through mt-1">{symbol} {basePrice.toLocaleString()}</p>
                        {program.offer_text && <p className="text-xs mt-2 px-3 py-1 rounded-full inline-block" style={{ background: heroAccent + '15', color: heroAccent }}>{program.offer_text}</p>}
                      </div>
                    ) : basePrice > 0 ? (
                      <div className="mb-4">
                        <p className="text-2xl font-semibold" style={pricingStyle}>{symbol} {basePrice.toLocaleString()}</p>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )}

            <div className="flex flex-col items-center gap-4 justify-center">
              {(() => {
                const enrollStatus = program.enrollment_status || (program.enrollment_open !== false ? 'open' : 'closed');
                const pricingHidden = program.show_pricing_on_card === false;
                const hasTiers = program.duration_tiers?.length > 0;

                // No pricing shown → always Express Your Interest (notified when enrollment opens)
                // Avoid duplicate: if tiers block already renders the Express Interest widget, skip here
                if (pricingHidden) {
                  return hasTiers ? null : <ExpressInterestInline programId={program.id} programTitle={program.title} accent={heroAccent} />;
                }

                // Pricing visible → Enroll Now if open, Express Interest if closed
                if (enrollStatus === 'open') {
                  return (
                    <button data-testid="enroll-btn" onClick={() => navigate(`/enroll/program/${program.id}${enrollProgramQuery()}`)}
                      className="text-white px-10 py-3 text-xs tracking-[0.2em] uppercase transition-colors hover:opacity-90" style={{ background: heroAccent }}>Enroll Now</button>
                  );
                }
                return <ExpressInterestInline programId={program.id} programTitle={program.title} accent={heroAccent} />;
              })()}
            </div>
          </div>
        </div>
      </section>

      {testimonials.filter(t => t.type === 'template' || (t.type === 'video' && (t.video_url || t.videoId))).length > 0 && (() => {
        const rawCards = testimonials.filter(t =>
          t.type === 'template' || (t.type === 'video' && (t.video_url || t.videoId))
        );
        const videoGroup = rawCards.filter((c) => c.type === 'video');
        const writtenGroup = rawCards.filter((c) => c.type === 'template');
        const writtenWithPic = writtenGroup.filter((t) => templateTestimonialHasPhotos(t));
        const writtenWithoutPic = writtenGroup.filter((t) => !templateTestimonialHasPhotos(t));
        const allCards = [...writtenWithPic, ...writtenWithoutPic, ...videoGroup];
        const CARD_W  = 300;
        const CARD_GAP = 20;
        const times = Math.ceil(10 / Math.max(allCards.length, 1));
        const loopCards = Array.from({ length: times * 2 }, (_, rep) =>
          allCards.map((c, i) => ({ ...c, _key: `${rep}-${i}` }))
        ).flat();
        const trackWidth = allCards.length * (CARD_W + CARD_GAP);
        const duration   = Math.max(20, allCards.length * 5);

        return (
          <section className="py-10 md:py-12" data-testid="testimonials-section"
            style={{ background: 'linear-gradient(180deg, #f5f4f8 0%, #eceaf1 40%, #f5f4f8 100%)' }}>
            <div className="container mx-auto px-4 max-w-7xl">
              <h2 className="text-center mb-6 md:mb-8"
                style={applyStyle(template.testimonial_title_style, { ...HEADING, color: heroAccent, fontStyle: 'italic', fontSize: '1.6rem' })}>
                What People Are Saying
              </h2>
            </div>

            <style>{`
              @keyframes progTestimonialMarquee {
                from { transform: translateX(0); }
                to   { transform: translateX(-${trackWidth + CARD_GAP}px); }
              }
              .prog-marquee-track {
                display: flex;
                gap: ${CARD_GAP}px;
                width: max-content;
                animation: progTestimonialMarquee ${duration}s linear infinite;
              }
              .prog-marquee-wrap:hover .prog-marquee-track {
                animation-play-state: paused;
              }
            `}</style>
            <div className="prog-marquee-wrap overflow-hidden"
              style={{
                maskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)',
              }}>
              <div className="prog-marquee-track items-stretch">
                {loopCards.map(t => (
                  <div
                    key={t._key}
                    className="flex items-center justify-center"
                    style={{ width: CARD_W, flexShrink: 0, alignSelf: 'stretch' }}>
                    {t.type === 'video'
                      ? <SoulfulUniformVideoCard testimonial={t} footerCentered compactProgram
                          quoteStyle={writtenQuoteStyle}
                          onPlay={(embedUrl, platform) => setSelectedEmbed({ embedUrl, platform })}
                          onOpen={url => window.open(url, '_blank')}
                        />
                      : (
                          <SoulfulWrittenCard
                            testimonial={t}
                            uniform
                            footerCentered
                            compactProgram
                            quoteStyle={writtenQuoteStyle}
                            onClick={() => setSelectedTemplate(t)}
                          />
                        )
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* Full story modal */}
            <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
              <DialogContent
                className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl"
                style={{ border: '1px solid rgba(123,104,238,0.15)' }}>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  {selectedTemplate && (
                    <SoulfulTestimonialFull testimonial={selectedTemplate} quoteStyle={writtenQuoteStyle} />
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Video embed modal */}
            <Dialog open={!!selectedEmbed} onOpenChange={() => setSelectedEmbed(null)}>
              <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black rounded-2xl">
                {selectedEmbed && (
                  <div className="relative"
                    style={{ paddingBottom: selectedEmbed.platform === 'instagram' ? '120%' : '56.25%' }}>
                    <iframe className="absolute inset-0 w-full h-full"
                      src={selectedEmbed.embedUrl} title="Video testimonial" frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms" />
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </section>
        );
      })()}

      {/* Testimonial Lightbox — dark overlay, full image */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" data-testid="program-testimonial-lightbox"
          onClick={() => setLightboxImg(null)}
          style={{ background: 'rgba(0,0,0,0.85)' }}>
          <button onClick={() => setLightboxImg(null)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-50"
            data-testid="lightbox-close">
            <span className="text-white text-xl font-light">&times;</span>
          </button>
          <img src={lightboxImg} alt="Testimonial"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl"
            style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <Footer />
      <FloatingButtons />
    </div>
  );
}

export default ProgramDetailPage;
