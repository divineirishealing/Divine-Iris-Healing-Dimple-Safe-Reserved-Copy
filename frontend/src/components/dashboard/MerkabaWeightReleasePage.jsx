import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { Pause, Play, User, Armchair, Sparkles, ImagePlus, X } from 'lucide-react';
import { Button } from '../ui/button';

const PHOTO_STORAGE_KEY = 'divine_merkaba_personal_photo_v1';
const MAX_FILE_BYTES = 2.5 * 1024 * 1024;

/** Scaled for a large on-screen merkaba (viewBox units) */
const R = 200;
const MERKABA_VERTICES = [
  { x: 0, y: -R, k: 0 },
  { x: R * 0.866, y: R * 0.5, k: 1 },
  { x: -R * 0.866, y: R * 0.5, k: 2 },
  { x: 0, y: R, k: 3 },
  { x: -R * 0.866, y: -R * 0.5, k: 4 },
  { x: R * 0.866, y: -R * 0.5, k: 5 },
];

const AFFIRMATIONS = [
  'I release heaviness with love; my body remembers its natural harmony.',
  'Each layer that leaves me is transmuted in the void—only truth remains.',
  'Sacred light refines me; I am present in the still center of the Merkaba.',
  'What no longer serves my highest vitality dissolves into infinite peace.',
];

const StandingFigure = () => (
  <g
    stroke="rgba(255, 248, 240, 0.85)"
    strokeWidth="2.2"
    fill="none"
    strokeLinecap="round"
    style={{ filter: 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.4))' }}
  >
    <circle cx="0" cy="-150" r="12" fill="rgba(10,8,20,0.4)" />
    <path d="M0 -130 L0 -45" />
    <path d="M0 -110 L-32 -70 M0 -110 L32 -70" />
    <path d="M0 -45 L-20 50 M0 -45 L20 50" />
  </g>
);

const SittingFigure = () => (
  <g
    stroke="rgba(255, 248, 240, 0.88)"
    strokeWidth="2.2"
    fill="none"
    strokeLinecap="round"
    style={{ filter: 'drop-shadow(0 0 6px rgba(120, 200, 255, 0.35))' }}
  >
    <circle cx="0" cy="-120" r="10" fill="rgba(10,8,20,0.35)" />
    <path d="M0 -110 Q-38 -58 -40 6 Q-32 24 0 30 Q32 24 40 6 Q38 -58 0 -110" />
    <path d="M-40 6 L-48 16 M40 6 L48 16" />
  </g>
);

