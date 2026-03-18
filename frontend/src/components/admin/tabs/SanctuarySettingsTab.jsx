import React, { useState, useRef } from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Film, Upload, X } from 'lucide-react';
import ImageUploader from '../ImageUploader';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const VideoUploader = ({ value, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/api/upload`, formData);
      const url = res.data.url?.startsWith('http') ? res.data.url : `${API}${res.data.url}`;
      onChange(url);
    } catch (err) {
      console.error('Video upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative rounded-lg overflow-hidden border bg-black">
          <video src={value} className="w-full h-32 object-cover" muted autoPlay loop playsInline />
          <button onClick={() => onChange('')} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Film size={20} />
              <span className="text-xs">Upload Video (MP4)</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={e => handleUpload(e.target.files?.[0])}
      />
    </div>
  );
};

const SanctuarySettingsTab = ({ settings, onChange }) => {
  const raw = settings.sanctuary_settings || {};
  const sanctuary = {
    hero_bg: raw.hero_bg || "",
    hero_video: raw.hero_video || "",
    hero_overlay: raw.hero_overlay || "",
    greeting_title: raw.greeting_title || "Divine Iris Healing",
    greeting_subtitle: raw.greeting_subtitle || "Home for Your Soul"
  };

  const update = (field, value) => {
    onChange({
      ...settings,
      sanctuary_settings: {
        ...sanctuary,
        [field]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Sanctuary (Dashboard) Atmosphere</h2>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Atmosphere Background (Image)</Label>
            <ImageUploader value={sanctuary.hero_bg} onChange={url => update('hero_bg', url)} />
            <p className="text-xs text-gray-500">Static background image. Recommended: 1920x1080px.</p>
          </div>

          <div className="space-y-2">
            <Label>Atmosphere Background (Video)</Label>
            <VideoUploader value={sanctuary.hero_video || ''} onChange={url => update('hero_video', url)} />
            <p className="text-xs text-gray-500">Looping ambient video. Overrides image if both set. MP4/WebM.</p>
          </div>

          <div className="space-y-2">
            <Label>Decorative Overlay (Parallax)</Label>
            <ImageUploader value={sanctuary.hero_overlay} onChange={url => update('hero_overlay', url)} />
            <p className="text-xs text-gray-500">Transparent PNG with butterflies, gold swirls, etc.</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mt-1">Priority</p>
            <p className="text-xs text-gray-500">Video takes priority over Image. If neither is set, a default purple gradient is used.</p>
          </div>

          <div className="space-y-2">
            <Label>Greeting Title</Label>
            <Input 
              value={sanctuary.greeting_title} 
              onChange={e => update('greeting_title', e.target.value)} 
              placeholder="e.g., Divine Iris Healing" 
              data-testid="sanctuary-greeting-title"
            />
          </div>

          <div className="space-y-2">
            <Label>Greeting Subtitle</Label>
            <Input 
              value={sanctuary.greeting_subtitle} 
              onChange={e => update('greeting_subtitle', e.target.value)} 
              placeholder="e.g., Home for Your Soul" 
              data-testid="sanctuary-greeting-subtitle"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 bg-gray-100 rounded-lg border">
          <p className="text-xs text-gray-500 mb-2 text-center">Live Preview</p>
          <div className="w-full h-64 relative rounded-xl overflow-hidden shadow-lg bg-black">
            {sanctuary.hero_video ? (
              <video src={sanctuary.hero_video} className="absolute inset-0 w-full h-full object-cover" muted autoPlay loop playsInline />
            ) : sanctuary.hero_bg ? (
              <img src={sanctuary.hero_bg} className="absolute inset-0 w-full h-full object-cover" alt="BG" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#2D1B69] via-[#5D3FD3] to-[#7C5CE7]" />
            )}
            {sanctuary.hero_overlay && (
              <img src={sanctuary.hero_overlay} className="absolute inset-0 w-full h-full object-cover opacity-70" alt="Overlay" />
            )}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(20,10,50,0.5)_100%)]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
              <h1 className="text-3xl font-serif font-bold drop-shadow-lg">{sanctuary.greeting_title}</h1>
              <p className="text-sm font-light tracking-[0.25em] uppercase opacity-70 mt-1">{sanctuary.greeting_subtitle}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SanctuarySettingsTab;
