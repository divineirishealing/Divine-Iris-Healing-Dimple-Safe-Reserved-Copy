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
        axios.get(`${API}/testimonials`),
      ]);
      setProgram(progRes.data);
      setSettings(settingsRes.data);
      setTestimonials(testRes.data.filter(t => t.visible !== false));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const nextT = () => setCurrentTestimonial(p => (p + 1) % Math.max(testimonials.length, 1));
  const prevT = () => setCurrentTestimonial(p => (p - 1 + testimonials.length) % Math.max(testimonials.length, 1));

  const aboutImage = settings?.about_image ? resolveImageUrl(settings.about_image) : '';

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
  const GoldLine = () => <div className="w-12 h-0.5 mx-auto mb-10" style={{ background: heroAccent }} />;
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
            <div className="w-12 h-0.5 mx-auto mb-4" style={{ background: heroAccent }} />
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
      const sectionImg = section.image_url ? resolveImageUrl(section.image_url) : aboutImage;
      return (
        <section key={section.id || idx} data-testid={`section-${idx}`} className={SECTION_PY} style={{ background: '#1a1a1a' }}>
          <div className={CONTAINER}><div className={WIDE}>
            <h2 className="text-center mb-4" style={applyStyle(template.exp_title_style, { ...HEADING, color: heroAccent, fontStyle: 'italic', fontSize: '1.6rem' })}>
              {section.title || 'Your Experience'}
            </h2>
            <div className="w-12 h-0.5 mx-auto mb-12" style={{ background: heroAccent }} />
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
        <div className="w-14 h-0.5" style={{ background: heroAccent }} />
      </section>

      {sections.map((section, idx) => renderSection(section, idx))}

      {/* CTA */}
      <section className={`${SECTION_PY} bg-white`} data-testid="cta-section">
        <div className={CONTAINER}>
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-14 h-0.5 mx-auto mb-6" style={{ background: heroAccent }} />
            <p className="mb-6" style={applyStyle(template.cta_style, LABEL)}>When you are seeking</p>
            <p className="mb-10 leading-relaxed" style={applyStyle(template.body_style, { ...BODY, fontSize: '1rem', color: '#666' })}>
              When you are ready to experience deep inner transformation and lasting change, this program becomes the foundation for that shift.
            </p>

            {program.is_flagship && program.duration_tiers?.length > 0 && (
              <div data-testid="duration-tiers" className="max-w-3xl mx-auto mb-10">
                <div className={`grid gap-4 ${program.duration_tiers.length === 3 ? 'sm:grid-cols-3' : program.duration_tiers.length === 2 ? 'sm:grid-cols-2' : 'max-w-xs mx-auto'}`}>
                  {program.duration_tiers.map((tier, tIdx) => {
                    const isAnnual = tier.label?.toLowerCase().includes('annual') || tier.label?.toLowerCase().includes('year') || tier.duration_unit === 'year';
                    const tierPrice = getPrice(program, tIdx);
                    const tierOffer = getOfferPrice(program, tIdx);
                    const showContact = isAnnual && tierPrice === 0;
                    return (
                      <div key={tIdx} data-testid={`tier-${tIdx}`}
                        className="border border-gray-200 hover:border-[#D4AF37] rounded-lg p-5 transition-all duration-300 cursor-pointer group hover:shadow-md"
                        style={{ '--hover-accent': heroAccent }}
                        onClick={() => showContact ? navigate(`/contact?program=${program.id}&title=${encodeURIComponent(program.title)}&tier=${tier.label}`) : navigate(`/enroll/program/${program.id}?tier=${tIdx}`)}>
                        <p className="text-sm font-medium text-gray-900 transition-colors mb-2" style={{ fontFamily: "'Lato', sans-serif" }}>{tier.label}</p>
                        {showContact ? (
                          <div><p className="text-gray-400 text-[10px] mb-3">Custom pricing</p>
                            <span className="inline-block text-white text-[10px] py-2 px-6 tracking-[0.15em] uppercase" style={{ background: heroAccent }}>Contact Us</span></div>
                        ) : (
                          <div><div className="mb-3">
                            {tierOffer > 0 ? (<><p className="text-base font-semibold" style={{ ...HEADING, color: heroAccent, fontSize: '1rem' }}>{symbol} {tierOffer.toLocaleString()}</p><p className="text-[10px] text-gray-400 line-through">{symbol} {tierPrice.toLocaleString()}</p></>) : tierPrice > 0 ? (<p className="text-base font-semibold" style={{ ...HEADING, fontSize: '1rem' }}>{symbol} {tierPrice.toLocaleString()}</p>) : (<p className="text-xs text-gray-400 italic">Contact for pricing</p>)}
                          </div><span className="inline-block bg-gray-900 text-white text-[10px] py-2 px-6 tracking-[0.15em] uppercase transition-colors" style={{ ':hover': { background: heroAccent } }}>Select</span></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {program.enrollment_open !== false ? (
                <button data-testid="enroll-btn" onClick={() => navigate(`/enroll/program/${program.id}`)}
                  className="text-white px-10 py-3 text-xs tracking-[0.2em] uppercase transition-colors hover:opacity-90" style={{ background: heroAccent }}>Enroll Now</button>
              ) : (
                <button data-testid="express-interest-btn" onClick={() => navigate(`/contact?program=${program.id}&title=${encodeURIComponent(program.title)}`)}
                  className="text-white px-10 py-3 text-xs tracking-[0.2em] uppercase transition-colors hover:opacity-90" style={{ background: heroAccent }}>Express Your Interest</button>
              )}
            </div>
          </div>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="py-16 bg-white" data-testid="testimonials-section">
          <div className={CONTAINER}>
            <h2 className="text-center mb-10" style={{ ...HEADING, color: heroAccent, fontStyle: 'italic', fontSize: '1.6rem' }}>Testimonials</h2>
            <div className="max-w-5xl mx-auto relative flex items-center justify-center gap-4">
              <button onClick={prevT} data-testid="prev-testimonial" className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 flex-shrink-0"><ChevronLeft size={18} /></button>
              <div className="flex gap-3 overflow-hidden">
                {[0,1,2,3,4].map(offset => {
                  if (!testimonials.length) return null;
                  const t = testimonials[(currentTestimonial + offset) % testimonials.length];
                  if (!t) return null;
                  const imgSrc = t.type === 'graphic' ? resolveImageUrl(t.image) : `https://img.youtube.com/vi/${t.videoId}/hqdefault.jpg`;
                  return <img key={offset} src={imgSrc} alt={t.name || ''} className="w-36 h-36 object-cover rounded-lg shadow flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setLightboxImg(imgSrc)} onError={(e) => { e.target.style.display='none'; }} />;
                })}
              </div>
              <button onClick={nextT} data-testid="next-testimonial" className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 flex-shrink-0"><ChevronRight size={18} /></button>
            </div>
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
