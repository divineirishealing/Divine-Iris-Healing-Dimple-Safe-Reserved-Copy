import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save, Eye, EyeOff, GripVertical, Quote } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TextTestimonialsTab = () => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    const r = await axios.get(`${API}/text-testimonials/`);
    setItems(r.data || []);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

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
      await Promise.all(items.map((item, i) =>
        axios.put(`${API}/text-testimonials/${item.id}`, { ...item, order: i })
      ));
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
