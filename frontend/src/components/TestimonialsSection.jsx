import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Sparkles, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import { resolveImageUrl } from '../lib/imageUtils';
import { HEADING, CONTAINER, applySectionStyle } from '../lib/designTokens';
import {
  SoulfulWrittenCard,
  SoulfulVideoCard,
  SoulfulGraphicCard,
  SoulfulTestimonialFull,
  writtenMediaFrom,
} from './SoulfulTestimonialCard';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/* Card wrapper — fixed width so exactly 5 show at once */
const CARD_W  = 300;  // px
const CARD_GAP = 20;  // px

/* ─── Before/After Transformation Card ─────────────────────────── */
const BACard = ({ t, onClick }) => {
  const { photos, photo_labels, photo_mode } = writtenMediaFrom(t);
  const hasBeforeAfter = photo_mode === 'before_after' && photos.length >= 2;
  const beforeSrc = hasBeforeAfter ? resolveImageUrl(photos[0]) : null;
  const afterSrc  = hasBeforeAfter ? resolveImageUrl(photos[1]) : (photos[0] ? resolveImageUrl(photos[0]) : null);

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden shadow-md border border-purple-100/60 cursor-pointer hover:shadow-xl transition-shadow duration-300 group"
      onClick={() => onClick(t)}
    >
      {/* Before / After images */}
      {hasBeforeAfter ? (
        <div className="flex">
          {[{ src: beforeSrc, label: photo_labels?.[0] || 'Before', color: '#9ca3af' },
            { src: afterSrc,  label: photo_labels?.[1] || 'After',  color: '#7c3aed' }
          ].map(({ src, label, color }, i) => (
            <div key={i} className="flex-1 relative overflow-hidden">
              <img
                src={src}
                alt={label}
                className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <span
                className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: i === 0 ? 'rgba(0,0,0,0.55)' : 'rgba(124,58,237,0.85)' }}
              >
                {label}
              </span>
              {i === 0 && (
                <div className="absolute inset-y-0 right-0 w-px bg-white/60 z-10" />
              )}
            </div>
          ))}
        </div>
      ) : afterSrc ? (
        <img src={afterSrc} alt={t.name} className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : null}

      {/* Quote + author */}
      <div className="p-5">
        {t.quote && (
          <p
            className="text-sm text-gray-700 italic leading-relaxed mb-4 line-clamp-4"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '0.95rem', lineHeight: 1.8 }}
          >
            &ldquo;{t.quote}&rdquo;
          </p>
        )}
        <div className="flex items-center justify-between border-t border-purple-50 pt-3">
          <div>
            <p className="text-xs font-bold text-gray-800 uppercase tracking-wide">{t.name}</p>
            {(t.role || t.location) && (
              <p className="text-[10px] text-gray-400 italic mt-0.5">{t.role || t.location}</p>
            )}
          </div>
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(i => (
              <span key={i} style={{ color: i <= (t.rating || 5) ? '#D4AF37' : '#e5e7eb', fontSize: 12 }}>★</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Before/After grid with dot-navigation ────────────────────── */
const TransformationsGrid = ({ items, onOpen }) => {
  const [page, setPage] = useState(0);
  const perPage = 3;
  const totalPages = Math.ceil(items.length / perPage);
  const slice = items.slice(page * perPage, page * perPage + perPage);

  return (
    <div>
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {slice.map(t => (
          <BACard key={t.id} t={t} onClick={onOpen} />
        ))}
        {/* Pad to 3 columns */}
        {slice.length < perPage && Array.from({ length: perPage - slice.length }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1.5 rounded-full border border-gray-200 text-gray-400 hover:text-purple-600 hover:border-purple-300 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                className="w-2 h-2 rounded-full transition-all"
                style={{ background: i === page ? '#D4AF37' : '#e5e7eb' }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="p-1.5 rounded-full border border-gray-200 text-gray-400 hover:text-purple-600 hover:border-purple-300 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

/* ─── Main section ──────────────────────────────────────────────── */
const TestimonialsSection = ({ sectionConfig, inline }) => {
  const [testimonials, setTestimonials]         = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedEmbed, setSelectedEmbed]       = useState(null);
  const [selectedImage, setSelectedImage]       = useState(null);
  const [paused, setPaused]                     = useState(false);

  const displayMode = sectionConfig?.display_mode || 'videos'; // 'videos' | 'transformations' | 'all'

  useEffect(() => {
    axios.get(`${API}/testimonials?visible_only=true`)
      .then(r => { if (r.data?.length) setTestimonials(r.data); })
      .catch(() => {});
  }, []);

  const writtenList = useMemo(() => testimonials.filter(t => t.type === 'template'), [testimonials]);
  const videoList   = useMemo(() => testimonials.filter(t => t.type === 'video' && (t.video_url || t.videoId)), [testimonials]);

  /* Template testimonials that have at least one photo — for BA grid */
  const transformList = useMemo(
    () => writtenList.filter(t => writtenMediaFrom(t).photos.length > 0),
    [writtenList]
  );
  /* All written (with or without photos) for the quote-only fallback */
  const quoteList = useMemo(
    () => writtenList.filter(t => writtenMediaFrom(t).photos.length === 0),
    [writtenList]
  );

  /* ── Video carousel data ── */
  const videoCards = useMemo(() => videoList.map(c => ({ ...c, _type: 'video' })), [videoList]);
  const loopCards = useMemo(() => {
    if (videoCards.length === 0) return [];
    const times = Math.ceil(10 / videoCards.length);
    return Array.from({ length: times * 2 }, (_, rep) =>
      videoCards.map((c, i) => ({ ...c, _key: `${rep}-${i}` }))
    ).flat();
  }, [videoCards]);

  const trackWidth = videoCards.length * (CARD_W + CARD_GAP);
  const duration   = Math.max(20, videoCards.length * 4);
  const title      = sectionConfig?.title || 'Transformations';

  /* Nothing to show at all */
  const showVideos = (displayMode === 'videos' || displayMode === 'all') && videoCards.length > 0;
  const showBA     = (displayMode === 'transformations' || displayMode === 'all') && transformList.length > 0;
  const showQuotes = displayMode === 'transformations' && transformList.length === 0 && quoteList.length > 0;

  if (!showVideos && !showBA && !showQuotes) return null;

  const renderVideoCard = (t) => {
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

  /* ── Section header ── */
  const SectionHeader = () => (
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
  );

  const content = (
    <>
      <SectionHeader />

      {/* ── Before/After transformation grid ── */}
      {showBA && (
        <TransformationsGrid
          items={transformList}
          onOpen={(t) => { setSelectedTemplate(t); }}
        />
      )}

      {/* ── Quote-only testimonials (fallback when no photos) ── */}
      {showQuotes && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {quoteList.map(t => (
            <SoulfulWrittenCard
              key={t.id}
              testimonial={t}
              onClick={() => setSelectedTemplate(t)}
            />
          ))}
        </div>
      )}

      {/* ── Divider between modes when showing both ── */}
      {displayMode === 'all' && showBA && showVideos && (
        <div className="flex items-center gap-4 my-10">
          <div className="flex-1 h-px" style={{ background: 'rgba(212,175,55,0.2)' }} />
          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Video Stories</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(212,175,55,0.2)' }} />
        </div>
      )}

      {/* ── Infinite video carousel ── */}
      {showVideos && (
        <>
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
            .t-marquee-track.paused { animation-play-state: paused; }
            .t-marquee-wrap:hover .t-marquee-track { animation-play-state: paused; }
          `}</style>
          <div
            className="t-marquee-wrap overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
            }}
          >
            <div className={`t-marquee-track${paused ? ' paused' : ''}`}>
              {loopCards.map(t => (
                <div key={t._key} style={{ width: CARD_W, flexShrink: 0 }}>
                  {renderVideoCard(t)}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── View All ── */}
      <div className="text-center mt-10">
        <a href="/transformations"
          className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-semibold tracking-wide transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff', boxShadow: '0 4px 18px rgba(124,58,237,0.3)' }}>
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
