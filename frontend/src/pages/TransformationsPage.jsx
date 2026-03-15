import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import TemplateTestimonialCard, { TemplateTestimonialFull } from '../components/TemplateTestimonialCard';
import { Search, Play, X, Filter } from 'lucide-react';
import { resolveImageUrl } from '../lib/imageUtils';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { HEADING, GOLD, LABEL, CONTAINER } from '../lib/designTokens';

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
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
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

  useEffect(() => {
    loadTestimonials();
  }, [searchQuery, activeType, selectedProgram, selectedSession]);

  const loadTestimonials = async () => {
    try {
      const params = new URLSearchParams();
      if (activeType !== 'all') params.append('type', activeType);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedProgram) params.append('program_id', selectedProgram);
      if (selectedSession) params.append('session_id', selectedSession);
      params.append('visible_only', 'true');
      const response = await axios.get(`${API}/testimonials?${params}`);
      setTestimonials(response.data);
    } catch (error) {
      console.error('Error loading testimonials:', error);
    } finally {
      setLoading(false);
    }
  };

  const templateTestimonials = useMemo(() => testimonials.filter(t => t.type === 'template'), [testimonials]);
  const graphicTestimonials = useMemo(() => testimonials.filter(t => t.type === 'graphic' && t.image), [testimonials]);
  const videoTestimonials = useMemo(() => testimonials.filter(t => t.type === 'video' && t.videoId), [testimonials]);

  const hasActiveFilters = selectedProgram || selectedSession || searchQuery;
  const hero = settings?.page_heroes?.transformations || {};

  const applyHeroStyle = (styleObj, defaults = {}) => {
    if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
    return { ...defaults, ...(styleObj.font_family && { fontFamily: styleObj.font_family }), ...(styleObj.font_size && { fontSize: styleObj.font_size }), ...(styleObj.font_color && { color: styleObj.font_color }), ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }), ...(styleObj.font_style && { fontStyle: styleObj.font_style }) };
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setActiveType('all');
    setSelectedProgram('');
    setSelectedSession('');
  };

  const typeTabs = [
    { key: 'all', label: 'All' },
    { key: 'template', label: 'Text Stories' },
    { key: 'graphic', label: 'Graphics' },
    { key: 'video', label: 'Videos' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section
        data-testid="transformations-hero"
        className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6 pt-24"
        style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #1a1a1add 50%, #1a1a1a 100%)' }}
      >
        <h1 className="text-white mb-4 max-w-4xl" style={applyHeroStyle(hero.title_style, { ...HEADING, color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontVariant: 'small-caps', letterSpacing: '0.05em', lineHeight: 1.3 })}>
          {hero.title_text || 'Transformations'}
        </h1>
        <p className="mb-6" style={applyHeroStyle(hero.subtitle_style, { ...LABEL, color: GOLD })}>
          {hero.subtitle_text || 'Stories of Healing, Growth & Awakening'}
        </p>
        <div className="w-14 h-0.5" style={{ background: GOLD }} />
      </section>

      {/* Search + Filter Bar */}
      <section className="py-6 border-b sticky top-0 z-30" style={{ background: 'linear-gradient(180deg, #f8f5ff, #ffffff)' }}>
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  data-testid="transformations-search"
                  placeholder="Search by name, keyword, healing type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-gray-200 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none text-sm"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Type Tabs */}
              <div className="flex gap-1.5">
                {typeTabs.map(tab => (
                  <button
                    key={tab.key}
                    data-testid={`tab-${tab.key}`}
                    onClick={() => setActiveType(tab.key)}
                    className={`px-4 py-2 rounded-full text-[11px] font-medium tracking-wider transition-all ${
                      activeType === tab.key ? 'bg-[#D4AF37] text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Filter Toggle */}
              <button
                data-testid="filter-toggle"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-medium tracking-wider transition-all border ${
                  showFilters || hasActiveFilters ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Filter size={13} />
                Filters
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
              </button>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100" data-testid="filter-panel">
                <select
                  data-testid="filter-program"
                  value={selectedProgram}
                  onChange={(e) => setSelectedProgram(e.target.value)}
                  className="border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-600 focus:border-[#D4AF37] outline-none"
                >
                  <option value="">All Programs</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                <select
                  data-testid="filter-session"
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-600 focus:border-[#D4AF37] outline-none"
                >
                  <option value="">All Sessions</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
                {hasActiveFilters && (
                  <button
                    data-testid="clear-filters"
                    onClick={clearAllFilters}
                    className="text-xs text-red-400 hover:text-red-600 underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Results Count */}
      {!loading && (
        <div className="container mx-auto px-4 pt-6">
          <p className="text-xs text-gray-400 text-center" data-testid="results-count">
            {testimonials.length} transformation{testimonials.length !== 1 ? 's' : ''} found
            {hasActiveFilters && <span> &middot; <button onClick={clearAllFilters} className="text-[#D4AF37] hover:underline">show all</button></span>}
          </p>
        </div>
      )}

      {/* Template Testimonials (Text Stories) */}
      {(activeType === 'all' || activeType === 'template') && templateTestimonials.length > 0 && (
        <section data-testid="template-testimonials" className="py-10" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #faf8ff 50%, #f5f0ff 100%)' }}>
          <div className="container mx-auto px-4">
            {activeType === 'all' && (
              <h2 className="text-center mb-8" style={{ ...HEADING, fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)', color: '#4c1d95', fontStyle: 'italic' }}>
                Healing Stories
              </h2>
            )}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {templateTestimonials.map(t => (
                <TemplateTestimonialCard
                  key={t.id}
                  testimonial={t}
                  onClick={() => setSelectedTemplate(t)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Graphic Testimonials */}
      {(activeType === 'all' || activeType === 'graphic') && graphicTestimonials.length > 0 && (
        <section data-testid="graphic-testimonials" className="py-10">
          <div className="container mx-auto px-4">
            {activeType === 'all' && (
              <h2 className="text-center mb-8" style={{ ...HEADING, fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)', color: '#4c1d95', fontStyle: 'italic' }}>
                Graphic Testimonials
              </h2>
            )}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {graphicTestimonials.map(t => (
                <div
                  key={t.id}
                  data-testid={`graphic-card-${t.id}`}
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden cursor-pointer border border-gray-100"
                  onClick={() => setSelectedImage(resolveImageUrl(t.image))}
                >
                  <img src={resolveImageUrl(t.image)} alt={t.name || 'Testimonial'} className="w-full h-auto object-contain" loading="lazy" />
                  {t.name && (
                    <div className="p-3 text-center">
                      <p className="text-xs font-medium text-gray-700">{t.name}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Video Testimonials */}
      {(activeType === 'all' || activeType === 'video') && videoTestimonials.length > 0 && (
        <section data-testid="video-testimonials" className="py-10" style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)' }}>
          <div className="container mx-auto px-4">
            {activeType === 'all' && (
              <h2 className="text-center mb-8 text-white" style={{ ...HEADING, fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)', fontStyle: 'italic' }}>
                Video Testimonials
              </h2>
            )}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {videoTestimonials.map(t => (
                <div
                  key={t.id}
                  data-testid={`video-card-${t.id}`}
                  className="relative group cursor-pointer overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300"
                  onClick={() => setSelectedVideo(t.videoId)}
                >
                  <img
                    src={t.thumbnail || `https://img.youtube.com/vi/${t.videoId}/maxresdefault.jpg`}
                    alt={t.name || 'Video'}
                    className="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center">
                    <div className="w-14 h-14 bg-[#D4AF37] rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300 shadow-xl">
                      <Play size={20} className="text-white ml-0.5" fill="white" />
                    </div>
                  </div>
                  {t.name && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      <p className="text-white text-sm font-medium">{t.name}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {!loading && testimonials.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-gray-400 text-sm">No testimonials found matching your filters.</p>
          <button onClick={clearAllFilters} className="mt-3 text-[#D4AF37] hover:underline text-xs tracking-wider">
            Clear all filters
          </button>
        </div>
      )}

      {/* Template Detail Modal */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl" style={{ border: '1px solid rgba(123,104,238,0.15)' }}>
          {selectedTemplate && <TemplateTestimonialFull testimonial={selectedTemplate} />}
        </DialogContent>
      </Dialog>

      {/* Video Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
          {selectedVideo && (
            <div className="relative" style={{ paddingBottom: '56.25%' }}>
              <iframe className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1`}
                title="YouTube video player" frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-white">
          {selectedImage && <img src={selectedImage} alt="Testimonial" className="w-full h-auto rounded-lg" />}
        </DialogContent>
      </Dialog>

      <Footer />
      <FloatingButtons />
    </div>
  );
}

export default TransformationsPage;
