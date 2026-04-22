import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { Pause, Play, User, Armchair, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';

const CX = 200;
const CY = 200;

/** Local-space vertices: star of David, circumradius 100, center (0,0) */
const MERKABA_VERTICES = [
  { x: 0, y: -100, k: 0 },
  { x: 86.6, y: 50, k: 1 },
  { x: -86.6, y: 50, k: 2 },
  { x: 0, y: 100, k: 3 },
  { x: -86.6, y: -50, k: 4 },
  { x: 86.6, y: -50, k: 5 },
];

const AFFIRMATIONS = [
  'I release heaviness with love; my body remembers its natural harmony.',
  'Each layer that leaves me is transmuted in the void—only truth remains.',
  'Sacred light refines me; I am present in the still center of the Merkaba.',
  'What no longer serves my highest vitality dissolves into infinite peace.',
];

const StandingFigure = () => (
  <g
    className="figure-standing"
    style={{ filter: 'drop-shadow(0 0 6px rgba(212, 175, 55, 0.35))' }}
    stroke="rgba(255, 248, 240, 0.85)"
    strokeWidth="1.4"
    fill="none"
    strokeLinecap="round"
  >
    <circle cx="0" cy="-115" r="8" fill="rgba(10,8,20,0.4)" />
    <path d="M0 -105 L0 -35" />
    <path d="M0 -90 L-22 -55 M0 -90 L22 -55" />
    <path d="M0 -35 L-14 38 M0 -35 L14 38" />
  </g>
);

const SittingFigure = () => (
  <g
    className="figure-sitting"
    style={{ filter: 'drop-shadow(0 0 5px rgba(120, 200, 255, 0.3))' }}
    stroke="rgba(255, 248, 240, 0.88)"
    strokeWidth="1.4"
    fill="none"
    strokeLinecap="round"
  >
    <circle cx="0" cy="-88" r="7" fill="rgba(10,8,20,0.35)" />
    <path d="M0 -80 Q-28 -45 -32 5 Q-24 18 0 22 Q24 18 32 5 Q28 -45 0 -80" />
    <path d="M-32 5 L-38 12 M32 5 L38 12" />
  </g>
);

const MerkabaWeightReleasePage = () => {
  const [pose, setPose] = useState('standing');
  const [affirmationIdx, setAffirmationIdx] = useState(0);
  const [playing, setPlaying] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      if (mq.matches) setPlaying(false);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const shedYEnd = pose === 'sitting' ? 276 : 268;

  const shedPaths = useMemo(
    () => [
      `M-40,-60 Q0,100 0,${shedYEnd}`,
      `M40,-50 Q-20,80 0,${shedYEnd}`,
      `M-25,20 Q-40,150 0,${shedYEnd}`,
      `M30,15 Q30,150 0,${shedYEnd}`,
      `M0,-30 Q35,120 0,${shedYEnd}`,
      `M-50,0 Q15,160 0,${shedYEnd}`,
    ],
    [shedYEnd]
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4" data-testid="merkaba-weight-page">
      <div className="text-center space-y-1">
        <h1
          className="text-2xl md:text-3xl font-bold"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            background: 'linear-gradient(90deg, #e8d5ff, #D4AF37, #a5b4fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Merkaba · Weight release &amp; transmutation
        </h1>
        <p className="text-xs text-white/50 max-w-md mx-auto leading-relaxed">
          Sit or stand in the still center. The Merkaba turns; light cuts through what is ready to go; each layer
          spirals to the singularity to be remade. Breathe slowly—this is inner work, not a substitute for medical care.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <div
          className="inline-flex rounded-full p-0.5 border border-white/10"
          style={{ background: 'rgba(0,0,0,0.25)' }}
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
          className="rounded-full border-white/20 text-white/80 hover:bg-white/10 h-8 text-[11px]"
        >
          {playing ? <Pause size={12} className="mr-1" /> : <Play size={12} className="mr-1" />}
          {playing ? 'Pause motion' : 'Play motion'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAffirmationIdx((i) => (i + 1) % AFFIRMATIONS.length)}
          className="text-[#D4AF37]/80 hover:text-[#D4AF37] h-8 text-[11px]"
        >
          <Sparkles size={12} className="mr-1" />
          Next intention
        </Button>
      </div>

      <div
        className="relative rounded-3xl overflow-hidden border border-white/10"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 25%, rgba(80, 40, 120, 0.35) 0%, transparent 55%), linear-gradient(180deg, #050210 0%, #0a0618 45%, #020008 100%)',
          boxShadow: 'inset 0 0 80px rgba(0,0,0,0.5)',
        }}
      >
        <svg
          viewBox="0 0 400 520"
          className="w-full h-[min(72vh,640px)] block select-none"
          role="img"
          aria-label="Merkaba meditation: rotating light body, figure at center, rays inward, and energy flowing into a black hole below"
        >
          <defs>
            <radialGradient id="bh-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1a0020" />
              <stop offset="45%" stopColor="#0a0010" />
              <stop offset="100%" stopColor="#000" />
            </radialGradient>
            <radialGradient id="bh-disk" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(180, 80, 40, 0.35)" />
              <stop offset="50%" stopColor="rgba(100, 40, 120, 0.25)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <filter id="ray-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="sharp-ray" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="0.2" result="a" />
              <feColorMatrix
                in="a"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.9 0"
                result="b"
              />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Ambient field */}
          <ellipse cx="200" cy="100" rx="180" ry="90" fill="rgba(100, 60, 180, 0.06)" />

          {/* Black hole + accretion */}
          <g transform="translate(0, 0)">
            <ellipse cx="200" cy="468" rx="150" ry="36" fill="url(#bh-disk)" opacity={0.85} style={{ mixBlendMode: 'screen' }} />
            <ellipse cx="200" cy="468" rx="32" ry="9" fill="url(#bh-glow)" style={playing ? { animation: 'bhPulse 4s ease-in-out infinite' } : {}} />
            <ellipse cx="200" cy="468" rx="6" ry="2.2" fill="#000" opacity="0.95" />
            <path
              d="M 80 450 A 120 20 0 0 0 320 450"
              fill="none"
              stroke="rgba(212, 175, 55, 0.15)"
              strokeWidth="0.8"
              strokeDasharray="5 5"
              style={playing ? { animation: 'spiralWobble 12s linear infinite' } : {}}
            />
            <path
              d="M 100 456 A 100 16 0 0 0 300 456"
              fill="none"
              stroke="rgba(100, 200, 255, 0.2)"
              strokeWidth="0.5"
              strokeDasharray="4 6"
              style={playing ? { animation: 'spiralWobble 18s linear infinite reverse' } : {}}
            />
          </g>

          <g
            className="merkaba-root"
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
            transform={`translate(${CX}, ${CY - (pose === 'sitting' ? 8 : 0)})`}
          >
            {/* Counter-rotating tetrahedra (2D double triangle) */}
            <g
              className="tri-cw"
              style={playing ? { animation: 'merkabaCW 90s linear infinite' } : {}}
            >
              <polygon
                points="0,-100 86.6,50 -86.6,50"
                fill="none"
                stroke="rgba(212, 175, 55, 0.5)"
                strokeWidth="0.8"
                strokeLinejoin="round"
              />
            </g>
            <g
              className="tri-ccw"
              style={playing ? { animation: 'merkabaCCW 70s linear infinite' } : {}}
            >
              <polygon
                points="0,100 -86.6,-50 86.6,-50"
                fill="none"
                stroke="rgba(150, 200, 255, 0.5)"
                strokeWidth="0.8"
                strokeLinejoin="round"
              />
            </g>

            {/* Inner light */}
            <circle
              r="6"
              fill="rgba(255, 240, 200, 0.25)"
              style={playing ? { animation: 'coreGlow 3s ease-in-out infinite' } : {}}
            />

            {MERKABA_VERTICES.map((v) => {
              const innerX = v.x * 0.12;
              const innerY = v.y * 0.12;
              return (
                <g key={v.k}>
                  <line
                    x1={v.x}
                    y1={v.y}
                    x2={innerX}
                    y2={innerY + 4}
                    stroke="rgba(100, 220, 255, 0.5)"
                    strokeWidth="0.4"
                    filter="url(#ray-glow)"
                    style={playing ? { animation: 'rayPulse 2.2s ease-in-out infinite', animationDelay: `${v.k * 0.18}s` } : {}}
                  />
                  <line
                    x1={v.x}
                    y1={v.y}
                    x2={innerX * 0.9}
                    y2={innerY * 0.9 + 5}
                    stroke="rgba(255, 255, 255, 0.8)"
                    strokeWidth="0.7"
                    filter="url(#sharp-ray)"
                    style={playing ? { animation: 'raySharp 1.4s ease-in-out infinite', animationDelay: `${v.k * 0.12}s` } : {}}
                  />
                </g>
              );
            })}

            {/* You — still point */}
            <g
              className="figure-wrap"
              transform={pose === 'sitting' ? 'translate(0, 6)' : 'translate(0, 0)'}
            >
              {pose === 'standing' ? <StandingFigure /> : <SittingFigure />}
            </g>

            {/* Energy layers shed → singularity (relative to group) */}
            {shedPaths.map((d, i) => (
              <g key={d} opacity="0.55">
                <path d={d} fill="none" stroke="none" id={`shedPath-${i}`} />
                <circle r="2.2" fill="rgba(200, 180, 255, 0.7)">
                  {playing && (
                    <animateMotion
                      dur={`${4.2 + i * 0.4}s`}
                      repeatCount="indefinite"
                      path={d}
                      rotate="auto"
                    />
                  )}
                </circle>
                <circle r="1.4" fill="rgba(212, 175, 55, 0.45)">
                  {playing && (
                    <animateMotion
                      dur={`${5.5 + i * 0.3}s`}
                      repeatCount="indefinite"
                      path={d}
                      begin={`${i * 0.7}s`}
                    />
                  )}
                </circle>
              </g>
            ))}
          </g>
        </svg>

        <div
          className="absolute bottom-0 left-0 right-0 px-4 py-3 text-center border-t border-white/5"
          style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.45) 0%, transparent 100%)' }}
        >
          <p className="text-[12px] md:text-sm text-amber-100/80 italic max-w-md mx-auto leading-relaxed" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            {AFFIRMATIONS[affirmationIdx]}
          </p>
        </div>
      </div>

      <p className="text-[10px] text-white/30 text-center max-w-lg mx-auto leading-relaxed">
        This visualization is for meditation and self-reflection. It is not medical advice, diagnosis, or treatment.
        Honor your body; consult qualified professionals for health concerns.
      </p>

      <style>{`
        @keyframes merkabaCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes merkabaCCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes coreGlow {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.8; }
        }
        @keyframes rayPulse {
          0%, 100% { stroke-opacity: 0.35; }
          50% { stroke-opacity: 0.95; }
        }
        @keyframes raySharp {
          0%, 100% { stroke-opacity: 0.2; }
          50% { stroke-opacity: 1; }
        }
        @keyframes bhPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes spiralWobble {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 24; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tri-cw, .tri-ccw { animation: none !important; }
          .merkaba-root { animation: none !important; }
        }
      `}</style>
    </div>
  );
};

export default MerkabaWeightReleasePage;
