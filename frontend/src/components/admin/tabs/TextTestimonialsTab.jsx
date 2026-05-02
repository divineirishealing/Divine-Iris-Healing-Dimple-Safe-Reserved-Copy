import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save, Eye, EyeOff, GripVertical, Quote, Palette } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FONT_OPTIONS = [
  { group: 'Elegant / Serif', fonts: ['Cormorant Garamond', 'Playfair Display', 'Cinzel', 'Merriweather', 'Libre Baskerville', 'Italiana'] },
  { group: 'Modern / Sans', fonts: ['Titillium Web', 'Montserrat', 'Lato', 'Poppins', 'Raleway', 'Josefin Sans', 'Open Sans', 'Nunito'] },
  { group: 'Handwriting / Script', fonts: ['Great Vibes', 'Dancing Script', 'Pacifico', 'Sacramento', 'Alex Brush', 'Kaushan Script', 'Satisfy', 'Allura', 'Caveat'] },
];

const SIZE_OPTIONS = [
  { value: '14px', label: 'XS' }, { value: '16px', label: 'S' }, { value: '20px', label: 'M' },
  { value: '24px', label: 'L' }, { value: '28px', label: 'XL' }, { value: '34px', label: '2XL' },
  { value: '42px', label: '3XL' },
];

const AUTHOR_SIZE_OPTIONS = [
  { value: '10px', label: 'XS' }, { value: '11px', label: 'S' }, { value: '13px', label: 'M' },
  { value: '15px', label: 'L' }, { value: '18px', label: 'XL' },
];

