import React, { useState, useRef, useCallback } from 'react';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Upload, X, Film } from 'lucide-react';
import { resolveImageUrl } from '../../../lib/imageUtils';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FONT_OPTIONS = [
  'Playfair Display', 'Lato', 'Cinzel', 'Caveat', 'Montserrat',
  'Poppins', 'Raleway', 'Cormorant Garamond', 'Italiana', 'Josefin Sans',
  'Great Vibes', 'Dancing Script', 'Merriweather', 'Libre Baskerville',
  'Roboto Slab', 'Open Sans', 'Source Sans Pro', 'Nunito'
];

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
      console.error(err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [s]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleVideoDrop(e.dataTransfer.files);
  };

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  return (
    <div data-testid="hero-settings-tab">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Hero Section</h2>
      <p className="text-xs text-gray-400 mb-6">The big banner at the top of your homepage with your title and video.</p>

      {/* VIDEO — Drag & Drop */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Background Video</p>
        <p className="text-xs text-gray-400 mb-3">This video plays behind your title text. Drag & drop or click to upload.</p>

        {s.hero_video_url ? (
          <div className="relative rounded-lg overflow-hidden border mb-3">
            <video src={resolveImageUrl(s.hero_video_url)} className="w-full h-40 object-cover" muted autoPlay loop playsInline />
            <button onClick={() => set('hero_video_url', '')} data-testid="hero-video-remove"
              className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div
            data-testid="hero-video-dropzone"
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
              dragOver ? 'border-[#D4AF37] bg-amber-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-[#D4AF37] animate-spin" />
                <p className="text-sm text-gray-600 font-medium">Uploading... {uploadProgress}%</p>
                <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#D4AF37] rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                  <Film size={24} className="text-gray-400" />
                </div>
                <p className="text-sm text-gray-600 font-medium">Drop your video here</p>
                <p className="text-xs text-gray-400">or click to browse — MP4, WebM, MOV</p>
              </div>
            )}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/mov" className="hidden"
          onChange={(e) => handleVideoDrop(e.target.files)} />
      </div>

      {/* TITLE */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Main Title</p>
        <p className="text-xs text-gray-400 mb-3">The big text visitors see first. Leave empty to hide. Press Enter for a new line.</p>

        <Textarea data-testid="hero-title-input" value={s.hero_title || ''} onChange={e => set('hero_title', e.target.value)} rows={2} className="mb-4 text-base" placeholder="Divine Iris&#10;Healing" />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-gray-500">Font Style</Label>
            <select data-testid="hero-title-font" value={s.hero_title_font || 'Cinzel'} onChange={e => set('hero_title_font', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              {FONT_OPTIONS.map(f => <option key={f} value={f} style={{fontFamily:f}}>{f}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Text Color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={s.hero_title_color||'#ffffff'} onChange={e => set('hero_title_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
              <Input value={s.hero_title_color||'#ffffff'} onChange={e => set('hero_title_color', e.target.value)} className="text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Text Size</Label>
            <select value={s.hero_title_size||'70px'} onChange={e => set('hero_title_size', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              <option value="40px">Small</option><option value="50px">Medium</option><option value="60px">Large</option>
              <option value="70px">Very Large</option><option value="85px">Extra Large</option><option value="100px">Huge</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Bold?</Label>
            <button onClick={() => set('hero_title_bold', !s.hero_title_bold)}
              className={`w-full py-2 rounded-md text-sm font-bold border-2 transition-all ${s.hero_title_bold ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200'}`}>
              B {s.hero_title_bold ? '(ON)' : '(OFF)'}
            </button>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Italic?</Label>
            <button onClick={() => set('hero_title_italic', !s.hero_title_italic)}
              className={`w-full py-2 rounded-md text-sm border-2 transition-all ${s.hero_title_italic ? 'bg-gray-900 text-white border-gray-900 italic' : 'bg-white text-gray-400 border-gray-200'}`}>
              <em>I</em> {s.hero_title_italic ? '(ON)' : '(OFF)'}
            </button>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Position</Label>
            <div className="flex gap-1">
              {[{v:'left',l:'Left'},{v:'center',l:'Center'},{v:'right',l:'Right'}].map(a => (
                <button key={a.v} onClick={() => set('hero_title_align', a.v)}
                  className={`flex-1 py-2 rounded text-xs border-2 transition-all ${(s.hero_title_align||'left')===a.v ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-400 border-gray-200'}`}>
                  {a.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SUBTITLE */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Subtitle</p>
        <p className="text-xs text-gray-400 mb-3">Smaller text below the main title. Leave empty to hide.</p>

        <Input data-testid="hero-subtitle-input" value={s.hero_subtitle||''} onChange={e => set('hero_subtitle', e.target.value)} className="mb-4" placeholder="ETERNAL HAPPINESS" />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-gray-500">Font Style</Label>
            <select value={s.hero_subtitle_font||'Lato'} onChange={e => set('hero_subtitle_font', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              {FONT_OPTIONS.map(f => <option key={f} value={f} style={{fontFamily:f}}>{f}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Text Color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={s.hero_subtitle_color||'#ffffff'} onChange={e => set('hero_subtitle_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
              <Input value={s.hero_subtitle_color||'#ffffff'} onChange={e => set('hero_subtitle_color', e.target.value)} className="text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Text Size</Label>
            <select value={s.hero_subtitle_size||'14px'} onChange={e => set('hero_subtitle_size', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              <option value="10px">Tiny</option><option value="12px">Small</option><option value="14px">Normal</option>
              <option value="16px">Medium</option><option value="18px">Large</option><option value="22px">Very Large</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Bold?</Label>
            <button onClick={() => set('hero_subtitle_bold', !s.hero_subtitle_bold)}
              className={`w-full py-2 rounded-md text-sm font-bold border-2 transition-all ${s.hero_subtitle_bold ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200'}`}>
              B {s.hero_subtitle_bold ? '(ON)' : '(OFF)'}
            </button>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Italic?</Label>
            <button onClick={() => set('hero_subtitle_italic', !s.hero_subtitle_italic)}
              className={`w-full py-2 rounded-md text-sm border-2 transition-all ${s.hero_subtitle_italic ? 'bg-gray-900 text-white border-gray-900 italic' : 'bg-white text-gray-400 border-gray-200'}`}>
              <em>I</em> {s.hero_subtitle_italic ? '(ON)' : '(OFF)'}
            </button>
          </div>
        </div>
      </div>

      {/* DECORATIVE LINES */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Decorative Lines</p>
            <p className="text-xs text-gray-400">The thin lines that appear above and below the subtitle</p>
          </div>
          <Switch checked={s.hero_show_lines !== false} onCheckedChange={v => set('hero_show_lines', v)} />
        </div>
      </div>

      {/* LIVE PREVIEW */}
      <div className="bg-white rounded-lg p-5 shadow-sm border">
        <p className="text-xs text-gray-400 mb-3 text-center font-medium">LIVE PREVIEW</p>
        <div className="p-6 rounded-lg relative overflow-hidden" style={{ background: '#1a1a2e', minHeight: '120px' }}>
          {s.hero_video_url && (
            <video src={resolveImageUrl(s.hero_video_url)} className="absolute inset-0 w-full h-full object-cover opacity-60" muted autoPlay loop playsInline />
          )}
          <div className={`relative z-10 flex flex-col ${(s.hero_title_align||'left')==='center'?'items-center text-center':(s.hero_title_align||'left')==='right'?'items-end text-right':'items-start text-left'}`}>
            {s.hero_title && (
              <p style={{color:s.hero_title_color||'#fff',fontWeight:s.hero_title_bold?700:400,fontSize:`calc(${s.hero_title_size||'70px'}*0.4)`,fontFamily:`'${s.hero_title_font||'Cinzel'}',serif`,fontStyle:s.hero_title_italic?'italic':'normal',lineHeight:1.2,whiteSpace:'pre-line'}}>
                {s.hero_title}
              </p>
            )}
            {s.hero_show_lines!==false && (s.hero_title || s.hero_subtitle) && <div className="w-20 h-px bg-white/50 my-1.5"></div>}
            {s.hero_subtitle && (
              <p style={{color:s.hero_subtitle_color||'#fff',fontWeight:s.hero_subtitle_bold?700:300,fontSize:`calc(${s.hero_subtitle_size||'14px'}*0.9)`,fontFamily:`'${s.hero_subtitle_font||'Lato'}',sans-serif`,fontStyle:s.hero_subtitle_italic?'italic':'normal',letterSpacing:'0.3em'}}>
                {s.hero_subtitle}
              </p>
            )}
            {s.hero_show_lines!==false && (s.hero_title || s.hero_subtitle) && <div className="w-20 h-px bg-white/50 mt-1.5"></div>}
            {!s.hero_title && !s.hero_subtitle && (
              <p className="text-white/40 text-xs italic text-center w-full py-4">Video only — no text overlay</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSettingsTab;
