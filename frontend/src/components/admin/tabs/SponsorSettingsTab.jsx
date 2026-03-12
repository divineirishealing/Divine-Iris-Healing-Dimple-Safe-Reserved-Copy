import React from 'react';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import ImageUploader from '../ImageUploader';
import { resolveImageUrl } from '../../../lib/imageUtils';

const ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

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
        <select value={style.text_align || ''} onChange={e => update('text_align', e.target.value)} className="text-[8px] border rounded px-1 py-0.5">
          <option value="">Align</option>
          {ALIGN_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>
    </details>
  );
};

const SponsorSettingsTab = ({ settings, onChange }) => {
  const home = settings.sponsor_home || {};
  const page = settings.sponsor_page || {};

  const setHome = (key, val) => onChange({ ...settings, sponsor_home: { ...home, [key]: val } });
  const setPage = (key, val) => onChange({ ...settings, sponsor_page: { ...page, [key]: val } });

  return (
    <div data-testid="sponsor-settings-tab">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Sponsor Section</h2>
      <p className="text-[10px] text-gray-400 mb-5">Control the "Shine a Light" section on homepage and the /sponsor payment page separately. Use **bold** and *italic* in text.</p>

      {/* ===== HOMEPAGE SECTION ===== */}
      <p className="text-[10px] font-semibold text-gray-500 mb-2 mt-2 uppercase tracking-wider">Homepage Section</p>

      <div className="bg-white rounded-lg p-5 shadow-sm border mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-3">Title & Subtitle</p>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] text-gray-500">Section Title</Label>
            <Input value={home.title || ''} onChange={e => setHome('title', e.target.value)} placeholder="Shine a Light in a Life" className="text-xs" />
            <FontControls label="Title" style={home.title_style || {}} onStyleChange={v => setHome('title_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Subtitle</Label>
            <Input value={home.subtitle || ''} onChange={e => setHome('subtitle', e.target.value)} placeholder="Healing flows when we support each other." className="text-xs" />
            <FontControls label="Subtitle" style={home.subtitle_style || {}} onStyleChange={v => setHome('subtitle_style', v)} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-3">Body Content</p>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] text-gray-500">Paragraph 1</Label>
            <Textarea value={home.body_1 || ''} onChange={e => setHome('body_1', e.target.value)} placeholder="Be the Sponsor allows anyone..." rows={2} className="text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Paragraph 2</Label>
            <Textarea value={home.body_2 || ''} onChange={e => setHome('body_2', e.target.value)} placeholder="It is not charity, it is *conscious support.*" rows={2} className="text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Paragraph 3</Label>
            <Textarea value={home.body_3 || ''} onChange={e => setHome('body_3', e.target.value)} placeholder="When one heals, the collective heals." rows={2} className="text-xs" />
          </div>
          <FontControls label="Body" style={home.body_style || {}} onStyleChange={v => setHome('body_style', v)} />
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-3">Quote & Button</p>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] text-gray-500">Quote</Label>
            <Input value={home.quote || ''} onChange={e => setHome('quote', e.target.value)} placeholder="Because healing should never wait for circumstances" className="text-xs" />
            <FontControls label="Quote" style={home.quote_style || {}} onStyleChange={v => setHome('quote_style', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-gray-500">Button Text</Label>
              <Input value={home.button_text || ''} onChange={e => setHome('button_text', e.target.value)} placeholder="Become a Sponsor" className="text-xs" />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Content Alignment</Label>
              <select value={home.align || 'left'} onChange={e => setHome('align', e.target.value)} className="w-full text-[10px] border rounded px-2 py-1.5">
                {ALIGN_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-3">Image</p>
        {home.image && (
          <div className="mb-3 flex items-center gap-3 bg-gray-50 p-3 rounded">
            <img src={resolveImageUrl(home.image)} alt="Sponsor" className="h-20 rounded object-cover" />
            <button onClick={() => setHome('image', '')} className="text-red-500 text-[10px] hover:underline">Remove</button>
          </div>
        )}
        <ImageUploader value={home.image || ''} onChange={url => setHome('image', url)} />
      </div>

      {/* ===== SPONSOR PAGE ===== */}
      <p className="text-[10px] font-semibold text-gray-500 mb-2 mt-6 uppercase tracking-wider">Sponsor Page (/sponsor)</p>

      <div className="bg-white rounded-lg p-5 shadow-sm border mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-3">"Why Sponsor?" Left Column</p>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] text-gray-500">Section Title</Label>
            <Input value={page.why_title || ''} onChange={e => setPage('why_title', e.target.value)} placeholder="Why Sponsor?" className="text-xs" />
            <FontControls label="Why Title" style={page.why_title_style || {}} onStyleChange={v => setPage('why_title_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Paragraph 1</Label>
            <Textarea value={page.why_body_1 || ''} onChange={e => setPage('why_body_1', e.target.value)} placeholder="Be the Sponsor allows anyone..." rows={2} className="text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Paragraph 2</Label>
            <Textarea value={page.why_body_2 || ''} onChange={e => setPage('why_body_2', e.target.value)} placeholder="It is not charity, it is *conscious support.*" rows={2} className="text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Paragraph 3</Label>
            <Textarea value={page.why_body_3 || ''} onChange={e => setPage('why_body_3', e.target.value)} placeholder="When one heals, the collective heals." rows={2} className="text-xs" />
          </div>
          <FontControls label="Why Body" style={page.why_body_style || {}} onStyleChange={v => setPage('why_body_style', v)} />
          <div>
            <Label className="text-[10px] text-gray-500">Quote</Label>
            <Input value={page.quote || ''} onChange={e => setPage('quote', e.target.value)} placeholder="Because healing should never wait for money." className="text-xs" />
            <FontControls label="Quote" style={page.quote_style || {}} onStyleChange={v => setPage('quote_style', v)} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-3">"Make a Contribution" Right Column</p>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] text-gray-500">Form Title</Label>
            <Input value={page.form_title || ''} onChange={e => setPage('form_title', e.target.value)} placeholder="MAKE A CONTRIBUTION" className="text-xs" />
            <FontControls label="Form Title" style={page.form_title_style || {}} onStyleChange={v => setPage('form_title_style', v)} />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Submit Button Text</Label>
            <Input value={page.submit_text || ''} onChange={e => setPage('submit_text', e.target.value)} placeholder="Proceed to Payment" className="text-xs" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SponsorSettingsTab;
