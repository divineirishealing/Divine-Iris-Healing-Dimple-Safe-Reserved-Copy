import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import ConstellationCanvas from '../components/ConstellationCanvas';
import { SoulfulWrittenCard, SoulfulVideoCard, SoulfulGraphicCard, SoulfulTestimonialFull } from '../components/SoulfulTestimonialCard';
import { Search, X, Filter, Sparkles } from 'lucide-react';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { HEADING, GOLD, LABEL, CONTAINER } from '../lib/designTokens';
import { resolveImageUrl } from '../lib/imageUtils';
import { resolveTransformationsSection } from '../lib/transformationsSectionDefaults';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function TransformationsPage() {
  const [testimonials, setTestimonials] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState('all');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEmbed, setSelectedEmbed] = useState(null);   // { embedUrl }
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/settings`),
      axios.get(`${API}/programs?visible_only=true`),
      axios.get(`${API}/sessions?visible_only=true`),
    ]).then(([sRes, pRes, sesRes]) => {
      setSettings(sRes.data);
      setPrograms(pRes.data || []);
      setSessions(sesRes.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadTestimonials(); }, [searchQuery, activeType, selectedProgram, selectedSession]);

  const loadTestimonials = async () => {
    try {
      const params = new URLSearchParams();
      if (activeType !== 'all') params.append('type', activeType);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedProgram) params.append('program_id', selectedProgram);
      if (selectedSession) params.append('session_id', selectedSession);
      params.append('visible_only', 'true');
      const res = await axios.get(`${API}/testimonials?${params}`);
      setTestimonials(res.data);
    } catch { /* silently ignore */ }
    finally { setLoading(false); }
  };

  const writtenTestimonials = useMemo(() => testimonials.filter(t => t.type === 'template'), [testimonials]);
  const videoTestimonials   = useMemo(() => testimonials.filter(t => t.type === 'video' && (t.video_url || t.videoId)), [testimonials]);
  const graphicTestimonials = useMemo(() => testimonials.filter(t => t.type === 'graphic' && t.image), [testimonials]);

  const hasActiveFilters = selectedProgram || selectedSession || searchQuery;
  const hero = settings?.page_heroes?.transformations || {};
  const section = resolveTransformationsSection(hero);
  const galleryVisible = settings?.transformations_gallery_visible !== false;

  const applyHeroStyle = (styleObj, defaults = {}) => {
    if (!styleObj || !Object.keys(styleObj).length) return defaults;
    return {
      ...defaults,
      ...(styleObj.font_family && { fontFamily: styleObj.font_family }),
      ...(styleObj.font_size && { fontSize: styleObj.font_size }),
      ...(styleObj.font_color && { color: styleObj.font_color }),
      ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }),
      ...(styleObj.font_style && { fontStyle: styleObj.font_style }),
      ...(styleObj.letter_spacing !== undefined && styleObj.letter_spacing !== '' && { letterSpacing: styleObj.letter_spacing }),
      ...(styleObj.text_align && { textAlign: styleObj.text_align }),
    };
  };

  const clearAllFilters = () => { setSearchQuery(''); setActiveType('all'); setSelectedProgram(''); setSelectedSession(''); };

  const typeTabs = useMemo(() => {
    const tabs = [
      { key: 'all', label: 'All' },
      { key: 'template', label: 'Stories' },
      { key: 'video', label: 'Videos' },
      { key: 'graphic', label: 'Gallery' },
    ];
    if (!galleryVisible) return tabs.filter(t => t.key !== 'graphic');
    return tabs;
  }, [galleryVisible]);

  useEffect(() => {
    if (!galleryVisible && activeType === 'graphic') setActiveType('all');
  }, [galleryVisible, activeType]);

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        data-testid="transformations-hero"
        className="relative min-h-[50vh] flex flex-col items-center justify-center text-center px-6 pt-24"
        style={{ background: hero.hero_image ? 'transparent' : 'linear-gradient(180deg, #0d0618 0%, #1a0a3e 60%, #0f0a1e 100%)' }}
      >
        {hero.hero_image && <div className="absolute inset-0" style={{ backgroundImage: `url(${resolveImageUrl(hero.hero_image)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
        {hero.hero_image && <div className="absolute inset-0 bg-black" style={{ opacity: (hero.overlay_opacity || 60) / 100 }} />}

        {/* Moving constellation */}
        <ConstellationCanvas style={{ zIndex: 1, opacity: 0.85 }} />

        <div className="relative z-10 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px w-8" style={{ background: 'rgba(212,175,55,0.4)' }} />
            <Sparkles size={14} style={{ color: '#D4AF37', opacity: 0.8 }} />
            <div className="h-px w-8" style={{ background: 'rgba(212,175,55,0.4)' }} />
          </div>
          <h1 className="text-white mb-4 max-w-4xl"
            style={applyHeroStyle(hero.title_style, { ...HEADING, color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontVariant: 'small-caps', letterSpacing: '0.05em', lineHeight: 1.3 })}>
            {hero.title_text || 'Transformations'}
          </h1>
          <p className="mb-6"
            style={applyHeroStyle(hero.subtitle_style, { ...LABEL, color: GOLD })}>
            {hero.subtitle_text || 'Stories of Healing, Growth & Awakening'}
          </p>
          <div className="w-14 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)' }} />
        </div>
      </section>

      {/* ── Search + Filter Bar ───────────────────────────────────────────── */}
      <section className="py-5 border-b sticky top-0 z-30" style={{ background: 'linear-gradient(180deg, #faf7ff, #ffffff)' }}>
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" data-testid="transformations-search"
                  placeholder="Search by name, keyword, healing type..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-gray-200 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none text-sm" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                )}
              </div>
              <div className="flex gap-1.5">
                {typeTabs.map(tab => (
                  <button key={tab.key} data-testid={`tab-${tab.key}`} onClick={() => setActiveType(tab.key)}
                    className={`px-4 py-2 rounded-full text-[11px] font-medium tracking-wider transition-all ${
                      activeType === tab.key ? 'bg-[#D4AF37] text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <button data-testid="filter-toggle" onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-medium tracking-wider transition-all border ${
                  showFilters || hasActiveFilters ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}>
                <Filter size={13} /> Filters
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
              </button>
            </div>
            {showFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100" data-testid="filter-panel">
                <select data-testid="filter-program" value={selectedProgram} onChange={e => setSelectedProgram(e.target.value)}
                  className="border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-600 focus:border-[#D4AF37] outline-none">
                  <option value="">All Programs</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <select data-testid="filter-session" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}
                  className="border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-600 focus:border-[#D4AF37] outline-none">
                  <option value="">All Sessions</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
                {hasActiveFilters && (
                  <button data-testid="clear-filters" onClick={clearAllFilters} className="text-xs text-red-400 hover:text-red-600 underline">Clear all</button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {!loading && (
        <div className="container mx-auto px-4 pt-5 pb-1">
          <p className="text-xs text-gray-400 text-center" data-testid="results-count">
            {testimonials.length} transformation{testimonials.length !== 1 ? 's' : ''} found
            {hasActiveFilters && <span> · <button onClick={clearAllFilters} className="text-[#D4AF37] hover:underline">show all</button></span>}
          </p>
        </div>
      )}

      {/* ── Written / Template Stories ────────────────────────────────────── */}
      {(activeType === 'all' || activeType === 'template') && writtenTestimonials.length > 0 && (
        <section data-testid="written-testimonials" className="py-12"
          style={{ background: 'linear-gradient(180deg, #ffffff 0%, #faf7ff 50%, #f5f0ff 100%)' }}>
          <div className="container mx-auto px-4">
            {(activeType === 'all' || activeType === 'template') && (
              <div className="text-center mb-10">
                <p className="text-[11px] tracking-[0.25em] uppercase mb-2" style={{ color: '#D4AF37', fontFamily: "'Lato', sans-serif" }}>{section.stories_kicker}</p>
                <h2 style={{ ...HEADING, fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)', color: '#4c1d95', fontStyle: 'italic' }}>
                  {section.stories_title}
                </h2>
                <div className="w-10 h-px mx-auto mt-3" style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)' }} />
              </div>
            )}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {writtenTestimonials.map(t => (
                <SoulfulWrittenCard key={t.id} testimonial={t} footerCentered onClick={() => setSelectedTemplate(t)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Video Testimonials ────────────────────────────────────────────── */}
      {(activeType === 'all' || activeType === 'video') && videoTestimonials.length > 0 && (
        <section data-testid="video-testimonials" className="py-12"
          style={{ background: 'linear-gradient(180deg, #0d0618 0%, #1a0a3e 50%, #0f0a1e 100%)' }}>
          <div className="container mx-auto px-4">
            {(activeType === 'all' || activeType === 'video') && (
              <div className="text-center mb-10">
                <p className="text-[11px] tracking-[0.25em] uppercase mb-2" style={{ color: 'rgba(212,175,55,0.7)', fontFamily: "'Lato', sans-serif" }}>{section.video_kicker}</p>
                <h2 style={{ ...HEADING, fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)', color: '#f5f0ff', fontStyle: 'italic' }}>
                  {section.video_title}
                </h2>
                <div className="w-10 h-px mx-auto mt-3" style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)' }} />
              </div>
            )}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videoTestimonials.map(t => (
                <SoulfulVideoCard key={t.id} testimonial={t} footerCentered
                  onPlay={(embedUrl, platform) => setSelectedEmbed({ embedUrl, platform })}
                  onOpen={url => window.open(url, '_blank')}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Graphic Gallery ───────────────────────────────────────────────── */}
      {galleryVisible && (activeType === 'all' || activeType === 'graphic') && graphicTestimonials.length > 0 && (
        <section data-testid="graphic-testimonials" className="py-12"
          style={{ background: 'linear-gradient(180deg, #faf7ff, #ffffff)' }}>
          <div className="container mx-auto px-4">
            {(activeType === 'all' || activeType === 'graphic') && (
              <div className="text-center mb-10">
                <p className="text-[11px] tracking-[0.25em] uppercase mb-2" style={{ color: '#D4AF37', fontFamily: "'Lato', sans-serif" }}>{section.gallery_kicker}</p>
                <h2 style={{ ...HEADING, fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)', color: '#4c1d95', fontStyle: 'italic' }}>
                  {section.gallery_title}
                </h2>
                <div className="w-10 h-px mx-auto mt-3" style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)' }} />
              </div>
            )}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {graphicTestimonials.map(t => (
                <SoulfulGraphicCard key={t.id} testimonial={t} footerCentered onClick={() => setSelectedImage(resolveImageUrl(t.image))} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Empty State ───────────────────────────────────────────────────── */}
      {!loading && testimonials.length === 0 && (
        <div className="py-24 text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(212,175,55,0.06))' }}>
            <Sparkles size={24} className="text-purple-300" />
          </div>
          <p className="text-gray-400 text-sm">No testimonials found matching your filters.</p>
          <button onClick={clearAllFilters} className="mt-3 text-[#D4AF37] hover:underline text-xs tracking-wider">
            Clear all filters
          </button>
        </div>
      )}

      {/* ── Full Story Modal ──────────────────────────────────────────────── */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl" style={{ border: '1px solid rgba(123,104,238,0.15)' }}>
          {selectedTemplate && <SoulfulTestimonialFull testimonial={selectedTemplate} />}
        </DialogContent>
      </Dialog>

      {/* ── Embed Video Modal ─────────────────────────────────────────────── */}
      <Dialog open={!!selectedEmbed} onOpenChange={() => setSelectedEmbed(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black rounded-2xl">
          {selectedEmbed && (
            <div className="relative" style={{ paddingBottom: selectedEmbed.platform === 'instagram' ? '120%' : '56.25%' }}>
              <iframe className="absolute inset-0 w-full h-full"
                src={selectedEmbed.embedUrl}
                title="Video testimonial" frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Image Lightbox ────────────────────────────────────────────────── */}
      {selectedImage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={() => setSelectedImage(null)}
          style={{ background: 'rgba(0,0,0,0.88)' }}>
          <button onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-50">
            <span className="text-white text-xl font-light">&times;</span>
          </button>
          <img src={selectedImage} alt="Transformation"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl"
            style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()} />
        </div>
      )}

      <Footer />
      <FloatingButtons />
    </div>
  );
}

export default TransformationsPage;