const MerkabaWeightReleasePage = () => {
  const clipId = useId().replace(/:/g, '');
  const [pose, setPose] = useState('standing');
  const [affirmationIdx, setAffirmationIdx] = useState(0);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [playing, setPlaying] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PHOTO_STORAGE_KEY);
      if (saved && saved.startsWith('data:image')) setPhotoDataUrl(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      if (mq.matches) setPlaying(false);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const onFile = useCallback((e) => {
    const file = e.target?.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > MAX_FILE_BYTES) {
      window.alert('Please choose an image under 2.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      if (typeof data !== 'string') return;
      setPhotoDataUrl(data);
      try {
        localStorage.setItem(PHOTO_STORAGE_KEY, data);
      } catch {
        /* quota — keep in memory only */
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const clearPhoto = useCallback(() => {
    setPhotoDataUrl(null);
    try {
      localStorage.removeItem(PHOTO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const cx = 400;
  const cy = 360;
  const shedYBase = pose === 'sitting' ? 600 : 590;

  const shedPaths = useMemo(
    () => [
      `M-80,-120 Q0,200 0,${shedYBase}`,
      `M80,-100 Q-32,200 0,${shedYBase}`,
      `M-50,40 Q-60,300 0,${shedYBase}`,
      `M50,35 Q55,300 0,${shedYBase}`,
      `M0,-60 Q70,250 0,${shedYBase}`,
      `M-100,10 Q25,320 0,${shedYBase}`,
    ],
    [shedYBase]
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 px-1" data-testid="merkaba-weight-page">
      <div className="text-center space-y-2">
        <h1
          className="text-2xl md:text-4xl font-bold"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            background: 'linear-gradient(90deg, #e8d5ff, #D4AF37, #a5b4fc, #D4AF37)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Divine Merkaba · personal sanctuary
        </h1>
        <p className="text-[11px] text-white/45 max-w-xl mx-auto leading-relaxed">
          Standalone page — not part of the student dashboard. Save{' '}
          <span className="text-[#D4AF37]/80 font-mono text-[10px]">/merkaba</span> on this site as your personal link. Your
          photo stays in this browser only (not uploaded to our servers). For meditation, not medical advice.
        </p>
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 p-3"
        style={{ background: 'rgba(0,0,0,0.25)' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
          aria-label="Upload your photo for the center of the Merkaba"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full border-[#D4AF37]/40 text-amber-100/90 hover:bg-[#D4AF37]/10 h-9 text-xs"
        >
          <ImagePlus size={14} className="mr-1.5 shrink-0" />
          Add your picture
        </Button>
        {photoDataUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearPhoto}
            className="text-white/50 hover:text-red-300 h-9 text-xs"
          >
            <X size={14} className="mr-1" />
            Remove photo
          </Button>
        )}
        <div className="w-px h-6 bg-white/10 hidden sm:block" aria-hidden />
        <div
          className="inline-flex rounded-full p-0.5 border border-white/10"
          style={{ background: 'rgba(0,0,0,0.2)' }}
        >
          <button
            type="button"
            onClick={() => setPose('standing')}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all',
              pose === 'standing' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'text-white/50 hover:text-white/80'
            )}
            aria-pressed={pose === 'standing'}
          >
            <User size={12} /> Standing
          </button>
          <button
            type="button"
            onClick={() => setPose('sitting')}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all',
              pose === 'sitting' ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/50 hover:text-white/80'
            )}
            aria-pressed={pose === 'sitting'}
          >
            <Armchair size={12} /> Sitting
          </button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPlaying((p) => !p)}
          className="rounded-full border-white/20 text-white/80 hover:bg-white/10 h-9 text-xs"
        >
          {playing ? <Pause size={12} className="mr-1" /> : <Play size={12} className="mr-1" />}
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAffirmationIdx((i) => (i + 1) % AFFIRMATIONS.length)}
          className="text-[#D4AF37]/80 hover:text-[#D4AF37] h-9 text-xs"
        >
          <Sparkles size={12} className="mr-1" />
          Next line
        </Button>
      </div>

      <div
        className="relative rounded-3xl overflow-hidden border border-[#D4AF37]/20"
        style={{
          background:
            'radial-gradient(ellipse 90% 55% at 50% 22%, rgba(120, 60, 180, 0.45) 0%, transparent 50%), radial-gradient(ellipse 70% 40% at 50% 85%, rgba(20, 5, 40, 0.9) 0%, transparent 45%), linear-gradient(180deg, #020008 0%, #06020e 40%, #000005 100%)',
          boxShadow: '0 0 100px rgba(80, 40, 120, 0.15), inset 0 0 120px rgba(0,0,0,0.5)',
        }}
      >
        <svg
          viewBox="0 0 800 920"
          className="w-full h-[min(85vh,880px)] block select-none"
          role="img"
          aria-label="Divine Merkaba meditation: your image at the center, rotating light body, and energy path to a singularity below"
        >
          <defs>
            <radialGradient id={`bh-glow-${clipId}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1a0028" />
              <stop offset="50%" stopColor="#080010" />
              <stop offset="100%" stopColor="#000" />
            </radialGradient>
            <radialGradient id={`bh-disk-${clipId}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(200, 100, 60, 0.45)" />
              <stop offset="45%" stopColor="rgba(90, 40, 120, 0.35)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <linearGradient id={`goldLine-${clipId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 220, 140, 0.9)" />
              <stop offset="100%" stopColor="rgba(212, 175, 55, 0.5)" />
            </linearGradient>
            <filter id={`ray-glow-${clipId}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id={`userPhotoClip-${clipId}`}>
              <circle cx="0" cy="0" r="102" />
            </clipPath>
          </defs>

          <ellipse cx="400" cy="120" rx="340" ry="120" fill="rgba(100, 60, 200, 0.07)" />

          <g>
            <ellipse cx="400" cy="820" rx="300" ry="55" fill={`url(#bh-disk-${clipId})`} opacity={0.9} style={{ mixBlendMode: 'screen' }} />
            <ellipse
              cx="400"
              cy="820"
              rx="64"
              ry="18"
              fill={`url(#bh-glow-${clipId})`}
              style={playing ? { animation: 'bhPulse 4s ease-in-out infinite' } : {}}
            />
            <ellipse cx="400" cy="820" rx="10" ry="3.2" fill="#000" opacity="0.95" />
            <path
              d="M 120 780 A 280 40 0 0 0 680 780"
              fill="none"
              stroke="rgba(212, 175, 55, 0.22)"
              strokeWidth="1.2"
              strokeDasharray="8 10"
              style={playing ? { animation: 'spiralWobble 14s linear infinite' } : {}}
            />
            <path
              d="M 160 790 A 240 32 0 0 0 640 790"
              fill="none"
              stroke="rgba(120, 200, 255, 0.2)"
              strokeWidth="0.8"
              strokeDasharray="5 7"
              style={playing ? { animation: 'spiralWobble 20s linear infinite reverse' } : {}}
            />
          </g>

          <g transform={`translate(${cx}, ${cy - (pose === 'sitting' ? 10 : 0)})`}>
            <g className="tri-cw" style={playing ? { animation: 'merkabaCW 100s linear infinite' } : {}}>
              <polygon
                points={`0,-${R} ${R * 0.866},${R * 0.5} -${R * 0.866},${R * 0.5}`}
                fill="none"
                stroke={`url(#goldLine-${clipId})`}
                strokeWidth="1.4"
                strokeLinejoin="round"
                opacity="0.9"
              />
            </g>
            <g className="tri-ccw" style={playing ? { animation: 'merkabaCCW 75s linear infinite' } : {}}>
              <polygon
                points={`0,${R} -${R * 0.866},-${R * 0.5} ${R * 0.866},-${R * 0.5}`}
                fill="none"
                stroke="rgba(160, 210, 255, 0.75)"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </g>

            <circle
              r="10"
              fill="rgba(255, 240, 220, 0.35)"
              style={playing ? { animation: 'coreGlow 3.2s ease-in-out infinite' } : {}}
            />

            {MERKABA_VERTICES.map((v) => {
              const innerX = v.x * 0.1;
              const innerY = v.y * 0.1;
              return (
                <g key={v.k}>
                  <line
                    x1={v.x}
                    y1={v.y}
                    x2={innerX}
                    y2={innerY + 6}
                    stroke="rgba(100, 230, 255, 0.45)"
                    strokeWidth="0.6"
                    filter={`url(#ray-glow-${clipId})`}
                    style={playing ? { animation: 'rayPulse 2.4s ease-in-out infinite', animationDelay: `${v.k * 0.15}s` } : {}}
                  />
                  <line
                    x1={v.x}
                    y1={v.y}
                    x2={innerX * 0.88}
                    y2={innerY * 0.88 + 8}
                    stroke="rgba(255, 255, 255, 0.92)"
                    strokeWidth="1.1"
                    style={playing ? { animation: 'raySharp 1.5s ease-in-out infinite', animationDelay: `${v.k * 0.1}s` } : {}}
                  />
                </g>
              );
            })}

            <g
              className="figure-wrap"
              transform={pose === 'sitting' ? 'translate(0, 8)' : 'translate(0, 0)'}
            >
              {photoDataUrl ? (
                <g>
                  <circle cx="0" cy="0" r="108" fill="none" stroke="rgba(212, 175, 55, 0.35)" strokeWidth="1.5" />
                  <image
                    href={photoDataUrl}
                    x="-110"
                    y="-125"
                    width="220"
                    height="260"
                    clipPath={`url(#userPhotoClip-${clipId})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </g>
              ) : pose === 'standing' ? (
                <StandingFigure />
              ) : (
                <SittingFigure />
              )}
            </g>

            {shedPaths.map((d, i) => (
              <g key={d} opacity="0.5">
                <circle r="2.8" fill="rgba(200, 180, 255, 0.75)">
                  {playing && <animateMotion dur={`${4.5 + i * 0.35}s`} repeatCount="indefinite" path={d} rotate="auto" />}
                </circle>
                <circle r="1.8" fill="rgba(212, 175, 55, 0.5)">
                  {playing && (
                    <animateMotion
                      dur={`${5.8 + i * 0.3}s`}
                      repeatCount="indefinite"
                      path={d}
                      begin={`${i * 0.65}s`}
                    />
                  )}
                </circle>
              </g>
            ))}
          </g>
        </svg>

        <div
          className="absolute bottom-0 left-0 right-0 px-4 py-4 text-center border-t border-white/5"
          style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.55) 0%, transparent 100%)' }}
        >
          <p
            className="text-sm md:text-base text-amber-50/90 italic max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {AFFIRMATIONS[affirmationIdx]}
          </p>
        </div>
      </div>

      <p className="text-[10px] text-white/28 text-center max-w-lg mx-auto leading-relaxed">
        This visualization is for meditation. It is not medical advice. If local storage is full, your image may not
        persist after refresh.
      </p>

      <style>{`
        @keyframes merkabaCW { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes merkabaCCW { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes coreGlow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.95; } }
        @keyframes rayPulse { 0%, 100% { stroke-opacity: 0.3; } 50% { stroke-opacity: 0.95; } }
        @keyframes raySharp { 0%, 100% { stroke-opacity: 0.25; } 50% { stroke-opacity: 1; } }
        @keyframes bhPulse { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; } }
        @keyframes spiralWobble { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 28; } }
        @media (prefers-reduced-motion: reduce) { .tri-cw, .tri-ccw { animation: none !important; } }
      `}</style>
    </div>
  );
};

export default MerkabaWeightReleasePage;
