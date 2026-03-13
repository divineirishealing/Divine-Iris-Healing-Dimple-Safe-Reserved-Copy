import React from 'react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Copy, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import ImageUploader from '../ImageUploader';
import { resolveImageUrl } from '../../../lib/imageUtils';

const FONT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: "'Cinzel', serif", label: 'Cinzel' },
  { value: "'Playfair Display', serif", label: 'Playfair' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Titillium Web', sans-serif", label: 'Titillium Web' },
];
const SIZE_OPTIONS = ['10px','12px','14px','16px','18px','20px','24px','28px','32px','36px','42px','48px'];

const StyleCell = ({ style = {}, onStyleChange, label }) => {
  const update = (prop, val) => onStyleChange({ ...style, [prop]: val });
  return (
    <div className="mt-1">
      {label && <span className="text-[8px] text-gray-400 uppercase tracking-wider">{label}</span>}
      <div className="flex gap-1 items-center flex-wrap">
        <input type="color" value={style.font_color || '#000000'} onChange={e => update('font_color', e.target.value)} className="w-5 h-5 rounded cursor-pointer border-0" />
        <select value={style.font_family || ''} onChange={e => update('font_family', e.target.value)} className="text-[9px] border rounded px-1 py-0.5 w-16">
          {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={style.font_size || ''} onChange={e => update('font_size', e.target.value)} className="text-[9px] border rounded px-1 py-0.5 w-12">
          <option value="">Size</option>
          {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" onClick={() => update('font_weight', style.font_weight === 'bold' ? '400' : 'bold')} className={`text-[9px] px-1 py-0.5 rounded border ${style.font_weight === 'bold' ? 'bg-gray-800 text-white' : 'bg-white'}`}><b>B</b></button>
        <button type="button" onClick={() => update('font_style', style.font_style === 'italic' ? 'normal' : 'italic')} className={`text-[9px] px-1 py-0.5 rounded border ${style.font_style === 'italic' ? 'bg-gray-800 text-white' : 'bg-white'}`}><i>I</i></button>
      </div>
    </div>
  );
};

const STATIC_PAGES = [
  { key: 'services', label: 'Services', defaultTitle: 'Our Services', defaultSubtitle: 'Claim your personal space', alwaysVisible: true },
  { key: 'contact', label: 'Contact', defaultTitle: 'Express Your Interest', defaultSubtitle: 'Ready to begin your healing journey?', alwaysVisible: true },
  { key: 'about', label: 'About', defaultTitle: 'Dimple Ranawat', defaultSubtitle: 'Founder, Divine Iris – Soulful Healing Studio', alwaysVisible: true },
  { key: 'programs', label: 'All Programs', defaultTitle: 'All Programs', defaultSubtitle: 'Explore our comprehensive healing programs', alwaysVisible: true },
  { key: 'sponsor', label: 'Shine a Light', defaultTitle: 'Shine a Light in a Life', defaultSubtitle: 'Healing flows when we support each other.', alwaysVisible: true },
  { key: 'transformations', label: 'Transformations', defaultTitle: 'TRANSFORMATIONS', defaultSubtitle: 'Stories of Healing, Growth & Awakening', alwaysVisible: true },
  { key: 'media', label: 'Media', defaultTitle: 'MEDIA', defaultSubtitle: '', toggleKey: 'media_page_visible' },
  { key: 'blog', label: 'Blog', defaultTitle: 'BLOG', defaultSubtitle: 'Insights, stories and updates', toggleKey: 'blog_page_visible' },
  { key: 'sessions', label: 'Personal Sessions', defaultTitle: 'Personal Healing Sessions', defaultSubtitle: 'Individual sessions tailored to your unique healing journey', toggleKey: 'sessions_page_visible' },
];

const TEMPLATE_STYLE_KEYS = [
  { key: 'title_style', label: 'Hero Title' },
  { key: 'subtitle_style', label: 'Hero Subtitle' },
  { key: 'section_title_style', label: 'Section Titles' },
  { key: 'section_subtitle_style', label: 'Section Subtitles' },
  { key: 'body_style', label: 'Body / Description Text' },
  { key: 'cta_style', label: 'CTA / Pricing Text' },
  { key: 'testimonial_title_style', label: 'Testimonials Title' },
];

const DARK_SECTION_STYLE_KEYS = [
  { key: 'exp_title_style', label: 'Title (Dark BG)' },
  { key: 'exp_subtitle_style', label: 'Subtitle (Dark BG)' },
  { key: 'exp_body_style', label: 'Body (Dark BG)' },
];

const SECTION_TYPE_OPTIONS = [
  { value: 'journey', label: 'The Journey', defaultTitle: 'The Journey' },
  { value: 'who_for', label: 'Who It Is For?', defaultTitle: 'Who It Is For?' },
  { value: 'experience', label: 'Your Experience (Dark BG)', defaultTitle: 'Your Experience' },
  { value: 'why_now', label: 'Why You Need This Now?', defaultTitle: 'Why You Need This Now?' },
  { value: 'custom', label: 'Custom Section', defaultTitle: '' },
];

const PageHeadersTab = ({ settings, programs = [], onChange }) => {
  const heroes = settings.page_heroes || {};
  const getHero = (key) => heroes[key] || {};

  const updateHero = (key, field, value) => {
    const updated = { ...heroes, [key]: { ...getHero(key), [field]: value } };
    onChange({ ...settings, page_heroes: updated });
  };

  const applyToAll = () => {
    const src = getHero('home');
    const updated = { ...heroes };
    STATIC_PAGES.forEach(p => {
      updated[p.key] = { ...getHero(p.key), title_style: { ...(src.title_style || {}) }, subtitle_style: { ...(src.subtitle_style || {}) } };
    });
    onChange({ ...settings, page_heroes: updated });
  };

  const PageRow = ({ pageKey, label, defaultTitle, defaultSubtitle, toggleKey }) => {
    const hero = getHero(pageKey);
    return (
      <div className="bg-white rounded-lg border p-3 mb-2" data-testid={`hero-row-${pageKey}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold text-gray-700 w-24 flex-shrink-0">{label}</span>
          {toggleKey && (
            <div className="flex items-center gap-1 ml-auto">
              <Label className="text-[9px] text-gray-400">Visible</Label>
              <Switch checked={settings[toggleKey] || false} onCheckedChange={v => onChange({ ...settings, [toggleKey]: v })} />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[9px] text-gray-400">Hero Title</Label>
            <Input value={hero.title_text ?? defaultTitle} onChange={e => updateHero(pageKey, 'title_text', e.target.value)} className="text-[10px] h-7 mb-1" />
            <StyleCell style={hero.title_style || {}} onStyleChange={v => updateHero(pageKey, 'title_style', v)} />
          </div>
          <div>
            <Label className="text-[9px] text-gray-400">Hero Subtitle</Label>
            <Input value={hero.subtitle_text ?? defaultSubtitle} onChange={e => updateHero(pageKey, 'subtitle_text', e.target.value)} className="text-[10px] h-7 mb-1" />
            <StyleCell style={hero.subtitle_style || {}} onStyleChange={v => updateHero(pageKey, 'subtitle_style', v)} />
          </div>
        </div>
      </div>
    );
  };

  // Program Template (font styles)
  const template = getHero('program_template');
  const updateTemplate = (field, value) => updateHero('program_template', field, value);

  // Section Template (structure)
  const sectionTemplate = settings.program_section_template || [];
  const updateSectionTemplate = (newTemplate) => {
    onChange({ ...settings, program_section_template: newTemplate });
  };

  const addSection = () => {
    const newSec = { id: Date.now().toString(), section_type: 'custom', default_title: '', default_subtitle: '', order: sectionTemplate.length, is_enabled: true };
    updateSectionTemplate([...sectionTemplate, newSec]);
  };

  const updateSection = (idx, field, val) => {
    const updated = [...sectionTemplate];
    updated[idx] = { ...updated[idx], [field]: val };
    updateSectionTemplate(updated);
  };

  const removeSection = (idx) => {
    const updated = sectionTemplate.filter((_, i) => i !== idx);
    updated.forEach((s, i) => s.order = i);
    updateSectionTemplate(updated);
  };

  const moveSection = (idx, dir) => {
    const sw = idx + dir;
    if (sw < 0 || sw >= sectionTemplate.length) return;
    const updated = [...sectionTemplate];
    [updated[idx], updated[sw]] = [updated[sw], updated[idx]];
    updated.forEach((s, i) => s.order = i);
    updateSectionTemplate(updated);
  };

  return (
    <div data-testid="page-headers-tab">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Page Headers</h2>
          <p className="text-[10px] text-gray-400">Edit hero title & subtitle for every page. Use "Apply Homepage Style to All" for uniform look.</p>
        </div>
        <Button onClick={applyToAll} variant="outline" size="sm" className="text-[10px] gap-1">
          <Copy size={12} /> Apply Homepage Style to All
        </Button>
      </div>

      <p className="text-[10px] font-semibold text-gray-500 mb-2 mt-4">STATIC PAGES</p>
      {STATIC_PAGES.map(p => (
        <PageRow key={p.key} pageKey={p.key} label={p.label} defaultTitle={p.defaultTitle} defaultSubtitle={p.defaultSubtitle} toggleKey={p.toggleKey} />
      ))}

      {/* ===== FLAGSHIP PROGRAM TEMPLATE — FONT STYLES ===== */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <p className="text-[10px] font-semibold text-gray-500">FLAGSHIP PROGRAM PAGES — SHARED STYLES</p>
        <span className="text-[8px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">Applies to all program pages</span>
      </div>
      <div className="bg-gradient-to-br from-purple-50/50 to-white rounded-xl border border-purple-100 p-4" data-testid="program-template-section">
        <p className="text-[9px] text-gray-500 mb-3">Font & color changes here apply to <strong>every</strong> program detail page. Set once, used everywhere.</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TEMPLATE_STYLE_KEYS.map(({ key, label }) => (
            <div key={key} className="bg-white rounded-lg border border-gray-100 p-2.5">
              <Label className="text-[9px] text-gray-500 font-semibold block mb-1">{label}</Label>
              <StyleCell style={template[key] || {}} onStyleChange={v => updateTemplate(key, v)} />
            </div>
          ))}
        </div>

        {/* Dark BG Section (Your Experience) styles */}
        <div className="mt-3 mb-3">
          <p className="text-[9px] font-semibold text-gray-500 mb-2">YOUR EXPERIENCE — DARK BACKGROUND SECTION</p>
          <div className="grid grid-cols-3 gap-3">
            {DARK_SECTION_STYLE_KEYS.map(({ key, label }) => (
              <div key={key} className="bg-gray-800 rounded-lg border border-gray-600 p-2.5">
                <Label className="text-[9px] text-yellow-400 font-semibold block mb-1">{label}</Label>
                <StyleCell style={template[key] || {}} onStyleChange={v => updateTemplate(key, v)} />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Label className="text-[9px] text-gray-500 font-semibold block mb-1">Photo (shown on all program pages in the dark section)</Label>
            <div className="flex items-start gap-3">
              <div className="flex-1 max-w-xs">
                <ImageUploader value={template.experience_image || ''} onChange={url => updateTemplate('experience_image', url)} />
              </div>
              {template.experience_image && (
                <div className="flex-shrink-0">
                  <img src={resolveImageUrl(template.experience_image)} alt="Experience" className="w-20 h-20 rounded border border-gray-600 object-cover" />
                  <button type="button" onClick={() => updateTemplate('experience_image', '')} className="text-[9px] text-red-400 mt-1 hover:underline">Remove</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-[9px] text-gray-500">Hero Background</Label>
            <input type="color" value={template.hero_bg || '#1a1a1a'} onChange={e => updateTemplate('hero_bg', e.target.value)} className="w-6 h-6 rounded cursor-pointer border" />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[9px] text-gray-500">Gold Line Color</Label>
            <input type="color" value={template.accent_color || '#D4AF37'} onChange={e => updateTemplate('accent_color', e.target.value)} className="w-6 h-6 rounded cursor-pointer border" />
          </div>
        </div>

        {/* Gold Line Controls */}
        <div className="mt-4" data-testid="gold-line-controls">
          <p className="text-[9px] font-semibold text-gray-500 mb-2">GOLD LINE SEPARATORS</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'hero_line', label: 'Hero (under subtitle)' },
              { key: 'section_line', label: 'Section Titles' },
              { key: 'exp_line', label: 'Experience (Dark BG)' },
              { key: 'cta_line', label: 'CTA Section' },
            ].map(({ key, label }) => {
              const lineKey = `${key}_visible`;
              const gapKey = `${key}_gap`;
              return (
                <div key={key} className="bg-white rounded-lg border border-gray-100 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-[9px] text-gray-500">{label}</Label>
                    <Switch checked={template[lineKey] !== false} onCheckedChange={v => updateTemplate(lineKey, v)} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[8px] text-gray-400 whitespace-nowrap">Gap</Label>
                    <select value={template[gapKey] || '10'} onChange={e => updateTemplate(gapKey, e.target.value)} className="text-[9px] border rounded px-1 py-0.5 flex-1">
                      {['2','4','6','8','10','12','16','20','24'].map(v => <option key={v} value={v}>{v}px</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== PROGRAM PAGE SECTIONS — STRUCTURE ===== */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <p className="text-[10px] font-semibold text-gray-500">PROGRAM PAGE SECTIONS — STRUCTURE</p>
        <span className="text-[8px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">Shared across all programs</span>
      </div>
      <div className="bg-gradient-to-br from-blue-50/50 to-white rounded-xl border border-blue-100 p-4" data-testid="section-template-editor">
        <p className="text-[9px] text-gray-500 mb-3">Define which sections appear on every program page and in what order. Add or remove sections here — it applies to <strong>all</strong> programs. Per-program text is edited in the Programs tab.</p>

        <div className="space-y-2">
          {sectionTemplate.map((sec, idx) => {
            const typeInfo = SECTION_TYPE_OPTIONS.find(o => o.value === sec.section_type) || { label: 'Custom' };
            const isDark = sec.section_type === 'experience';
            return (
              <div key={sec.id} data-testid={`template-section-${idx}`} className={`flex items-center gap-2 rounded-lg border p-2.5 ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
                <div className="flex flex-col gap-0.5">
                  <button type="button" disabled={idx === 0} onClick={() => moveSection(idx, -1)} className="p-0.5 hover:bg-black/10 rounded disabled:opacity-20"><ArrowUp size={10} className={isDark ? 'text-white' : ''} /></button>
                  <button type="button" disabled={idx === sectionTemplate.length - 1} onClick={() => moveSection(idx, 1)} className="p-0.5 hover:bg-black/10 rounded disabled:opacity-20"><ArrowDown size={10} className={isDark ? 'text-white' : ''} /></button>
                </div>
                <span className={`text-[10px] font-bold w-5 ${isDark ? 'text-yellow-400' : 'text-gray-400'}`}>#{idx + 1}</span>
                <select value={sec.section_type} onChange={e => {
                  const newType = e.target.value;
                  const typeOpt = SECTION_TYPE_OPTIONS.find(o => o.value === newType);
                  updateSection(idx, 'section_type', newType);
                  if (!sec.default_title && typeOpt?.defaultTitle) updateSection(idx, 'default_title', typeOpt.defaultTitle);
                }} className={`text-[10px] border rounded px-2 py-1 w-40 ${isDark ? 'bg-gray-700 text-white border-gray-500' : ''}`}>
                  {SECTION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <Input value={sec.default_title || ''} onChange={e => updateSection(idx, 'default_title', e.target.value)} placeholder="Default title..." className={`text-[10px] h-7 flex-1 ${isDark ? 'bg-gray-700 text-white border-gray-500' : ''}`} />
                <Switch checked={sec.is_enabled !== false} onCheckedChange={v => updateSection(idx, 'is_enabled', v)} />
                <button type="button" onClick={() => removeSection(idx)} className={`p-1 rounded hover:bg-black/10 ${isDark ? 'text-red-400' : 'text-red-400'}`}><Trash2 size={12} /></button>
              </div>
            );
          })}
        </div>

        <Button type="button" variant="outline" size="sm" className="mt-3 text-[10px] gap-1" onClick={addSection} data-testid="add-template-section-btn">
          <Plus size={12} /> Add Section
        </Button>
      </div>

      {/* ===== PERSONAL SESSIONS — COMPLETE STYLE CONTROL ===== */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <p className="text-[10px] font-semibold text-gray-500">PERSONAL SESSIONS — STYLE CONTROL</p>
        <span className="text-[8px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">Applies to all session pages</span>
      </div>
      <div className="bg-gradient-to-br from-indigo-50/50 to-white rounded-xl border border-indigo-100 p-4" data-testid="session-template-section">
        {(() => {
          const sessionTpl = heroes['session_template'] || {};
          const updateSessionTpl = (field, value) => updateHero('session_template', field, value);

          return (
            <div className="space-y-5">
              {/* ── HERO SECTION ── */}
              <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl p-4 text-white relative overflow-hidden">
                <div className="absolute top-2 right-3 text-[8px] bg-white/20 px-2 py-0.5 rounded-full">Preview: Top banner of every session page</div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-200 mb-3">Hero Section</p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-white/10 rounded-lg p-2.5 backdrop-blur-sm">
                    <Label className="text-[9px] text-purple-200 font-semibold block mb-1">Hero Title Font</Label>
                    <StyleCell style={sessionTpl.hero_title_style || sessionTpl.title_style || {}} onStyleChange={v => updateSessionTpl('hero_title_style', v)} />
                  </div>
                  <div className="bg-white/10 rounded-lg p-2.5 backdrop-blur-sm">
                    <Label className="text-[9px] text-purple-200 font-semibold block mb-1">Price Text</Label>
                    <StyleCell style={sessionTpl.hero_price_style || {}} onStyleChange={v => updateSessionTpl('hero_price_style', v)} />
                  </div>
                  <div className="bg-white/10 rounded-lg p-2.5 backdrop-blur-sm">
                    <Label className="text-[9px] text-purple-200 font-semibold block mb-1">Badge Style</Label>
                    <div className="flex gap-1 items-center flex-wrap">
                      <Label className="text-[8px] text-purple-300">BG</Label>
                      <input type="color" value={sessionTpl.badge_bg || '#ffffff'} onChange={e => updateSessionTpl('badge_bg', e.target.value)} className="w-5 h-5 rounded cursor-pointer border-0" />
                      <Label className="text-[8px] text-purple-300">Text</Label>
                      <input type="color" value={sessionTpl.badge_text || '#ffffff'} onChange={e => updateSessionTpl('badge_text', e.target.value)} className="w-5 h-5 rounded cursor-pointer border-0" />
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white/10 rounded-lg p-2.5 backdrop-blur-sm">
                    <Label className="text-[9px] text-purple-200 font-semibold block mb-1">Hero BG Color</Label>
                    <input type="color" value={sessionTpl.hero_bg || '#2a1252'} onChange={e => updateSessionTpl('hero_bg', e.target.value)} className="w-8 h-6 rounded cursor-pointer border border-white/20" />
                  </div>
                  <div className="bg-white/10 rounded-lg p-2.5 backdrop-blur-sm">
                    <Label className="text-[9px] text-purple-200 font-semibold block mb-1">Purple Intensity</Label>
                    <select value={sessionTpl.page_purple || 'medium'} onChange={e => updateSessionTpl('page_purple', e.target.value)} className="text-[10px] border rounded px-2 py-1 w-full text-gray-800">
                      <option value="light">Light</option>
                      <option value="medium">Medium</option>
                      <option value="strong">Strong</option>
                    </select>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2.5 backdrop-blur-sm">
                    <Label className="text-[9px] text-purple-200 font-semibold block mb-1">Accent / Line Color</Label>
                    <input type="color" value={sessionTpl.accent_color || '#D4AF37'} onChange={e => updateSessionTpl('accent_color', e.target.value)} className="w-8 h-6 rounded cursor-pointer border border-white/20" />
                  </div>
                  <div className="bg-white/10 rounded-lg p-2.5 backdrop-blur-sm">
                    <Label className="text-[9px] text-purple-200 font-semibold block mb-1">Star Color</Label>
                    <input type="color" value={sessionTpl.star_color || '#D4AF37'} onChange={e => updateSessionTpl('star_color', e.target.value)} className="w-8 h-6 rounded cursor-pointer border border-white/20" />
                  </div>
                </div>
              </div>

              {/* ── BODY CONTENT ── */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 relative">
                <div className="absolute top-2 right-3 text-[8px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Preview: Content below hero on session page</div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Body Content</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg border border-gray-100 p-2.5">
                    <Label className="text-[9px] text-gray-500 font-semibold block mb-1">Section Title ("About...")</Label>
                    <StyleCell style={sessionTpl.title_style || {}} onStyleChange={v => updateSessionTpl('title_style', v)} />
                  </div>
                  <div className="bg-gray-50 rounded-lg border border-gray-100 p-2.5">
                    <Label className="text-[9px] text-gray-500 font-semibold block mb-1">Description Text</Label>
                    <StyleCell style={sessionTpl.description_style || {}} onStyleChange={v => updateSessionTpl('description_style', v)} />
                  </div>
                  <div className="bg-gray-50 rounded-lg border border-gray-100 p-2.5">
                    <Label className="text-[9px] text-gray-500 font-semibold block mb-1">Testimonial Text</Label>
                    <StyleCell style={sessionTpl.testimonial_style || {}} onStyleChange={v => updateSessionTpl('testimonial_style', v)} />
                  </div>
                </div>
              </div>

              {/* ── BUTTONS & CALENDAR ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 relative">
                  <div className="absolute top-2 right-3 text-[8px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Preview: "Book Now" & "View Details" buttons</div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Buttons</p>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-[9px] text-gray-500">Primary Button Color</Label>
                      <div className="flex gap-2 items-center mt-1">
                        <input type="color" value={sessionTpl.button_bg || '#D4AF37'} onChange={e => updateSessionTpl('button_bg', e.target.value)} className="w-8 h-6 rounded cursor-pointer border" />
                        <span className="text-[9px] text-gray-400">{sessionTpl.button_bg || '#D4AF37'}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[9px] text-gray-500">Button Text Color</Label>
                      <div className="flex gap-2 items-center mt-1">
                        <input type="color" value={sessionTpl.button_text || '#1a1a1a'} onChange={e => updateSessionTpl('button_text', e.target.value)} className="w-8 h-6 rounded cursor-pointer border" />
                        <span className="text-[9px] text-gray-400">{sessionTpl.button_text || '#1a1a1a'}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[9px] text-gray-500">Quick Presets</Label>
                      <div className="flex gap-1.5 mt-1">
                        {[
                          { label: 'Gold', bg: '#D4AF37', text: '#1a1a1a' },
                          { label: 'Coal Black', bg: '#1a1a1a', text: '#D4AF37' },
                          { label: 'Purple', bg: '#7c3aed', text: '#ffffff' },
                          { label: 'Deep Iris', bg: '#4c1d95', text: '#D4AF37' },
                        ].map(preset => (
                          <button key={preset.label} type="button"
                            onClick={() => { updateSessionTpl('button_bg', preset.bg); updateSessionTpl('button_text', preset.text); }}
                            className="text-[8px] px-2 py-1 rounded-full border border-gray-200 hover:border-gray-400 transition-colors"
                            style={{ background: preset.bg, color: preset.text }}>
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 relative">
                  <div className="absolute top-2 right-3 text-[8px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Preview: Booking calendar on session pages</div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Calendar & Booking</p>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-[9px] text-gray-500">Calendar Accent Color</Label>
                      <div className="flex gap-2 items-center mt-1">
                        <input type="color" value={sessionTpl.calendar_accent || '#D4AF37'} onChange={e => updateSessionTpl('calendar_accent', e.target.value)} className="w-8 h-6 rounded cursor-pointer border" />
                        <span className="text-[9px] text-gray-400">Selected date & highlights</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[9px] text-gray-500">Calendar BG Color</Label>
                      <div className="flex gap-2 items-center mt-1">
                        <input type="color" value={sessionTpl.calendar_bg || '#2a1252'} onChange={e => updateSessionTpl('calendar_bg', e.target.value)} className="w-8 h-6 rounded cursor-pointer border" />
                        <span className="text-[9px] text-gray-400">Booking sidebar background</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[9px] text-gray-500">Homepage Purple Intensity</Label>
                      <select value={sessionTpl.homepage_purple || 'medium'} onChange={e => updateSessionTpl('homepage_purple', e.target.value)} className="text-[10px] border rounded px-2 py-1 w-full mt-1">
                        <option value="light">Light — Subtle lavender</option>
                        <option value="medium">Medium — Balanced iris</option>
                        <option value="strong">Strong — Deep violet</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── HOMEPAGE LIST ── */}
              <div className="bg-purple-50/50 rounded-xl border border-purple-100 p-4 relative">
                <div className="absolute top-2 right-3 text-[8px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Preview: Session names list on homepage</div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Homepage Session List</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                    <Label className="text-[9px] text-gray-500 font-semibold block mb-1">Session Name Font</Label>
                    <StyleCell style={sessionTpl.title_style || {}} onStyleChange={v => updateSessionTpl('title_style', v)} />
                  </div>
                  <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                    <Label className="text-[9px] text-gray-500 font-semibold block mb-1">Price Style</Label>
                    <StyleCell style={sessionTpl.price_style || {}} onStyleChange={v => updateSessionTpl('price_style', v)} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default PageHeadersTab;
