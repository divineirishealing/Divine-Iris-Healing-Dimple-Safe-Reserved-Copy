import React, { useState } from 'react';
import { Star, Play, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { resolveImageUrl } from '../lib/imageUtils';

/* ── Stars ───────────────────────────────────────────────────────────────── */
const Stars = ({ rating = 5 }) => (
  <div className="flex items-center gap-0.5">
    {[1,2,3,4,5].map(i => (
      <Star key={i} size={14}
        fill={i <= rating ? '#D4AF37' : 'none'}
        stroke={i <= rating ? '#D4AF37' : '#d1c5a0'}
        strokeWidth={1.5}
      />
    ))}
  </div>
);

/* ── Animated Iris Flower ────────────────────────────────────────────────── */
/*
  True furl/unfurl: all petals start pointing UPWARD (closed bud, rotate 180°)
  then each sweeps to its spread position: top stays, right swings to 60°,
  left swings to 300°. Simultaneously the petal grows in length (scaleY).
  Separate @keyframes per petal so the rotation interpolates correctly.
  4.5 s loop: ~1.7 s open, 0.7 s hold, ~1.7 s close, 0.4 s pause.
*/
const IrisBloom = () => (
  <span style={{ display: 'inline-flex', flexShrink: 0 }}>
    <style>{`
      /* Top petal (180°): stays up, grows out then furls back */
      @keyframes irisPetal0 {
        0%, 100% { transform: rotate(180deg) scaleY(0.05) scaleX(0.3); }
        40%      { transform: rotate(180deg) scaleY(1.1)  scaleX(1); }
        50%      { transform: rotate(180deg) scaleY(1)    scaleX(1); }
        58%      { transform: rotate(180deg) scaleY(1)    scaleX(1); }
        92%      { transform: rotate(180deg) scaleY(0.05) scaleX(0.3); }
      }
      /* Right petal: sweeps from bud (180°) → spread (60°) while unfurling */
      @keyframes irisPetal1 {
        0%, 100% { transform: rotate(180deg) scaleY(0.05) scaleX(0.3); }
        40%      { transform: rotate(60deg)  scaleY(1.1)  scaleX(1); }
        50%      { transform: rotate(60deg)  scaleY(1)    scaleX(1); }
        58%      { transform: rotate(60deg)  scaleY(1)    scaleX(1); }
        92%      { transform: rotate(180deg) scaleY(0.05) scaleX(0.3); }
      }
      /* Left petal: sweeps from bud (180°) → spread (300°) while unfurling */
      @keyframes irisPetal2 {
        0%, 100% { transform: rotate(180deg) scaleY(0.05) scaleX(0.3); }
        40%      { transform: rotate(300deg) scaleY(1.1)  scaleX(1); }
        50%      { transform: rotate(300deg) scaleY(1)    scaleX(1); }
        58%      { transform: rotate(300deg) scaleY(1)    scaleX(1); }
        92%      { transform: rotate(180deg) scaleY(0.05) scaleX(0.3); }
      }
      /* Pollen blooms only while petals are fully open */
      @keyframes irisPollenAnim {
        0%, 46%  { transform: scale(0); opacity: 0; }
        54%      { transform: scale(1.15); opacity: 1; }
        58%      { transform: scale(1);    opacity: 1; }
        78%      { opacity: 1; }
        90%      { transform: scale(0); opacity: 0; }
        100%     { transform: scale(0); opacity: 0; }
      }
      /* Stem pulses gently */
      @keyframes irisStemAnim {
        0%, 100% { opacity: 0.5; }
        15%      { opacity: 1; }
        85%      { opacity: 1; }
      }
      .ipetal3 {
        transform-box: fill-box;
        transform-origin: 50% 0%;
      }
      .ipollen {
        transform-box: fill-box;
        transform-origin: center;
        animation: irisPollenAnim 4.5s ease-in-out infinite;
      }
      .istem3 { animation: irisStemAnim 4.5s ease-in-out infinite; }
    `}</style>

    <svg viewBox="-20 -25 40 54" width="27" height="35" style={{ overflow: 'visible' }}>
      {/* Stem */}
      <path d="M0,0 C1,8 -1,17 0,27"
        stroke="#4a7c4e" strokeWidth="2.4" fill="none"
        strokeLinecap="round" className="istem3" />

      {/* 3 petals — each with its own named keyframes so rotation interpolates */}
      {[0, 1, 2].map(i => (
        <g key={i} className="ipetal3"
          style={{ animation: `irisPetal${i} 4.5s cubic-bezier(0.45,0,0.2,1) ${i * 0.06}s infinite` }}>
          <path
            d="M0,0 C-3.5,4 -4.5,14 -2.2,22 C-1.1,25 1.1,25 2.2,22 C4.5,14 3.5,4 0,0Z"
            fill="url(#irisPetalG)" opacity="0.95" />
        </g>
      ))}

      <defs>
        <radialGradient id="irisPetalG" cx="50%" cy="10%" r="80%">
          <stop offset="0%"   stopColor="#ede9fe" />
          <stop offset="55%"  stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#5b21b6" />
        </radialGradient>
      </defs>

      {/* Pollen centre */}
      <circle cx="0" cy="0" r="4.8" fill="#D4AF37" className="ipollen" style={{ animationDelay: '1.7s' }} />
      <circle cx="0" cy="0" r="3"   fill="#fef08a" className="ipollen" style={{ animationDelay: '1.76s' }} />
      {[0, 60, 120, 180, 240, 300].map((a, i) => (
        <circle key={i}
          cx={+(Math.cos((a - 90) * Math.PI / 180) * 2.2).toFixed(3)}
          cy={+(Math.sin((a - 90) * Math.PI / 180) * 2.2).toFixed(3)}
          r="0.7" fill="#1a0a0a"
          className="ipollen"
          style={{ animationDelay: `${1.8 + i * 0.02}s` }}
        />
      ))}
      <circle cx="0" cy="0" r="1" fill="#92400e" className="ipollen" style={{ animationDelay: '1.92s' }} />
    </svg>
  </span>
);

/* ── Opening quote glyph ────────────────────────────────────────────────── */
const QuoteGlyph = ({ color = 'rgba(139,92,246,0.12)' }) => (
  <span aria-hidden style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '5rem', lineHeight: 1, color, position: 'absolute', top: -8, left: 12, pointerEvents: 'none', userSelect: 'none' }}>
    "
  </span>
);

