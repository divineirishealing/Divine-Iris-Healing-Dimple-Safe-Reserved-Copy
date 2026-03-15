import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, X, ArrowRight, BookOpen, Sparkles, MessageSquare } from 'lucide-react';
import { resolveImageUrl } from '../lib/imageUtils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GlobalSearch = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ programs: [], sessions: [], testimonials: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults({ programs: [], sessions: [], testimonials: [] });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const searchDebounced = useCallback(
    (() => {
      let timer;
      return (q) => {
        clearTimeout(timer);
        if (q.length < 2) { setResults({ programs: [], sessions: [], testimonials: [] }); return; }
        timer = setTimeout(async () => {
          setLoading(true);
          try {
            const res = await axios.get(`${API}/search?q=${encodeURIComponent(q)}`);
            setResults(res.data);
          } catch { }
          setLoading(false);
        }, 300);
      };
    })(),
    []
  );

  useEffect(() => { searchDebounced(query); }, [query, searchDebounced]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasResults = results.programs.length > 0 || results.sessions.length > 0 || results.testimonials.length > 0;

  const handleNavigate = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-[100]" data-testid="global-search-overlay">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Search Panel */}
      <div className="relative max-w-2xl mx-auto mt-[12vh] px-4" data-testid="global-search-panel">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ border: '1px solid rgba(212,175,55,0.15)' }}>
          {/* Search Input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <Search size={18} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              data-testid="global-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search programs, sessions, testimonials..."
              className="flex-1 text-sm outline-none placeholder:text-gray-400"
              autoComplete="off"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
            <kbd className="hidden sm:inline text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">ESC</kbd>
          </div>

          {/* Results */}
          {query.length >= 2 && (
            <div className="max-h-[55vh] overflow-y-auto" data-testid="search-results">
              {loading && (
                <div className="py-8 text-center text-xs text-gray-400">Searching...</div>
              )}

              {!loading && !hasResults && (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-400">No results found for "{query}"</p>
                </div>
              )}

              {/* Programs */}
              {results.programs.length > 0 && (
                <div className="p-3" data-testid="search-programs">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Programs</p>
                  {results.programs.map(p => (
                    <button
                      key={p.id}
                      data-testid={`search-result-program-${p.id}`}
                      onClick={() => handleNavigate(`/program/${p.slug || p.id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-purple-50 transition-colors text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #f3edff, #ece4ff)' }}>
                        <BookOpen size={14} className="text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                        {p.category && <p className="text-[10px] text-gray-400 truncate">{p.category}</p>}
                      </div>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-purple-400 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Sessions */}
              {results.sessions.length > 0 && (
                <div className="p-3 border-t border-gray-50" data-testid="search-sessions">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Sessions</p>
                  {results.sessions.map(s => (
                    <button
                      key={s.id}
                      data-testid={`search-result-session-${s.id}`}
                      onClick={() => handleNavigate(`/session/${s.slug || s.id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-purple-50 transition-colors text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #fdf8f3, #f5eef8)' }}>
                        <Sparkles size={14} className="text-[#D4AF37]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                      </div>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-purple-400 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Testimonials */}
              {results.testimonials.length > 0 && (
                <div className="p-3 border-t border-gray-50" data-testid="search-testimonials">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Testimonials</p>
                  {results.testimonials.slice(0, 5).map(t => (
                    <button
                      key={t.id}
                      data-testid={`search-result-testimonial-${t.id}`}
                      onClick={() => handleNavigate('/transformations')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-purple-50 transition-colors text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #f3edff, #fdf8f3)' }}>
                        <MessageSquare size={14} className="text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{t.name || 'Testimonial'}</p>
                        {t.text && <p className="text-[10px] text-gray-400 truncate">{t.text.substring(0, 80)}...</p>}
                      </div>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-purple-400 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Links (when no query) */}
          {query.length < 2 && (
            <div className="p-4 text-center">
              <p className="text-[10px] text-gray-400 mb-3">Quick links</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['Programs', 'Sessions', 'Transformations'].map(label => (
                  <button
                    key={label}
                    onClick={() => handleNavigate(`/${label.toLowerCase()}`)}
                    className="px-3 py-1.5 text-[10px] rounded-full border border-gray-200 text-gray-500 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
