import React from 'react';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import ImageUploader from '../ImageUploader';
import { resolveImageUrl } from '../../../lib/imageUtils';

const FontControls = ({ label, style = {}, onStyleChange }) => {
  const update = (prop, val) => onStyleChange({ ...style, [prop]: val });
  return (
    <details className="mt-1">
      <summary className="text-[9px] text-gray-400 cursor-pointer hover:text-gray-600">{label} font styling</summary>
      <div className="mt-1 flex gap-1 flex-wrap items-center bg-gray-50 rounded p-1.5">
        <input type="color" value={style.font_color || '#000000'} onChange={e => update('font_color', e.target.value)} className="w-5 h-5 rounded cursor-pointer" title="Color" />
        <select value={style.font_family || ''} onChange={e => update('font_family', e.target.value)} className="text-[8px] border rounded px-1 py-0.5">
          <option value="">Font</option>
          <option value="'Cinzel', serif">Cinzel</option>
          <option value="'Playfair Display', serif">Playfair</option>
          <option value="'Lato', sans-serif">Lato</option>
          <option value="'Montserrat', sans-serif">Montserrat</option>
        </select>
        <select value={style.font_size || ''} onChange={e => update('font_size', e.target.value)} className="text-[8px] border rounded px-1 py-0.5">
          <option value="">Size</option>
          {['12px','14px','16px','18px','20px','24px','28px','32px','36px','42px'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => update('font_weight', style.font_weight === 'bold' ? '400' : 'bold')} className={`text-[8px] px-1.5 py-0.5 rounded border ${style.font_weight === 'bold' ? 'bg-gray-800 text-white' : 'bg-white'}`}><b>B</b></button>
        <button onClick={() => update('font_style', style.font_style === 'italic' ? 'normal' : 'italic')} className={`text-[8px] px-1.5 py-0.5 rounded border ${style.font_style === 'italic' ? 'bg-gray-800 text-white' : 'bg-white'}`}><i>I</i></button>
      </div>
    </details>
  );
};

const AlignmentPicker = ({ value = 'center', onChange }) => (
  <div className="flex gap-0.5">
    {[{ val: 'left', Icon: AlignLeft }, { val: 'center', Icon: AlignCenter }, { val: 'right', Icon: AlignRight }].map(({ val, Icon }) => (
      <button key={val} type="button" onClick={() => onChange(val)}
        className={`p-1 rounded border ${value === val ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
        <Icon size={12} />
      </button>
    ))}
  </div>
);

const AboutSettingsTab = ({ settings, onChange }) => {
  const s = settings;
  const set = (key, val) => onChange({ ...s, [key]: val });
  const hero = s.page_heroes?.about || {};
  const updateHero = (field, val) => {
    const updated = { ...(s.page_heroes || {}), about: { ...hero, [field]: val } };
    onChange({ ...s, page_heroes: updated });
  };

  return (
    <div data-testid="about-settings-tab">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">About Section</h2>
      <p className="text-[10px] text-gray-400 mb-5">The "Meet the Healer" section + full About page content. Use **bold** and *italic* in text fields.</p>

      {/* ===== HERO SECTION CONTROLS ===== */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 shadow-sm border border-gray-700 mb-4" data-testid="about-hero-controls">
        <p className="text-sm font-semibold text-white mb-1">Hero Section (About Page)</p>
        <p className="text-[10px] text-gray-400 mb-4">Controls for the dark hero banner at the top of the About page. Toggle visibility and alignment for each element.</p>

        {/* Hero Logo */}
        <div className="bg-white/10 rounded-lg p-3 mb-3 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-white">Logo Image</p>
            <div className="flex items-center gap-2">
              <Label className="text-[9px] text-gray-400">Visible</Label>
              <Switch data-testid="about-hero-logo-toggle" checked={hero.logo_visible !== false} onCheckedChange={v => updateHero('logo_visible', v)} />
            </div>
          </div>
          {hero.logo_url && (
            <div className="mb-2 flex items-center gap-3 bg-black/20 p-2 rounded">
              <img src={resolveImageUrl(hero.logo_url)} alt="Hero Logo" className="h-12 object-contain" />
              <button onClick={() => updateHero('logo_url', '')} className="text-red-400 text-[10px] hover:underline">Remove</button>
            </div>
          )}
          <ImageUploader value={hero.logo_url || ''} onChange={url => updateHero('logo_url', url)} />
          <div className="mt-2">
            <Label className="text-[9px] text-gray-400">Logo Size: {hero.logo_size || 96}px</Label>
            <input type="range" min="40" max="300" value={hero.logo_size || 96} onChange={e => updateHero('logo_size', parseInt(e.target.value))} className="w-full mt-1" />
          </div>
        </div>

        {/* Hero Title */}
        <div className="bg-white/10 rounded-lg p-3 mb-3 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-white">Title</p>
            <div className="flex items-center gap-3">
              <AlignmentPicker value={hero.title_alignment || 'center'} onChange={v => updateHero('title_alignment', v)} />
              <div className="flex items-center gap-2">
                <Label className="text-[9px] text-gray-400">Visible</Label>
                <Switch data-testid="about-hero-title-toggle" checked={hero.title_visible !== false} onCheckedChange={v => updateHero('title_visible', v)} />
              </div>
            </div>
          </div>
          <Input data-testid="about-hero-title-input" value={hero.title_text ?? s.about_name ?? ''} onChange={e => updateHero('title_text', e.target.value)} placeholder="Dimple Ranawat" className="text-xs bg-white/90 mb-1" />
          <FontControls label="Title" style={hero.title_style || {}} onStyleChange={v => updateHero('title_style', v)} />
        </div>

        {/* Hero Subtitle */}
        <div className="bg-white/10 rounded-lg p-3 mb-3 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-white">Subtitle</p>
            <div className="flex items-center gap-3">
              <AlignmentPicker value={hero.subtitle_alignment || 'center'} onChange={v => updateHero('subtitle_alignment', v)} />
              <div className="flex items-center gap-2">
                <Label className="text-[9px] text-gray-400">Visible</Label>
                <Switch data-testid="about-hero-subtitle-toggle" checked={hero.subtitle_visible !== false} onCheckedChange={v => updateHero('subtitle_visible', v)} />
              </div>
            </div>
          </div>
          <Input data-testid="about-hero-subtitle-input" value={hero.subtitle_text ?? s.about_title ?? ''} onChange={e => updateHero('subtitle_text', e.target.value)} placeholder="Founder, Divine Iris – Soulful Healing Studio" className="text-xs bg-white/90 mb-1" />
          <FontControls label="Subtitle" style={hero.subtitle_style || {}} onStyleChange={v => updateHero('subtitle_style', v)} />
        </div>

        {/* Hero Divider */}
        <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-white">Divider Line</p>
            <div className="flex items-center gap-2">
              <Label className="text-[9px] text-gray-400">Visible</Label>
              <Switch data-testid="about-hero-divider-toggle" checked={hero.divider_visible !== false} onCheckedChange={v => updateHero('divider_visible', v)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-[9px] text-gray-400">Color</Label>
              <input type="color" value={hero.divider_color || '#D4AF37'} onChange={e => updateHero('divider_color', e.target.value)} className="w-6 h-5 rounded cursor-pointer border-0" data-testid="about-hero-divider-color" />
              <span className="text-[8px] text-gray-500">{hero.divider_color || '#D4AF37'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[9px] text-gray-400">Width</Label>
              <select value={hero.divider_width || '56'} onChange={e => updateHero('divider_width', e.target.value)} className="text-[9px] border rounded px-1 py-0.5 bg-white/90">
                {['28','42','56','72','96','128','full'].map(w => <option key={w} value={w}>{w === 'full' ? 'Full width' : `${w}px`}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[9px] text-gray-400">Thickness</Label>
              <select value={hero.divider_thickness || '2'} onChange={e => updateHero('divider_thickness', e.target.value)} className="text-[9px] border rounded px-1 py-0.5 bg-white/90">
                {['1','2','3','4'].map(t => <option key={t} value={t}>{t}px</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Site Logo */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-1">Site Logo</p>
        <p className="text-[10px] text-gray-400 mb-3">Appears in the top-left corner of the header navigation. Clickable — navigates to home.</p>
        {s.logo_url && (
          <div className="mb-3 flex items-center gap-3 bg-gray-50 p-3 rounded">
            <img src={resolveImageUrl(s.logo_url)} alt="Logo" className="h-16 object-contain" />
            <button onClick={() => set('logo_url', '')} className="text-red-500 text-[10px] hover:underline">Remove</button>
          </div>
        )}
        <ImageUploader value={s.logo_url || ''} onChange={url => set('logo_url', url)} />
        <div className="mt-3">
          <Label className="text-[10px] text-gray-500">Logo Size: {s.logo_width || 96}px</Label>
          <input type="range" min="40" max="300" value={s.logo_width || 96} onChange={e => set('logo_width', parseInt(e.target.value))} className="w-full mt-1" />
          <div className="flex justify-between text-[9px] text-gray-400"><span>Small (40px)</span><span>Large (300px)</span></div>
        </div>
      </div>

      {/* About Photo */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-1">Your Photo</p>
        <p className="text-[10px] text-gray-400 mb-3">Your image on the homepage About section AND the full /about page.</p>
        {s.about_image && (
          <div className="mb-3 flex gap-4 items-start">
            <img src={resolveImageUrl(s.about_image)} alt="About" className="w-28 h-36 rounded border" style={{ objectFit: s.about_image_fit || 'contain', objectPosition: s.about_image_position || 'center top' }} />
            <div className="space-y-2 flex-1">
              <div>
                <Label className="text-[10px] text-gray-500">Image Fit</Label>
                <select value={s.about_image_fit || 'contain'} onChange={e => set('about_image_fit', e.target.value)} className="w-full text-[10px] border rounded px-2 py-1">
                  <option value="contain">Contain (show full image)</option>
                  <option value="cover">Cover (fill area, may crop)</option>
                  <option value="fill">Fill (stretch to fit)</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px] text-gray-500">Image Position</Label>
                <select value={s.about_image_position || 'center top'} onChange={e => set('about_image_position', e.target.value)} className="w-full text-[10px] border rounded px-2 py-1">
                  <option value="center top">Top (show head/face)</option>
                  <option value="center">Center</option>
                  <option value="center bottom">Bottom</option>
                  <option value="top left">Top Left</option>
                  <option value="top right">Top Right</option>
                </select>
              </div>
            </div>
          </div>
        )}
        <ImageUploader value={s.about_image || ''} onChange={url => set('about_image', url)} />
      </div>

      {/* Text Content */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-1">Bio Content</p>
        <p className="text-[10px] text-gray-400 mb-3">Shown on homepage and /about page. Wrap words in **double stars** for <strong>bold</strong> and *single stars* for <em>italic</em>.</p>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] text-gray-500">Small Label Above Name</Label>
            <Input value={s.about_subtitle || ''} onChange={e => set('about_subtitle', e.target.value)} placeholder="Meet the Healer" className="text-xs" />
            <FontControls label="Label" style={s.about_subtitle_style || {}} onStyleChange={v => set('about_subtitle_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Your Name</Label>
            <Input value={s.about_name || ''} onChange={e => set('about_name', e.target.value)} placeholder="Dimple Ranawat" className="text-sm" />
            <FontControls label="Name" style={s.about_name_style || {}} onStyleChange={v => set('about_name_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Your Title (gold text)</Label>
            <Input value={s.about_title || ''} onChange={e => set('about_title', e.target.value)} placeholder="Founder, Divine Iris..." className="text-xs" />
            <FontControls label="Title" style={s.about_title_style || {}} onStyleChange={v => set('about_title_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Bio - Paragraph 1</Label>
            <Textarea value={s.about_bio || ''} onChange={e => set('about_bio', e.target.value)} rows={3} placeholder="Write your main bio here..." className="text-xs" />
            <FontControls label="Bio" style={s.about_bio_style || {}} onStyleChange={v => set('about_bio_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Bio - Paragraph 2 (Personal Journey)</Label>
            <Textarea value={s.about_bio_2 || ''} onChange={e => set('about_bio_2', e.target.value)} rows={3} placeholder="Write your personal journey here..." className="text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-gray-500">Button Text</Label>
              <Input value={s.about_button_text || ''} onChange={e => set('about_button_text', e.target.value)} placeholder="Read Full Bio" className="text-xs" />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Button Link</Label>
              <Input value={s.about_button_link || ''} onChange={e => set('about_button_link', e.target.value)} placeholder="/about" className="text-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* About Page - Philosophy & Impact */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-1">About Page - Cards</p>
        <p className="text-[10px] text-gray-400 mb-3">The "Our Philosophy" and "Work & Impact" cards on /about page.</p>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] text-gray-500">Our Philosophy - Title</Label>
            <FontControls label="Philosophy Title" style={s.about_philosophy_title_style || {}} onStyleChange={v => set('about_philosophy_title_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Our Philosophy - Body</Label>
            <Textarea data-testid="about-philosophy" value={s.about_philosophy || ''} onChange={e => set('about_philosophy', e.target.value)} rows={3} placeholder="Dimple believes in 'living limitless effortlessly'..." className="text-xs" />
            <FontControls label="Philosophy Body" style={s.about_philosophy_style || {}} onStyleChange={v => set('about_philosophy_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Work & Impact - Title</Label>
            <FontControls label="Impact Title" style={s.about_impact_title_style || {}} onStyleChange={v => set('about_impact_title_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Work & Impact - Body</Label>
            <Textarea data-testid="about-impact" value={s.about_impact || ''} onChange={e => set('about_impact', e.target.value)} rows={3} placeholder="As the creator of the Atomic Weight Release Program..." className="text-xs" />
            <FontControls label="Impact Body" style={s.about_impact_style || {}} onStyleChange={v => set('about_impact_style', v)} />
          </div>
        </div>
      </div>

      {/* About Page - Mission & Vision */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-1">About Page - Mission & Vision</p>
        <p className="text-[10px] text-gray-400 mb-3">The dark section on /about page.</p>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] text-gray-500">Section Title ("Mission & Vision")</Label>
            <FontControls label="Section Title" style={s.about_mv_section_title_style || {}} onStyleChange={v => set('about_mv_section_title_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Section Subtitle</Label>
            <Input data-testid="about-mv-subtitle" value={s.about_mission_vision_subtitle || ''} onChange={e => set('about_mission_vision_subtitle', e.target.value)} placeholder="Where healing meets awareness..." className="text-xs" />
            <FontControls label="Section Subtitle" style={s.about_mv_section_subtitle_style || {}} onStyleChange={v => set('about_mv_section_subtitle_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Our Mission - Title</Label>
            <FontControls label="Mission Title" style={s.about_mission_title_style || {}} onStyleChange={v => set('about_mission_title_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Our Mission - Body</Label>
            <Textarea data-testid="about-mission" value={s.about_mission || ''} onChange={e => set('about_mission', e.target.value)} rows={3} placeholder="To alleviate suffering at its root..." className="text-xs" />
            <FontControls label="Mission Body" style={s.about_mission_style || {}} onStyleChange={v => set('about_mission_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Our Vision - Title</Label>
            <FontControls label="Vision Title" style={s.about_vision_title_style || {}} onStyleChange={v => set('about_vision_title_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Our Vision - Body</Label>
            <Textarea data-testid="about-vision" value={s.about_vision || ''} onChange={e => set('about_vision', e.target.value)} rows={3} placeholder="To build a world where healing is humane..." className="text-xs" />
            <FontControls label="Vision Body" style={s.about_vision_style || {}} onStyleChange={v => set('about_vision_style', v)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutSettingsTab;
