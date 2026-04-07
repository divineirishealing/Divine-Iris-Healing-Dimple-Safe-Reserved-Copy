import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Sparkles, RotateCcw, Send, ArrowRight, Zap, Heart } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../../hooks/use-toast';
import { cn, formatDateDdMmYyyy } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

const TRANSFORMATIONS = {
  'fear': 'courage', 'anger': 'compassion', 'anxiety': 'peace', 'jealousy': 'gratitude',
  'guilt': 'forgiveness', 'sadness': 'joy', 'doubt': 'faith', 'hate': 'love',
  'loneliness': 'connection', 'failure': 'growth', 'rejection': 'acceptance',
  'stress': 'calm', 'confusion': 'clarity', 'shame': 'self-love', 'regret': 'wisdom',
  'pain': 'healing', 'worry': 'trust', 'insecurity': 'confidence',
};

const AFFIRMATIONS = [
  "I am worthy of love and belonging",
  "My past does not define my future",
  "I release what no longer serves me",
  "I am growing stronger every day",
  "The universe has my back",
  "I choose peace over perfection",
  "My light shines brighter than my shadows",
  "I trust the process of my transformation",
  "What I release creates space for miracles",
  "I am exactly where I need to be",
];

const transformText = (text) => {
  let transformed = text.toLowerCase();
  Object.entries(TRANSFORMATIONS).forEach(([neg, pos]) => {
    transformed = transformed.replace(new RegExp(neg, 'gi'), pos.toUpperCase());
  });
  if (transformed === text.toLowerCase()) {
    return AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
  }
  return transformed.charAt(0).toUpperCase() + transformed.slice(1);
};

