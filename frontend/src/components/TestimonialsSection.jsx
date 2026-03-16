import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import { resolveImageUrl } from '../lib/imageUtils';
import { HEADING, CONTAINER, applySectionStyle } from '../lib/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TestimonialsSection = ({ sectionConfig, inline }) => {
  const [testimonials, setTestimonials] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [activeTab, setActiveTab] = useState('video');
  const scrollRef = useRef(null);

  useEffect(() => {
    loadTestimonials();
  }, []);

  const loadTestimonials = async () => {
    try {
      const response = await axios.get(`${API}/testimonials?visible_only=true`);
      if (response.data && response.data.length > 0) {
        setTestimonials(response.data);
      }
    } catch (error) {
      console.log('Error loading testimonials');
    }
  };

  const videoTestimonials = testimonials.filter(t => t.type === 'video' && t.videoId);
  const graphicTestimonials = testimonials.filter(t => t.type === 'graphic' && t.image);
  const displayList = activeTab === 'video' ? videoTestimonials : graphicTestimonials;

  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 320, behavior: 'smooth' });
    }
  };

  const getThumbnail = (t) => {
    if (t.type === 'video') {
      return t.thumbnail || `https://img.youtube.com/vi/${t.videoId}/hqdefault.jpg`;
    }
    return resolveImageUrl(t.image);
  };

  if (testimonials.length === 0) return null;

  const cardWidth = inline ? 'w-60' : 'w-72 md:w-80';
  const cardHeight = inline ? 'h-40' : 'h-48 md:h-52';

  const content = (
    <>
      <h2 className={inline ? "mb-6 text-xl md:text-2xl" : "text-center mb-8"} style={applySectionStyle(sectionConfig?.title_style, { ...HEADING, fontSize: inline ? undefined : 'clamp(1.5rem, 3vw, 2rem)' })}>
        {sectionConfig?.title || 'Testimonials'}
      </h2>

      {/* Tab Switcher */}
      {videoTestimonials.length > 0 && graphicTestimonials.length > 0 && (
        <div className={`flex ${inline ? '' : 'justify-center'} gap-3 mb-6`}>
          <button data-testid="testimonial-tab-video" onClick={() => setActiveTab('video')}
            className={`px-4 py-1.5 rounded-full text-xs tracking-wider transition-all duration-300 ${activeTab === 'video' ? 'bg-[#D4AF37] text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Video
          </button>
          <button data-testid="testimonial-tab-graphic" onClick={() => setActiveTab('graphic')}
            className={`px-4 py-1.5 rounded-full text-xs tracking-wider transition-all duration-300 ${activeTab === 'graphic' ? 'bg-[#D4AF37] text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Transformations
          </button>
        </div>
      )}

      {/* Carousel */}
      <div className="relative">
        {!inline && displayList.length > 3 && (
          <button onClick={() => scroll(-1)} data-testid="testimonial-prev"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors -ml-5">
            <ChevronLeft size={20} />
          </button>
        )}
        <div ref={scrollRef}
          className={`flex gap-4 overflow-x-auto scroll-smooth pb-4 ${inline ? '' : 'px-2'}`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {displayList.map((testimonial) => (
            <div key={testimonial.id} data-testid={`testimonial-card-${testimonial.id}`}
              className={`flex-shrink-0 ${cardWidth} relative group cursor-pointer overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300`}
              onClick={() => {
                if (testimonial.type === 'video') setSelectedVideo(testimonial.videoId);
                else if (testimonial.type === 'graphic') setSelectedImage(getThumbnail(testimonial));
              }}>
              <img src={getThumbnail(testimonial)} alt={testimonial.name || 'Testimonial'}
                className={`w-full ${cardHeight} object-cover transition-transform duration-500 group-hover:scale-105`}
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop'; }} />
              {testimonial.type === 'video' && (
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center">
                  <div className="w-12 h-12 bg-[#D4AF37] rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300 shadow-xl">
                    <Play size={18} className="text-white ml-0.5" fill="white" />
                  </div>
                </div>
              )}
              {testimonial.name && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-white text-xs font-medium">{testimonial.name}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        {!inline && displayList.length > 3 && (
          <button onClick={() => scroll(1)} data-testid="testimonial-next"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors -mr-5">
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Video Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
          {selectedVideo && (
            <div className="relative" style={{ paddingBottom: '56.25%' }}>
              <iframe className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1`}
                title="YouTube video player" frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent data-testid="testimonial-lightbox" className="max-w-4xl p-1 bg-white">
          {selectedImage && (
            <img src={selectedImage} alt="Testimonial" className="w-full h-auto max-h-[85vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  if (inline) return <div data-testid="testimonials-section">{content}</div>;

  return (
    <section id="media" data-testid="testimonials-section" className="py-12 relative" style={{ background: 'linear-gradient(180deg, #f3edff 0%, #f5f0ff 10%, #ffffff 30%, #ffffff 50%, #ffffff 70%, #f5f0ff 90%, #f3edff 100%)' }}>
      <div className={CONTAINER}>{content}</div>
    </section>
  );
};

export default TestimonialsSection;
