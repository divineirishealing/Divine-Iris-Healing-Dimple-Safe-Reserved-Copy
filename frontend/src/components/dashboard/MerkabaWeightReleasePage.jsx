import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { Pause, Play, User, Armchair, Sparkles, ImagePlus, X, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

const PHOTO_STORAGE_KEY = 'divine_merkaba_personal_photo_v1';
const MAX_FILE_BYTES = 2.5 * 1024 * 1024;

/** Primary merkaba circumradius (viewBox space) — big & dense */
const R = 270;
const R2 = R * 0.58;
const R3 = R * 0.36;

const ROTATION_MS = 60_000; // one "full" primary turn — slim tick matches this
const SLIM_PER_TURN = 0.0026;
const SLIM_MIN = 0.8;

const triUp = (r) => `0,-${r} ${r * 0.866},${r * 0.5} -${r * 0.866},${r * 0.5}`;
const triDown = (r) => `0,${r} -${r * 0.866},-${r * 0.5} ${r * 0.866},-${r * 0.5}`;

const makeVertices = (r) => [
  { x: 0, y: -r, k: 0 },
  { x: r * 0.866, y: r * 0.5, k: 1 },
  { x: -r * 0.866, y: r * 0.5, k: 2 },
  { x: 0, y: r, k: 3 },
  { x: -r * 0.866, y: -r * 0.5, k: 4 },
  { x: r * 0.866, y: -r * 0.5, k: 5 },
];

const MERKABA_VERTICES = makeVertices(R);
const RAY_INNER = makeVertices(R2).map((v, i) => ({ ...v, k: 20 + i }));

const AFFIRMATIONS = [
  'I release heaviness with love; my body remembers its natural harmony.',
  'Each full turn of the field: I intend my center a little freer, lighter, more at ease.',
  'Sacred light refines me; I am present in the still center of the Merkaba.',
  'I welcome vitality, strength, and a body that feels clear, balanced, and well.',
  'With every turn: old patterns soften; I align with the healthiest, kindest version of me.',
  'This is my visualization — a loving mirror for intention, not a promise of a specific result.',
];

const StandingFigure = () => (
  <g
    stroke="rgba(255, 248, 240, 0.85)"
    strokeWidth="2.4"
    fill="none"
    strokeLinecap="round"
    style={{ filter: 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.4))' }}
  >
    <circle cx="0" cy="-200" r="16" fill="rgba(10,8,20,0.4)" />
    <path d="M0 -175 L0 -55" />
    <path d="M0 -145 L-40 -90 M0 -145 L40 -90" />
    <path d="M0 -55 L-24 64 M0 -55 L24 64" />
  </g>
);

const SittingFigure = () => (
  <g
    stroke="rgba(255, 248, 240, 0.88)"
    strokeWidth="2.4"
    fill="none"
    strokeLinecap="round"
    style={{ filter: 'drop-shadow(0 0 6px rgba(120, 200, 255, 0.35))' }}
  >
    <circle cx="0" cy="-165" r="14" fill="rgba(10,8,20,0.35)" />
    <path d="M0 -150 Q-50 -72 -50 6 Q-40 32 0 40 Q40 32 50 6 Q50 -72 0 -150" />
    <path d="M-50 6 L-58 20 M50 6 L58 20" />
  </g>
);

const MerkabaWeightReleasePage = () => {
  const clipId = useId().replace(/:/g, '');
  const [pose, setPose] = useState('standing');
  const [affirmationIdx, setAffirmationIdx] = useState(0);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [slimScale, setSlimScale] = useState(1);
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

  useEffect(() => {
    if (!playing) return undefined;
    const t = setInterval(() => {
      setSlimScale((s) => Math.max(SLIM_MIN, s - SLIM_PER_TURN));
    }, ROTATION_MS);
    return () => clearInterval(t);
  }, [playing]);

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
        /* quota */
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

  const cx = 500;
  const cy = 410;
  const shedYBase = pose === 'sitting' ? 620 : 600;

  const shedPaths = useMemo(
    () => [
      `M-95,-150 Q0,220 0,${shedYBase}`,
      `M95,-130 Q-40,220 0,${shedYBase}`,
      `M-60,50 Q-70,340 0,${shedYBase}`,
      `M60,45 Q70,340 0,${shedYBase}`,
      `M0,-80 Q50,300 0,${shedYBase}`,
      `M-115,20 Q30,360 0,${shedYBase}`,
    ],
    [shedYBase]
  );

  const rClip = 138;
  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 px-1" data-testid="merkaba-weight-page">
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
        <p className="text-[10px] text-[#D4AF37]/50 max-w-md mx-auto">
          Gold = sunwise (left to right) · Cyan = moonwise (right to left) — field tightens a little with each 60s turn.
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
          onClick={() => {
            setSlimScale(1);
          }}
          className="text-cyan-300/70 hover:text-cyan-200 h-9 text-xs"
        >
          <RefreshCw size={12} className="mr-1" />
          Reset size
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
        <span className="text-[9px] text-white/30 tabular-nums w-full sm:w-auto text-center">
          Field: {(slimScale * 100).toFixed(1)}%
        </span>
      </div>

      <div
        className="relative rounded-3xl overflow-hidden border border-[#D4AF37]/20"
        style={{
          background:
            'radial-gradient(ellipse 90% 55% at 50% 20%, rgba(120, 60, 180, 0.5) 0%, transparent 50%), radial-gradient(ellipse 70% 45% at 50% 88%, rgba(20, 5, 40, 0.95) 0%, transparent 45%), linear-gradient(180deg, #010004 0%, #080318 40%, #000003 100%)',
          boxShadow: '0 0 120px rgba(80, 40, 120, 0.2), inset 0 0 140px rgba(0,0,0,0.55)',
        }}
      >
        <svg
          viewBox="0 0 1000 1000"
          className="w-full h-[min(92vh,960px)] block select-none"
          role="img"
          aria-label="Dense divine Merkaba: counter-rotating layers, center portrait, and release paths"
        >
          <defs>
            <radialGradient id={`bh-glow-${clipId}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1a0028" />
              <stop offset="50%" stopColor="#080010" />
              <stop offset="100%" stopColor="#000" />
            </radialGradient>
            <radialGradient id={`bh-disk-${clipId}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(200, 100, 60, 0.5)" />
              <stop offset="45%" stopColor="rgba(90, 40, 120, 0.4)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <linearGradient id={`goldLine-${clipId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 230, 160, 0.95)" />
              <stop offset="100%" stopColor="rgba(212, 175, 55, 0.45)" />
            </linearGradient>
            <filter id={`ray-glow-${clipId}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id={`userPhotoClip-${clipId}`}>
              <circle cx="0" cy="0" r={rClip} />
            </clipPath>
          </defs>

          <ellipse cx="500" cy="110" rx="420" ry="150" fill="rgba(100, 60, 200, 0.09)" />

          <g>
            <ellipse cx="500" cy="890" rx="360" ry="64" fill={`url(#bh-disk-${clipId})`} opacity={0.92} style={{ mixBlendMode: 'screen' }} />
            <ellipse
              cx="500"
              cy="890"
              rx="70"
              ry="20"
              fill={`url(#bh-glow-${clipId})`}
              style={playing ? { animation: 'bhPulse 4s ease-in-out infinite' } : {}}
            />
            <ellipse cx="500" cy="890" rx="12" ry="3.5" fill="#000" opacity="0.96" />
            <path
              d="M 130 850 A 370 50 0 0 0 870 850"
              fill="none"
              stroke="rgba(212, 175, 55, 0.28)"
              strokeWidth="1.4"
              strokeDasharray="10 12"
              style={playing ? { animation: 'spiralWobble 14s linear infinite' } : {}}
            />
            <path
              d="M 180 865 A 320 40 0 0 0 820 865"
              fill="none"
              stroke="rgba(100, 200, 255, 0.28)"
              strokeWidth="1"
              strokeDasharray="5 8"
              style={playing ? { animation: 'spiralWobble 20s linear infinite reverse' } : {}}
            />
            <g transform={`translate(${cx} ${cy - (pose === 'sitting' ? 10 : 0)})`}>
            {[100, 165, 230].map((rad, j) => (
              <circle
                key={rad}
                cx="0"
                cy="0"
                r={rad}
                fill="none"
                stroke="rgba(212, 175, 55, 0.08)"
                strokeWidth="0.6"
                strokeDasharray={`${4 + j} ${6 + j}`}
                style={playing ? { animation: `spiralWobble ${10 + j * 4}s linear infinite` } : {}}
              />
            ))}
            </g>
          </g>

          <g transform={`translate(${cx}, ${cy - (pose === 'sitting' ? 10 : 0)})`}>
            <g className="merkaba-slim-scaler" transform={`scale(${slimScale})`}>
              {Array.from({ length: 18 }).map((_, i) => {
                const a = (i / 18) * Math.PI * 2;
                return (
                  <line
                    key={`rad-${i}`}
                    x1="0"
                    y1="0"
                    x2={Math.sin(a) * (R * 0.95)}
                    y2={-Math.cos(a) * (R * 0.95)}
                    stroke="rgba(200, 180, 255, 0.09)"
                    strokeWidth="0.45"
                  />
                );
              })}

              <g
                className="tri-outer-cw"
                style={playing ? { animation: 'merkabaCW 60s linear infinite' } : {}}
              >
                <polygon
                  points={triUp(R)}
                  fill="none"
                  stroke={`url(#goldLine-${clipId})`}
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  opacity="0.95"
                />
                <polygon points={triUp(R)} fill="none" stroke="rgba(255, 220, 140, 0.15)" strokeWidth="3" />
              </g>
              <g
                className="tri-outer-ccw"
                style={playing ? { animation: 'merkabaCCW 60s linear infinite' } : {}}
              >
                <polygon
                  points={triDown(R)}
                  fill="none"
                  stroke="rgba(150, 220, 255, 0.9)"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <polygon points={triDown(R)} fill="none" stroke="rgba(100, 200, 255, 0.2)" strokeWidth="3" />
              </g>

              <g className="tri-mid-cw" style={playing ? { animation: 'merkabaCCW 40s linear infinite' } : {}}>
                <polygon
                  points={triUp(R2)}
                  fill="none"
                  stroke="rgba(212, 175, 55, 0.45)"
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                  strokeDasharray="6 4"
                />
              </g>
              <g className="tri-mid-ccw" style={playing ? { animation: 'merkabaCW 40s linear infinite' } : {}}>
                <polygon
                  points={triDown(R2)}
                  fill="none"
                  stroke="rgba(120, 200, 255, 0.4)"
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                  strokeDasharray="5 5"
                />
              </g>

              <g className="tri-inner-cw" style={playing ? { animation: 'merkabaCW 25s linear infinite' } : {}}>
                <polygon points={triUp(R3)} fill="none" stroke="rgba(255, 200, 120, 0.35)" strokeWidth="0.8" />
              </g>
              <g className="tri-inner-ccw" style={playing ? { animation: 'merkabaCCW 25s linear infinite' } : {}}>
                <polygon points={triDown(R3)} fill="none" stroke="rgba(180, 220, 255, 0.3)" strokeWidth="0.8" />
              </g>

              <circle
                r="12"
                fill="rgba(255, 240, 220, 0.4)"
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
                      y2={innerY + 5}
                      stroke="rgba(100, 230, 255, 0.45)"
                      strokeWidth="0.65"
                      filter={`url(#ray-glow-${clipId})`}
                      style={playing ? { animation: 'rayPulse 2.2s ease-in-out infinite', animationDelay: `${v.k * 0.12}s` } : {}}
                    />
                    <line
                      x1={v.x}
                      y1={v.y}
                      x2={innerX * 0.9}
                      y2={innerY * 0.9 + 8}
                      stroke="rgba(255, 255, 255, 0.9)"
                      strokeWidth="1.2"
                      style={playing ? { animation: 'raySharp 1.4s ease-in-out infinite', animationDelay: `${v.k * 0.1}s` } : {}}
                    />
                  </g>
                );
              })}
              {RAY_INNER.map((v) => {
                const innerX = v.x * 0.12;
                const innerY = v.y * 0.12;
                return (
                  <g key={v.k}>
                    <line
                      x1={v.x}
                      y1={v.y}
                      x2={innerX * 0.5}
                      y2={innerY * 0.5 + 4}
                      stroke="rgba(120, 200, 255, 0.3)"
                      strokeWidth="0.4"
                    />
                  </g>
                );
              })}

              {MERKABA_VERTICES.map((v) => (
                <line
                  key={`c-${v.k}`}
                  x1="0"
                  y1="0"
                  x2={v.x * 0.92}
                  y2={v.y * 0.92}
                  stroke="rgba(200, 160, 255, 0.1)"
                  strokeWidth="0.4"
                />
              ))}

              <g transform={pose === 'sitting' ? 'translate(0, 8)' : 'translate(0, 0)'}>
              <g
                className="figure-belly"
                style={playing ? { animation: 'breatheBelly 30s ease-in-out infinite' } : undefined}
              >
                {photoDataUrl ? (
                  <g>
                    <circle cx="0" cy="0" r={rClip + 6} fill="none" stroke="rgba(212, 175, 55, 0.4)" strokeWidth="1.5" />
                    <image
                      href={photoDataUrl}
                      x={-(rClip + 8)}
                      y={-145}
                      width={(rClip + 8) * 2}
                      height={300}
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
              </g>

              {shedPaths.map((d, i) => (
                <g key={d} opacity="0.55">
                  <circle r="3.2" fill="rgba(200, 180, 255, 0.8)">
                    {playing && <animateMotion dur={`${4.2 + i * 0.3}s`} repeatCount="indefinite" path={d} rotate="auto" />}
                  </circle>
                  <circle r="2" fill="rgba(212, 175, 55, 0.55)">
                    {playing && (
                      <animateMotion
                        dur={`${5.4 + i * 0.25}s`}
                        repeatCount="indefinite"
                        path={d}
                        begin={`${i * 0.55}s`}
                      />
                    )}
                  </circle>
                </g>
              ))}
            </g>
          </g>
        </svg>

        <div
          className="absolute bottom-0 left-0 right-0 px-4 py-4 text-center border-t border-white/5"
          style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 100%)' }}
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
        This visualization is for meditation and intention. It is not medical advice, a weight-loss program, or a guarantee
        of results. Nourish your body with real care; consult professionals for health concerns.
      </p>

      <style>{`
        @keyframes merkabaCW { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes merkabaCCW { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes coreGlow { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.95; } }
        @keyframes rayPulse { 0%, 100% { stroke-opacity: 0.3; } 50% { stroke-opacity: 0.95; } }
        @keyframes raySharp { 0%, 100% { stroke-opacity: 0.25; } 50% { stroke-opacity: 1; } }
        @keyframes bhPulse { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; } }
        @keyframes spiralWobble { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 32; } }
        @keyframes breatheBelly { 0%, 100% { transform: scale(1, 1.03); } 50% { transform: scale(1, 0.96); } }
        @media (prefers-reduced-motion: reduce) {
          .tri-outer-cw, .tri-outer-ccw, .tri-mid-cw, .tri-mid-ccw, .tri-inner-cw, .tri-inner-ccw, .figure-belly { animation: none !important; }
        }
      `}</style>
    </div>
  );
};

export default MerkabaWeightReleasePage;