const TextTestimonialsTab = () => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [style, setStyle] = useState({
    quote_font: 'Cormorant Garamond',
    quote_size: '20px',
    quote_color: '#374151',
    quote_italic: true,
    author_font: 'Lato',
    author_size: '11px',
    author_color: '#111827',
  });

  const fetchAll = useCallback(async () => {
    const [quotesRes, settingsRes] = await Promise.all([
      axios.get(`${API}/text-testimonials/`),
      axios.get(`${API}/settings`),
    ]);
    setItems(quotesRes.data || []);
    if (settingsRes.data?.text_testimonials_style) {
      setStyle(prev => ({ ...prev, ...settingsRes.data.text_testimonials_style }));
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const setStyleField = (key, val) => setStyle(prev => ({ ...prev, [key]: val }));

  const add = async () => {
    const r = await axios.post(`${API}/text-testimonials/`, {
      quote: '', author: '', role: '', visible: true, order: items.length,
    });
    setItems(prev => [...prev, r.data]);
  };

  const update = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const remove = async (idx) => {
    const item = items[idx];
    if (item.id) await axios.delete(`${API}/text-testimonials/${item.id}`);
    setItems(prev => prev.filter((_, i) => i !== idx));
    toast({ title: 'Deleted' });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        ...items.map((item, i) =>
          axios.put(`${API}/text-testimonials/${item.id}`, { ...item, order: i })
        ),
        axios.put(`${API}/settings`, { text_testimonials_style: style }),
      ]);
      toast({ title: 'Saved!' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div data-testid="text-testimonials-tab">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Text Testimonials</h2>
          <p className="text-xs text-gray-400 mt-0.5">Rotating quotes displayed above Upcoming Programs on the homepage</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={add} data-testid="add-text-testimonial">
            <Plus size={14} className="mr-1" /> Add Quote
          </Button>
          <Button size="sm" onClick={saveAll} disabled={saving} className="bg-[#D4AF37] hover:bg-[#b8962e]" data-testid="save-text-testimonials">
            <Save size={14} className="mr-1" /> {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>
      </div>

      {/* ── Font & Style Controls ── */}
      <div className="border rounded-lg p-4 mb-5 bg-white shadow-sm" data-testid="quote-style-controls">
        <div className="flex items-center gap-2 mb-3">
          <Palette size={14} className="text-[#D4AF37]" />
          <p className="text-xs font-semibold text-gray-700">Quote Appearance</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Quote Font */}
          <div>
            <label className="text-[9px] text-gray-500 block mb-1">Quote Font</label>
            <select value={style.quote_font} onChange={e => setStyleField('quote_font', e.target.value)}
              className="w-full border rounded-md px-2 py-1.5 text-xs" style={{ fontFamily: style.quote_font }}
              data-testid="quote-font-select">
              {FONT_OPTIONS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.fonts.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          {/* Quote Size */}
          <div>
            <label className="text-[9px] text-gray-500 block mb-1">Quote Size</label>
            <div className="flex flex-wrap gap-1">
              {SIZE_OPTIONS.map(sz => (
                <button key={sz.value} onClick={() => setStyleField('quote_size', sz.value)}
                  className={`px-1.5 py-1 text-[9px] rounded border transition-all ${style.quote_size === sz.value ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-400 border-gray-200'}`}>
                  {sz.label}
                </button>
              ))}
            </div>
          </div>
          {/* Quote Color + Italic */}
          <div>
            <label className="text-[9px] text-gray-500 block mb-1">Quote Color & Style</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={style.quote_color} onChange={e => setStyleField('quote_color', e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border" data-testid="quote-color" />
              <button onClick={() => setStyleField('quote_italic', !style.quote_italic)}
                className={`px-3 py-1.5 rounded text-xs border-2 italic transition-all ${style.quote_italic ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200'}`}>
                I
              </button>
              <Input value={style.quote_color} onChange={e => setStyleField('quote_color', e.target.value)} className="h-7 text-[9px] w-20" />
            </div>
          </div>
          {/* Author Font & Size */}
          <div>
            <label className="text-[9px] text-gray-500 block mb-1">Author Font</label>
            <select value={style.author_font} onChange={e => setStyleField('author_font', e.target.value)}
              className="w-full border rounded-md px-2 py-1.5 text-xs mb-1.5" style={{ fontFamily: style.author_font }}
              data-testid="author-font-select">
              {FONT_OPTIONS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.fonts.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="flex gap-1.5 items-center">
              <div className="flex gap-0.5">
                {AUTHOR_SIZE_OPTIONS.map(sz => (
                  <button key={sz.value} onClick={() => setStyleField('author_size', sz.value)}
                    className={`px-1 py-0.5 text-[8px] rounded border ${style.author_size === sz.value ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-400 border-gray-200'}`}>
                    {sz.label}
                  </button>
                ))}
              </div>
              <input type="color" value={style.author_color} onChange={e => setStyleField('author_color', e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border" />
            </div>
          </div>
        </div>
        {/* Live preview */}
        <div className="mt-3 bg-gray-50 rounded-lg p-4 text-center border" data-testid="quote-style-preview">
          <p style={{ fontFamily: `'${style.quote_font}', serif`, fontSize: 'clamp(12px, 2vw, 18px)', color: style.quote_color, fontStyle: style.quote_italic ? 'italic' : 'normal', lineHeight: 1.7 }}>
            "The healing sessions have transformed my life..."
          </p>
          <div className="w-8 h-px bg-[#D4AF37]/40 mx-auto my-2" />
          <p style={{ fontFamily: `'${style.author_font}', sans-serif`, fontSize: style.author_size, color: style.author_color, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Sample Author
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Quote size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-1">No text testimonials yet</p>
          <p className="text-xs text-gray-300">Add your first client quote to display on the homepage</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="border rounded-lg p-4 bg-white shadow-sm" data-testid={`text-testimonial-${idx}`}>
              <div className="flex items-start gap-3">
                <GripVertical size={16} className="text-gray-300 mt-2 shrink-0 cursor-grab" />
                <div className="flex-1 space-y-2">
                  <textarea
                    value={item.quote || ''}
                    onChange={e => update(idx, 'quote', e.target.value)}
                    placeholder="Enter the testimonial quote..."
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 resize-none focus:ring-1 focus:ring-[#D4AF37] italic"
                    style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '15px' }}
                    data-testid={`quote-input-${idx}`}
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        value={item.author || ''}
                        onChange={e => update(idx, 'author', e.target.value)}
                        placeholder="Author name"
                        className="h-8 text-xs"
                        data-testid={`author-input-${idx}`}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        value={item.role || ''}
                        onChange={e => update(idx, 'role', e.target.value)}
                        placeholder="Role / Location (optional)"
                        className="h-8 text-xs"
                        data-testid={`role-input-${idx}`}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={item.visible !== false}
                    onCheckedChange={v => update(idx, 'visible', v)}
                    data-testid={`visible-toggle-${idx}`}
                  />
                  {item.visible !== false ? <Eye size={13} className="text-green-500" /> : <EyeOff size={13} className="text-gray-300" />}
                  <button onClick={() => remove(idx)} className="text-red-400 hover:text-red-600 p-1" data-testid={`delete-testimonial-${idx}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TextTestimonialsTab;