const VortexAnimation = ({ active, onComplete }) => {
  useEffect(() => {
    if (active) {
      const timer = setTimeout(onComplete, 3000);
      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" data-testid="vortex-animation">
      <div className="text-center">
        {/* Vortex rings */}
        <div className="relative w-48 h-48 mx-auto mb-6">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="absolute inset-0 rounded-full border-2 border-purple-500/30"
              style={{
                animation: `vortexSpin ${2 + i * 0.3}s linear infinite`,
                transform: `scale(${1 - i * 0.15})`,
                borderColor: i < 2 ? 'rgba(239,68,68,0.4)' : i < 4 ? 'rgba(147,51,234,0.4)' : 'rgba(212,175,55,0.4)',
              }} />
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-black shadow-[0_0_40px_20px_rgba(0,0,0,0.8)]" />
          </div>
        </div>
        <p className="text-white text-lg font-serif animate-pulse">Transmuting...</p>
        <p className="text-purple-300/60 text-xs mt-1">Releasing into the cosmic void</p>
      </div>
      <style>{`
        @keyframes vortexSpin {
          0% { transform: rotate(0deg) scale(var(--scale, 1)); }
          100% { transform: rotate(360deg) scale(var(--scale, 1)); }
        }
      `}</style>
    </div>
  );
};

const BhaadPortalPage = () => {
  const { toast } = useToast();
  const [inputText, setInputText] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [transformed, setTransformed] = useState(null);
  const [history, setHistory] = useState([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/api/student/bhaad-history`, { withCredentials: true })
      .then(r => setHistory(r.data || []))
      .catch(() => {});
  }, []);

  const handleRelease = () => {
    if (!inputText.trim()) return;
    setReleasing(true);
    setTransformed(null);
  };

  const handleVortexComplete = () => {
    const result = transformText(inputText);
    setTransformed(result);
    setReleasing(false);

    // Save to backend
    axios.post(`${API}/api/student/bhaad-release`, {
      original: inputText,
      transformed: result,
      date: new Date().toISOString().split('T')[0],
    }, { withCredentials: true }).then(() => {
      setHistory(prev => [{ original: inputText, transformed: result, date: new Date().toISOString().split('T')[0] }, ...prev]);
    }).catch(() => {});
  };

  const reset = () => {
    setInputText('');
    setTransformed(null);
    textareaRef.current?.focus();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="bhaad-portal-page">
      {/* Header */}
      <div className="text-center mb-2">
        <h1 className="text-2xl md:text-3xl font-serif font-bold text-gray-900">The Bhaad Portal</h1>
        <p className="text-sm text-gray-500 mt-1">Release what weighs you down. Watch it transform.</p>
      </div>

      {/* Main Portal */}
      <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #1A0B2E 0%, #0a0a0a 50%, #1a2a1a 100%)' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 30%, #5D3FD3, transparent 60%)' }} />

        <div className="relative z-10 p-6 md:p-8">
          {!transformed ? (
            <>
              {/* Dark Side — Input */}
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">🌑</div>
                <h2 className="text-lg font-serif text-white/90">This Side of the Black Hole</h2>
                <p className="text-xs text-white/40 mt-1">Write what you want to release — fears, anger, doubts, limiting beliefs</p>
              </div>

              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="I am tired of feeling... / I want to let go of... / I'm afraid that..."
                className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/20 text-sm resize-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/30 outline-none backdrop-blur-sm"
                data-testid="bhaad-input"
              />

              <div className="flex justify-center mt-4">
                <Button
                  onClick={handleRelease}
                  disabled={!inputText.trim() || releasing}
                  className="bg-gradient-to-r from-red-600 to-purple-700 hover:from-red-700 hover:to-purple-800 text-white rounded-full px-8 py-3 font-medium shadow-lg shadow-red-500/20"
                  data-testid="bhaad-release-btn"
                >
                  <Zap size={16} className="mr-2" /> Release into the Void
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Light Side — Transformed */}
              <div className="text-center mb-6">
                <div className="text-4xl mb-2" style={{ filter: 'drop-shadow(0 0 20px rgba(212,175,55,0.5))' }}>🌟</div>
                <h2 className="text-lg font-serif text-[#D4AF37]">The Other Side</h2>
                <p className="text-xs text-[#D4AF37]/50 mt-1">What emerged from your transformation</p>
              </div>

              {/* Before */}
              <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-4 mb-4">
                <p className="text-[10px] text-red-400/60 uppercase tracking-wider mb-1">Released</p>
                <p className="text-sm text-red-300/80 line-through italic">{inputText}</p>
              </div>

              {/* Arrow */}
              <div className="flex justify-center my-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-[#D4AF37] flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <ArrowRight size={16} className="text-white" style={{ transform: 'rotate(90deg)' }} />
                </div>
              </div>

              {/* After */}
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl p-4 mb-4" style={{ boxShadow: '0 0 30px rgba(212,175,55,0.1)' }}>
                <p className="text-[10px] text-[#D4AF37]/60 uppercase tracking-wider mb-1">Transformed Into</p>
                <p className="text-lg text-[#D4AF37] font-serif font-bold">{transformed}</p>
              </div>

              <div className="flex justify-center gap-3 mt-4">
                <Button variant="outline" onClick={reset} className="rounded-full border-white/20 text-white hover:bg-white/10" data-testid="bhaad-again">
                  <RotateCcw size={14} className="mr-2" /> Release Again
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* History — Past Transformations */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border p-5">
          <h3 className="text-sm font-serif font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-[#D4AF37]" /> Your Transformation Journey
          </h3>
          <div className="space-y-3">
            {history.slice(0, 10).map((h, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors" data-testid={`bhaad-history-${i}`}>
                <div className="text-lg shrink-0">🌑</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 line-through truncate">{h.original}</p>
                  <div className="flex items-center gap-1 my-1">
                    <ArrowRight size={10} className="text-purple-400" />
                  </div>
                  <p className="text-sm text-[#D4AF37] font-medium">{h.transformed}</p>
                </div>
                <div className="text-[10px] text-gray-400 shrink-0 font-mono tabular-nums">
                  {formatDateDdMmYyyy(h.date)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <VortexAnimation active={releasing} onComplete={handleVortexComplete} />
    </div>
  );
};

export default BhaadPortalPage;
