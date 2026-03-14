import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play } from 'lucide-react';
import { Dialog, DialogContent } from '../components/ui/dialog';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { resolveImageUrl } from '../lib/imageUtils';
import { HEADING, SUBTITLE, LABEL, GOLD, CONTAINER, SECTION_PY } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const applyHeroStyle = (styleObj, defaults = {}) => {
  if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
  return {
    ...defaults,
    ...(styleObj.font_family && { fontFamily: styleObj.font_family }),
    ...(styleObj.font_size && { fontSize: styleObj.font_size }),
    ...(styleObj.font_color && { color: styleObj.font_color }),
    ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }),
    ...(styleObj.font_style && { fontStyle: styleObj.font_style }),
  };
};

function MediaPage() {
  const [settings, setSettings] = useState(null);
  const [testimonials, setTestimonials] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
    axios.get(`${API}/testimonials`).then(r => setTestimonials(r.data)).catch(() => {});
  }, []);

  const hero = settings?.page_heroes?.media || {};
  const videoTestimonials = testimonials.filter(t => t.type === 'video');
  const graphicTestimonials = testimonials.filter(t => t.type === 'graphic');

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section data-testid="media-hero" className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6 pt-20"
        style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #1a1a1add 50%, #1a1a1a 100%)' }}>
        <h1 className="mb-4 max-w-4xl" style={applyHeroStyle(hero.title_style, { ...HEADING, color: GOLD, fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontVariant: 'small-caps', letterSpacing: '0.05em', lineHeight: 1.3 })}>
          {hero.title_text || 'Media'}
        </h1>
        <p className="mb-6" style={applyHeroStyle(hero.subtitle_style, { ...LABEL, color: '#fff' })}>
          {hero.subtitle_text || ''}
        </p>
        <div className="w-14 h-0.5" style={{ background: GOLD }} />
      </section>

      {/* Video Testimonials */}
      {videoTestimonials.length > 0 && (
        <section className={SECTION_PY}>
          <div className={CONTAINER}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {videoTestimonials.map(t => (
                <div key={t.id} className="relative group cursor-pointer overflow-hidden rounded-lg shadow hover:shadow-xl transition-all"
                  onClick={() => setSelectedVideo(t.videoId)} data-testid={`media-video-${t.id}`}>
                  <img src={`https://img.youtube.com/vi/${t.videoId}/hqdefault.jpg`} alt={t.name || ''} className="w-full h-56 object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-all flex items-center justify-center">
                    <div className="w-14 h-14 bg-[#D4AF37] rounded-full flex items-center justify-center shadow-lg">
                      <Play size={24} className="text-white ml-0.5" fill="white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Graphic Testimonials */}
      {graphicTestimonials.length > 0 && (
        <section className={`${SECTION_PY} bg-gray-50`}>
          <div className={CONTAINER}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
              {graphicTestimonials.map(t => {
                const src = t.image ? resolveImageUrl(t.image) : '';
                return (
                  <div key={t.id} className="cursor-pointer overflow-hidden rounded-lg shadow hover:shadow-lg transition-all"
                    onClick={() => setSelectedImage(src)} data-testid={`media-graphic-${t.id}`}>
                    <img src={src} alt={t.name || ''} className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300" />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Video Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
          {selectedVideo && (
            <div className="relative" style={{ paddingBottom: '56.25%' }}>
              <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1`} title="Video" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-1 bg-white">
          {selectedImage && <img src={selectedImage} alt="Testimonial" className="w-full h-auto max-h-[85vh] object-contain rounded" />}
        </DialogContent>
      </Dialog>

      <Footer />
      <FloatingButtons />
    </div>
  );
}

export default MediaPage;
