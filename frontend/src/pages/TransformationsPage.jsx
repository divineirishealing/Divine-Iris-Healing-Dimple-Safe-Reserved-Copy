import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { Search, Play, X } from 'lucide-react';
import { resolveImageUrl } from '../lib/imageUtils';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { HEADING, SUBTITLE, BODY, GOLD, LABEL, CONTAINER, SECTION_PY } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function TransformationsPage() {
  const [testimonials, setTestimonials] = useState([]);
  const [settings, setSettings] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadTestimonials();
  }, [searchQuery, activeTab]);

  const loadTestimonials = async () => {
    try {
      let url = `${API}/testimonials?`;
      if (activeTab === 'graphic') url += 'type=graphic&';
      if (activeTab === 'video') url += 'type=video&';
      if (searchQuery.trim()) url += `search=${encodeURIComponent(searchQuery.trim())}&`;
      const response = await axios.get(url);
      setTestimonials(response.data);
    } catch (error) {
      console.error('Error loading testimonials:', error);
    } finally {
      setLoading(false);
    }
  };

  const graphicTestimonials = testimonials.filter(t => t.type === 'graphic');
  const videoTestimonials = testimonials.filter(t => t.type === 'video');

  const hero = settings?.page_heroes?.transformations || {};

  const applyHeroStyle = (styleObj, defaults = {}) => {
    if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
    return { ...defaults, ...(styleObj.font_family && { fontFamily: styleObj.font_family }), ...(styleObj.font_size && { fontSize: styleObj.font_size }), ...(styleObj.font_color && { color: styleObj.font_color }), ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }), ...(styleObj.font_style && { fontStyle: styleObj.font_style }) };
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section
        data-testid="transformations-hero"
        className="min-h-[45vh] flex flex-col items-center justify-center text-center px-6 pt-24"
        style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)' }}
      >
        <h1 className="mb-2" style={applyHeroStyle(hero.title_style, { ...HEADING, color: GOLD, fontSize: 'clamp(2rem, 5vw, 3rem)', fontVariant: 'small-caps', letterSpacing: '0.1em' })}>
          {hero.title_text || 'TRANSFORMATIONS'}
        </h1>
        <p style={applyHeroStyle(hero.subtitle_style, { ...SUBTITLE, color: '#999', fontFamily: "'Lato', sans-serif", fontSize: '0.8rem', letterSpacing: '0.2em' })}>
          {hero.subtitle_text || 'Stories of Healing, Growth & Awakening'}
        </p>
      </section>

      {/* Search + Filter Bar */}
      <section className="py-8 bg-gray-50 border-b sticky top-0 z-30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                data-testid="transformations-search"
                placeholder="Search testimonials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-full border border-gray-200 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none text-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'graphic', label: 'Graphic' },
                { key: 'video', label: 'Video' },
              ].map(tab => (
                <button
                  key={tab.key}
                  data-testid={`tab-${tab.key}`}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-5 py-2 rounded-full text-xs font-medium tracking-wider transition-all ${
                    activeTab === tab.key
                      ? 'bg-[#D4AF37] text-white shadow-md'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Graphic Testimonials */}
      {(activeTab === 'all' || activeTab === 'graphic') && graphicTestimonials.length > 0 && (
        <section data-testid="graphic-testimonials" className="py-12">
          <div className="container mx-auto px-4">
            {activeTab === 'all' && (
              <h2 className="text-2xl text-center text-gray-900 mb-10">Graphic Testimonials</h2>
            )}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {graphicTestimonials.map((t) => (
                <div
                  key={t.id}
                  data-testid={`graphic-card-${t.id}`}
                  className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden cursor-pointer"
                  onClick={() => setSelectedImage(resolveImageUrl(t.image))}
                >
                  <img
                    src={resolveImageUrl(t.image)}
                    alt={t.name || `Testimonial`}
                    className="w-full h-auto object-contain"
                    loading="lazy"
                  />
                  {t.name && (
                    <div className="p-3 text-center">
                      <p className="text-sm font-medium text-gray-800">{t.name}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Video Testimonials */}
      {(activeTab === 'all' || activeTab === 'video') && videoTestimonials.length > 0 && (
        <section data-testid="video-testimonials" className="py-12 bg-gray-900">
          <div className="container mx-auto px-4">
            {activeTab === 'all' && (
              <h2 className="text-2xl text-center text-white mb-10">Video Testimonials</h2>
            )}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videoTestimonials.map((t) => (
                <div
                  key={t.id}
                  data-testid={`video-card-${t.id}`}
                  className="relative group cursor-pointer overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300"
                  onClick={() => setSelectedVideo(t.videoId)}
                >
                  <img
                    src={t.thumbnail || `https://img.youtube.com/vi/${t.videoId}/maxresdefault.jpg`}
                    alt={t.name || 'Video testimonial'}
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
          <p className="text-gray-500 text-lg">No testimonials found matching your search.</p>
          <button onClick={() => { setSearchQuery(''); setActiveTab('all'); }} className="mt-4 text-[#D4AF37] hover:underline text-sm">
            Clear filters
          </button>
        </div>
      )}

      {/* Video Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
          {selectedVideo && (
            <div className="relative" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-white">
          {selectedImage && (
            <img src={selectedImage} alt="Testimonial" className="w-full h-auto rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      <Footer />
      <FloatingButtons />
    </div>
  );
}

export default TransformationsPage;
