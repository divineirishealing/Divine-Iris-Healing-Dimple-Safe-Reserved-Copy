import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import ImageUploader from './ImageUploader';
import { resolveImageUrl } from '../../lib/imageUtils';
import {
  Settings, Package, Calendar, MessageSquare, BarChart3, Mail,
  Trash2, Edit, Plus, ChevronUp, ChevronDown, Eye, EyeOff, Save, X,
  ArrowUp, ArrowDown
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FONT_OPTIONS = [
  'Playfair Display', 'Lato', 'Cinzel', 'Caveat', 'Montserrat',
  'Poppins', 'Raleway', 'Cormorant Garamond', 'Italiana', 'Josefin Sans',
  'Great Vibes', 'Dancing Script', 'Merriweather', 'Libre Baskerville',
  'Roboto Slab', 'Open Sans', 'Source Sans Pro', 'Nunito'
];

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
  { value: 'extra-large', label: 'Extra Large' },
];

const AdminPanel = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('programs');

  // Data states
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [stats, setStats] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [siteSettings, setSiteSettings] = useState(null);

  // Form states
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [programForm, setProgramForm] = useState({ title: '', category: '', description: '', image: '', price_usd: 0, price_inr: 0, price_eur: 0, price_gbp: 0, price_aed: 0, visible: true, order: 0, program_type: 'online', offer_price_usd: 0, offer_price_inr: 0, offer_text: '', is_upcoming: false, start_date: '', deadline_date: '', enrollment_open: true });
  const [sessionForm, setSessionForm] = useState({ title: '', description: '', image: '', price_usd: 0, price_inr: 0, price_eur: 0, price_gbp: 0, visible: true, order: 0 });
  const [testimonialForm, setTestimonialForm] = useState({ type: 'graphic', name: '', text: '', image: '', videoId: '', program_id: '', visible: true });

  const loadAll = useCallback(async () => {
    try {
      const [prog, sess, test, st, subs, settings] = await Promise.all([
        axios.get(`${API}/programs`),
        axios.get(`${API}/sessions`),
        axios.get(`${API}/testimonials`),
        axios.get(`${API}/stats`),
        axios.get(`${API}/newsletter`),
        axios.get(`${API}/settings`),
      ]);
      setPrograms(prog.data);
      setSessions(sess.data);
      setTestimonials(test.data);
      setStats(st.data);
      setSubscribers(subs.data);
      setSiteSettings(settings.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ===== PROGRAMS =====
  const saveProgram = async () => {
    try {
      if (editingId) {
        await axios.put(`${API}/programs/${editingId}`, programForm);
        toast({ title: 'Program updated!' });
      } else {
        await axios.post(`${API}/programs`, programForm);
        toast({ title: 'Program created!' });
      }
      resetProgramForm();
      loadAll();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const editProgram = (p) => {
    setEditingId(p.id);
    setProgramForm({ title: p.title, category: p.category || '', description: p.description, image: p.image, price_usd: p.price_usd || 0, price_inr: p.price_inr || 0, price_eur: p.price_eur || 0, price_gbp: p.price_gbp || 0, price_aed: p.price_aed || 0, visible: p.visible !== false, order: p.order || 0, program_type: p.program_type || 'online', offer_price_usd: p.offer_price_usd || 0, offer_price_inr: p.offer_price_inr || 0, offer_text: p.offer_text || '', is_upcoming: p.is_upcoming || false, start_date: p.start_date || '', deadline_date: p.deadline_date || '', enrollment_open: p.enrollment_open !== false });
    setShowProgramForm(true);
  };

  const deleteProgram = async (id) => {
    if (!window.confirm('Delete this program?')) return;
    await axios.delete(`${API}/programs/${id}`);
    toast({ title: 'Program deleted' });
    loadAll();
  };

  const toggleProgramVisibility = async (p) => {
    await axios.patch(`${API}/programs/${p.id}/visibility`, { visible: !p.visible });
    loadAll();
  };

  const moveProgramOrder = async (idx, direction) => {
    const items = [...programs];
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
    await axios.patch(`${API}/programs/reorder`, { order: items.map(i => i.id) });
    loadAll();
  };

  const resetProgramForm = () => {
    setShowProgramForm(false);
    setEditingId(null);
    setProgramForm({ title: '', category: '', description: '', image: '', price_usd: 0, price_inr: 0, price_eur: 0, price_gbp: 0, price_aed: 0, visible: true, order: 0, program_type: 'online', offer_price_usd: 0, offer_price_inr: 0, offer_text: '', is_upcoming: false, start_date: '', deadline_date: '', enrollment_open: true });
  };

  // ===== SESSIONS =====
  const saveSession = async () => {
    try {
      if (editingId) {
        await axios.put(`${API}/sessions/${editingId}`, sessionForm);
        toast({ title: 'Session updated!' });
      } else {
        await axios.post(`${API}/sessions`, sessionForm);
        toast({ title: 'Session created!' });
      }
      resetSessionForm();
      loadAll();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const editSession = (s) => {
    setEditingId(s.id);
    setSessionForm({ title: s.title, description: s.description, image: s.image, price_usd: s.price_usd || 0, price_inr: s.price_inr || 0, price_eur: s.price_eur || 0, price_gbp: s.price_gbp || 0, visible: s.visible !== false, order: s.order || 0 });
    setShowSessionForm(true);
  };

  const deleteSession = async (id) => {
    if (!window.confirm('Delete this session?')) return;
    await axios.delete(`${API}/sessions/${id}`);
    toast({ title: 'Session deleted' });
    loadAll();
  };

  const toggleSessionVisibility = async (s) => {
    await axios.patch(`${API}/sessions/${s.id}/visibility`, { visible: !s.visible });
    loadAll();
  };

  const moveSessionOrder = async (idx, direction) => {
    const items = [...sessions];
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
    await axios.patch(`${API}/sessions/reorder`, { order: items.map(i => i.id) });
    loadAll();
  };

  const resetSessionForm = () => {
    setShowSessionForm(false);
    setEditingId(null);
    setSessionForm({ title: '', description: '', image: '', price_usd: 0, price_inr: 0, price_eur: 0, price_gbp: 0, visible: true, order: 0 });
  };

  // ===== TESTIMONIALS =====
  const saveTestimonial = async () => {
    try {
      if (editingId) {
        await axios.put(`${API}/testimonials/${editingId}`, testimonialForm);
        toast({ title: 'Testimonial updated!' });
      } else {
        await axios.post(`${API}/testimonials`, testimonialForm);
        toast({ title: 'Testimonial created!' });
      }
      resetTestimonialForm();
      loadAll();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const editTestimonial = (t) => {
    setEditingId(t.id);
    setTestimonialForm({ type: t.type, name: t.name || '', text: t.text || '', image: t.image || '', videoId: t.videoId || '', program_id: t.program_id || '', visible: t.visible !== false });
    setShowTestimonialForm(true);
  };

  const deleteTestimonial = async (id) => {
    if (!window.confirm('Delete this testimonial?')) return;
    await axios.delete(`${API}/testimonials/${id}`);
    toast({ title: 'Testimonial deleted' });
    loadAll();
  };

  const toggleTestimonialVisibility = async (t) => {
    await axios.patch(`${API}/testimonials/${t.id}/visibility`, { visible: !t.visible });
    loadAll();
  };

  const resetTestimonialForm = () => {
    setShowTestimonialForm(false);
    setEditingId(null);
    setTestimonialForm({ type: 'graphic', name: '', text: '', image: '', videoId: '', program_id: '', visible: true });
  };

  // ===== SITE SETTINGS =====
  const saveSiteSettings = async () => {
    try {
      await axios.put(`${API}/settings`, siteSettings);
      toast({ title: 'Site settings saved!' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const tabs = [
    { key: 'programs', label: 'Programs', icon: Package, count: programs.length },
    { key: 'sessions', label: 'Sessions', icon: Calendar, count: sessions.length },
    { key: 'testimonials', label: 'Testimonials', icon: MessageSquare, count: testimonials.length },
    { key: 'stats', label: 'Stats', icon: BarChart3, count: stats.length },
    { key: 'subscribers', label: 'Subscribers', icon: Mail, count: subscribers.length },
    { key: 'settings', label: 'Site Settings', icon: Settings },
  ];

  return (
    <div data-testid="admin-panel" className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white py-4 px-6 flex justify-between items-center">
        <h1 className="text-lg font-semibold tracking-wider">Divine Iris Admin</h1>
        <a href="/" className="text-xs text-gray-400 hover:text-[#D4AF37] transition-colors">View Site</a>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r min-h-[calc(100vh-56px)] p-3 hidden md:block">
          {tabs.map(tab => (
            <button
              key={tab.key}
              data-testid={`admin-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-all ${
                activeTab === tab.key ? 'bg-[#D4AF37] text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
              {tab.count !== undefined && <span className="ml-auto text-xs opacity-70">{tab.count}</span>}
            </button>
          ))}
        </aside>

        {/* Mobile tabs */}
        <div className="md:hidden w-full overflow-x-auto border-b bg-white">
          <div className="flex">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-xs whitespace-nowrap ${activeTab === tab.key ? 'border-b-2 border-[#D4AF37] text-[#D4AF37]' : 'text-gray-500'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 p-6 max-w-5xl">
          {/* ===== PROGRAMS TAB ===== */}
          {activeTab === 'programs' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Programs ({programs.length})</h2>
                <Button data-testid="add-program-btn" onClick={() => { resetProgramForm(); setShowProgramForm(true); }} className="bg-[#D4AF37] hover:bg-[#b8962e]">
                  <Plus size={16} className="mr-1" /> Add Program
                </Button>
              </div>

              {showProgramForm && (
                <div data-testid="program-form" className="bg-white rounded-lg p-6 mb-6 shadow-sm border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">{editingId ? 'Edit Program' : 'New Program'}</h3>
                    <button onClick={resetProgramForm}><X size={18} /></button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Title</Label>
                      <Input data-testid="program-title-input" value={programForm.title} onChange={e => setProgramForm({...programForm, title: e.target.value})} />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Input value={programForm.category} onChange={e => setProgramForm({...programForm, category: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Description</Label>
                      <Textarea value={programForm.description} onChange={e => setProgramForm({...programForm, description: e.target.value})} rows={4} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Image</Label>
                      <ImageUploader value={programForm.image} onChange={url => setProgramForm({...programForm, image: url})} />
                    </div>
                    <div><Label>Price USD</Label><Input type="number" value={programForm.price_usd} onChange={e => setProgramForm({...programForm, price_usd: parseFloat(e.target.value) || 0})} /></div>
                    <div><Label>Price AED</Label><Input type="number" value={programForm.price_aed} onChange={e => setProgramForm({...programForm, price_aed: parseFloat(e.target.value) || 0})} /></div>
                    <div><Label>Price INR</Label><Input type="number" value={programForm.price_inr} onChange={e => setProgramForm({...programForm, price_inr: parseFloat(e.target.value) || 0})} /></div>
                    <div><Label>Price EUR</Label><Input type="number" value={programForm.price_eur} onChange={e => setProgramForm({...programForm, price_eur: parseFloat(e.target.value) || 0})} /></div>
                    <div><Label>Price GBP</Label><Input type="number" value={programForm.price_gbp} onChange={e => setProgramForm({...programForm, price_gbp: parseFloat(e.target.value) || 0})} /></div>
                    <div><Label>Offer Price USD</Label><Input type="number" value={programForm.offer_price_usd} onChange={e => setProgramForm({...programForm, offer_price_usd: parseFloat(e.target.value) || 0})} placeholder="0 = no offer" /></div>
                    <div><Label>Offer Price INR</Label><Input type="number" value={programForm.offer_price_inr} onChange={e => setProgramForm({...programForm, offer_price_inr: parseFloat(e.target.value) || 0})} placeholder="0 = no offer" /></div>
                    <div className="md:col-span-2"><Label>Offer Badge Text</Label><Input value={programForm.offer_text} onChange={e => setProgramForm({...programForm, offer_text: e.target.value})} placeholder="e.g., 20% OFF, Early Bird, Limited Offer" /></div>
                    <div>
                      <Label>Program Type</Label>
                      <select value={programForm.program_type} onChange={e => setProgramForm({...programForm, program_type: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="online">Online</option>
                        <option value="offline">In-Person (Offline)</option>
                        <option value="hybrid">Hybrid (Online + In-Person)</option>
                      </select>
                    </div>
                    <div><Label>Start Date</Label><Input value={programForm.start_date} onChange={e => setProgramForm({...programForm, start_date: e.target.value})} placeholder="e.g., March 15, 2026" /></div>
                    <div><Label>Deadline Date (for countdown)</Label><Input type="date" value={programForm.deadline_date || ''} onChange={e => setProgramForm({...programForm, deadline_date: e.target.value})} /></div>
                    <div className="flex items-center gap-2">
                      <Switch checked={programForm.is_upcoming} onCheckedChange={v => setProgramForm({...programForm, is_upcoming: v})} />
                      <Label>Show in Upcoming Programs section</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={programForm.enrollment_open !== false} onCheckedChange={v => setProgramForm({...programForm, enrollment_open: v})} />
                      <Label>Enrollment Open (Pay Now visible)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={programForm.visible} onCheckedChange={v => setProgramForm({...programForm, visible: v})} />
                      <Label>Visible on website</Label>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button data-testid="save-program-btn" onClick={saveProgram} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Save size={14} className="mr-1" /> Save</Button>
                    <Button variant="outline" onClick={resetProgramForm}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Program List */}
              <div className="space-y-2">
                {programs.map((p, idx) => (
                  <div key={p.id} data-testid={`program-row-${p.id}`} className={`bg-white rounded-lg p-4 flex items-center gap-4 shadow-sm border ${!p.visible ? 'opacity-60' : ''}`}>
                    <div className="flex flex-col gap-1">
                      <button data-testid={`program-up-${p.id}`} onClick={() => moveProgramOrder(idx, -1)} disabled={idx === 0} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button data-testid={`program-down-${p.id}`} onClick={() => moveProgramOrder(idx, 1)} disabled={idx === programs.length - 1} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowDown size={14} /></button>
                    </div>
                    {p.image && <img src={resolveImageUrl(p.image)} alt={p.title} className="w-14 h-14 object-cover rounded" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{p.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-500">{p.category}</p>
                        {p.is_upcoming && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Upcoming</span>}
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">{p.program_type || 'online'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button data-testid={`program-toggle-${p.id}`} onClick={() => toggleProgramVisibility(p)} className="p-1.5 rounded hover:bg-gray-100" title={p.visible ? 'Hide' : 'Show'}>
                        {p.visible ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}
                      </button>
                      <button onClick={() => editProgram(p)} className="p-1.5 rounded hover:bg-gray-100"><Edit size={16} className="text-blue-600" /></button>
                      <button onClick={() => deleteProgram(p.id)} className="p-1.5 rounded hover:bg-gray-100"><Trash2 size={16} className="text-red-500" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== SESSIONS TAB ===== */}
          {activeTab === 'sessions' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Sessions ({sessions.length})</h2>
                <Button data-testid="add-session-btn" onClick={() => { resetSessionForm(); setShowSessionForm(true); }} className="bg-[#D4AF37] hover:bg-[#b8962e]">
                  <Plus size={16} className="mr-1" /> Add Session
                </Button>
              </div>

              {showSessionForm && (
                <div data-testid="session-form" className="bg-white rounded-lg p-6 mb-6 shadow-sm border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">{editingId ? 'Edit Session' : 'New Session'}</h3>
                    <button onClick={resetSessionForm}><X size={18} /></button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2"><Label>Title</Label><Input data-testid="session-title-input" value={sessionForm.title} onChange={e => setSessionForm({...sessionForm, title: e.target.value})} /></div>
                    <div className="md:col-span-2"><Label>Description</Label><Textarea value={sessionForm.description} onChange={e => setSessionForm({...sessionForm, description: e.target.value})} rows={4} /></div>
                    <div className="md:col-span-2"><Label>Image</Label><ImageUploader value={sessionForm.image} onChange={url => setSessionForm({...sessionForm, image: url})} /></div>
                    <div><Label>Price USD</Label><Input type="number" value={sessionForm.price_usd} onChange={e => setSessionForm({...sessionForm, price_usd: parseFloat(e.target.value) || 0})} /></div>
                    <div><Label>Price AED</Label><Input type="number" value={sessionForm.price_aed || 0} onChange={e => setSessionForm({...sessionForm, price_aed: parseFloat(e.target.value) || 0})} /></div>
                    <div><Label>Price INR</Label><Input type="number" value={sessionForm.price_inr} onChange={e => setSessionForm({...sessionForm, price_inr: parseFloat(e.target.value) || 0})} /></div>
                    <div className="flex items-center gap-2">
                      <Switch checked={sessionForm.visible} onCheckedChange={v => setSessionForm({...sessionForm, visible: v})} />
                      <Label>Visible on website</Label>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button data-testid="save-session-btn" onClick={saveSession} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Save size={14} className="mr-1" /> Save</Button>
                    <Button variant="outline" onClick={resetSessionForm}>Cancel</Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {sessions.map((s, idx) => (
                  <div key={s.id} data-testid={`session-row-${s.id}`} className={`bg-white rounded-lg p-4 flex items-center gap-4 shadow-sm border ${!s.visible ? 'opacity-60' : ''}`}>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveSessionOrder(idx, -1)} disabled={idx === 0} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button onClick={() => moveSessionOrder(idx, 1)} disabled={idx === sessions.length - 1} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowDown size={14} /></button>
                    </div>
                    {s.image && <img src={resolveImageUrl(s.image)} alt={s.title} className="w-14 h-14 object-cover rounded" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{s.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleSessionVisibility(s)} className="p-1.5 rounded hover:bg-gray-100">
                        {s.visible ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}
                      </button>
                      <button onClick={() => editSession(s)} className="p-1.5 rounded hover:bg-gray-100"><Edit size={16} className="text-blue-600" /></button>
                      <button onClick={() => deleteSession(s.id)} className="p-1.5 rounded hover:bg-gray-100"><Trash2 size={16} className="text-red-500" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== TESTIMONIALS TAB ===== */}
          {activeTab === 'testimonials' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Testimonials ({testimonials.length})</h2>
                <Button data-testid="add-testimonial-btn" onClick={() => { resetTestimonialForm(); setShowTestimonialForm(true); }} className="bg-[#D4AF37] hover:bg-[#b8962e]">
                  <Plus size={16} className="mr-1" /> Add Testimonial
                </Button>
              </div>

              {showTestimonialForm && (
                <div data-testid="testimonial-form" className="bg-white rounded-lg p-6 mb-6 shadow-sm border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">{editingId ? 'Edit Testimonial' : 'New Testimonial'}</h3>
                    <button onClick={resetTestimonialForm}><X size={18} /></button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Type</Label>
                      <select
                        data-testid="testimonial-type-select"
                        value={testimonialForm.type}
                        onChange={e => setTestimonialForm({...testimonialForm, type: e.target.value})}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                      >
                        <option value="graphic">Graphic (Image)</option>
                        <option value="video">Video (YouTube)</option>
                      </select>
                    </div>
                    <div><Label>Name</Label><Input value={testimonialForm.name} onChange={e => setTestimonialForm({...testimonialForm, name: e.target.value})} /></div>
                    <div className="md:col-span-2">
                      <Label>Text (searchable content)</Label>
                      <Textarea data-testid="testimonial-text-input" value={testimonialForm.text} onChange={e => setTestimonialForm({...testimonialForm, text: e.target.value})} rows={3} placeholder="Enter text for search indexing..." />
                    </div>
                    {testimonialForm.type === 'graphic' && (
                      <div className="md:col-span-2"><Label>Image</Label><ImageUploader value={testimonialForm.image} onChange={url => setTestimonialForm({...testimonialForm, image: url})} /></div>
                    )}
                    {testimonialForm.type === 'video' && (
                      <div className="md:col-span-2"><Label>YouTube Video ID</Label><Input value={testimonialForm.videoId} onChange={e => setTestimonialForm({...testimonialForm, videoId: e.target.value})} placeholder="e.g., FVgxpMEMnoc" /></div>
                    )}
                    <div>
                      <Label>Associated Program (optional)</Label>
                      <select value={testimonialForm.program_id} onChange={e => setTestimonialForm({...testimonialForm, program_id: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="">None</option>
                        {programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={testimonialForm.visible} onCheckedChange={v => setTestimonialForm({...testimonialForm, visible: v})} />
                      <Label>Visible</Label>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button data-testid="save-testimonial-btn" onClick={saveTestimonial} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Save size={14} className="mr-1" /> Save</Button>
                    <Button variant="outline" onClick={resetTestimonialForm}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Testimonial List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {testimonials.map((t) => (
                  <div key={t.id} data-testid={`testimonial-row-${t.id}`} className={`bg-white rounded-lg shadow-sm border overflow-hidden ${!t.visible ? 'opacity-50' : ''}`}>
                    {t.type === 'graphic' && t.image && (
                      <img src={resolveImageUrl(t.image)} alt={t.name} className="w-full h-32 object-cover" />
                    )}
                    {t.type === 'video' && (
                      <img src={t.thumbnail || `https://img.youtube.com/vi/${t.videoId}/hqdefault.jpg`} alt={t.name} className="w-full h-32 object-cover" />
                    )}
                    <div className="p-3">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${t.type === 'graphic' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{t.type}</span>
                          {t.name && <p className="text-sm font-medium mt-1">{t.name}</p>}
                        </div>
                      </div>
                      {t.text && <p className="text-xs text-gray-500 line-clamp-2 mt-1">{t.text}</p>}
                      <div className="flex items-center gap-2 mt-3">
                        <button onClick={() => toggleTestimonialVisibility(t)} className="p-1 rounded hover:bg-gray-100">
                          {t.visible ? <Eye size={14} className="text-green-600" /> : <EyeOff size={14} className="text-gray-400" />}
                        </button>
                        <button onClick={() => editTestimonial(t)} className="p-1 rounded hover:bg-gray-100"><Edit size={14} className="text-blue-600" /></button>
                        <button onClick={() => deleteTestimonial(t.id)} className="p-1 rounded hover:bg-gray-100"><Trash2 size={14} className="text-red-500" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== STATS TAB ===== */}
          {activeTab === 'stats' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Stats ({stats.length})</h2>
              <div className="space-y-3">
                {stats.map((stat) => (
                  <div key={stat.id} className="bg-white rounded-lg p-4 flex items-center gap-4 shadow-sm border">
                    <div className="text-2xl font-bold text-[#D4AF37]">{stat.value}</div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== SUBSCRIBERS TAB ===== */}
          {activeTab === 'subscribers' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Subscribers ({subscribers.length})</h2>
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left text-xs text-gray-500">Email</th><th className="px-4 py-3 text-left text-xs text-gray-500">Date</th></tr></thead>
                  <tbody>
                    {subscribers.map(sub => (
                      <tr key={sub.id || sub.email} className="border-b"><td className="px-4 py-3">{sub.email}</td><td className="px-4 py-3 text-gray-500">{sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString() : '-'}</td></tr>
                    ))}
                  </tbody>
                </table>
                {subscribers.length === 0 && <p className="text-center py-8 text-gray-400">No subscribers yet</p>}
              </div>
            </div>
          )}

          {/* ===== SITE SETTINGS TAB ===== */}
          {activeTab === 'settings' && siteSettings && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Site Settings</h2>

              {/* Hero Section Settings */}
              <div className="bg-white rounded-lg p-6 shadow-sm border mb-6">
                <h3 className="font-medium text-gray-800 mb-2 text-base">Hero Section</h3>
                <p className="text-xs text-gray-400 mb-5">This is the big banner at the top of your homepage with your title and video.</p>

                {/* VIDEO UPLOAD */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-sm font-semibold text-blue-800 mb-2">Background Video</p>
                  <p className="text-xs text-blue-600 mb-3">Upload a video that plays behind your title text.</p>
                  {siteSettings.hero_video_url && (
                    <div className="mb-3 flex items-center gap-3">
                      <video src={resolveImageUrl(siteSettings.hero_video_url)} className="w-40 h-24 object-cover rounded border" muted />
                      <button onClick={() => setSiteSettings({...siteSettings, hero_video_url: ''})} className="text-red-500 text-xs hover:underline">Remove Video</button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/mov"
                    data-testid="hero-video-upload"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        toast({ title: 'Uploading video...', description: 'This may take a moment' });
                        const res = await axios.post(`${API}/upload/video`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                        setSiteSettings({...siteSettings, hero_video_url: res.data.url});
                        toast({ title: 'Video uploaded!' });
                      } catch (err) {
                        toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
                      }
                    }}
                    className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-[#D4AF37] file:text-white hover:file:bg-[#b8962e] cursor-pointer"
                  />
                </div>

                {/* TITLE TEXT */}
                <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-sm font-semibold text-amber-800 mb-3">Main Title (big text)</p>

                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">What should the big title say?</p>
                    <Textarea data-testid="hero-title-input" value={siteSettings.hero_title || ''} onChange={e => setSiteSettings({...siteSettings, hero_title: e.target.value})} rows={2} placeholder="Divine Iris&#10;Healing" className="text-base" />
                    <p className="text-xs text-gray-400 mt-1">Press Enter to put text on a new line.</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {/* Title Color */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Title Color</p>
                      <div className="flex gap-2 items-center">
                        <input type="color" data-testid="hero-title-color" value={siteSettings.hero_title_color || '#ffffff'} onChange={e => setSiteSettings({...siteSettings, hero_title_color: e.target.value})} className="w-10 h-10 rounded cursor-pointer border" />
                        <Input value={siteSettings.hero_title_color || '#ffffff'} onChange={e => setSiteSettings({...siteSettings, hero_title_color: e.target.value})} className="text-xs" />
                      </div>
                    </div>

                    {/* Title Size */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Title Size</p>
                      <select data-testid="hero-title-size" value={siteSettings.hero_title_size || '70px'} onChange={e => setSiteSettings({...siteSettings, hero_title_size: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="40px">Small</option>
                        <option value="50px">Medium</option>
                        <option value="60px">Large</option>
                        <option value="70px">Very Large</option>
                        <option value="85px">Extra Large</option>
                        <option value="100px">Huge</option>
                      </select>
                    </div>

                    {/* Bold Toggle */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Make Bold?</p>
                      <button
                        data-testid="hero-title-bold-toggle"
                        onClick={() => setSiteSettings({...siteSettings, hero_title_bold: !siteSettings.hero_title_bold})}
                        className={`w-full py-2 rounded-md text-sm font-bold border-2 transition-all ${
                          siteSettings.hero_title_bold
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        B {siteSettings.hero_title_bold ? '(ON)' : '(OFF)'}
                      </button>
                    </div>

                    {/* Alignment */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Position</p>
                      <div className="flex gap-1">
                        {[
                          { val: 'left', label: 'Left', icon: '|===' },
                          { val: 'center', label: 'Center', icon: '=||=' },
                          { val: 'right', label: 'Right', icon: '===|' },
                        ].map(a => (
                          <button
                            key={a.val}
                            data-testid={`hero-align-${a.val}`}
                            onClick={() => setSiteSettings({...siteSettings, hero_title_align: a.val})}
                            className={`flex-1 py-2 rounded text-xs font-mono border-2 transition-all ${
                              (siteSettings.hero_title_align || 'left') === a.val
                                ? 'bg-[#D4AF37] text-white border-[#D4AF37]'
                                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                            }`}
                            title={a.label}
                          >
                            {a.icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SUBTITLE TEXT */}
                <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-sm font-semibold text-green-800 mb-3">Subtitle (small text below title)</p>

                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">What should the small text say?</p>
                    <Input data-testid="hero-subtitle-input" value={siteSettings.hero_subtitle || ''} onChange={e => setSiteSettings({...siteSettings, hero_subtitle: e.target.value})} placeholder="ETERNAL HAPPINESS" />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {/* Subtitle Color */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Subtitle Color</p>
                      <div className="flex gap-2 items-center">
                        <input type="color" data-testid="hero-subtitle-color" value={siteSettings.hero_subtitle_color || '#ffffff'} onChange={e => setSiteSettings({...siteSettings, hero_subtitle_color: e.target.value})} className="w-10 h-10 rounded cursor-pointer border" />
                        <Input value={siteSettings.hero_subtitle_color || '#ffffff'} onChange={e => setSiteSettings({...siteSettings, hero_subtitle_color: e.target.value})} className="text-xs" />
                      </div>
                    </div>

                    {/* Subtitle Size */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Subtitle Size</p>
                      <select data-testid="hero-subtitle-size" value={siteSettings.hero_subtitle_size || '14px'} onChange={e => setSiteSettings({...siteSettings, hero_subtitle_size: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="10px">Tiny</option>
                        <option value="12px">Small</option>
                        <option value="14px">Normal</option>
                        <option value="16px">Medium</option>
                        <option value="18px">Large</option>
                        <option value="22px">Very Large</option>
                      </select>
                    </div>

                    {/* Subtitle Bold */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Make Bold?</p>
                      <button
                        data-testid="hero-subtitle-bold-toggle"
                        onClick={() => setSiteSettings({...siteSettings, hero_subtitle_bold: !siteSettings.hero_subtitle_bold})}
                        className={`w-full py-2 rounded-md text-sm font-bold border-2 transition-all ${
                          siteSettings.hero_subtitle_bold
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        B {siteSettings.hero_subtitle_bold ? '(ON)' : '(OFF)'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* LINES */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Show Lines Above & Below Subtitle?</p>
                      <p className="text-xs text-gray-400">The thin horizontal lines that appear around "ETERNAL HAPPINESS"</p>
                    </div>
                    <Switch
                      data-testid="hero-lines-toggle"
                      checked={siteSettings.hero_show_lines !== false}
                      onCheckedChange={v => setSiteSettings({...siteSettings, hero_show_lines: v})}
                    />
                  </div>
                </div>

                {/* LIVE PREVIEW */}
                <div className="mt-6 p-6 rounded-lg border-2 border-dashed border-gray-300" style={{ background: '#1a1a2e' }}>
                  <p className="text-xs text-gray-400 mb-3 text-center">LIVE PREVIEW (how it will look)</p>
                  <div className={`flex flex-col ${
                    (siteSettings.hero_title_align || 'left') === 'center' ? 'items-center text-center' :
                    (siteSettings.hero_title_align || 'left') === 'right' ? 'items-end text-right' : 'items-start text-left'
                  }`}>
                    <p style={{
                      color: siteSettings.hero_title_color || '#ffffff',
                      fontWeight: siteSettings.hero_title_bold ? 700 : 400,
                      fontSize: `calc(${siteSettings.hero_title_size || '70px'} * 0.4)`,
                      fontFamily: "'Cinzel', serif",
                      lineHeight: 1.2,
                      whiteSpace: 'pre-line',
                    }}>
                      {siteSettings.hero_title || 'Divine Iris\nHealing'}
                    </p>
                    {siteSettings.hero_show_lines !== false && <div className="w-20 h-px bg-white/50 my-1.5"></div>}
                    <p style={{
                      color: siteSettings.hero_subtitle_color || '#ffffff',
                      fontWeight: siteSettings.hero_subtitle_bold ? 700 : 300,
                      fontSize: `calc(${siteSettings.hero_subtitle_size || '14px'} * 0.9)`,
                      letterSpacing: '0.3em',
                    }}>
                      {siteSettings.hero_subtitle || 'ETERNAL HAPPINESS'}
                    </p>
                    {siteSettings.hero_show_lines !== false && <div className="w-20 h-px bg-white/50 mt-1.5"></div>}
                  </div>
                </div>
              </div>

              {/* Logo Settings */}
              <div className="bg-white rounded-lg p-6 shadow-sm border mb-6">
                <h3 className="font-medium text-gray-800 mb-4 text-base">Site Logo</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Logo Image</Label>
                    <div className="mt-1">
                      {siteSettings.logo_url && (
                        <div className="mb-3 flex items-center gap-3 bg-gray-50 p-3 rounded">
                          <img src={resolveImageUrl(siteSettings.logo_url)} alt="Current Logo" className="h-16 object-contain" />
                          <button onClick={() => setSiteSettings({...siteSettings, logo_url: ''})} className="text-red-500 text-xs hover:underline">Remove</button>
                        </div>
                      )}
                      <ImageUploader value={siteSettings.logo_url || ''} onChange={url => setSiteSettings({...siteSettings, logo_url: url})} />
                    </div>
                  </div>
                  <div>
                    <Label>Logo Width (px): {siteSettings.logo_width || 96}px</Label>
                    <input
                      type="range"
                      min="40"
                      max="300"
                      value={siteSettings.logo_width || 96}
                      onChange={e => setSiteSettings({...siteSettings, logo_width: parseInt(e.target.value)})}
                      className="w-full mt-2"
                      data-testid="logo-width-slider"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>40px</span>
                      <span>300px</span>
                    </div>
                  </div>
                  {siteSettings.logo_url && (
                    <div className="flex items-center justify-center bg-gray-50 rounded p-4">
                      <img src={resolveImageUrl(siteSettings.logo_url)} alt="Preview" style={{ width: `${siteSettings.logo_width || 96}px` }} className="object-contain" />
                    </div>
                  )}
                </div>
              </div>

              {/* Global Font & Color Settings */}
              <div className="bg-white rounded-lg p-6 shadow-sm border mb-6 space-y-6">
                <h3 className="font-medium text-gray-800 text-base">Global Defaults</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Heading Font</Label>
                    <select data-testid="heading-font-select" value={siteSettings.heading_font} onChange={e => setSiteSettings({...siteSettings, heading_font: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm" style={{ fontFamily: siteSettings.heading_font }}>
                      {FONT_OPTIONS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                    </select>
                    <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: siteSettings.heading_font }}>Preview: The quick brown fox</p>
                  </div>
                  <div>
                    <Label>Body Font</Label>
                    <select data-testid="body-font-select" value={siteSettings.body_font} onChange={e => setSiteSettings({...siteSettings, body_font: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm" style={{ fontFamily: siteSettings.body_font }}>
                      {FONT_OPTIONS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                    </select>
                    <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: siteSettings.body_font }}>Preview: The quick brown fox jumps over</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Heading Color</Label>
                    <div className="flex gap-2 items-center"><input type="color" value={siteSettings.heading_color} onChange={e => setSiteSettings({...siteSettings, heading_color: e.target.value})} className="w-10 h-10 rounded cursor-pointer border" /><Input value={siteSettings.heading_color} onChange={e => setSiteSettings({...siteSettings, heading_color: e.target.value})} className="flex-1" /></div>
                  </div>
                  <div>
                    <Label>Body Color</Label>
                    <div className="flex gap-2 items-center"><input type="color" value={siteSettings.body_color} onChange={e => setSiteSettings({...siteSettings, body_color: e.target.value})} className="w-10 h-10 rounded cursor-pointer border" /><Input value={siteSettings.body_color} onChange={e => setSiteSettings({...siteSettings, body_color: e.target.value})} className="flex-1" /></div>
                  </div>
                  <div>
                    <Label>Accent Color</Label>
                    <div className="flex gap-2 items-center"><input type="color" value={siteSettings.accent_color} onChange={e => setSiteSettings({...siteSettings, accent_color: e.target.value})} className="w-10 h-10 rounded cursor-pointer border" /><Input value={siteSettings.accent_color} onChange={e => setSiteSettings({...siteSettings, accent_color: e.target.value})} className="flex-1" /></div>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Heading Size</Label>
                    <select value={siteSettings.heading_size} onChange={e => setSiteSettings({...siteSettings, heading_size: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm">
                      {SIZE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Body Size</Label>
                    <select value={siteSettings.body_size} onChange={e => setSiteSettings({...siteSettings, body_size: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm">
                      {SIZE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Per-Section Style Overrides */}
              <div className="bg-white rounded-lg p-6 shadow-sm border mb-6">
                <h3 className="font-medium text-gray-800 mb-4 text-base">Per-Section Style Overrides</h3>
                <p className="text-xs text-gray-500 mb-4">Leave blank to use global defaults. Set a value to override for that section only.</p>
                {['hero', 'about', 'programs', 'sessions', 'stats', 'testimonials', 'sponsor', 'newsletter', 'footer'].map(section => {
                  const sectionData = siteSettings.sections?.[section] || {};
                  const updateSection = (key, val) => {
                    const sections = { ...(siteSettings.sections || {}) };
                    sections[section] = { ...(sections[section] || {}), [key]: val };
                    setSiteSettings({ ...siteSettings, sections });
                  };
                  return (
                    <details key={section} className="mb-3 border rounded-lg">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 capitalize">{section} Section</summary>
                      <div className="px-4 pb-4 pt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">Font</Label>
                          <select value={sectionData.font_family || ''} onChange={e => updateSection('font_family', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                            <option value="">Global default</option>
                            {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Size</Label>
                          <select value={sectionData.font_size || ''} onChange={e => updateSection('font_size', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                            <option value="">Default</option>
                            <option value="12px">12px</option><option value="14px">14px</option><option value="16px">16px</option><option value="18px">18px</option><option value="20px">20px</option><option value="24px">24px</option><option value="28px">28px</option><option value="32px">32px</option><option value="40px">40px</option><option value="48px">48px</option><option value="56px">56px</option><option value="64px">64px</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Color</Label>
                          <div className="flex gap-1 items-center"><input type="color" value={sectionData.font_color || '#000000'} onChange={e => updateSection('font_color', e.target.value)} className="w-7 h-7 rounded cursor-pointer border" /><input value={sectionData.font_color || ''} onChange={e => updateSection('font_color', e.target.value)} placeholder="#hex" className="flex-1 border rounded px-2 py-1.5 text-xs w-16" /></div>
                        </div>
                        <div>
                          <Label className="text-xs">Style</Label>
                          <select value={sectionData.font_style || ''} onChange={e => updateSection('font_style', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                            <option value="">Normal</option><option value="italic">Italic</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Weight</Label>
                          <select value={sectionData.font_weight || ''} onChange={e => updateSection('font_weight', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                            <option value="">Default</option><option value="300">Light (300)</option><option value="400">Regular (400)</option><option value="500">Medium (500)</option><option value="600">Semi-Bold (600)</option><option value="700">Bold (700)</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Bg Color</Label>
                          <div className="flex gap-1 items-center"><input type="color" value={sectionData.bg_color || '#ffffff'} onChange={e => updateSection('bg_color', e.target.value)} className="w-7 h-7 rounded cursor-pointer border" /><input value={sectionData.bg_color || ''} onChange={e => updateSection('bg_color', e.target.value)} placeholder="#hex" className="flex-1 border rounded px-2 py-1.5 text-xs w-16" /></div>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>

              <Button data-testid="save-settings-btn" onClick={saveSiteSettings} className="bg-[#D4AF37] hover:bg-[#b8962e]">
                <Save size={14} className="mr-1" /> Save All Settings
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminPanel;
