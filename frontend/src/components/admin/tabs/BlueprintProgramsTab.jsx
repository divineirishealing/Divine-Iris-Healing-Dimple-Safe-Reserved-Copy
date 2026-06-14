/**
 * BlueprintProgramsTab
 *
 * Manages programs that appear on the "Divine Iris Blueprint Immersion" detail page.
 * Combines:
 *   – Program details (title, category, description, image, dates, timing, mode, status)
 *   – Pricing (AED / INR / USD base + offer, per tier when tiers exist)
 *
 * Uses the same merge-onto-server-row pattern as UpcomingHubTab / PricingHubTab so
 * saving here never wipes data managed by other admin tabs.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import ImageUploader from '../ImageUploader';
import {
  Save, Plus, Trash2, ChevronDown, ChevronUp, Package,
  DollarSign, IndianRupee, Calendar, Clock, Monitor, Wifi, MapPin,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* ─── Field allow-lists (never wipe data owned by other tabs) ──── */
const DETAIL_FIELD_KEYS = [
  'title', 'category', 'description', 'image',
  'is_upcoming', 'is_flagship', 'is_blueprint_immersion', 'visible',
  'enrollment_status', 'enrollment_open',
  'start_date', 'end_date', 'deadline_date', 'timing', 'time_zone', 'duration',
  'enable_online', 'enable_offline', 'enable_in_person',
  'show_start_date_on_card', 'show_end_date_on_card',
  'show_timing_on_card', 'show_duration_on_card',
];

const PRICING_FIELD_KEYS = [
  'visible', 'show_pricing_on_card', 'show_tiers_on_card',
  'price_aed', 'price_inr', 'price_usd',
  'offer_price_aed', 'offer_price_inr', 'offer_price_usd', 'offer_text',
];

const TIER_PRICING_FIELD_KEYS = [
  'label', 'duration_value', 'duration_unit',
  'price_aed', 'price_inr', 'price_usd',
  'offer_price_aed', 'offer_price_inr', 'offer_price_usd', 'offer_text',
];

const ALL_FIELD_KEYS = [...new Set([...DETAIL_FIELD_KEYS, ...PRICING_FIELD_KEYS])];

function mergeTiersForSave(serverTiers = [], localTiers = []) {
  const st = Array.isArray(serverTiers) ? serverTiers : [];
  const lt = Array.isArray(localTiers) ? localTiers : [];
  return lt.map((loc, i) => {
    const base = st[i] || {};
    const merged = { ...base };
    for (const k of TIER_PRICING_FIELD_KEYS) {
      if (Object.prototype.hasOwnProperty.call(loc, k)) merged[k] = loc[k];
    }
    return merged;
  });
}

function buildPutPayload(local, server) {
  const base = server && typeof server === 'object' ? { ...server } : { ...local };
  for (const k of ALL_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(local, k)) base[k] = local[k];
  }
  base.duration_tiers = mergeTiersForSave(server?.duration_tiers, local?.duration_tiers);
  return base;
}

/* ─── Numeric cell with local string state ───────────────────── */
const NumCell = ({ value, onChange, placeholder = '0', className = '' }) => {
  const [v, setV] = useState(String(value ?? 0));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setV(String(value ?? 0)); }, [value, focused]);
  return (
    <input
      type="text" inputMode="decimal" placeholder={placeholder} value={v}
      onChange={e => setV(e.target.value)}
      onFocus={e => { setFocused(true); if (e.target.value === '0') e.target.select(); }}
      onBlur={() => { setFocused(false); onChange(parseFloat(v) || 0); }}
      className={`h-8 text-xs w-full text-center px-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-[#D4AF37] ${className}`}
    />
  );
};

/* ─── Enrollment status dropdown ─────────────────────────────── */
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'coming_soon', label: 'Coming Soon' },
];

