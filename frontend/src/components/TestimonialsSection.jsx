import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import { resolveImageUrl } from '../lib/imageUtils';
import { HEADING, CONTAINER, applySectionStyle } from '../lib/designTokens';
import {
  SoulfulWrittenCard,
  SoulfulVideoCard,
  SoulfulGraphicCard,
  SoulfulTestimonialFull,
} from './SoulfulTestimonialCard';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TestimonialsSection = ({ sectionConfig, inline }) => {
  const [testimonials, setTestimonials] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedEmbed, setSelectedEmbed]     = useState(null);
  const [selectedImage, setSelectedImage]     = useState(null);

  useEffect(() => {
    axios.get(`${API}/testimonials?visible_only=true`)
      .then(r => { if (r.data?.length) setTestimonials(r.data); })
      .catch(() => {});
  }, []);

  const writtenList = useMemo(() => testimonials.filter(t => t.type === 'template'), [testimonials]);
  const videoList   = useMemo(() => testimonials.filter(t => t.type === 'video' && (t.video_url || t.videoId)), [testimonials]);
  const graphicList = useMemo(() => testimonials.filter(t => t.type === 'graphic' && t.image), [testimonials]);

  if (testimonials.length === 0) return null;

  const title = sectionConfig?.title || 'Transformations';

  const content = (
    <>
      {/* Section header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="h-px w-8" style={{ background: 'rgba(212,175,55,0.4)' }} />
          <Sparkles size={13} style={{ color: '#D4AF37', opacity: 0.8 }} />
          <div className="h-px w-8" style={{ background: 'rgba(212,175,55,0.4)' }} />
        </div>
        <h2
          className="mb-3"
          style={applySectionStyle(sectionConfig?.title_style, {
            ...HEADING,
            fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
            color: '#2d1a5e',
          })}
        >
          {title}
        </h2>
        {sectionConfig?.subtitle && (
          <p className="text-sm text-gray-500 max-w-lg mx-auto">{sectionConfig.subtitle}</p>
        )}
        <div className="w-14 h-0.5 mx-auto mt-3" style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)' }} />
      </div>

      {/* ── Written stories ── */}
      {writtenList.length > 0 && (
        <div className="mb-10">
          <p className="text-[10px] tracking-[0.25em] uppercase text-center mb-5"
            style={{ color: '#D4AF37', fontFamily: "'Lato', sans-serif" }}>
            Healing Stories
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {writtenList.map(t => (
              <SoulfulWrittenCard key={t.id} testimonial={t} onClick={() => setSelectedTemplate(t)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Video testimonials ── */}
      {videoList.length > 0 && (
        <div className="mb-10 rounded-2xl py-8 px-4 md:px-6"
          style={{ background: 'linear-gradient(135deg, #0d0618 0%, #1a0a3e 60%, #0f0a1e 100%)' }}>
          <p className="text-[10px] tracking-[0.25em] uppercase text-center mb-5"
            style={{ color: 'rgba(212,175,55,0.75)', fontFamily: "'Lato', sans-serif" }}>
            Watch &amp; Feel
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {videoList.map(t => (
              <SoulfulVideoCard key={t.id} testimonial={t}
                onPlay={(embedUrl, platform) => setSelectedEmbed({ embedUrl, platform })}
                onOpen={url => window.open(url, '_blank')}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Graphic gallery ── */}
      {graphicList.length > 0 && (
        <div className="mb-10">
          <p className="text-[10px] tracking-[0.25em] uppercase text-center mb-5"
            style={{ color: '#D4AF37', fontFamily: "'Lato', sans-serif" }}>
            Transformation Gallery
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {graphicList.map(t => (
              <SoulfulGraphicCard key={t.id} testimonial={t}
                onClick={() => setSelectedImage(resolveImageUrl(t.image))}
              />
            ))}
          </div>
        </div>
      )}

      {/* View All link */}
      <div className="text-center mt-4">
        <a href="/transformations"
          className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-semibold tracking-wide transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            color: '#fff',
            boxShadow: '0 4px 18px rgba(124,58,237,0.3)',
          }}>
          View All Transformations <ArrowRight size={15} />
        </a>
      </div>

      {/* Full story modal */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl"
          style={{ border: '1px solid rgba(123,104,238,0.15)' }}>
          {selectedTemplate && <SoulfulTestimonialFull testimonial={selectedTemplate} />}
        </DialogContent>
      </Dialog>

      {/* Video embed modal */}
      <Dialog open={!!selectedEmbed} onOpenChange={() => setSelectedEmbed(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black rounded-2xl">
          {selectedEmbed && (
            <div className="relative"
              style={{ paddingBottom: selectedEmbed.platform === 'instagram' ? '120%' : '56.25%' }}>
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

      {/* Image lightbox */}
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
    </>
  );

  if (inline) return <div data-testid="testimonials-section">{content}</div>;

  return (
    <section id="transformations" data-testid="testimonials-section" className="py-16">
      <div className={CONTAINER}>{content}</div>
    </section>
  );
};

export default TestimonialsSection;
