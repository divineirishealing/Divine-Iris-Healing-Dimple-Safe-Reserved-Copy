import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Textarea } from '../../ui/textarea';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const UpcomingCardQuotesTab = ({ programs = [] }) => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const programOptions = useMemo(() => {
    const list = [...programs].sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title)));
    return list;
  }, [programs]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/upcoming-card-quotes`);
      setItems(res.data || []);
    } catch {
      toast({ title: 'Could not load quotes', variant: 'destructive' });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const add = async () => {
    const firstId = programOptions[0]?.id != null ? String(programOptions[0].id) : '';
    try {
      const r = await axios.post(`${API}/upcoming-card-quotes`, {
        program_id: firstId,
        text: '',
        author: '',
        role: '',
        visible: true,
        order: items.length,
      });
      setItems((prev) => [...prev, r.data]);
    } catch (e) {
      toast({ title: 'Add failed', description: e.message, variant: 'destructive' });
    }
  };

  const updateLocal = (idx, field, val) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  };

  const remove = async (idx) => {
    const item = items[idx];
    if (item?.id) {
      try {
        await axios.delete(`${API}/upcoming-card-quotes/${item.id}`);
      } catch {
        toast({ title: 'Delete failed', variant: 'destructive' });
        return;
      }
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
    toast({ title: 'Removed' });
  };

  const saveAll = async () => {
    for (const it of items) {
      if (!(String(it.program_id || '').trim() && String(it.text || '').trim())) {
        toast({
          title: 'Each row needs a program and quote text',
          variant: 'destructive',
        });
        return;
      }
    }
    setSaving(true);
    try {
      await Promise.all(
        items.map((item, i) =>
          axios.put(`${API}/upcoming-card-quotes/${item.id}`, {
            program_id: String(item.program_id || '').trim(),
            text: String(item.text || '').trim(),
            author: String(item.author || '').trim(),
            role: String(item.role || '').trim(),
            visible: !!item.visible,
            order: i,
          })
        )
      );
      toast({ title: 'Saved!' });
      await fetchAll();
    } catch (e) {
      toast({ title: 'Save error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const countByProgram = useMemo(() => {
    const m = {};
    items.forEach((it) => {
      const p = String(it.program_id || '');
      if (!p) return;
      m[p] = (m[p] || 0) + 1;
    });
    return m;
  }, [items]);

  return (
    <div data-testid="upcoming-card-quotes-tab">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center shrink-0">
            <Sparkles size={20} className="text-[#D4AF37]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Upcoming card quotes</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-xl">
              Short 1–2 line testimonials tied to a <strong>specific program</strong>. They appear inside each upcoming
              program card on the homepage (not the long Transformations testimonials). Keep copy brief for impact.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={add} disabled={programOptions.length === 0} data-testid="add-upcoming-card-quote">
            <Plus size={14} className="mr-1" /> Add quote
          </Button>
          <Button size="sm" onClick={saveAll} disabled={saving || loading} className="bg-[#D4AF37] hover:bg-[#b8962e]" data-testid="save-upcoming-card-quotes">
            <Save size={14} className="mr-1" /> {saving ? 'Saving…' : 'Save all'}
          </Button>
        </div>
      </div>

      {programOptions.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-4">
          Add programs first — then you can attach quotes to them here.
        </p>
      )}

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-4">
          {items.map((item, idx) => {
            const pid = String(item.program_id || '');
            const n = countByProgram[pid] || 0;
            return (
              <div
                key={item.id || idx}
                className="border rounded-xl p-4 bg-white shadow-sm space-y-3"
                data-testid={`upcoming-card-quote-row-${idx}`}
              >
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-[10px] uppercase text-gray-400 font-semibold">Program</label>
                    <select
                      value={pid}
                      onChange={(e) => updateLocal(idx, 'program_id', e.target.value)}
                      className="border rounded-md px-2 py-1.5 text-xs min-w-[200px] max-w-full"
                      data-testid={`upcoming-card-quote-program-${idx}`}
                    >
                      <option value="">Select program…</option>
                      {programOptions.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    {n > 2 && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        Tip: 1–2 quotes per program usually look best
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!item.visible} onCheckedChange={(v) => updateLocal(idx, 'visible', v)} data-testid={`upcoming-card-quote-visible-${idx}`} />
                    {item.visible ? <Eye size={14} className="text-gray-500" /> : <EyeOff size={14} className="text-gray-400" />}
                    <Button variant="ghost" size="sm" className="text-red-600 h-8" onClick={() => remove(idx)} data-testid={`upcoming-card-quote-delete-${idx}`}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-400 font-semibold block mb-1">Quote (1–2 lines)</label>
                  <Textarea
                    value={item.text || ''}
                    onChange={(e) => updateLocal(idx, 'text', e.target.value)}
                    rows={3}
                    maxLength={280}
                    placeholder="e.g. This journey shifted everything — I finally feel at peace."
                    className="text-sm resize-y min-h-[72px]"
                    data-testid={`upcoming-card-quote-text-${idx}`}
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">{(item.text || '').length}/280</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase text-gray-400 font-semibold block mb-1">Name (optional)</label>
                    <Input value={item.author || ''} onChange={(e) => updateLocal(idx, 'author', e.target.value)} className="text-xs" placeholder="Sarah M." data-testid={`upcoming-card-quote-author-${idx}`} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-gray-400 font-semibold block mb-1">Role / location (optional)</label>
                    <Input value={item.role || ''} onChange={(e) => updateLocal(idx, 'role', e.target.value)} className="text-xs" placeholder="Dubai" data-testid={`upcoming-card-quote-role-${idx}`} />
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && programOptions.length > 0 && (
            <p className="text-sm text-gray-400 text-center py-8 border border-dashed rounded-xl">No quotes yet — click &ldquo;Add quote&rdquo;.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default UpcomingCardQuotesTab;
