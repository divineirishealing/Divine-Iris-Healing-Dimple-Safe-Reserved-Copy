import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { resolveImageUrl } from '../lib/imageUtils';
import {
  resolveProgramDocument,
  splitDocumentBodyForExperience,
} from '../lib/documentLandingBlocks';
import ProgramDocumentMirror from '../components/ProgramDocumentMirror';
import ProgramExperienceMoment from '../components/ProgramExperienceMoment';
import { experienceMomentHasContent } from '../lib/parseExperienceMoment';
import { useCurrency } from '../context/CurrencyContext';
import { HEADING, BODY, GOLD, LABEL, CONTAINER, SECTION_PY } from '../lib/designTokens';
import { useSeoPage } from '../context/SeoPageContext';
import { formatDateDdMonYyyy } from '../lib/utils';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ExpressInterestInline = ({ programId, programTitle, accent, variant = 'default' }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const hero = variant === 'hero';

  const handleSubmit = async () => {
    if (!email) return;
    try {
      await axios.post(`${API}/notify-me`, { email, program_id: programId, program_title: programTitle });
      setSubmitted(true);
    } catch {}
  };

  if (submitted) {
    return (
      <p
        className={hero ? 'text-xs font-medium leading-snug text-white/90' : 'text-green-600 text-sm font-medium'}
        data-testid="express-interest-success"
      >
        You&apos;ll be notified when enrollment opens!
      </p>
    );
  }

  if (!showForm) {
    return (
      <button
        data-testid="express-interest-btn"
        onClick={() => setShowForm(true)}
        className={
          hero
            ? 'bg-transparent px-0 py-1 text-left text-[9px] font-medium uppercase tracking-[0.2em] transition-opacity hover:opacity-90'
            : 'text-white px-10 py-3 text-xs tracking-[0.2em] uppercase transition-colors hover:opacity-90'
        }
        style={hero ? { color: accent } : { background: accent }}
      >
        Express your interest
      </button>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${hero ? 'w-full max-w-none items-stretch text-left' : 'items-center w-full max-w-md'}`} data-testid="express-interest-form">
      <p className={hero ? 'text-[10px] leading-snug text-white/75' : 'text-sm text-gray-600'}>
        Enter your email to get notified when enrollment opens
      </p>
      <div className={`flex gap-2 w-full ${hero ? 'flex-col sm:flex-row' : ''}`}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className={
            hero
              ? 'flex-1 border-0 border-b border-white/35 bg-transparent px-0 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/70 focus:outline-none focus:ring-0'
              : 'flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400'
          }
        />
        <button
          onClick={handleSubmit}
          data-testid="express-interest-submit"
          className={
            hero
              ? 'shrink-0 bg-transparent px-0 py-2 text-left text-[9px] font-medium uppercase tracking-[0.2em] transition-opacity hover:opacity-90'
              : 'text-white px-6 py-2.5 text-xs tracking-[0.15em] uppercase transition-colors hover:opacity-90 rounded-full'
          }
          style={hero ? { color: accent } : { background: accent }}
        >
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

function stripForMeta(htmlOrText) {
  if (!htmlOrText) return '';
  return String(htmlOrText)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 165);
}

/** YYYY-MM-DD → weekday, DD-Mon-YYYY; otherwise return as stored. */
function formatProgramDateDisplay(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  const d = t.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const core = formatDateDdMonYyyy(d);
    if (!core) return t;
    const dt = new Date(`${d}T12:00:00`);
    if (Number.isNaN(dt.getTime())) return t;
    const wk = dt.toLocaleDateString('en-GB', { weekday: 'short' });
    return `${wk}, ${core}`;
  }
  return t;
}

function ProgramDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const promoFromQuery = (searchParams.get('promo') || '').trim();
  const sourceDashboard = searchParams.get('source') === 'dashboard';
  const { setPageSeo, clearPageSeo } = useSeoPage();
  const { getPrice, getOfferPrice, symbol } = useCurrency();

  const enrollProgramQuery = (tierIdx) => {
    const q = new URLSearchParams();
    if (tierIdx !== undefined && tierIdx !== null && tierIdx !== '') q.set('tier', String(tierIdx));
    if (promoFromQuery) q.set('promo', promoFromQuery);
    if (sourceDashboard) q.set('source', 'dashboard');
    const s = q.toString();
    return s ? `?${s}` : '';
  };
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [heroTierIdx, setHeroTierIdx] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadData();
  }, [id]);

  /** Sync tier selection from enroll links (?tier=N) once program is loaded. */
  useEffect(() => {
    if (!program?.duration_tiers?.length) return;
    const t = searchParams.get('tier');
    if (t == null || t === '') return;
    const n = parseInt(t, 10);
    if (!Number.isNaN(n) && n >= 0 && n < program.duration_tiers.length) {
      setHeroTierIdx(n);
    }
  }, [program?.id, program?.duration_tiers?.length, searchParams]);

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
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]"><p className="text-gray-400 text-xs" style={BODY}>Loading...</p></div>;
  if (!program) return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]">
      <div className="text-center">
        <h2 className="text-white text-xl mb-4" style={{ ...HEADING, color: '#fff' }}>Program Not Found</h2>
        <button onClick={() => navigate('/')} className="text-white px-6 py-2 text-xs tracking-[0.2em] uppercase" style={{ background: GOLD }}>Back to Home</button>
      </div>
    </div>
  );

  // Unified program template — one template controls all program detail pages
  const template = settings?.page_heroes?.program_template || {};
  const heroAccent = template.accent_color || GOLD;
  const heroBg = template.hero_bg || '#1a1a1a';
  const sectionTemplate = settings?.program_section_template || [];
  const programSections = program.content_sections || [];

  const experienceMoment = (() => {
    const tpl = sectionTemplate.find((t) => t.section_type === 'experience' && t.is_enabled !== false);
    const match = programSections.find((s) => s.section_type === 'experience' || s.id === 'experience') || {};
    const globalExpImg = template.experience_image ? resolveImageUrl(template.experience_image) : '';
    const aboutPortrait = settings?.about_image ? resolveImageUrl(settings.about_image) : '';
    const section = {
      id: match.id || tpl?.id || 'experience',
      section_type: 'experience',
      title: match.title != null ? match.title : (tpl?.default_title || ''),
      subtitle: match.subtitle != null ? match.subtitle : (tpl?.default_subtitle || ''),
      body: match.body || '',
      image_url: match.image_url || '',
      image_fit: match.image_fit || 'contain',
      image_position: match.image_position || 'center top',
    };
    const portraitUrl = section.image_url
      ? resolveImageUrl(section.image_url)
      : (globalExpImg || aboutPortrait);
    if (!experienceMomentHasContent(section, portraitUrl)) return null;
    return { section, portraitUrl };
  })();

  const documentSection = resolveProgramDocument(program, programSections)?.section || null;
  const docBody = documentSection?.body || '';
  const splitDocForExperience = !!(documentSection && docBody.trim() && experienceMoment);
  const { before: docBefore, after: docAfter } = splitDocForExperience
    ? splitDocumentBodyForExperience(docBody, 1)
    : { before: docBody, after: '' };

  const heroScheduleItems = [];
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

  const enrollmentDeadline = program.deadline_date || program.start_date;
  const enrollmentExpiredByDeadline = (() => {
    if (!enrollmentDeadline) return false;
    const t = new Date(enrollmentDeadline);
    return !Number.isNaN(t.getTime()) && t.getTime() < Date.now();
  })();

  /** True when signup is not available (deadline passed, toggle off, or status closed — same idea as Sacred Home upcoming). */
  const registrationClosed =
    enrollmentExpiredByDeadline ||
    program.enrollment_open === false ||
    String(program.enrollment_status || 'open').toLowerCase() === 'closed';

  const showHeroPrice =
    program.show_pricing_on_card !== false &&
    !enrollmentExpiredByDeadline &&
    program.enrollment_open !== false &&
    String(program.enrollment_status || 'open').toLowerCase() !== 'closed';
  const tiersLen = program.duration_tiers?.length || 0;
  const showTierUi = program.show_tiers_on_card !== false && tiersLen > 0;
  const heroPriceBase = tiersLen > 0 ? getPrice(program, 0) : getPrice(program);
  const heroPriceOffer = tiersLen > 0 ? getOfferPrice(program, 0) : getOfferPrice(program);
  const heroHasAmount = heroPriceOffer > 0 || heroPriceBase > 0;

  const heroStart = heroScheduleItems.find((r) => r.key === 'sd');
  const heroEnd = heroScheduleItems.find((r) => r.key === 'ed');
  const heroTime = heroScheduleItems.find((r) => r.key === 'tm');
  /** Schedule / single-price block (no duplicated tier breakdown when tier UI is enabled). */
  const heroLeftScheduleBlock = !registrationClosed && (heroStart || heroEnd || heroTime);
  const heroLeftInvestmentSingle = showHeroPrice && heroHasAmount && !showTierUi;
  const showHeroFooter = !!(heroLeftScheduleBlock || heroLeftInvestmentSingle);
  /** Stacked duration tiers + enroll in hero (right column on large screens). */
  const showHeroTierDock = showTierUi && showHeroPrice;

  const detailEnrollStatus = registrationClosed
    ? 'closed'
    : program.enrollment_status || (program.enrollment_open !== false ? 'open' : 'closed');

  const GoldLine = ({ type = 'section' }) => {
    const visKey = `${type}_line_visible`;
    const gapKey = `${type}_line_gap`;
    if (template[visKey] === false) return null;
    const gap = template[gapKey] || '10';
    return <div className="w-12 h-0.5 mx-auto" style={{ background: heroAccent, marginBottom: `${gap}px` }} />;
  };

  // Global pricing style
  const globalPricingStyle = {
    fontFamily: settings?.pricing_font || 'Cinzel, Georgia, serif',
    color: settings?.pricing_color || heroAccent,
    fontWeight: parseInt(settings?.pricing_weight || '700'),
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* HERO — title centered; schedule & single-tier price bottom-left; duration tiers stacked bottom-right when tier UI is on */}
      <section
        data-testid="program-hero"
        className="relative flex min-h-[52vh] flex-col px-5 pb-6 pt-20 md:min-h-[58vh] md:px-10 md:pb-8"
        style={{ background: template.hero_image ? 'transparent' : `linear-gradient(180deg, ${heroBg} 0%, ${heroBg}dd 50%, ${heroBg} 100%)` }}
      >
        {template.hero_image && <div className="absolute inset-0" style={{ backgroundImage: `url(${resolveImageUrl(template.hero_image)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
        {template.hero_image && <div className="absolute inset-0" style={{ background: '#000', opacity: (template.overlay_opacity || 70) / 100 }} />}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <div className="translate-y-5 md:translate-y-9">
            <h1 data-testid="program-title" className="mb-4 max-w-4xl text-white" style={applyStyle(template.title_style, { ...HEADING, color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontVariant: 'small-caps', letterSpacing: '0.05em', lineHeight: 1.3 })}>
              {program.title}
            </h1>
            <p className="mb-6" style={applyStyle(template.subtitle_style, { ...LABEL, color: heroAccent })}>{program.category || 'FLAGSHIP PROGRAM'}</p>
            {template.hero_line_visible !== false && <div className="mx-auto w-14 h-0.5" style={{ background: heroAccent, marginTop: `${template.hero_line_gap || '10'}px` }} />}
          </div>
        </div>

        {(showHeroFooter || showHeroTierDock) ? (
          <div
            className={`relative z-10 mt-auto flex w-full flex-col gap-6 pt-6 lg:gap-10 ${showHeroFooter && showHeroTierDock ? 'lg:flex-row lg:items-end lg:justify-between' : showHeroTierDock ? 'lg:justify-end' : ''}`}
            data-testid="program-hero-footer-row"
          >
            {showHeroFooter ? (
              <div
                className={`w-full max-w-xl self-start text-left lg:self-end ${showHeroTierDock ? 'lg:max-w-md' : ''}`}
                data-testid="program-hero-schedule-price"
              >
                <div className="flex flex-col gap-3.5">
                  {heroStart && (
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-normal leading-snug text-white/85 [text-wrap:balance] md:text-base">
                      <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.2em]" style={{ color: heroAccent }}>{heroStart.label}:</span>
                      <span>{heroStart.value}</span>
                    </p>
                  )}
                  {heroEnd && (
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-normal leading-snug text-white/85 [text-wrap:balance] md:text-base">
                      <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.2em]" style={{ color: heroAccent }}>{heroEnd.label}:</span>
                      <span>{heroEnd.value}</span>
                    </p>
                  )}
                  {heroTime && (
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-normal leading-snug text-white/85 [text-wrap:balance] md:text-base">
                      <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.2em]" style={{ color: heroAccent }}>{heroTime.label}:</span>
                      <span>{heroTime.value}</span>
                    </p>
                  )}
                  {showHeroPrice && heroHasAmount && !showTierUi && (
                    <div>
                      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-snug md:text-base">
                        <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.2em]" style={{ color: heroAccent }}>Investment:</span>
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
                      </p>
                      {tiersLen > 1 && (
                        <p className="mt-1.5 max-w-[18rem] text-[10px] leading-snug text-white/35">Starting price for the first option — all tiers below</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {showHeroTierDock ? (
              <div
                className="flex w-full max-w-[min(100%,28rem)] flex-col gap-3 self-end text-right"
                data-testid="program-hero-tier-dock"
              >
                {detailEnrollStatus === 'open' && (
                  <div className="mb-1 flex w-full justify-end" data-testid="program-hero-tier-dock-title">
                    <button
                      type="button"
                      data-testid="hero-enroll-btn"
                      onClick={() => navigate(`/enroll/program/${program.id}${enrollProgramQuery(heroTierIdx)}`)}
                      className="rounded-sm px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-md transition-opacity hover:opacity-90 md:text-xs md:tracking-[0.2em]"
                      style={{ background: heroAccent }}
                    >
                      ENROLL NOW
                    </button>
                  </div>
                )}
                {program.duration_tiers.map((tier, tIdx) => {
                  const isAnnual =
                    tier.label?.toLowerCase().includes('annual') ||
                    tier.label?.toLowerCase().includes('year') ||
                    tier.duration_unit === 'year';
                  if (isAnnual) return null;

                  const tierPrice = getPrice(program, tIdx);
                  const tierOffer = getOfferPrice(program, tIdx);
                  return (
                    <div
                      key={tIdx}
                      className="flex w-full flex-wrap items-baseline justify-end gap-x-2 gap-y-1 text-sm font-normal leading-snug text-white/85 [text-wrap:balance] md:flex-nowrap md:text-base"
                    >
                      <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.2em]" style={{ color: heroAccent }}>
                        {tier.label}:
                      </span>
                      {tierOffer > 0 ? (
                        <>
                          <span className="shrink-0 text-base font-semibold tabular-nums md:text-lg" style={{ ...globalPricingStyle, color: heroAccent }}>
                            {symbol} {tierOffer.toLocaleString()}
                          </span>
                          {tierPrice > tierOffer && (
                            <span className="shrink-0 text-xs text-white/45 line-through md:text-sm">
                              {symbol} {tierPrice.toLocaleString()}
                            </span>
                          )}
                          <button
                            type="button"
                            data-testid={`hero-tier-${tIdx}`}
                            onClick={() => {
                              setHeroTierIdx(tIdx);
                              navigate(`/enroll/program/${program.id}${enrollProgramQuery(tIdx)}`);
                            }}
                            className="shrink-0 text-[9px] font-medium uppercase tracking-[0.2em] transition-opacity hover:opacity-90"
                            style={{ color: heroAccent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          >
                            SELECT
                          </button>
                        </>
                      ) : tierPrice > 0 ? (
                        <>
                          <span className="shrink-0 text-base font-semibold tabular-nums md:text-lg" style={{ ...globalPricingStyle, color: heroAccent }}>
                            {symbol} {tierPrice.toLocaleString()}
                          </span>
                          <button
                            type="button"
                            data-testid={`hero-tier-${tIdx}`}
                            onClick={() => {
                              setHeroTierIdx(tIdx);
                              navigate(`/enroll/program/${program.id}${enrollProgramQuery(tIdx)}`);
                            }}
                            className="shrink-0 text-[9px] font-medium uppercase tracking-[0.2em] transition-opacity hover:opacity-90"
                            style={{ color: heroAccent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          >
                            SELECT
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="min-w-0 text-[10px] italic text-white/70 md:text-xs">Contact for customised pricing</span>
                          <button
                            type="button"
                            data-testid={`hero-tier-${tIdx}`}
                            onClick={() => {
                              setHeroTierIdx(tIdx);
                              navigate(`/contact?program=${program.id}&title=${encodeURIComponent(program.title)}&tier=${tier.label}`);
                            }}
                            className="shrink-0 text-[9px] font-medium uppercase tracking-[0.2em] transition-opacity hover:opacity-90"
                            style={{ color: heroAccent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          >
                            CONTACT US
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
                {detailEnrollStatus !== 'open' && (
                  <div className="flex flex-col items-end pt-2" data-testid="hero-express-interest">
                    <ExpressInterestInline variant="hero" programId={program.id} programTitle={program.title} accent={heroAccent} />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {documentSection && docBefore.trim() ? (
        <ProgramDocumentMirror
          body={docBefore}
          subtitle={documentSection.subtitle}
          accent={heroAccent}
        />
      ) : null}

      {experienceMoment ? (
        <ProgramExperienceMoment
          section={experienceMoment.section}
          accent={heroAccent}
          portraitUrl={experienceMoment.portraitUrl}
        />
      ) : null}

      {documentSection && docAfter.trim() ? (
        <ProgramDocumentMirror
          body={docAfter}
          subtitle={documentSection.subtitle}
          accent={heroAccent}
          continuation
        />
      ) : null}

      {/* CTA — Book Now */}
      <section className={`${SECTION_PY} bg-white`} data-testid="cta-section">
        <div className={CONTAINER}>
          <div className="max-w-3xl mx-auto text-center">
            <GoldLine type="cta" />

            {program.show_tiers_on_card !== false && program.duration_tiers?.length > 0 && (
              <div data-testid="duration-tiers" className="max-w-3xl mx-auto mb-10">
                {showHeroPrice ? (
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
                  /* Pricing invisible — show tier labels + Enroll/Interest based on status */
                  <div className="text-center">
                    {!registrationClosed ? (
                      <div className="flex gap-3 justify-center mb-6">
                        {program.duration_tiers.map((tier, tIdx) => (
                          <button
                            key={tIdx}
                            type="button"
                            onClick={() => setHeroTierIdx(tIdx)}
                            className="px-4 py-2 border rounded-full text-sm transition-all duration-200"
                            style={heroTierIdx === tIdx
                              ? { background: heroAccent, color: '#fff', borderColor: heroAccent, fontWeight: 600 }
                              : { background: '#fff', color: '#444', borderColor: '#d1d5db' }
                            }
                          >
                            {tier.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {detailEnrollStatus === 'open' ? (
                      <button
                        data-testid="enroll-btn-no-price"
                        onClick={() => navigate(`/enroll/program/${program.id}${enrollProgramQuery(heroTierIdx)}`)}
                        className="text-white px-10 py-3 text-xs tracking-[0.2em] uppercase transition-colors hover:opacity-90"
                        style={{ background: heroAccent }}
                      >
                        Book Now
                      </button>
                    ) : (
                      <ExpressInterestInline programId={program.id} programTitle={program.title} accent={heroAccent} />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Regular pricing when no tiers */}
            {showHeroPrice && (!program.duration_tiers || program.duration_tiers.length === 0) && (
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
                const hasTiers = program.duration_tiers?.length > 0;

                // No purchase pricing on page — still show Enroll Now if enrollment is open
                if (!showHeroPrice) {
                  if (detailEnrollStatus === 'open') {
                    return hasTiers ? null : ( // tiers block above already shows the button
                      <button
                        data-testid="enroll-btn-no-price-solo"
                        onClick={() => navigate(`/enroll/program/${program.id}${enrollProgramQuery()}`)}
                        className="text-white px-10 py-3 text-xs tracking-[0.2em] uppercase transition-colors hover:opacity-90"
                        style={{ background: heroAccent }}
                      >
                        Book Now
                      </button>
                    );
                  }
                  return hasTiers ? null : <ExpressInterestInline programId={program.id} programTitle={program.title} accent={heroAccent} />;
                }

                // Prices shown and enrollment allows checkout → Enroll Now; else interest (e.g. coming_soon)
                if (detailEnrollStatus === 'open') {
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

      <Footer />
      <FloatingButtons />
    </div>
  );
}

export default ProgramDetailPage;
