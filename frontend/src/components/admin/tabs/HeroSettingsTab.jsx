import React, { useState, useRef, useCallback } from 'react';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Upload, X, Film, Sparkles } from 'lucide-react';
import { resolveImageUrl } from '../../../lib/imageUtils';
import CollapsibleSection from '../CollapsibleSection';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FONT_OPTIONS = [
  { group: 'Elegant / Serif', fonts: ['Cinzel', 'Playfair Display', 'Cormorant Garamond', 'Merriweather', 'Libre Baskerville', 'Italiana'] },
  { group: 'Modern / Sans', fonts: ['Titillium Web', 'Montserrat', 'Lato', 'Poppins', 'Raleway', 'Josefin Sans', 'Open Sans', 'Nunito'] },
  { group: 'Handwriting / Script', fonts: ['Great Vibes', 'Dancing Script', 'Pacifico', 'Sacramento', 'Alex Brush', 'Kaushan Script', 'Satisfy', 'Allura', 'Caveat'] },
];
const ALL_FONTS = FONT_OPTIONS.flatMap(g => g.fonts);

const COLOR_EFFECTS = [
  { value: 'solid', label: 'Solid Color', preview: null },
  { value: 'gold_shimmer', label: 'Gold Shimmer', gradient: 'linear-gradient(135deg, #D4AF37 0%, #FFD700 30%, #F5E6B0 50%, #FFD700 70%, #D4AF37 100%)' },
  { value: 'purple_glow', label: 'Purple Glow', gradient: 'linear-gradient(135deg, #7B2D8E 0%, #9B59B6 30%, #C39BD3 50%, #9B59B6 70%, #7B2D8E 100%)' },
  { value: 'gold_purple', label: 'Gold-Purple Mix', gradient: 'linear-gradient(135deg, #D4AF37 0%, #9B59B6 40%, #D4AF37 70%, #9B59B6 100%)' },
  { value: 'silver', label: 'Silver Chrome', gradient: 'linear-gradient(135deg, #C0C0C0 0%, #E8E8E8 30%, #A8A8A8 50%, #E8E8E8 70%, #C0C0C0 100%)' },
  { value: 'rose_gold', label: 'Rose Gold', gradient: 'linear-gradient(135deg, #B76E79 0%, #EABFBF 30%, #D4A574 50%, #EABFBF 70%, #B76E79 100%)' },
  { value: 'rainbow', label: 'Rainbow', gradient: 'linear-gradient(135deg, #FF6B6B, #FFD93D, #6BCB77, #4D96FF, #9B59B6)' },
];

const SIZE_OPTIONS = [
  { value: '28px', label: 'XS' }, { value: '36px', label: 'S' }, { value: '44px', label: 'M' },
  { value: '54px', label: 'L' }, { value: '64px', label: 'XL' }, { value: '76px', label: '2XL' },
  { value: '90px', label: '3XL' }, { value: '110px', label: '4XL' },
];

const SUB_SIZE_OPTIONS = [
  { value: '10px', label: 'XS' }, { value: '13px', label: 'S' }, { value: '16px', label: 'M' },
  { value: '20px', label: 'L' }, { value: '24px', label: 'XL' }, { value: '30px', label: '2XL' },
  { value: '38px', label: '3XL' }, { value: '48px', label: '4XL' },
];