/* ─── Single program row ──────────────────────────────────────── */
const ProgramRow = ({ p, serverRow, idx, onChange, onToggleBlueprint, onSave, saving }) => {
  const [open, setOpen] = useState(false);
  const hasTiers = (p.duration_tiers || []).length > 0;

  const set = (field, val) => onChange(idx, field, val);
  const setTier = (ti, field, val) => {
    const tiers = [...(p.duration_tiers || [])];
    tiers[ti] = { ...tiers[ti], [field]: val };
    onChange(idx, 'duration_tiers', tiers);
  };
  const addTier = () => {
    const tiers = [...(p.duration_tiers || [])];
    tiers.push({
      label: '1 Month', duration_value: 1, duration_unit: 'month',
      price_aed: 0, price_inr: 0, price_usd: 0,
      offer_price_aed: 0, offer_price_inr: 0, offer_price_usd: 0, offer_text: '',
    });
    onChange(idx, 'duration_tiers', tiers);
  };
  const removeTier = (ti) => {
    const tiers = (p.duration_tiers || []).filter((_, i) => i !== ti);
    onChange(idx, 'duration_tiers', tiers);
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${p.is_blueprint_immersion ? 'border-purple-300 shadow-sm' : 'border-gray-200'}`}>
      {/* ── Row header ── */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${p.is_blueprint_immersion ? 'bg-purple-50' : 'bg-gray-50'}`}
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{p.title || '(untitled)'}</p>
          {p.category && <p className="text-[10px] text-gray-400 mt-0.5">{p.category}</p>}
        </div>
        {/* Blueprint toggle in header */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-[10px] font-medium text-purple-700">Blueprint Immersion</span>
          <Switch
            checked={!!p.is_blueprint_immersion}
            onCheckedChange={v => { onToggleBlueprint(idx, v); }}
            className="data-[state=checked]:bg-purple-600"
          />
        </div>
        {/* Visibility */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-3" onClick={e => e.stopPropagation()}>
          <span className="text-[10px] text-gray-400">Visible</span>
          <Switch checked={p.visible !== false} onCheckedChange={v => set('visible', v)} />
        </div>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onSave(idx); }}
          disabled={saving}
          className="ml-3 flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[#D4AF37] hover:bg-[#b8962e] text-white disabled:opacity-50"
        >
          <Save size={11} /> Save
        </button>
      </div>

      {/* ── Expanded panel ── */}
      {open && (
        <div className="p-5 space-y-6 border-t border-gray-100 bg-white">

          {/* SECTION: Details */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-purple-700 mb-3 flex items-center gap-1.5">
              <Package size={12} /> Program Details
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={p.title || ''} onChange={e => set('title', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Category label</Label>
                <Input value={p.category || ''} onChange={e => set('category', e.target.value)} placeholder="e.g. Emotional Healing" className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Description</Label>
                <Textarea value={p.description || ''} onChange={e => set('description', e.target.value)} rows={3} className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Image</Label>
                <div className="mt-1">
                  <ImageUploader value={p.image || ''} onChange={url => set('image', url)} />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: Schedule & Mode */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-3 flex items-center gap-1.5">
              <Calendar size={12} /> Schedule &amp; Mode
            </h4>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={p.start_date || ''} onChange={e => set('start_date', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={p.end_date || ''} onChange={e => set('end_date', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Enrolment Deadline</Label>
                <Input type="date" value={p.deadline_date || ''} onChange={e => set('deadline_date', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Clock size={11} /> Timing</Label>
                <Input value={p.timing || ''} onChange={e => set('timing', e.target.value)} placeholder="e.g. 9 PM - 11 PM" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Timezone</Label>
                <Input value={p.time_zone || ''} onChange={e => set('time_zone', e.target.value)} placeholder="e.g. IST, GST" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Duration label</Label>
                <Input value={p.duration || ''} onChange={e => set('duration', e.target.value)} placeholder="e.g. 21 Days" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Enrolment Status</Label>
                <select
                  value={p.enrollment_status || 'open'}
                  onChange={e => set('enrollment_status', e.target.value)}
                  className="mt-1 w-full h-9 border border-input rounded-md text-xs px-2 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <Monitor size={12} />
                <Switch checked={p.enable_online !== false} onCheckedChange={v => set('enable_online', v)} />
                Online (Zoom)
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <Wifi size={12} />
                <Switch checked={p.enable_offline !== false} onCheckedChange={v => set('enable_offline', v)} />
                Offline / Remote
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <MapPin size={12} />
                <Switch checked={!!p.enable_in_person} onCheckedChange={v => set('enable_in_person', v)} />
                In-Person
              </label>
            </div>
          </div>

          {/* SECTION: Pricing */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-3 flex items-center gap-1.5">
              <DollarSign size={12} /> Pricing
            </h4>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <Switch checked={p.show_pricing_on_card !== false} onCheckedChange={v => set('show_pricing_on_card', v)} />
                Show price on card
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <Switch checked={!!p.show_tiers_on_card} onCheckedChange={v => set('show_tiers_on_card', v)} />
                Show tier selector on card
              </label>
            </div>

            {!hasTiers ? (
              /* Flat pricing */
              <div className="overflow-x-auto">
                <table className="text-xs w-full min-w-[540px]">
                  <thead>
                    <tr className="text-[10px] text-gray-500 uppercase">
                      <th className="pb-1 text-left w-24">Currency</th>
                      <th className="pb-1 text-center">Base Price</th>
                      <th className="pb-1 text-center">Offer Price</th>
                      <th className="pb-1 text-left pl-2">Offer Label</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    {[
                      { cur: 'AED', base: 'price_aed', offer: 'offer_price_aed' },
                      { cur: 'INR', base: 'price_inr', offer: 'offer_price_inr' },
                      { cur: 'USD', base: 'price_usd', offer: 'offer_price_usd' },
                    ].map(({ cur, base, offer }) => (
                      <tr key={cur}>
                        <td className="pr-2 text-gray-500 font-medium py-1">{cur}</td>
                        <td className="px-1 py-1"><NumCell value={p[base]} onChange={v => set(base, v)} /></td>
                        <td className="px-1 py-1"><NumCell value={p[offer]} onChange={v => set(offer, v)} /></td>
                        {cur === 'AED' && (
                          <td rowSpan={3} className="pl-2 py-1 align-top">
                            <Input
                              value={p.offer_text || ''}
                              onChange={e => set('offer_text', e.target.value)}
                              placeholder="e.g. Early Bird"
                              className="h-8 text-xs"
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Tiered pricing */
              <div className="space-y-3">
                {(p.duration_tiers || []).map((tier, ti) => (
                  <div key={ti} className="border border-gray-200 rounded-lg p-3 bg-amber-50/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Input
                        value={tier.label || ''}
                        onChange={e => setTier(ti, 'label', e.target.value)}
                        placeholder="Tier label (e.g. 1 Month)"
                        className="h-7 text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeTier(ti)}
                        className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full min-w-[480px]">
                        <thead>
                          <tr className="text-[10px] text-gray-500 uppercase">
                            <th className="pb-1 text-left w-20">Currency</th>
                            <th className="pb-1 text-center">Base</th>
                            <th className="pb-1 text-center">Offer</th>
                            <th className="pb-1 text-left pl-2">Offer Label</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { cur: 'AED', base: 'price_aed', offer: 'offer_price_aed' },
                            { cur: 'INR', base: 'price_inr', offer: 'offer_price_inr' },
                            { cur: 'USD', base: 'price_usd', offer: 'offer_price_usd' },
                          ].map(({ cur, base, offer }) => (
                            <tr key={cur}>
                              <td className="pr-2 text-gray-500 font-medium py-1">{cur}</td>
                              <td className="px-1 py-1"><NumCell value={tier[base]} onChange={v => setTier(ti, base, v)} /></td>
                              <td className="px-1 py-1"><NumCell value={tier[offer]} onChange={v => setTier(ti, offer, v)} /></td>
                              {cur === 'AED' && (
                                <td rowSpan={3} className="pl-2 align-top">
                                  <Input
                                    value={tier.offer_text || ''}
                                    onChange={e => setTier(ti, 'offer_text', e.target.value)}
                                    placeholder="e.g. Early Bird"
                                    className="h-8 text-xs"
                                  />
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTier}
                  className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium"
                >
                  <Plus size={13} /> Add Tier
                </button>
              </div>
            )}

            {!hasTiers && (
              <button
                type="button"
                onClick={addTier}
                className="mt-2 flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                <Plus size={13} /> Add Duration Tier
              </button>
            )}
          </div>

          {/* Save button at bottom of expanded row */}
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <Button
              onClick={() => onSave(idx)}
              disabled={saving}
              className="bg-[#D4AF37] hover:bg-[#b8962e] text-sm"
            >
              <Save size={14} className="mr-1.5" /> Save Program
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── New program form ──────────────────────────────────────────── */
const BLANK_PROGRAM = {
  title: '', category: '', description: '', image: '',
  is_blueprint_immersion: true, is_upcoming: false, is_flagship: false, visible: true,
  start_date: '', end_date: '', deadline_date: '', timing: '', time_zone: '', duration: '',
  enrollment_status: 'open', enrollment_open: true,
  enable_online: true, enable_offline: true, enable_in_person: false,
  price_aed: 0, price_inr: 0, price_usd: 0,
  offer_price_aed: 0, offer_price_inr: 0, offer_price_usd: 0, offer_text: '',
  duration_tiers: [],
  show_pricing_on_card: true, show_tiers_on_card: false,
  show_start_date_on_card: true, show_end_date_on_card: true,
  show_timing_on_card: true, show_duration_on_card: true,
  order: 0,
};

/* ─── Main tab ──────────────────────────────────────────────────── */
const BlueprintProgramsTab = () => {
  const { toast } = useToast();
  const [programs, setPrograms]             = useState([]);
  const [serverCache, setServerCache]       = useState([]);
  const [showAll, setShowAll]               = useState(false);
  const [savingIdx, setSavingIdx]           = useState(null);
  const [showNew, setShowNew]               = useState(false);
  const [newForm, setNewForm]               = useState({ ...BLANK_PROGRAM });
  const [creatingNew, setCreatingNew]       = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/programs`);
      const all = Array.isArray(r.data) ? r.data : [];
      setServerCache(all);
      setPrograms(all);
    } catch {
      toast({ title: 'Failed to load programs', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onChange = (idx, field, val) => {
    setPrograms(prev => {
      const c = [...prev];
      c[idx] = { ...c[idx], [field]: val };
      return c;
    });
  };

  const onToggleBlueprint = (idx, val) => {
    onChange(idx, 'is_blueprint_immersion', val);
  };

  const onSave = async (idx) => {
    setSavingIdx(idx);
    try {
      const local = programs[idx];
      const server = serverCache.find(s => s.id === local.id) || local;
      const body = buildPutPayload(local, server);
      await axios.put(`${API}/programs/${local.id}`, body);
      toast({ title: `"${local.title}" saved` });
      await fetchData();
    } catch (e) {
      toast({ title: 'Save failed', description: e?.response?.data?.detail || e.message, variant: 'destructive' });
    } finally {
      setSavingIdx(null);
    }
  };

  const onCreateNew = async () => {
    if (!newForm.title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    setCreatingNew(true);
    try {
      await axios.post(`${API}/programs`, { ...newForm, id: `blueprint_${Date.now()}` });
      toast({ title: `"${newForm.title}" created` });
      setShowNew(false);
      setNewForm({ ...BLANK_PROGRAM });
      await fetchData();
    } catch (e) {
      toast({ title: 'Create failed', description: e?.response?.data?.detail || e.message, variant: 'destructive' });
    } finally {
      setCreatingNew(false);
    }
  };

  const blueprintPrograms = programs.filter(p => p.is_blueprint_immersion);
  const otherPrograms     = programs.filter(p => !p.is_blueprint_immersion);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Package size={18} className="text-purple-600" />
            Blueprint Immersion — Programs &amp; Pricing
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Toggle <strong>Blueprint Immersion</strong> on a program to show it on the detail page.
            Expand any row to edit details and pricing.
          </p>
        </div>
        <Button
          onClick={() => { setShowNew(true); setNewForm({ ...BLANK_PROGRAM }); }}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus size={15} className="mr-1" /> New Program
        </Button>
      </div>

      {/* New Program Form */}
      {showNew && (
        <div className="border-2 border-purple-300 rounded-xl overflow-hidden">
          <div className="bg-purple-50 px-4 py-3 flex items-center gap-2 border-b border-purple-200">
            <Package size={14} className="text-purple-600" />
            <p className="text-sm font-semibold text-purple-800">New Blueprint Immersion Program</p>
          </div>
          <div className="p-5 bg-white space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Title *</Label>
                <Input value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Input value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Emotional Healing" className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Description</Label>
                <Textarea value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} rows={3} className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Image</Label>
                <div className="mt-1">
                  <ImageUploader value={newForm.image} onChange={url => setNewForm(f => ({ ...f, image: url }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={newForm.start_date} onChange={e => setNewForm(f => ({ ...f, start_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={newForm.end_date} onChange={e => setNewForm(f => ({ ...f, end_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Timing</Label>
                <Input value={newForm.timing} onChange={e => setNewForm(f => ({ ...f, timing: e.target.value }))} placeholder="e.g. 9 PM - 11 PM" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Timezone</Label>
                <Input value={newForm.time_zone} onChange={e => setNewForm(f => ({ ...f, time_zone: e.target.value }))} placeholder="e.g. IST" className="mt-1" />
              </div>
            </div>
            {/* Flat pricing for new program */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <DollarSign size={11} /> Pricing
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'AED', base: 'price_aed', offer: 'offer_price_aed' },
                  { label: 'INR', base: 'price_inr', offer: 'offer_price_inr' },
                  { label: 'USD', base: 'price_usd', offer: 'offer_price_usd' },
                ].map(({ label, base, offer }) => (
                  <div key={label}>
                    <p className="text-[10px] text-gray-500 mb-1">{label} Base / Offer</p>
                    <div className="flex gap-1.5">
                      <NumCell value={newForm[base]} onChange={v => setNewForm(f => ({ ...f, [base]: v }))} />
                      <NumCell value={newForm[offer]} onChange={v => setNewForm(f => ({ ...f, [offer]: v }))} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <Label className="text-xs">Offer Label</Label>
                <Input value={newForm.offer_text} onChange={e => setNewForm(f => ({ ...f, offer_text: e.target.value }))} placeholder="e.g. Early Bird" className="mt-1 max-w-xs" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={onCreateNew} disabled={creatingNew} className="bg-purple-600 hover:bg-purple-700">
                <Save size={14} className="mr-1" /> Create Program
              </Button>
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Blueprint Immersion Programs */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <h3 className="text-sm font-bold text-purple-800">
            Blueprint Immersion Programs ({blueprintPrograms.length})
          </h3>
        </div>
        {blueprintPrograms.length === 0 ? (
          <div className="border border-dashed border-purple-200 rounded-xl p-8 text-center">
            <Package size={28} className="mx-auto text-purple-200 mb-2" />
            <p className="text-sm text-gray-400">No programs tagged yet.</p>
            <p className="text-xs text-gray-400 mt-1">Toggle <strong>Blueprint Immersion</strong> on any program below, or create a new one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {blueprintPrograms.map((p) => {
              const realIdx = programs.findIndex(x => x.id === p.id);
              return (
                <ProgramRow
                  key={p.id}
                  p={p}
                  serverRow={serverCache.find(s => s.id === p.id)}
                  idx={realIdx}
                  onChange={onChange}
                  onToggleBlueprint={onToggleBlueprint}
                  onSave={onSave}
                  saving={savingIdx === realIdx}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* All Other Programs (collapsed by default) */}
      <div>
        <button
          type="button"
          onClick={() => setShowAll(v => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          {showAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          All Other Programs ({otherPrograms.length}) — toggle Blueprint Immersion to add
        </button>
        {showAll && (
          <div className="mt-3 space-y-2">
            {otherPrograms.map((p) => {
              const realIdx = programs.findIndex(x => x.id === p.id);
              return (
                <ProgramRow
                  key={p.id}
                  p={p}
                  serverRow={serverCache.find(s => s.id === p.id)}
                  idx={realIdx}
                  onChange={onChange}
                  onToggleBlueprint={onToggleBlueprint}
                  onSave={onSave}
                  saving={savingIdx === realIdx}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlueprintProgramsTab;
