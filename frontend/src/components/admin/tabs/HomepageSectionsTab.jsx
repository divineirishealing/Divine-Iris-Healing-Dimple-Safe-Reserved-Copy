import React, { useState } from 'react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Trash2, Plus, GripVertical, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import ImageUploader from '../ImageUploader';
import AboutSettingsTab from './AboutSettingsTab';
import SponsorSettingsTab from './SponsorSettingsTab';
import NewsletterSettingsTab from './NewsletterSettingsTab';

const FONT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: "'Cinzel', serif", label: 'Cinzel' },
  { value: "'Playfair Display', serif", label: 'Playfair' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Titillium Web', sans-serif", label: 'Titillium Web' },
  { value: "'Cormorant Garamond', serif", label: 'Cormorant' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Raleway', sans-serif", label: 'Raleway' },
  { value: "'Great Vibes', cursive", label: 'Great Vibes' },
  { value: "'Dancing Script', cursive", label: 'Dancing Script' },
  { value: "'Pacifico', cursive", label: 'Pacifico' },
  { value: "'Sacramento', cursive", label: 'Sacramento' },
  { value: "'Alex Brush', cursive", label: 'Alex Brush' },
  { value: "'Kaushan Script', cursive", label: 'Kaushan Script' },
  { value: "'Satisfy', cursive", label: 'Satisfy' },
  { value: "'Allura', cursive", label: 'Allura' },
  { value: "'Caveat', cursive", label: 'Caveat' },
];
const SIZE_OPTIONS = ['12px','14px','16px','18px','20px','24px','28px','32px','36px','42px'];

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
        <button onClick={() => update('font_weight', style.font_weight === 'bold' ? '400' : 'bold')} className={`text-[9px] px-1 py-0.5 rounded border ${style.font_weight === 'bold' ? 'bg-gray-800 text-white' : 'bg-white'}`}><b>B</b></button>
        <button onClick={() => update('font_style', style.font_style === 'italic' ? 'normal' : 'italic')} className={`text-[9px] px-1 py-0.5 rounded border ${style.font_style === 'italic' ? 'bg-gray-800 text-white' : 'bg-white'}`}><i>I</i></button>
      </div>
    </div>
  );
};

const DEFAULT_SECTIONS = [
  { id: 'hero', title: 'Divine Iris Healing', subtitle: 'ETERNAL HAPPINESS', component: 'HeroSection', removable: false },
  { id: 'about', title: 'Meet the Healer', subtitle: 'Dimple Ranawat', component: 'AboutSection', removable: false },
  { id: 'text_testimonials', title: 'Testimonial Quotes', subtitle: '', component: 'TextTestimonialsStrip', removable: false },
  { id: 'upcoming', title: 'Upcoming Programs', subtitle: '', component: 'UpcomingProgramsSection', removable: false },
  { id: 'sponsor', title: 'Shine a Light in a Life', subtitle: 'Healing flows when we support each other.', component: 'SponsorSection', removable: false },
  { id: 'programs', title: 'Flagship Programs', subtitle: 'Our signature healing journeys', component: 'ProgramsSection', removable: false },
  { id: 'sessions', title: 'Upcoming Sessions', subtitle: '', component: 'SessionsSection', removable: false },
  { id: 'stats', title: '', subtitle: '', component: 'StatsSection', removable: true },
  { id: 'testimonials', title: 'Transformations', subtitle: '', component: 'TestimonialsSection', removable: false },
  { id: 'trust', title: "Why We're Loved", subtitle: 'Trusted by our community', component: 'TrustSection', removable: false },
  { id: 'newsletter', title: 'Join Our Community', subtitle: '', component: 'NewsletterSection', removable: false },
];
const DEFAULTS_BY_ID = Object.fromEntries(DEFAULT_SECTIONS.map(s => [s.id, s]));

const CONTENT_SECTIONS = new Set(['about', 'sponsor', 'newsletter']);

