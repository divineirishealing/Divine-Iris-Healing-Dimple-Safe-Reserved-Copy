import React from 'react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

const FONT_OPTIONS = [
  'Playfair Display', 'Lato', 'Cinzel', 'Caveat', 'Montserrat',
  'Poppins', 'Raleway', 'Cormorant Garamond', 'Italiana', 'Josefin Sans',
  'Great Vibes', 'Dancing Script', 'Merriweather', 'Libre Baskerville',
  'Roboto Slab', 'Open Sans', 'Source Sans Pro', 'Nunito', 'Titillium Web',
  'Pacifico', 'Sacramento', 'Alex Brush', 'Kaushan Script', 'Satisfy', 'Allura',
];

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
  { value: 'extra-large', label: 'Extra Large' },
];

const GlobalStylesTab = ({ settings, onChange }) => {
  const s = settings;
  const set = (key, val) => onChange({ ...s, [key]: val });

  const updateSection = (section, key, val) => {
    const sections = { ...(s.sections || {}) };
    sections[section] = { ...(sections[section] || {}), [key]: val };
    onChange({ ...s, sections });
  };

  return (
    <div data-testid="global-styles-tab">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Global Styles</h2>
      <p className="text-xs text-gray-400 mb-6">Default fonts and colors for your entire website. Sections can override these.</p>

      {/* Global Fonts */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Fonts</p>
        <p className="text-xs text-gray-400 mb-4">Choose the default fonts for all headings and body text.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-500">Heading Font (titles, section names)</Label>
            <select value={s.heading_font} onChange={e => set('heading_font', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" style={{fontFamily: s.heading_font}}>
              {FONT_OPTIONS.map(f => <option key={f} value={f} style={{fontFamily:f}}>{f}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1" style={{fontFamily:s.heading_font}}>Preview: The quick brown fox</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Body Font (paragraphs, descriptions)</Label>
            <select value={s.body_font} onChange={e => set('body_font', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" style={{fontFamily: s.body_font}}>
              {FONT_OPTIONS.map(f => <option key={f} value={f} style={{fontFamily:f}}>{f}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1" style={{fontFamily:s.body_font}}>Preview: The quick brown fox jumps over</p>
          </div>
        </div>
      </div>

      {/* Global Colors */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Colors</p>
        <p className="text-xs text-gray-400 mb-4">Set the main colors used across your website.</p>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-gray-500">Heading Color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={s.heading_color} onChange={e => set('heading_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
              <Input value={s.heading_color} onChange={e => set('heading_color', e.target.value)} className="flex-1 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Body Text Color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={s.body_color} onChange={e => set('body_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
              <Input value={s.body_color} onChange={e => set('body_color', e.target.value)} className="flex-1 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Accent Color (buttons, highlights)</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={s.accent_color} onChange={e => set('accent_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
              <Input value={s.accent_color} onChange={e => set('accent_color', e.target.value)} className="flex-1 text-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Font (Global) */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Pricing Display</p>
        <p className="text-xs text-gray-400 mb-4">Font and color for prices shown across all programs.</p>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-gray-500">Pricing Font</Label>
            <select value={s.pricing_font || s.heading_font || 'Cinzel'} onChange={e => set('pricing_font', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" style={{fontFamily: s.pricing_font || s.heading_font}}>
              {FONT_OPTIONS.map(f => <option key={f} value={f} style={{fontFamily:f}}>{f}</option>)}
            </select>
            <p className="text-lg text-gray-700 mt-2" style={{fontFamily: s.pricing_font || s.heading_font, color: s.pricing_color || s.accent_color || '#D4AF37', fontWeight: s.pricing_weight || 700}}>AED 4,500</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Pricing Color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={s.pricing_color || s.accent_color || '#D4AF37'} onChange={e => set('pricing_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
              <Input value={s.pricing_color || s.accent_color || '#D4AF37'} onChange={e => set('pricing_color', e.target.value)} className="flex-1 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Pricing Weight</Label>
            <select value={s.pricing_weight || '700'} onChange={e => set('pricing_weight', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              <option value="400">Regular (400)</option>
              <option value="500">Medium (500)</option>
              <option value="600">Semi-Bold (600)</option>
              <option value="700">Bold (700)</option>
              <option value="800">Extra Bold (800)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Global Sizes */}
      <div className="bg-white rounded-lg p-5 shadow-sm border mb-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Text Sizes</p>
        <p className="text-xs text-gray-400 mb-4">Control how big or small text appears by default.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-500">Heading Size</Label>
            <select value={s.heading_size} onChange={e => set('heading_size', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Body Text Size</Label>
            <select value={s.body_size} onChange={e => set('body_size', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Per-Section Overrides */}
      <div className="bg-white rounded-lg p-5 shadow-sm border">
        <p className="text-sm font-semibold text-gray-800 mb-1">Section-Level Overrides</p>
        <p className="text-xs text-gray-400 mb-4">Want a specific section to look different? Set overrides here. Leave blank to use global defaults.</p>
        {['hero','about','programs','sessions','stats','testimonials','sponsor','newsletter','footer'].map(section => {
          const d = s.sections?.[section] || {};
          return (
            <details key={section} className="mb-2 border rounded-lg">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 capitalize">{section} Section</summary>
              <div className="px-4 pb-4 pt-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px]">Font</Label>
                  <select value={d.font_family||''} onChange={e => updateSection(section,'font_family',e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                    <option value="">Use global default</option>
                    {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">Size</Label>
                  <select value={d.font_size||''} onChange={e => updateSection(section,'font_size',e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                    <option value="">Default</option>
                    {['12px','14px','16px','18px','20px','24px','28px','32px','40px','48px'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">Color</Label>
                  <div className="flex gap-1 items-center">
                    <input type="color" value={d.font_color||'#000000'} onChange={e => updateSection(section,'font_color',e.target.value)} className="w-7 h-7 rounded cursor-pointer border" />
                    <input value={d.font_color||''} onChange={e => updateSection(section,'font_color',e.target.value)} placeholder="#hex" className="flex-1 border rounded px-2 py-1.5 text-xs w-16" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px]">Weight</Label>
                  <select value={d.font_weight||''} onChange={e => updateSection(section,'font_weight',e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                    <option value="">Default</option><option value="300">Light</option><option value="400">Regular</option>
                    <option value="600">Semi-Bold</option><option value="700">Bold</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">Style</Label>
                  <select value={d.font_style||''} onChange={e => updateSection(section,'font_style',e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                    <option value="">Normal</option><option value="italic">Italic</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">Background Color</Label>
                  <div className="flex gap-1 items-center">
                    <input type="color" value={d.bg_color||'#ffffff'} onChange={e => updateSection(section,'bg_color',e.target.value)} className="w-7 h-7 rounded cursor-pointer border" />
                    <input value={d.bg_color||''} onChange={e => updateSection(section,'bg_color',e.target.value)} placeholder="#hex" className="flex-1 border rounded px-2 py-1.5 text-xs w-16" />
                  </div>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
};

export default GlobalStylesTab;
