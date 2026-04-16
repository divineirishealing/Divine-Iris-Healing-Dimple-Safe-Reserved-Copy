import React, { useState, useEffect, useMemo, useRef } from 'react';
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

/* Card wrapper — fixed width so exactly 5 show at once */
const CARD_W  = 300;  // px
const CARD_GAP = 20;  // px

const TestimonialsSection = ({ sectionConfig, inline }) => {
  const [testimonials, setTestimonials]   = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedEmbed, setSelectedEmbed]       = useState(null);
  const [selectedImage, setSelectedImage]       = useState(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    axios.get(`${API}/testimonials?visible_only=true`)
      .then(r => { if (r.data?.length) setTestimonials(r.data); })
      .catch(() => {});
  }, []);

  const writtenList = useMemo(() => testimonials.filter(t => t.type === 'template'), [testimonials]);
  const videoList   = useMemo(() => testimonials.filter(t => t.type === 'video' && (t.video_url || t.videoId)), [testimonials]);
  const graphicList = useMemo(() => testimonials.filter(t => t.type === 'graphic' && t.image), [testimonials]);

  /* Only video testimonials on the home page carousel */
  const allCards = useMemo(() =>
    videoList.map(c => ({ ...c, _type: 'video' })),
  [videoList]);

  /* Repeat until we have at least 10 cards (ensures seamless loop) */
  const loopCards = useMemo(() => {
    if (allCards.length === 0) return [];
    const times = Math.ceil(10 / allCards.length);
    return Array.from({ length: times * 2 }, (_, rep) =>
      allCards.map((c, i) => ({ ...c, _key: `${rep}-${i}` }))
    ).flat();
  }, [allCards]);

  if (allCards.length === 0) return null;

  /* Animation: scroll width = half of total track (since we duplicate) */
  const trackWidth = allCards.length * (CARD_W + CARD_GAP);
  /* 5 px/s base speed — more cards = longer duration */
  const duration = Math.max(20, allCards.length * 4);

  const title = sectionConfig?.title || 'Transformations';

  const renderCard = (t) => {
    if (t._type === 'written') {
      return (
        <SoulfulWrittenCard testimonial={t} onClick={() => {
          setPaused(true);
          setSelectedTemplate(t);
        }} />
      );
    }
    if (t._type === 'video') {
      return (
        <SoulfulVideoCard testimonial={t}
          onPlay={(embedUrl, platform) => { setPaused(true); setSelectedEmbed({ embedUrl, platform }); }}
          onOpen={url => window.open(url, '_blank')}
        />
      );
    }
    return (
      <SoulfulGraphicCard testimonial={t}
        onClick={() => { setPaused(true); setSelectedImage(resolveImageUrl(t.image)); }}
      />
    );
  };

  const content = (
    <>
      {/* ── Section header ── */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="h-px w-8" style={{ background: 'rgba(212,175,55,0.4)' }} />
          <Sparkles size={13} style={{ color: '#D4AF37', opacity: 0.8 }} />
          <div className="h-px w-8" style={{ background: 'rgba(212,175,55,0.4)' }} />
        </div>
        <h2 className="mb-3"
          style={applySectionStyle(sectionConfig?.title_style, {
            ...HEADING, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', color: '#2d1a5e',
          })}>
          {title}
        </h2>
        {sectionConfig?.subtitle && (
          <p className="text-sm text-gray-500 max-w-lg mx-auto">{sectionConfig.subtitle}</p>
        )}
        <div className="w-14 h-0.5 mx-auto mt-3"
          style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)' }} />
      </div>

      {/* ── Infinite rotating carousel ── */}
      <style>{`
        @keyframes testimonialMarquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-${trackWidth + CARD_GAP}px); }
        }
        .t-marquee-track {
          display: flex;
          gap: ${CARD_GAP}px;
          width: max-content;
          animation: testimonialMarquee ${duration}s linear infinite;
        }
        .t-marquee-track.paused {
          animation-play-state: paused;
        }
        .t-marquee-wrap:hover .t-marquee-track {
          animation-play-state: paused;
        }
      `}</style>

      <div
        className="t-marquee-wrap overflow-hidden"
        style={{
          /* Soft fade on both edges */
          maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
        }}
      >
        <div className={`t-marquee-track${paused ? ' paused' : ''}`}>
          {loopCards.map(t => (
            <div key={t._key}
              style={{ width: CARD_W, flexShrink: 0 }}>
              {renderCard(t)}
            </div>
          ))}
        </div>
      </div>

      {/* ── View All ── */}
      <div className="text-center mt-10">
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

      {/* ── Modals ── */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => { setSelectedTemplate(null); setPaused(false); }}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl"
          style={{ border: '1px solid rgba(123,104,238,0.15)' }}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {selectedTemplate && <SoulfulTestimonialFull testimonial={selectedTemplate} />}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEmbed} onOpenChange={() => { setSelectedEmbed(null); setPaused(false); }}>
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

      {selectedImage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={() => { setSelectedImage(null); setPaused(false); }}
          style={{ background: 'rgba(0,0,0,0.88)' }}>
          <button onClick={() => { setSelectedImage(null); setPaused(false); }}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center z-50">
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