const FontSelect = ({ value, onChange, testId }) => (
  <select data-testid={testId} value={value} onChange={e => onChange(e.target.value)}
    className="w-full border rounded-md px-3 py-2 text-sm" style={{ fontFamily: value }}>
    {FONT_OPTIONS.map(g => (
      <optgroup key={g.group} label={g.group}>
        {g.fonts.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
      </optgroup>
    ))}
  </select>
);

const HeroSettingsTab = ({ settings, onChange, onVideoUpload }) => {
  const s = settings;
  const set = (key, val) => onChange({ ...s, [key]: val });
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleVideoDrop = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['mp4', 'webm', 'mov'].includes(ext)) {
      alert('Please upload an MP4, WebM, or MOV file.');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/upload/video`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      set('hero_video_url', res.data.url);
    } catch (err) {
      alert('Video upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [s]);

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); handleVideoDrop(e.dataTransfer.files); };
  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  // Preview gradient text style
  const getEffectStyle = (effect, fallbackColor) => {
    const fx = COLOR_EFFECTS.find(e => e.value === effect);
    if (!fx || !fx.gradient) return { color: fallbackColor || '#ffffff' };
    return {
      background: fx.gradient,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    };
  };

  return (
    <div data-testid="hero-settings-tab">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Hero Section</h2>
      <p className="text-xs text-gray-400 mb-6">The big banner at the top of your homepage with your title and video.</p>

      {/* ── TITLE ── */}
      <CollapsibleSection title="Main Title" subtitle={s.hero_title?.split('\n')[0] || 'Hero heading text'} defaultOpen={true}>
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Main Title</p>
        <p className="text-xs text-gray-400 mb-3">The big text visitors see first. Leave empty to hide. Press Enter for a new line.</p>

        <Textarea data-testid="hero-title-input" value={s.hero_title || ''} onChange={e => set('hero_title', e.target.value)} rows={2} className="mb-4 text-base" placeholder="Divine Iris&#10;Healing" />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-gray-500">Font</Label>
            <FontSelect value={s.hero_title_font || 'Cinzel'} onChange={v => set('hero_title_font', v)} testId="hero-title-font" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Size</Label>
            <div className="flex flex-wrap gap-1">
              {SIZE_OPTIONS.map(sz => (
                <button key={sz.value} onClick={() => set('hero_title_size', sz.value)}
                  className={`px-2 py-1.5 text-[10px] rounded border transition-all ${(s.hero_title_size || '44px') === sz.value ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                  {sz.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Color Effect</Label>
            <select value={s.hero_title_effect || 'solid'} onChange={e => set('hero_title_effect', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm" data-testid="hero-title-effect">
              {COLOR_EFFECTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            {(s.hero_title_effect || 'solid') === 'solid' && (
              <div className="flex gap-2 items-center mt-2">
                <input type="color" value={s.hero_title_color || '#ffffff'} onChange={e => set('hero_title_color', e.target.value)} className="w-8 h-8 rounded cursor-pointer border" />
                <Input value={s.hero_title_color || '#ffffff'} onChange={e => set('hero_title_color', e.target.value)} className="text-xs h-8" />
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs text-gray-500">Style</Label>
            <div className="flex gap-1">
              <button onClick={() => set('hero_title_bold', !s.hero_title_bold)}
                className={`flex-1 py-2 rounded text-xs font-bold border-2 transition-all ${s.hero_title_bold ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200'}`}>
                B
              </button>
              <button onClick={() => set('hero_title_italic', !s.hero_title_italic)}
                className={`flex-1 py-2 rounded text-xs border-2 transition-all italic ${s.hero_title_italic ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200'}`}>
                I
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Letter Spacing</Label>
            <select value={s.hero_title_spacing || 'normal'} onChange={e => set('hero_title_spacing', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm" data-testid="hero-title-spacing">
              <option value="normal">Normal</option>
              <option value="0.05em">Tight</option>
              <option value="0.15em">Wide</option>
              <option value="0.3em">Extra Wide</option>
              <option value="0.5em">Ultra Wide</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Text Shadow</Label>
            <select value={s.hero_title_shadow || 'none'} onChange={e => set('hero_title_shadow', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm" data-testid="hero-title-shadow">
              <option value="none">None</option>
              <option value="subtle">Subtle</option>
              <option value="medium">Medium</option>
              <option value="strong">Strong Glow</option>
              <option value="gold_glow">Gold Glow</option>
            </select>
          </div>
        </div>

        {/* Live preview */}
        <div className="mt-4 bg-gray-900 rounded-lg p-4 text-center overflow-hidden" data-testid="title-preview">
          <p className="whitespace-pre-line" style={{
            fontFamily: "'Lato', sans-serif",
            fontSize: 'clamp(16px, 3vw, 28px)',
            fontWeight: s.hero_title_bold ? 700 : 400,
            fontStyle: s.hero_title_italic ? 'italic' : 'normal',
            letterSpacing: s.hero_title_spacing || 'normal',
            ...getEffectStyle(s.hero_title_effect, s.hero_title_color),
          }}>
            {s.hero_title || 'Title Preview'}
          </p>
        </div>
      </div>
      </CollapsibleSection>

      {/* ── SUBTITLE ── */}
      <CollapsibleSection title="Subtitle" subtitle={s.hero_subtitle || 'Below the title'}>
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Subtitle</p>
        <p className="text-xs text-gray-400 mb-3">Smaller text below the main title. Leave empty to hide.</p>

        <Input data-testid="hero-subtitle-input" value={s.hero_subtitle || ''} onChange={e => set('hero_subtitle', e.target.value)} className="mb-4" placeholder="ETERNAL HAPPINESS" />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-gray-500">Font</Label>
            <FontSelect value={s.hero_subtitle_font || 'Lato'} onChange={v => set('hero_subtitle_font', v)} testId="hero-subtitle-font" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Size</Label>
            <div className="flex flex-wrap gap-1">
              {SUB_SIZE_OPTIONS.map(sz => (
                <button key={sz.value} onClick={() => set('hero_subtitle_size', sz.value)}
                  className={`px-2 py-1.5 text-[10px] rounded border transition-all ${(s.hero_subtitle_size || '14px') === sz.value ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                  {sz.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Color Effect</Label>
            <select value={s.hero_subtitle_effect || 'solid'} onChange={e => set('hero_subtitle_effect', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm" data-testid="hero-subtitle-effect">
              {COLOR_EFFECTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            {(s.hero_subtitle_effect || 'solid') === 'solid' && (
              <div className="flex gap-2 items-center mt-2">
                <input type="color" value={s.hero_subtitle_color || '#ffffff'} onChange={e => set('hero_subtitle_color', e.target.value)} className="w-8 h-8 rounded cursor-pointer border" />
                <Input value={s.hero_subtitle_color || '#ffffff'} onChange={e => set('hero_subtitle_color', e.target.value)} className="text-xs h-8" />
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs text-gray-500">Style</Label>
            <div className="flex gap-1">
              <button onClick={() => set('hero_subtitle_bold', !s.hero_subtitle_bold)}
                className={`flex-1 py-2 rounded text-xs font-bold border-2 transition-all ${s.hero_subtitle_bold ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200'}`}>
                B
              </button>
              <button onClick={() => set('hero_subtitle_italic', !s.hero_subtitle_italic)}
                className={`flex-1 py-2 rounded text-xs border-2 transition-all italic ${s.hero_subtitle_italic ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200'}`}>
                I
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Letter Spacing</Label>
            <select value={s.hero_subtitle_spacing || '0.3em'} onChange={e => set('hero_subtitle_spacing', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm">
              <option value="normal">Normal</option>
              <option value="0.1em">Tight</option>
              <option value="0.2em">Wide</option>
              <option value="0.3em">Extra Wide</option>
              <option value="0.5em">Ultra Wide</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Text Shadow</Label>
            <select value={s.hero_subtitle_shadow || 'none'} onChange={e => set('hero_subtitle_shadow', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm">
              <option value="none">None</option>
              <option value="subtle">Subtle</option>
              <option value="medium">Medium</option>
              <option value="strong">Strong Glow</option>
            </select>
          </div>
        </div>

        {/* Subtitle preview */}
        <div className="mt-4 bg-gray-900 rounded-lg p-3 text-center" data-testid="subtitle-preview">
          <p style={{
            fontFamily: `'${s.hero_subtitle_font || 'Lato'}', sans-serif`,
            fontSize: 'clamp(10px, 2vw, 18px)',
            fontWeight: s.hero_subtitle_bold ? 700 : 300,
            fontStyle: s.hero_subtitle_italic ? 'italic' : 'normal',
            letterSpacing: s.hero_subtitle_spacing || '0.3em',
            ...getEffectStyle(s.hero_subtitle_effect, s.hero_subtitle_color),
          }}>
            {s.hero_subtitle || 'Subtitle Preview'}
          </p>
        </div>
      </div>
      </CollapsibleSection>

      {/* ── LAYOUT & POSITIONING ── */}
      <CollapsibleSection title="Layout & Positioning" subtitle="Alignment, gaps, offsets">
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Layout & Positioning</p>
        <p className="text-xs text-gray-400 mb-4">Control where the text appears on the hero and how close the lines are.</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Horizontal Align</Label>
            <div className="flex gap-1">
              {[{ v: 'left', l: 'Left' }, { v: 'center', l: 'Center' }, { v: 'right', l: 'Right' }].map(a => (
                <button key={a.v} onClick={() => set('hero_title_align', a.v)}
                  className={`flex-1 py-2 rounded text-xs border-2 transition-all ${(s.hero_title_align || 'left') === a.v ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-400 border-gray-200'}`}>
                  {a.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Vertical Position</Label>
            <div className="flex gap-1">
              {[{ v: 'top', l: 'Top' }, { v: 'center', l: 'Mid' }, { v: 'bottom', l: 'Btm' }].map(a => (
                <button key={a.v} onClick={() => set('hero_vertical_align', a.v)}
                  className={`flex-1 py-2 rounded text-xs border-2 transition-all ${(s.hero_vertical_align || 'center') === a.v ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-400 border-gray-200'}`}>
                  {a.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Title-Subtitle Gap</Label>
            <select value={s.hero_title_gap || '24px'} onChange={e => set('hero_title_gap', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm" data-testid="hero-title-gap">
              <option value="4px">Touching</option>
              <option value="8px">Very Close</option>
              <option value="12px">Close</option>
              <option value="16px">Snug</option>
              <option value="24px">Normal</option>
              <option value="36px">Wide</option>
              <option value="48px">Very Wide</option>
            </select>
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Horizontal Offset</Label>
            <select value={s.hero_h_offset || '0'} onChange={e => set('hero_h_offset', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm" data-testid="hero-h-offset">
              <option value="-200px">Far Left</option>
              <option value="-100px">Left</option>
              <option value="-50px">Slightly Left</option>
              <option value="0">Centered</option>
              <option value="50px">Slightly Right</option>
              <option value="100px">Right</option>
              <option value="200px">Far Right</option>
            </select>
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Vertical Offset</Label>
            <select value={s.hero_v_offset || '0'} onChange={e => set('hero_v_offset', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm" data-testid="hero-v-offset">
              <option value="-150px">Far Up</option>
              <option value="-80px">Up</option>
              <option value="-40px">Slightly Up</option>
              <option value="0">Default</option>
              <option value="40px">Slightly Down</option>
              <option value="80px">Down</option>
              <option value="150px">Far Down</option>
            </select>
          </div>
        </div>
      </div>
      </CollapsibleSection>

      {/* ── DECORATIVE LINES ── */}
      <CollapsibleSection title="Decorative Lines" subtitle="Above & below subtitle">
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Decorative Lines</p>
            <p className="text-xs text-gray-400">The thin lines that appear above and below the subtitle</p>
          </div>
          <Switch checked={s.hero_show_lines !== false} onCheckedChange={v => set('hero_show_lines', v)} />
        </div>
      </div>
      </CollapsibleSection>

      {/* ── HERO BACKGROUND ── */}
      <CollapsibleSection title="Hero Background" subtitle="Video or image behind hero" defaultOpen={true}>
      <div className="bg-white rounded-lg p-5 shadow-sm border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Hero Background</p>
            <p className="text-xs text-gray-400">Drop a video or image here — this is what visitors see first</p>
          </div>
          {s.hero_video_url && (
            <button onClick={() => set('hero_video_url', '')} data-testid="hero-video-remove"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-full hover:bg-red-50 transition-colors">
              <X size={13} /> Remove
            </button>
          )}
        </div>

        <div
          data-testid="hero-video-dropzone"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !s.hero_video_url && fileInputRef.current?.click()}
          className={`relative rounded-xl overflow-hidden transition-all duration-200 ${!s.hero_video_url ? 'cursor-pointer' : ''} ${dragOver ? 'ring-2 ring-[#D4AF37] ring-offset-2' : ''}`}
          style={{ minHeight: '220px', background: '#0d1117' }}
        >
          {s.hero_video_url ? (
            <video src={resolveImageUrl(s.hero_video_url)} className="w-full h-56 object-cover" muted autoPlay loop playsInline />
          ) : uploading ? (
            <div className="flex flex-col items-center justify-center h-56 gap-3">
              <div className="w-14 h-14 rounded-full border-4 border-gray-700 border-t-[#D4AF37] animate-spin" />
              <p className="text-sm text-gray-400 font-medium">Uploading... {uploadProgress}%</p>
              <div className="w-48 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-[#D4AF37] rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <div className={`flex flex-col items-center justify-center h-56 gap-3 transition-colors ${dragOver ? 'bg-[#D4AF37]/10' : ''}`}>
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <Upload size={28} className="text-gray-500" />
              </div>
              <p className="text-sm text-gray-400 font-medium">Drop your video or animation here</p>
              <p className="text-xs text-gray-600">or click to browse — MP4, WebM, MOV</p>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/mov" className="hidden"
          onChange={(e) => handleVideoDrop(e.target.files)} />
      </div>
      </CollapsibleSection>
    </div>
  );
};

export default HeroSettingsTab;
