import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { resolveImageUrl } from '../lib/imageUtils';
import { renderMarkdown } from '../lib/renderMarkdown';
import { useCurrency } from '../context/CurrencyContext';
import { HEADING, SUBTITLE, BODY, GOLD, LABEL, CONTAINER, NARROW, WIDE, SECTION_PY } from '../lib/designTokens';

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

function ProgramDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPrice, getOfferPrice, symbol } = useCurrency();
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [testimonials, setTestimonials] = useState([]);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [lightboxImg, setLightboxImg] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [progRes, settingsRes, testRes] = await Promise.all([
        axios.get(`${API}/programs/${id}`),
        axios.get(`${API}/settings`),
        axios.get(`${API}/testimonials?program_id=${id}&visible_only=true`),
      ]);
      setProgram(progRes.data);
      setSettings(settingsRes.data);
      setTestimonials(testRes.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const imgTestimonialsCount = testimonials.filter(t => t.image).length;
  const nextT = () => setCurrentTestimonial(p => (p + 1) % Math.max(imgTestimonialsCount, 1));
  const prevT = () => setCurrentTestimonial(p => (p - 1 + imgTestimonialsCount) % Math.max(imgTestimonialsCount, 1));

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

      {/* HERO */}
      <section data-testid="program-hero" className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6 pt-20"
        style={{ background: `linear-gradient(180deg, ${heroBg} 0%, ${heroBg}dd 50%, ${heroBg} 100%)` }}>
        <h1 data-testid="program-title" className="text-white mb-4 max-w-4xl" style={applyStyle(template.title_style, { ...HEADING, color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontVariant: 'small-caps', letterSpacing: '0.05em', lineHeight: 1.3 })}>
          {program.title}
        </h1>
        <p className="mb-6" style={applyStyle(template.subtitle_style, { ...LABEL, color: heroAccent })}>{program.category || 'FLAGSHIP PROGRAM'}</p>
        {template.hero_line_visible !== false && <div className="w-14 h-0.5" style={{ background: heroAccent, marginTop: `${template.hero_line_gap || '10'}px` }} />}
      </section>

      {sections.map((section, idx) => renderSection(section, idx))}

      {/* CTA */}
      <section className={`${SECTION_PY} bg-white`} data-testid="cta-section">
        <div className={CONTAINER}>
          <div className="max-w-3xl mx-auto text-center">
            <GoldLine type="cta" />

            {/* Duration / Dates / Timing — above pricing */}
            {((program.show_duration_on_page && program.duration) || (program.show_timing_on_page && program.timing) || (program.show_start_date_on_page && program.start_date)) && (
              <div data-testid="program-info-bar" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-8 text-gray-500 text-xs">
                {program.show_duration_on_page && program.duration && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: heroAccent }} /> {program.duration}</span>}
                {program.show_start_date_on_page && program.start_date && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: heroAccent }} /> Starts: {program.start_date}</span>}
                {program.show_timing_on_page && program.timing && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: heroAccent }} /> {program.timing}{program.time_zone ? ` ${program.time_zone}` : ''}</span>}
                {program.show_timing_on_page && program.timing && program.time_zone && (() => {
                  try {
                    const tzShort = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
                    const programTz = program.time_zone;
                    if (!programTz.toLowerCase().includes(tzShort.toLowerCase()) && 
                        !tzShort.toLowerCase().includes(programTz.split(' ')[0]?.toLowerCase())) {
                      const timeMatch = program.timing.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                      if (timeMatch) {
                        let hours = parseInt(timeMatch[1]);
                        const minutes = parseInt(timeMatch[2]);
                        const ampm = timeMatch[3].toUpperCase();
                        if (ampm === 'PM' && hours !== 12) hours += 12;
                        if (ampm === 'AM' && hours === 12) hours = 0;
                        const tzOffsets = { 'GST': 4, 'Dubai': 4, 'UAE': 4, 'IST': 5.5, 'India': 5.5, 'EST': -5, 'EDT': -4, 'CST': -6, 'CDT': -5, 'PST': -8, 'PDT': -7, 'GMT': 0, 'UTC': 0, 'BST': 1, 'CET': 1, 'AEST': 10, 'JST': 9, 'SGT': 8, 'AST': 3, 'Arabia': 3, 'PKT': 5 };
                        let programOffset = null;
                        for (const [key, val] of Object.entries(tzOffsets)) {
                          if (programTz.toUpperCase().includes(key.toUpperCase())) { programOffset = val; break; }
                        }
                        if (programOffset !== null) {
                          const now = new Date();
                          const utcMinutes = (hours * 60 + minutes) - (programOffset * 60);
                          const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, utcMinutes + now.getTimezoneOffset() * -1);
                          const localTimeStr = localDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                          return <span className="flex items-center gap-1.5 text-blue-500"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> {localTimeStr} Your Time ({tzShort})</span>;
                        }
                      }
                    }
                    return null;
                  } catch { return null; }
                })()}
              </div>
            )}

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
                          onClick={() => showContact ? navigate(`/contact?program=${program.id}&title=${encodeURIComponent(program.title)}&tier=${tier.label}`) : navigate(`/enroll/program/${program.id}?tier=${tIdx}`)}>
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
              {program.show_pricing_on_card !== false && (program.enrollment_status || (program.enrollment_open !== false ? 'open' : 'closed')) === 'open' ? (
                <button data-testid="enroll-btn" onClick={() => navigate(`/enroll/program/${program.id}`)}
                  className="text-white px-10 py-3 text-xs tracking-[0.2em] uppercase transition-colors hover:opacity-90" style={{ background: heroAccent }}>Enroll Now</button>
              ) : (
                <ExpressInterestInline programId={program.id} programTitle={program.title} accent={heroAccent} />
              )}
            </div>
          </div>
        </div>
      </section>

      {testimonials.filter(t => t.image).length > 0 && (
        <section className="py-16 bg-gradient-to-b from-gray-50 to-white" data-testid="testimonials-section">
          <div className={CONTAINER}>
            <h2 className="text-center mb-12" style={applyStyle(template.testimonial_title_style, { ...HEADING, color: heroAccent, fontStyle: 'italic', fontSize: '1.6rem' })}>Testimonials</h2>
            {/* 3D Carousel — 5 cards, center overlaps sides */}
            {(() => {
              const imgTestimonials = testimonials.filter(t => t.image);
              const total = imgTestimonials.length;
              if (total === 0) return null;

              // Card dimensions — all same size
              const CARD_W = 300;
              const CARD_H = 480;

              const getCardStyle = (offset) => {
                const abs = Math.abs(offset);
                if (abs === 0) return { tx: 0, tz: 200, ry: 0, z: 50, op: 1 };
                if (abs === 1) return { tx: offset * 120, tz: 0, ry: offset * -12, z: 40, op: 0.95 };
                return { tx: offset * 250, tz: -60, ry: offset * -25, z: 30, op: 0.75 };
              };

              return (
                <div className="relative mx-auto" style={{ perspective: '1000px', maxWidth: '1100px' }}>
                  <div className="relative flex items-center justify-center" style={{ height: `${CARD_H + 60}px` }}>
                    {[-2, -1, 0, 1, 2].map(offset => {
                      if (total === 1 && offset !== 0) return null;
                      if (total < 3 && Math.abs(offset) > 1) return null;
                      if (total < 5 && Math.abs(offset) > 1) return null;
                      const idx = ((currentTestimonial + offset) % total + total) % total;
                      const t = imgTestimonials[idx];
                      if (!t) return null;
                      const imgSrc = resolveImageUrl(t.image);
                      const { tx, tz, ry, z, op } = getCardStyle(offset);
                      const isCenter = offset === 0;

                      return (
                        <div key={`${offset}-${idx}`}
                          className="absolute cursor-pointer"
                          data-testid={isCenter ? 'carousel-center-card' : `carousel-card-${offset}`}
                          onClick={() => { if (offset < 0) prevT(); else if (offset > 0) nextT(); else setLightboxImg(imgSrc); }}
                          style={{
                            width: `${CARD_W}px`,
                            height: `${CARD_H}px`,
                            left: '50%',
                            top: '50%',
                            transformStyle: 'preserve-3d',
                            transform: `translate(-50%, -50%) translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg)`,
                            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            zIndex: z,
                            opacity: op,
                          }}>
                          <div className="w-full h-full rounded-lg overflow-hidden bg-white"
                            style={{
                              boxShadow: isCenter
                                ? '0 25px 50px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15)'
                                : '0 10px 30px rgba(0,0,0,0.12)',
                              border: '1px solid rgba(230,230,230,0.5)',
                            }}>
                            <img src={imgSrc} alt={t.name || 'Testimonial'}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="480"><rect fill="%23f3f4f6" width="300" height="480"/></svg>'; }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Dot Indicators */}
                  <div className="flex justify-center items-center gap-2 mt-4">
                    {imgTestimonials.map((_, i) => (
                      <button key={i} onClick={() => setCurrentTestimonial(i)} data-testid={`carousel-dot-${i}`}
                        className="rounded-full transition-all duration-300"
                        style={{
                          width: i === currentTestimonial ? '14px' : '10px',
                          height: i === currentTestimonial ? '14px' : '10px',
                          background: i === currentTestimonial ? heroAccent : '#d1d5db',
                        }} />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* Testimonial Lightbox */}
      <Dialog open={!!lightboxImg} onOpenChange={() => setLightboxImg(null)}>
        <DialogContent data-testid="program-testimonial-lightbox" className="max-w-4xl p-1 bg-white">
          {lightboxImg && <img src={lightboxImg} alt="Testimonial" className="w-full h-auto max-h-[85vh] object-contain rounded" />}
        </DialogContent>
      </Dialog>

      <Footer />
      <FloatingButtons />
    </div>
  );
}

export default ProgramDetailPage;