const HomepageSectionsTab = ({ settings, onChange }) => {
  const [expandedContent, setExpandedContent] = useState(null);
  const saved = settings.homepage_sections || DEFAULT_SECTIONS;
  const savedIds = new Set(saved.map(s => s.id));
  // Merge any new defaults that aren't in saved
  const merged = [...saved];
  DEFAULT_SECTIONS.forEach(def => {
    if (!savedIds.has(def.id)) {
      const defIdx = DEFAULT_SECTIONS.findIndex(d => d.id === def.id);
      const nextDef = DEFAULT_SECTIONS.slice(defIdx + 1).find(d => savedIds.has(d.id));
      const insertIdx = nextDef ? merged.findIndex(s => s.id === nextDef.id) : merged.length;
      merged.splice(insertIdx, 0, def);
    }
  });
  const sections = merged.map(s => {
    const def = DEFAULTS_BY_ID[s.id] || {};
    return { visible: true, title_style: {}, subtitle_style: {}, removable: s.component === 'custom', ...def, ...s, title: s.title != null ? s.title : (def.title || ''), subtitle: s.subtitle != null ? s.subtitle : (def.subtitle || '') };
  });

  const update = (newSections) => {
    onChange({ ...settings, homepage_sections: newSections });
  };

  const updateSection = (idx, field, value) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], [field]: value };
    update(updated);
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    const updated = [...sections];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    update(updated);
  };

  const moveDown = (idx) => {
    if (idx >= sections.length - 1) return;
    const updated = [...sections];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    update(updated);
  };

  const removeSection = (idx) => {
    update(sections.filter((_, i) => i !== idx));
  };

  const addSection = () => {
    const newId = `custom_${Date.now()}`;
    update([...sections, { id: newId, title: 'New Section', subtitle: '', component: 'custom', visible: true, removable: true, title_style: {}, subtitle_style: {}, image_url: '', body_text: '', body_style: {} }]);
  };

  const isCustom = (sec) => sec.component === 'custom';

  return (
    <div data-testid="homepage-sections-tab">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Homepage Sections</h2>
          <p className="text-[10px] text-gray-400">Edit titles, fonts, reorder, show/hide sections. Changes apply to homepage.</p>
        </div>
        <Button onClick={addSection} variant="outline" size="sm" className="text-[10px] gap-1" data-testid="add-custom-section-btn">
          <Plus size={12} /> Add Section
        </Button>
      </div>

      <div className="space-y-2">
        {sections.map((sec, idx) => {
          const isHero = sec.id === 'hero';
          return (
          <div key={sec.id} className="bg-white rounded-lg border p-3" data-testid={`section-row-${sec.id}`}>
            <div className="flex items-center gap-2 mb-2">
              <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
              <div className="flex gap-0.5 flex-shrink-0">
                <button onClick={() => moveUp(idx)} className="p-0.5 hover:bg-gray-100 rounded" disabled={idx === 0}><ChevronUp size={12} className={idx === 0 ? 'text-gray-200' : 'text-gray-500'} /></button>
                <button onClick={() => moveDown(idx)} className="p-0.5 hover:bg-gray-100 rounded" disabled={idx === sections.length - 1}><ChevronDown size={12} className={idx === sections.length - 1 ? 'text-gray-200' : 'text-gray-500'} /></button>
              </div>
              <span className="text-[9px] text-gray-400 bg-gray-50 rounded px-1.5 py-0.5 flex-shrink-0">{isCustom(sec) ? 'Custom' : sec.component || sec.id}</span>
              {isHero && <span className="text-[8px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">Edit in Hero Banner tab</span>}
              <div className="flex items-center gap-1 ml-auto">
                <Label className="text-[9px] text-gray-400">Show</Label>
                <Switch checked={sec.visible !== false} onCheckedChange={v => updateSection(idx, 'visible', v)} />
                {sec.removable && (
                  <button onClick={() => removeSection(idx)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" data-testid={`remove-section-${sec.id}`}><Trash2 size={12} /></button>
                )}
              </div>
            </div>

            {/* Title & Subtitle — skip for hero (managed in Hero Banner tab) */}
            {!isHero && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[9px] text-gray-400">Title</Label>
                <Input value={sec.title || ''} onChange={e => updateSection(idx, 'title', e.target.value)} className="text-[10px] h-7" placeholder="Section title" />
                <StyleCell style={sec.title_style || {}} onStyleChange={v => updateSection(idx, 'title_style', v)} />
              </div>
              <div>
                <Label className="text-[9px] text-gray-400">Subtitle</Label>
                <Input value={sec.subtitle || ''} onChange={e => updateSection(idx, 'subtitle', e.target.value)} className="text-[10px] h-7" placeholder="Subtitle (optional)" />
                <StyleCell style={sec.subtitle_style || {}} onStyleChange={v => updateSection(idx, 'subtitle_style', v)} />
              </div>
            </div>
            )}

            {/* Custom section extra controls: image, body, body style */}
            {isCustom(sec) && (
              <div className="mt-3 pt-3 border-t border-dashed border-gray-200 space-y-3" data-testid={`custom-controls-${sec.id}`}>
                <div>
                  <Label className="text-[9px] text-gray-400 mb-1 block">Section Image</Label>
                  <ImageUploader
                    value={sec.image_url || ''}
                    onChange={v => updateSection(idx, 'image_url', v)}
                    label=""
                  />
                </div>
                <div>
                  <Label className="text-[9px] text-gray-400 mb-1 block">Body Content</Label>
                  <textarea
                    value={sec.body_text || ''}
                    onChange={e => updateSection(idx, 'body_text', e.target.value)}
                    className="w-full text-xs border rounded-md p-2 min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-gray-300"
                    placeholder="Enter body text... Use **bold** and *italic* for formatting"
                    data-testid={`body-text-${sec.id}`}
                  />
                  <p className="text-[8px] text-gray-400 mt-0.5">Supports **bold** and *italic* markdown</p>
                  <StyleCell style={sec.body_style || {}} onStyleChange={v => updateSection(idx, 'body_style', v)} label="Body Font" />
                </div>
              </div>
            )}

            {/* Inline content editor for About, Sponsor, Newsletter */}
            {CONTENT_SECTIONS.has(sec.id) && (
              <div className="mt-2">
                <button
                  onClick={() => setExpandedContent(expandedContent === sec.id ? null : sec.id)}
                  className="flex items-center gap-1 text-[10px] text-[#D4AF37] hover:text-[#b8962e] font-medium"
                  data-testid={`edit-content-${sec.id}`}
                >
                  <ChevronRight size={12} className={`transition-transform ${expandedContent === sec.id ? 'rotate-90' : ''}`} />
                  {expandedContent === sec.id ? 'Hide' : 'Edit'} Section Content
                </button>
                {expandedContent === sec.id && (
                  <div className="mt-3 pt-3 border-t border-dashed border-gray-200" data-testid={`content-panel-${sec.id}`}>
                    {sec.id === 'about' && <AboutSettingsTab settings={settings} onChange={onChange} />}
                    {sec.id === 'sponsor' && <SponsorSettingsTab settings={settings} onChange={onChange} />}
                    {sec.id === 'newsletter' && <NewsletterSettingsTab settings={settings} onChange={onChange} />}
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default HomepageSectionsTab;
