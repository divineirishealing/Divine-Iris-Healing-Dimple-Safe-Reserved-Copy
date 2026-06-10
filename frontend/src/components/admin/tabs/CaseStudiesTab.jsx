import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save, Eye, EyeOff, BookOpen, Sparkles, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { useToast } from '../../../hooks/use-toast';
import ImageUploader from '../ImageUploader';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const emptyStudy = () => ({
  slug: '',
  title: '',
  subtitle: '',
  summary: '',
  client_name: '',
  condition: '',
  hero_image: '',
  program_name: '',
  program_link: '/programs',
  scientific_reference: '',
  disclaimer: '',
  visible: true,
  featured: false,
  intro_sections: [],
  timeline: [],
  closing_sections: [],
});

const emptyStep = (order = 0) => ({
  date_label: '',
  title: '',
  body: '',
  image_url: '',
  images: [],
  phase: 'timeline',
  order,
});

const CaseStudiesTab = () => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyStudy());
  const [expandedStep, setExpandedStep] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const fetchAll = useCallback(async () => {
    const r = await axios.get(`${API}/case-studies`);
    setItems(r.data || []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const seedMeghavi = async () => {
    setSeeding(true);
    try {
      const r = await axios.post(`${API}/case-studies/seed/meghavi?replace=true`);
      toast({ title: 'Meghavi case study seeded', description: r.data?.slug });
      fetchAll();
    } catch (e) {
      toast({ title: 'Seed failed', description: e.response?.data?.detail || e.message, variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  const startNew = () => {
    setEditing('new');
    setForm(emptyStudy());
  };

  const startEdit = (item) => {
    setEditing(item.id);
    setForm({
      ...emptyStudy(),
      ...item,
      intro_sections: item.intro_sections || [],
      timeline: (item.timeline || []).map((s, i) => ({ ...emptyStep(i), ...s, images: s.images || [] })),
      closing_sections: item.closing_sections || [],
    });
  };

  const save = async () => {
    try {
      const payload = {
        ...form,
        timeline: (form.timeline || []).map((s, i) => ({ ...s, order: i })),
      };
      if (editing === 'new') {
        await axios.post(`${API}/case-studies`, payload);
        toast({ title: 'Case study created' });
      } else {
        await axios.put(`${API}/case-studies/${editing}`, payload);
        toast({ title: 'Case study updated' });
      }
      setEditing(null);
      fetchAll();
    } catch (e) {
      toast({ title: 'Save failed', description: e.response?.data?.detail || e.message, variant: 'destructive' });
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this case study?')) return;
    await axios.delete(`${API}/case-studies/${id}`);
    toast({ title: 'Deleted' });
    if (editing === id) setEditing(null);
    fetchAll();
  };

  const toggleVis = async (item) => {
    await axios.patch(`${API}/case-studies/${item.id}/visibility`, { visible: !item.visible });
    fetchAll();
  };

  const addStep = () => {
    const order = (form.timeline || []).length;
    setForm(prev => ({ ...prev, timeline: [...(prev.timeline || []), emptyStep(order)] }));
    setExpandedStep(order);
  };

  const updateStep = (idx, key, val) => {
    setForm(prev => ({
      ...prev,
      timeline: prev.timeline.map((s, i) => i === idx ? { ...s, [key]: val } : s),
    }));
  };

  const removeStep = (idx) => {
    setForm(prev => ({ ...prev, timeline: prev.timeline.filter((_, i) => i !== idx) }));
  };

  const moveStep = (idx, dir) => {
    const next = [...form.timeline];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setForm(prev => ({ ...prev, timeline: next }));
  };

  if (editing) {
    return (
      <div className="space-y-6" data-testid="case-studies-form">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">{editing === 'new' ? 'New Case Study' : 'Edit Case Study'}</h3>
          <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="text-xs font-semibold text-gray-500">Title</label><Input value={form.title} onChange={e => setField('title', e.target.value)} /></div>
          <div><label className="text-xs font-semibold text-gray-500">Slug</label><Input value={form.slug} onChange={e => setField('slug', e.target.value)} placeholder="auto-generated if empty" /></div>
          <div><label className="text-xs font-semibold text-gray-500">Client Name</label><Input value={form.client_name} onChange={e => setField('client_name', e.target.value)} /></div>
          <div><label className="text-xs font-semibold text-gray-500">Condition</label><Input value={form.condition} onChange={e => setField('condition', e.target.value)} /></div>
        </div>
        <div><label className="text-xs font-semibold text-gray-500">Subtitle</label><Input value={form.subtitle} onChange={e => setField('subtitle', e.target.value)} /></div>
        <div><label className="text-xs font-semibold text-gray-500">Summary</label><Textarea value={form.summary} onChange={e => setField('summary', e.target.value)} rows={3} /></div>
        <div><label className="text-xs font-semibold text-gray-500">Hero Image</label><ImageUploader value={form.hero_image} onChange={v => setField('hero_image', v)} /></div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.visible} onCheckedChange={v => setField('visible', v)} /> Visible</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.featured} onCheckedChange={v => setField('featured', v)} /> Featured</label>
        </div>

        {/* Timeline steps */}
        <div className="border rounded-lg p-4 bg-purple-50/30">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-purple-900">Timeline Steps ({form.timeline?.length || 0})</h4>
            <Button size="sm" onClick={addStep}><Plus size={14} className="mr-1" /> Add Step</Button>
          </div>
          {(form.timeline || []).map((step, idx) => (
            <div key={idx} className="mb-3 border rounded bg-white overflow-hidden">
              <button type="button" className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold bg-gray-50 hover:bg-gray-100"
                onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}>
                <GripVertical size={14} className="text-gray-400" />
                {step.date_label || 'No date'} — {step.title || 'Untitled'}
                {expandedStep === idx ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
              </button>
              {expandedStep === idx && (
                <div className="p-4 space-y-3 border-t">
                  <div className="grid md:grid-cols-3 gap-3">
                    <div><label className="text-xs text-gray-500">Date Label</label><Input value={step.date_label} onChange={e => updateStep(idx, 'date_label', e.target.value)} /></div>
                    <div><label className="text-xs text-gray-500">Phase</label>
                      <select className="w-full border rounded px-2 py-2 text-sm" value={step.phase} onChange={e => updateStep(idx, 'phase', e.target.value)}>
                        <option value="before">Before AWRP</option>
                        <option value="labs">Medical Records</option>
                        <option value="awrp">AWRP Healing</option>
                        <option value="timeline">General</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => moveStep(idx, -1)} disabled={idx === 0}>↑</Button>
                      <Button size="sm" variant="outline" onClick={() => moveStep(idx, 1)} disabled={idx === form.timeline.length - 1}>↓</Button>
                      <Button size="sm" variant="destructive" onClick={() => removeStep(idx)}><Trash2 size={14} /></Button>
                    </div>
                  </div>
                  <div><label className="text-xs text-gray-500">Title</label><Input value={step.title} onChange={e => updateStep(idx, 'title', e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500">Body</label><Textarea value={step.body} onChange={e => updateStep(idx, 'body', e.target.value)} rows={4} /></div>
                  <div><label className="text-xs text-gray-500">Primary Image</label><ImageUploader value={step.image_url} onChange={v => updateStep(idx, 'image_url', v)} /></div>
                </div>
              )}
            </div>
          ))}
        </div>

        <Button onClick={save} className="w-full"><Save size={16} className="mr-2" /> Save Case Study</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="case-studies-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><BookOpen size={18} /> Case Studies</h3>
          <p className="text-sm text-gray-500">Documented healing journeys with photo timelines</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={seedMeghavi} disabled={seeding}>
            <Sparkles size={14} className="mr-1" /> {seeding ? 'Seeding…' : 'Seed Meghavi'}
          </Button>
          <Button onClick={startNew}><Plus size={14} className="mr-1" /> Add Case Study</Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No case studies yet. Click &quot;Seed Meghavi&quot; to import the first one.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-4 border rounded-lg bg-white">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                <p className="text-xs text-gray-500">{item.client_name} · /case-studies/{item.slug} · {(item.timeline || []).length} timeline steps</p>
              </div>
              <button onClick={() => toggleVis(item)} className="p-2 rounded hover:bg-gray-100" title={item.visible ? 'Hide' : 'Show'}>
                {item.visible ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}
              </button>
              <Button size="sm" variant="outline" onClick={() => startEdit(item)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => remove(item.id)}><Trash2 size={14} /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CaseStudiesTab;