/* ── Parse video URL → { platform, id, embedUrl, thumbUrl, openUrl } ────── */
function parseVideo(url) {
  if (!url) return null;

  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return {
    platform: 'youtube',
    id: yt[1],
    embedUrl: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`,
    thumbUrl: `https://img.youtube.com/vi/${yt[1]}/maxresdefault.jpg`,
    openUrl: url,
  };

  // Instagram reel or post — /embed/ path works for public accounts
  const ig = url.match(/instagram\.com\/(reel|p)\/([a-zA-Z0-9_-]+)/);
  if (ig) {
    const type = ig[1]; // "reel" or "p"
    const code = ig[2];
    return {
      platform: 'instagram',
      id: code,
      embedUrl: `https://www.instagram.com/${type}/${code}/embed/`,
      thumbUrl: null,
      openUrl: url,
    };
  }

  // Facebook video
  if (url.includes('facebook.com')) {
    return {
      platform: 'facebook',
      id: null,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&width=500&show_text=false&autoplay=true`,
      thumbUrl: null,
      openUrl: url,
    };
  }

  return { platform: 'other', id: null, embedUrl: null, thumbUrl: null, openUrl: url };
}

/* ── Platform badge ─────────────────────────────────────────────────────── */
const PlatformBadge = ({ platform }) => {
  const cfg = {
    youtube:   { label: 'YouTube',   bg: '#FF0000', icon: '▶' },
    instagram: { label: 'Instagram', bg: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', icon: '◉' },
    facebook:  { label: 'Facebook',  bg: '#1877F2', icon: 'f' },
  }[platform] || { label: 'Video', bg: '#555', icon: '▶' };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
      style={{ background: cfg.bg }}>
      <span>{cfg.icon}</span>{cfg.label}
    </span>
  );
};

/* ── Single/multi photo display ─────────────────────────────────────────── */
const PhotoDisplay = ({ photos, photoLabels, photoMode, size = 'card' }) => {
  const resolved = (photos || []).map(resolveImageUrl);
  if (!resolved.length) return null;

  const isCard = size === 'card';
  const ovalW = isCard ? 80 : 130;
  const ovalH = isCard ? 118 : 160;

  if (photoMode === 'before_after') {
    return (
      <div className="flex gap-2 items-end justify-center">
        {resolved.slice(0, 2).map((src, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="overflow-hidden rounded-full"
              style={{ width: ovalW, height: ovalH, border: '2px solid rgba(139,92,246,0.25)', boxShadow: '0 4px 16px rgba(139,92,246,0.12)' }}>
              <img src={src} alt={photoLabels?.[i] || ''} className="w-full h-full object-cover" />
            </div>
            {photoLabels?.[i] && (
              <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: isCard ? '0.6rem' : '0.75rem', color: i === 0 ? '#9ca3af' : '#7c3aed', fontStyle: 'italic', fontWeight: 600 }}>
                {photoLabels[i]}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (photoMode === 'progressive') {
    const show = resolved.slice(0, isCard ? 3 : 5);
    const pw = isCard ? 56 : 90;
    const ph = isCard ? 68 : 110;
    return (
      <div className="flex gap-1.5 items-end justify-center">
        {show.map((src, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="overflow-hidden rounded-full"
              style={{ width: pw, height: ph, border: '2px solid rgba(212,175,55,0.3)', boxShadow: '0 3px 10px rgba(212,175,55,0.12)', opacity: 0.7 + (i / show.length) * 0.3 }}>
              <img src={src} alt={photoLabels?.[i] || `Week ${i + 1}`} className="w-full h-full object-cover" />
            </div>
            {photoLabels?.[i] && (
              <span style={{ fontSize: isCard ? '0.5rem' : '0.6rem', color: '#D4AF37', fontWeight: 600, fontStyle: 'italic', fontFamily: "'Lato', sans-serif" }}>
                {photoLabels[i]}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Single
  return (
    <div className="flex justify-center">
      <div className="overflow-hidden rounded-full"
        style={{ width: ovalW, height: ovalH, border: '2px solid rgba(139,92,246,0.2)', boxShadow: '0 6px 20px rgba(139,92,246,0.1)' }}>
        <img src={resolved[0]} alt="" className="w-full h-full object-cover" />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   WRITTEN TESTIMONIAL CARD  —  jewel-tone redesign
   ══════════════════════════════════════════════════════════════════════════ */
export const SoulfulWrittenCard = ({ testimonial, onClick }) => {
  const [expanded, setExpanded] = useState(false);
  const {
    name, text, role, rating = 5,
    photos = [], photo_labels = [], photo_mode = 'single',
    image, before_image, program_name,
  } = testimonial;

  const effectivePhotos = photos.length > 0 ? photos
    : before_image ? [before_image, image].filter(Boolean)
    : image ? [image]
    : [];
  const effectivePhotoLabels = photo_labels.length > 0 ? photo_labels
    : before_image && image ? ['Before', 'After']
    : [];
  const effectiveMode = photos.length > 0 ? photo_mode
    : before_image ? 'before_after'
    : 'single';

  const hasPhotos    = effectivePhotos.length > 0;
  const isSingle     = effectiveMode === 'single';
  const PREVIEW_LEN  = 150;
  const isLong       = (text || '').length > PREVIEW_LEN;
  const displayText  = isLong && !expanded ? text.substring(0, PREVIEW_LEN) + '…' : text;

  return (
    <div
      data-testid={`soulful-written-${testimonial.id}`}
      className="relative group cursor-pointer rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-2"
      style={{
        background: '#fdfbff',
        border: '1.5px solid rgba(109,40,217,0.22)',
        boxShadow: '0 4px 28px rgba(109,40,217,0.10), 0 1px 4px rgba(0,0,0,0.06)',
      }}
      onClick={onClick}
    >
      {/* ── Jewel header ── */}
      <div className="relative px-5 pt-5 pb-10 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e0654 0%, #3b0f9e 45%, #6d28d9 80%, #9333ea 100%)' }}>
        {/* Radial glow behind photo */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 80% at 50% 130%, rgba(212,175,55,0.18) 0%, transparent 70%)' }} />

        {/* Animated falling & drifting sparkle dots */}
        <style>{`
          @keyframes dotFall {
            0%   { transform: translateY(-10px) translateX(0px) scale(1);   opacity: 0; }
            15%  { opacity: 1; }
            80%  { opacity: 0.8; }
            100% { transform: translateY(110px) translateX(var(--dx,0px)) scale(0.4); opacity: 0; }
          }
          @keyframes dotFloat {
            0%, 100% { transform: translateY(0)   translateX(0);   opacity: 0.55; }
            50%      { transform: translateY(-8px) translateX(4px); opacity: 1; }
          }
        `}</style>
        {[
          {t:-5, l:8,  s:3, dur:3.2, dx:-6,  anim:'dotFall'},
          {t:-5, l:25, s:2, dur:2.8, dx:4,   anim:'dotFall'},
          {t:-5, l:45, s:4, dur:3.8, dx:-3,  anim:'dotFall'},
          {t:-5, l:62, s:2, dur:2.5, dx:7,   anim:'dotFall'},
          {t:-5, l:78, s:3, dur:3.5, dx:-5,  anim:'dotFall'},
          {t:-5, l:90, s:2, dur:2.2, dx:3,   anim:'dotFall'},
          {t:-5, l:15, s:2, dur:4.0, dx:5,   anim:'dotFall'},
          {t:-5, l:55, s:3, dur:3.0, dx:-4,  anim:'dotFall'},
          {t:-5, l:35, s:2, dur:4.2, dx:6,   anim:'dotFall'},
          {t:-5, l:70, s:4, dur:2.9, dx:-8,  anim:'dotFall'},
          {t:20, l:5,  s:2, dur:2.4, dx:0,   anim:'dotFloat'},
          {t:50, l:92, s:2, dur:3.1, dx:0,   anim:'dotFloat'},
          {t:40, l:50, s:3, dur:2.7, dx:0,   anim:'dotFloat'},
        ].map((p, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none"
            style={{
              top: `${p.t}%`, left: `${p.l}%`,
              width: p.s, height: p.s,
              background: i % 3 === 0 ? 'rgba(212,175,55,0.9)' : i % 3 === 1 ? 'rgba(255,255,255,0.7)' : 'rgba(196,181,253,0.8)',
              boxShadow: `0 0 ${p.s * 2}px ${i % 3 === 0 ? 'rgba(212,175,55,0.8)' : 'rgba(196,181,253,0.6)'}`,
              '--dx': `${p.dx}px`,
              animationName: p.anim,
              animationDuration: `${p.dur}s`,
              animationTimingFunction: 'ease-in',
              animationIterationCount: 'infinite',
              animationDelay: `${(i * 0.37) % p.dur}s`,
            }} />
        ))}

        {/* Stars centred */}
        <div className="flex justify-center mb-2 relative z-10"><Stars rating={rating} /></div>
      </div>

      {/* ── Single photo straddling header / body — oval shape ── */}
      {hasPhotos && isSingle && (
        <div className="flex justify-center" style={{ marginTop: -50, position: 'relative', zIndex: 10 }}>
          <div style={{
            width: 76, height: 104,
            borderRadius: '40% / 50%',
            overflow: 'hidden',
            border: '3px solid #D4AF37',
            boxShadow: '0 0 0 5px rgba(109,40,217,0.25), 0 8px 28px rgba(0,0,0,0.28)',
          }}>
            <img src={resolveImageUrl(effectivePhotos[0])} alt={name || ''}
              className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* ── Card body ── */}
      <div className={`px-5 pb-5 ${hasPhotos && isSingle ? 'pt-3' : 'pt-2'}`}>

        {/* Multi-photo for before/after or progressive */}
        {hasPhotos && !isSingle && (
          <div className="mb-3 mt-1">
            <PhotoDisplay photos={effectivePhotos} photoLabels={effectivePhotoLabels}
              photoMode={effectiveMode} size="card" />
          </div>
        )}

        {/* Quote text */}
        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '0.92rem', lineHeight: 1.85, color: '#1e0a4e',
          fontStyle: 'italic', textAlign: 'center',
        }}>
          {displayText}
        </p>

        {isLong && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex items-center gap-1 mx-auto mt-2 text-[11px] font-semibold tracking-wide transition-colors"
            style={{ color: '#7c3aed' }}
          >
            {expanded ? <><ChevronUp size={12} /> Read less</> : <><ChevronDown size={12} /> Read more</>}
          </button>
        )}

        {/* Gold divider */}
        <div className="my-4 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5) 30%, rgba(109,40,217,0.4) 70%, transparent)' }} />

        {/* Footer */}
        <div className="flex items-end justify-between gap-2">
          <div className="flex-1">
            <p style={{ fontFamily: "'Lato', sans-serif", fontWeight: 800, fontSize: '0.9rem', color: '#1a0a4e', letterSpacing: '0.02em' }}>
              {name}
            </p>
            <p style={{ fontFamily: "'Lato', sans-serif", fontSize: '0.68rem', color: '#7c6a9a', fontStyle: 'italic', marginTop: 2, minHeight: '2.2em', visibility: role ? 'visible' : 'hidden' }}>
              {role || '\u00A0'}
            </p>
            {program_name && (
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '0.74rem', color: '#b8860b', fontStyle: 'italic', marginTop: 2, letterSpacing: '0.03em', fontWeight: 600 }}>
                {program_name}
              </p>
            )}
          </div>
          <IrisBloom />
        </div>
      </div>

      {/* Bottom vibrant line */}
      <div className="h-0.5 w-full"
        style={{ background: 'linear-gradient(90deg, #6d28d9, #9333ea 40%, #D4AF37 70%, #b8860b)' }} />
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   VIDEO TESTIMONIAL CARD
   ══════════════════════════════════════════════════════════════════════════ */
export const SoulfulVideoCard = ({ testimonial, onPlay, onOpen }) => {
  const { name, role, program_name, video_url, videoId, thumbnail } = testimonial;
  const parsed = parseVideo(video_url) || (videoId ? parseVideo(`https://youtu.be/${videoId}`) : null);
  const thumbSrc = thumbnail || parsed?.thumbUrl;
  const canEmbed = parsed?.embedUrl;

  const handleClick = () => {
    if (canEmbed) onPlay?.(parsed.embedUrl, parsed.platform);
    else if (parsed?.openUrl) onOpen?.(parsed.openUrl);
  };

  return (
    <div
      data-testid={`soulful-video-${testimonial.id}`}
      className="relative group cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
      style={{ background: '#0f0a1e', border: '1px solid rgba(212,175,55,0.2)' }}
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
        {thumbSrc ? (
          <img src={thumbSrc} alt={name || 'Video testimonial'}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          /* Platform-branded placeholder when no thumbnail */
          <div className="w-full h-full flex flex-col items-center justify-center gap-3"
            style={{
              background: parsed?.platform === 'instagram'
                ? 'linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)'
                : parsed?.platform === 'facebook'
                ? 'linear-gradient(135deg,#1877F2,#0c5ecc)'
                : 'linear-gradient(135deg,#1a0a3e,#2d1a5e)',
            }}>
            <span style={{ fontSize: '2.8rem', opacity: 0.9 }}>
              {parsed?.platform === 'instagram' ? '📸' : parsed?.platform === 'facebook' ? '📘' : '🎬'}
            </span>
            {name && (
              <p style={{ fontFamily: "'Lato', sans-serif", fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', fontWeight: 600, textAlign: 'center', maxWidth: '80%', lineHeight: 1.3 }}>
                {name}
              </p>
            )}
            <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>
              {canEmbed ? 'Click to watch' : 'Click to open'}
              {parsed?.platform === 'instagram' ? ' on Instagram' : parsed?.platform === 'facebook' ? ' on Facebook' : ''}
            </p>
          </div>
        )}
        {/* Dark overlay only when we have a thumbnail */}
        {thumbSrc && <div className="absolute inset-0 bg-black/25 group-hover:bg-black/40 transition-all duration-300" />}
        {/* Play / Open button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{
              background: thumbSrc
                ? 'linear-gradient(135deg,#D4AF37,#b8962e)'
                : 'rgba(255,255,255,0.25)',
              boxShadow: thumbSrc ? '0 0 24px rgba(212,175,55,0.5)' : '0 0 16px rgba(255,255,255,0.2)',
              backdropFilter: 'blur(6px)',
              border: '1.5px solid rgba(255,255,255,0.4)',
            }}>
            {canEmbed
              ? <Play size={22} className="text-white ml-1" fill="white" />
              : <ExternalLink size={18} className="text-white" />
            }
          </div>
        </div>
        {/* Platform badge */}
        {parsed && (
          <div className="absolute top-3 left-3">
            <PlatformBadge platform={parsed.platform} />
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="px-4 py-3" style={{ background: 'linear-gradient(180deg,#0f0a1e,#1a1040)' }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            {name && <p style={{ fontFamily: "'Lato', sans-serif", fontWeight: 700, fontSize: '0.82rem', color: '#f5f0ff' }}>{name}</p>}
            {program_name && <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '0.7rem', color: '#D4AF37', fontStyle: 'italic', marginTop: 2 }}>{program_name}</p>}
            {role && !program_name && <p style={{ fontSize: '0.68rem', color: 'rgba(212,175,55,0.6)', marginTop: 2 }}>{role}</p>}
          </div>
          <span style={{ color: 'rgba(212,175,55,0.4)', fontSize: '0.9rem' }}>✿</span>
        </div>
      </div>
    </div>
  );
};

/* ── Modal author block — Name → Role → Program badge (matches card) ─────── */
const ModalAuthor = ({ name, role, program_name }) => (
  <div>
    {name && <p style={{ fontFamily: "'Lato', sans-serif", fontWeight: 800, fontSize: '1rem', color: '#1a1040' }}>{name}</p>}
    {/* Always reserve role row height for consistent layout */}
    <p style={{ fontFamily: "'Lato', sans-serif", fontSize: '0.75rem', color: '#8b7a9a', fontStyle: 'italic', marginTop: 4, minHeight: '2.4em', visibility: role ? 'visible' : 'hidden' }}>
      {role || '\u00A0'}
    </p>
    {program_name && (
      <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '0.8rem', color: '#D4AF37', fontStyle: 'italic', marginTop: 2, textAlign: 'center', letterSpacing: '0.02em' }}>
        {program_name}
      </p>
    )}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   FULL MODAL VIEW (written testimonial)
   ══════════════════════════════════════════════════════════════════════════ */
export const SoulfulTestimonialFull = ({ testimonial }) => {
  const {
    name, text, role, rating = 5,
    photos = [], photo_labels = [], photo_mode = 'single',
    image, before_image, program_name,
  } = testimonial;

  const effectivePhotos = photos.length > 0 ? photos
    : before_image ? [before_image, image].filter(Boolean)
    : image ? [image]
    : [];
  const effectivePhotoLabels = photo_labels.length > 0 ? photo_labels
    : before_image && image ? ['Before', 'After']
    : [];
  const effectiveMode = photos.length > 0 ? photo_mode
    : before_image ? 'before_after'
    : 'single';
  const hasPhotos = effectivePhotos.length > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: '#fdfbff', minHeight: 350 }}>
      {/* Jewel header bar */}
      <div className="relative px-8 pt-7 pb-6 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e0654 0%, #3b0f9e 45%, #6d28d9 80%, #9333ea 100%)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 80% at 50% 130%, rgba(212,175,55,0.18) 0%, transparent 70%)' }} />
        {[{t:-5,l:10,s:3,dur:3.0,dx:-4},{t:-5,l:30,s:2,dur:2.6,dx:5},{t:-5,l:55,s:3,dur:3.4,dx:-3},
          {t:-5,l:72,s:2,dur:2.8,dx:6},{t:-5,l:88,s:3,dur:3.6,dx:-5},{t:30,l:4,s:2,dur:2.5,dx:0},{t:45,l:94,s:2,dur:3.2,dx:0}].map((p,i)=>(
          <div key={i} className="absolute rounded-full pointer-events-none"
            style={{ top:`${p.t}%`, left:`${p.l}%`, width:p.s, height:p.s,
              background: i%2===0?'rgba(212,175,55,0.9)':'rgba(196,181,253,0.8)',
              boxShadow:`0 0 ${p.s*2}px rgba(212,175,55,0.7)`,
              '--dx':`${p.dx}px`,
              animationName: p.dx===0?'dotFloat':'dotFall', animationDuration:`${p.dur}s`,
              animationTimingFunction:'ease-in', animationIterationCount:'infinite',
              animationDelay:`${(i*0.4)%p.dur}s` }} />
        ))}
        <div className="relative z-10 flex justify-center mb-2"><Stars rating={rating} /></div>
      </div>

      <div className="p-8 md:p-10">
        <div className={`flex ${hasPhotos ? 'gap-8 items-start' : ''}`}>
          {hasPhotos && (
            <div className="shrink-0 flex flex-col items-center" style={{ width: effectiveMode === 'progressive' ? undefined : '32%', maxWidth: 220 }}>
              <PhotoDisplay photos={effectivePhotos} photoLabels={effectivePhotoLabels} photoMode={effectiveMode} size="full" />
              <div className="mt-5 text-center">
                <ModalAuthor name={name} role={role} program_name={program_name} />
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="relative rounded-2xl p-5 md:p-7"
              style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(109,40,217,0.08)', boxShadow: '0 2px 16px rgba(109,40,217,0.06)' }}>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(0.98rem, 1.5vw, 1.08rem)', color: '#1e0a4e', lineHeight: 1.95, fontStyle: 'italic' }}>
                "{text}"
              </p>
            </div>
            {!hasPhotos && (
              <div className="mt-7 text-center">
                <ModalAuthor name={name} role={role} program_name={program_name} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-0.5 w-full"
        style={{ background: 'linear-gradient(90deg, #6d28d9, #9333ea 40%, #D4AF37 70%, #b8860b)' }} />
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   GRAPHIC (image) CARD — unchanged style, kept for legacy graphic type
   ══════════════════════════════════════════════════════════════════════════ */
export const SoulfulGraphicCard = ({ testimonial, onClick }) => {
  const { image, name, program_name } = testimonial;
  const src = resolveImageUrl(image);
  return (
    <div
      data-testid={`soulful-graphic-${testimonial.id}`}
      className="relative group cursor-pointer overflow-hidden rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
      style={{ background: '#fff', border: '1px solid rgba(212,175,55,0.12)' }}
      onClick={onClick}
    >
      <img src={src} alt={name || 'Transformation'} className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02]" style={{ objectFit: 'contain' }} loading="lazy"
        onError={e => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225"><rect fill="%23f3f4f6" width="400" height="225"/></svg>'; }} />
      {(name || program_name) && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(212,175,55,0.1)' }}>
          {name && <p style={{ fontFamily: "'Lato', sans-serif", fontWeight: 700, fontSize: '0.78rem', color: '#1a1040' }}>{name}</p>}
          {program_name && <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '0.7rem', color: '#D4AF37', fontStyle: 'italic', marginTop: 2 }}>{program_name}</p>}
        </div>
      )}
    </div>
  );
};

export default SoulfulWrittenCard;
