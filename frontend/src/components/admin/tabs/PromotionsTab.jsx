import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Button } from '../../ui/button';
import { useToast } from '../../../hooks/use-toast';
import {
  Plus, X, Edit, Trash2, Save, Tag, Percent, Clock, Zap, Gift,
  Calendar, Users, Check
} from 'lucide-react';
import { formatDateDdMonYyyy } from '../../../lib/utils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TYPE_OPTIONS = [
  { value: 'coupon', label: 'Coupon Code', icon: Tag, desc: 'User enters a code at checkout' },
  { value: 'early_bird', label: 'Early Bird', icon: Clock, desc: 'Auto-applied before a deadline' },
  { value: 'limited_time', label: 'Limited Time Offer', icon: Zap, desc: 'Time-bound discount with countdown' },
];

const PromotionsTab = ({ programs }) => {
  const { toast } = useToast();
  const [promotions, setPromotions] = useState([]);
  const [checkoutPromoVisible, setCheckoutPromoVisible] = useState(true);
  const [checkoutPromoLoaded, setCheckoutPromoLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', code: '', type: 'coupon', discount_type: 'percentage',
    discount_percentage: 0, discount_aed: 0, discount_inr: 0, discount_usd: 0,
    applicable_to: 'all', applicable_program_ids: [], applicable_tier_indices_by_program: {},
    fixed_per_participant: true,
    usage_limit: 0, start_date: '', expiry_date: '', active: true,
  });

  useEffect(() => { loadPromotions(); }, []);

  useEffect(() => {
    axios
      .get(`${API}/settings`)
      .then((r) => {
        setCheckoutPromoVisible(r.data?.checkout_promo_code_visible !== false);
        setCheckoutPromoLoaded(true);
      })
      .catch(() => setCheckoutPromoLoaded(true));
  }, []);

  const persistCheckoutPromoVisible = async (v) => {
    const prev = checkoutPromoVisible;
    setCheckoutPromoVisible(v);
    try {
      await axios.put(`${API}/settings`, { checkout_promo_code_visible: v });
      toast({
        title: v ? 'Promo code field is now visible' : 'Promo code field is hidden',
        description: 'On cart and program enrollment.',
      });
    } catch {
      setCheckoutPromoVisible(prev);
      toast({ title: 'Could not save setting', variant: 'destructive' });
    }
  };

  const loadPromotions = async () => {
    try {
      const res = await axios.get(`${API}/promotions`);
      setPromotions(res.data);
    } catch (e) { console.error(e); }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({
      name: '', code: '', type: 'coupon', discount_type: 'percentage',
      discount_percentage: 0, discount_aed: 0, discount_inr: 0, discount_usd: 0,
      applicable_to: 'all', applicable_program_ids: [], applicable_tier_indices_by_program: {},
      fixed_per_participant: true,
      usage_limit: 0, start_date: '', expiry_date: '', active: true,
    });
  };

  const sanitizePromotionPayload = (f) => {
    const progList = programs || [];
    const allowedIds = new Set(
      f.applicable_to === 'specific'
        ? f.applicable_program_ids
        : progList.map((p) => p.id),
    );
    const raw = f.applicable_tier_indices_by_program || {};
    const next = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!allowedIds.has(k)) continue;
      if (!Array.isArray(v) || v.length === 0) continue;
      const prog = progList.find((p) => p.id === k);
      const n = (prog?.duration_tiers || []).length;
      const sorted = [...new Set(v.map((x) => parseInt(x, 10)).filter((x) => Number.isFinite(x)))].sort(
        (a, b) => a - b,
      );
      if (sorted.length === 0) continue;
      if (n > 0 && sorted.length >= n) continue;
      next[k] = sorted;
    }
    return { ...f, applicable_tier_indices_by_program: Object.keys(next).length ? next : null };
  };

  const savePromotion = async () => {
    try {
      const payload = sanitizePromotionPayload(form);
      if (editingId) {
        await axios.put(`${API}/promotions/${editingId}`, payload);
      } else {
        await axios.post(`${API}/promotions`, payload);
      }
      resetForm();
      loadPromotions();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error saving promotion');
    }
  };

  const editPromotion = (p) => {
    setEditingId(p.id);
    const tpm = p.applicable_tier_indices_by_program;
    setForm({
      name: p.name || '', code: p.code || '', type: p.type || 'coupon',
      discount_type: p.discount_type || 'percentage',
      discount_percentage: p.discount_percentage || 0,
      discount_aed: p.discount_aed || 0, discount_inr: p.discount_inr || 0, discount_usd: p.discount_usd || 0,
      applicable_to: p.applicable_to || 'all',
      applicable_program_ids: p.applicable_program_ids || [],
      applicable_tier_indices_by_program: tpm && typeof tpm === 'object' ? { ...tpm } : {},
      fixed_per_participant: !!p.fixed_per_participant,
      usage_limit: p.usage_limit || 0,
      start_date: p.start_date || '', expiry_date: p.expiry_date || '',
      active: p.active !== false,
    });
    setShowForm(true);
  };

  const deletePromotion = async (id) => {
    if (!window.confirm('Delete this promotion?')) return;
    await axios.delete(`${API}/promotions/${id}`);
    loadPromotions();
  };

  const toggleProgram = (progId) => {
    const ids = [...form.applicable_program_ids];
    const idx = ids.indexOf(progId);
    const nextTier = { ...(form.applicable_tier_indices_by_program || {}) };
    if (idx >= 0) {
      ids.splice(idx, 1);
      delete nextTier[progId];
    } else ids.push(progId);
    setForm({ ...form, applicable_program_ids: ids, applicable_tier_indices_by_program: nextTier });
  };

  const tierCheckboxChecked = (progId, tierIdx, numTiers) => {
    const cur = form.applicable_tier_indices_by_program || {};
    if (!cur[progId] || cur[progId].length === 0) return true;
    return cur[progId].includes(tierIdx);
  };

  const toggleTierForProgram = (progId, tierIdx, numTiers, checked) => {
    const full = Array.from({ length: numTiers }, (_, i) => i);
    const cur = form.applicable_tier_indices_by_program || {};
    const selected = new Set(
      !cur[progId] || cur[progId].length === 0 ? full : cur[progId],
    );
    if (checked) selected.add(tierIdx);
    else {
      if (selected.size <= 1) return;
      selected.delete(tierIdx);
    }
    const nextMap = { ...cur };
    if (selected.size === 0 || selected.size >= numTiers) delete nextMap[progId];
    else nextMap[progId] = [...selected].sort((a, b) => a - b);
    setForm({ ...form, applicable_tier_indices_by_program: nextMap });
  };

  const typeInfo = TYPE_OPTIONS.find(t => t.value === form.type) || TYPE_OPTIONS[0];

  return (
    <div data-testid="promotions-tab">
      <div className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50/80 p-4 shadow-sm" data-testid="promotions-checkout-promo-banner">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-gray-900">Website: show “Promo code” box</p>
            <p className="text-xs text-gray-600 mt-1 max-w-xl">
              Controls the promo field on the <strong>cart</strong> and <strong>program enrollment</strong> pages. Saves immediately when you flip the switch.
              Enrollment links with <code className="text-[10px] bg-white/80 px-1 rounded border">?promo=</code> still work when this is off.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-600">{checkoutPromoVisible ? 'On' : 'Off'}</span>
            <Switch
              data-testid="promotions-checkout-promo-switch"
              checked={checkoutPromoVisible}
              onCheckedChange={persistCheckoutPromoVisible}
              disabled={!checkoutPromoLoaded}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Promotions & Coupons</h2>
          <p className="text-xs text-gray-400">Create coupon codes, early bird offers, and limited time discounts</p>
        </div>
        <Button data-testid="add-promotion-btn" onClick={() => { resetForm(); setShowForm(true); }} className="bg-[#D4AF37] hover:bg-[#b8962e]">
          <Plus size={16} className="mr-1" /> New Promotion
        </Button>
      </div>

      {showForm && (
        <div data-testid="promotion-form" className="bg-white rounded-lg p-6 mb-6 shadow-sm border">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-medium text-gray-900">{editingId ? 'Edit Promotion' : 'Create Promotion'}</h3>
            <button onClick={resetForm}><X size={18} /></button>
          </div>

          {/* Name */}
          <div className="mb-4">
            <Label className="text-xs text-gray-500">Promotion Name (internal, for your reference)</Label>
            <Input data-testid="promo-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., New Year Sale 20%" />
          </div>

          {/* Type Selector */}
          <div className="mb-5">
            <Label className="text-xs text-gray-500 mb-2 block">Promotion Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setForm({ ...form, type: opt.value })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    form.type === opt.value ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <opt.icon size={18} className={form.type === opt.value ? 'text-[#D4AF37]' : 'text-gray-400'} />
                  <p className="text-xs font-semibold mt-1">{opt.label}</p>
                  <p className="text-[10px] text-gray-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Coupon Code (only for coupons) */}
          {form.type === 'coupon' && (
            <div className="mb-4">
              <Label className="text-xs text-gray-500">Coupon Code (what user types at checkout)</Label>
              <Input data-testid="promo-code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g., EARLY20, NEWYEAR" className="font-mono uppercase" />
            </div>
          )}

          {/* Discount Type */}
          <div className="mb-4">
            <Label className="text-xs text-gray-500 mb-2 block">Discount Type</Label>
            <div className="flex gap-2">
              <button onClick={() => setForm({ ...form, discount_type: 'percentage', fixed_per_participant: false })}
                className={`flex-1 py-3 rounded-lg border-2 text-center text-sm transition-all ${
                  form.discount_type === 'percentage' ? 'border-[#D4AF37] bg-[#D4AF37]/5 font-semibold text-[#D4AF37]' : 'border-gray-200 text-gray-500'
                }`}>
                <Percent size={16} className="inline mr-1" /> Percentage (%)
              </button>
              <button onClick={() => setForm({ ...form, discount_type: 'fixed', fixed_per_participant: true })}
                className={`flex-1 py-3 rounded-lg border-2 text-center text-sm transition-all ${
                  form.discount_type === 'fixed' ? 'border-[#D4AF37] bg-[#D4AF37]/5 font-semibold text-[#D4AF37]' : 'border-gray-200 text-gray-500'
                }`}>
                <Tag size={16} className="inline mr-1" /> Fixed Amount
              </button>
            </div>
          </div>

          {/* Discount Value */}
          {form.discount_type === 'percentage' ? (
            <div className="mb-4">
              <Label className="text-xs text-gray-500">Discount Percentage (%)</Label>
              <Input data-testid="promo-percentage" type="number" min="0" max="100" value={form.discount_percentage}
                onChange={e => setForm({ ...form, discount_percentage: parseFloat(e.target.value) || 0 })} placeholder="e.g., 20" />
              <p className="text-[10px] text-gray-400 mt-1">Same % discount will apply to all currencies (AED, INR, USD)</p>
            </div>
          ) : (
            <div className="mb-4">
              <Label className="text-xs text-gray-500 mb-2 block">Fixed Discount Amount (per currency)</Label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px] text-gray-400">AED (Base)</Label>
                  <Input type="number" value={form.discount_aed} onChange={e => setForm({ ...form, discount_aed: parseFloat(e.target.value) || 0 })} placeholder="AED" />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-400">INR</Label>
                  <Input type="number" value={form.discount_inr} onChange={e => setForm({ ...form, discount_inr: parseFloat(e.target.value) || 0 })} placeholder="INR" />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-400">USD</Label>
                  <Input type="number" value={form.discount_usd} onChange={e => setForm({ ...form, discount_usd: parseFloat(e.target.value) || 0 })} placeholder="USD" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Switch
                  checked={!!form.fixed_per_participant}
                  onCheckedChange={(v) => setForm({ ...form, fixed_per_participant: v })}
                />
                <Label className="text-xs text-gray-600">Amount is per participant (multiplied by headcount in cart / enrollment)</Label>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Turn off for a single flat discount on the whole order.</p>
            </div>
          )}

          {/* Applicability */}
          <div className="mb-4">
            <Label className="text-xs text-gray-500 mb-2 block">Applies To</Label>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setForm({ ...form, applicable_to: 'all', applicable_tier_indices_by_program: {} })}
                className={`px-4 py-2 rounded-lg border-2 text-xs transition-all ${
                  form.applicable_to === 'all' ? 'border-[#D4AF37] bg-[#D4AF37]/5 font-semibold text-[#D4AF37]' : 'border-gray-200 text-gray-500'
                }`}>All Programs</button>
              <button onClick={() => setForm({ ...form, applicable_to: 'specific' })}
                className={`px-4 py-2 rounded-lg border-2 text-xs transition-all ${
                  form.applicable_to === 'specific' ? 'border-[#D4AF37] bg-[#D4AF37]/5 font-semibold text-[#D4AF37]' : 'border-gray-200 text-gray-500'
                }`}>Specific Programs</button>
            </div>
            {form.applicable_to === 'specific' && (
              <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
                {programs.map(p => {
                  const tiers = p.duration_tiers || [];
                  const tiered = tiers.length > 0 && !!p.is_flagship;
                  const selectedProg = form.applicable_program_ids.includes(p.id);
                  return (
                    <div key={p.id} className="rounded-md border border-gray-100 bg-white/70 px-2 py-1.5">
                      <label className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-1">
                        <input type="checkbox" checked={selectedProg} onChange={() => toggleProgram(p.id)}
                          className="w-4 h-4 rounded border-gray-300 text-[#D4AF37] focus:ring-[#D4AF37]" />
                        <span className="text-xs text-gray-700">{p.title}</span>
                      </label>
                      {selectedProg && tiered && (
                        <div className="pl-7 mt-1 pb-1 space-y-1 border-t border-gray-100 pt-2">
                          <p className="text-[10px] text-gray-500">
                            Limit which duration tiers this code applies to (at least one tier must stay selected).
                            When all tiers are checked, the coupon is valid for any tier.
                          </p>
                          {tiers.map((t, ti) => (
                            <label key={ti} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={tierCheckboxChecked(p.id, ti, tiers.length)}
                                onChange={(e) => toggleTierForProgram(p.id, ti, tiers.length, e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-[#D4AF37] focus:ring-[#D4AF37]"
                              />
                              <span className="text-[11px] text-gray-600">{t.label || `Tier ${ti + 1}`}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dates & Limits */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <Label className="text-xs text-gray-500">Start Date</Label>
              <Input type="datetime-local" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Expiry Date</Label>
              <Input type="datetime-local" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Usage Limit (0 = unlimited)</Label>
              <Input type="number" min="0" value={form.usage_limit} onChange={e => setForm({ ...form, usage_limit: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
            <Label className="text-xs text-gray-600">Active (users can use this promotion)</Label>
          </div>

          <div className="flex gap-2">
            <Button data-testid="save-promotion-btn" onClick={savePromotion} className="bg-[#D4AF37] hover:bg-[#b8962e]"><Save size={14} className="mr-1" /> Save</Button>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Promotions List */}
      <div className="space-y-3">
        {promotions.length === 0 && <p className="text-center text-gray-400 py-8">No promotions created yet</p>}
        {promotions.map(p => {
          const typeOpt = TYPE_OPTIONS.find(t => t.value === p.type) || TYPE_OPTIONS[0];
          const isExpired = p.expiry_date && new Date(p.expiry_date) < new Date();
          return (
            <div key={p.id} data-testid={`promo-row-${p.id}`}
              className={`bg-white rounded-lg p-4 shadow-sm border flex items-center gap-4 ${!p.active || isExpired ? 'opacity-50' : ''}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                p.type === 'coupon' ? 'bg-blue-50' : p.type === 'early_bird' ? 'bg-amber-50' : 'bg-red-50'
              }`}>
                <typeOpt.icon size={18} className={
                  p.type === 'coupon' ? 'text-blue-500' : p.type === 'early_bird' ? 'text-amber-500' : 'text-red-500'
                } />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-gray-900">{p.name}</p>
                  {p.code && <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{p.code}</span>}
                  {isExpired && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded">Expired</span>}
                  {!p.active && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Inactive</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {p.discount_type === 'percentage'
                    ? `${p.discount_percentage}% off`
                    : `AED ${p.discount_aed} / INR ${p.discount_inr} / USD ${p.discount_usd} off${
                        p.fixed_per_participant ? ' (× participants)' : ''
                      }`
                  }
                  {' · '}{p.applicable_to === 'all' ? 'All programs' : `${(p.applicable_program_ids || []).length} programs`}
                  {p.applicable_tier_indices_by_program && Object.keys(p.applicable_tier_indices_by_program).length > 0
                    ? ' · tier-specific'
                    : ''}
                  {p.usage_limit > 0 && ` · ${p.used_count || 0}/${p.usage_limit} used`}
                  {p.expiry_date &&
                    ` · Expires ${formatDateDdMonYyyy(String(p.expiry_date).slice(0, 10)) || p.expiry_date}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => editPromotion(p)} className="p-1.5 rounded hover:bg-gray-100"><Edit size={16} className="text-blue-600" /></button>
                <button onClick={() => deletePromotion(p.id)} className="p-1.5 rounded hover:bg-gray-100"><Trash2 size={16} className="text-red-500" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PromotionsTab;
