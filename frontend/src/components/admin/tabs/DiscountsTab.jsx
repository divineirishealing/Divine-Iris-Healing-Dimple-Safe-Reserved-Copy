import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { useToast } from '../../../hooks/use-toast';
import { Plus, Trash2, Users, ShoppingCart, Heart, UserPlus, Save, Gift } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DiscountsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [settings, setSettings] = useState({
    enable_referral: true,
    enable_group_discount: false,
    group_discount_rules: [],
    enable_combo_discount: false,
    combo_discount_pct: 0,
    combo_min_programs: 2,
    combo_rules: [],
    enable_loyalty: false,
    loyalty_discount_pct: 0,
    cross_sell_rules: [],
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const [dRes, pRes] = await Promise.all([
        axios.get(`${API}/discounts/settings`),
        axios.get(`${API}/programs`),
      ]);
      setSettings(dRes.data);
      setPrograms(pRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, settings);
      toast({ title: 'Discount settings saved!' });
    } catch (e) {
      toast({ title: 'Error saving', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const addGroupRule = () => {
    setSettings(prev => ({
      ...prev,
      group_discount_rules: [...prev.group_discount_rules, { min_participants: 3, discount_pct: 10 }]
    }));
  };

  const updateGroupRule = (idx, field, value) => {
    const rules = [...settings.group_discount_rules];
    rules[idx] = { ...rules[idx], [field]: parseFloat(value) || 0 };
    setSettings(prev => ({ ...prev, group_discount_rules: rules }));
  };

  const removeGroupRule = (idx) => {
    setSettings(prev => ({
      ...prev,
      group_discount_rules: prev.group_discount_rules.filter((_, i) => i !== idx)
    }));
  };

  if (loading) return <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="discounts-tab">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Discounts & Loyalty</h2>
          <p className="text-xs text-gray-500">Global settings for all flagship programs. Toggle features on/off as needed.</p>
        </div>
        <Button onClick={saveSettings} disabled={saving} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white" data-testid="save-discounts-btn">
          <Save size={14} className="mr-1.5" /> {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Referral Toggle */}
      <div className="bg-white rounded-lg border p-5" data-testid="referral-section">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
              <UserPlus size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Referral Program</p>
              <p className="text-[10px] text-gray-500">Show "Referred by" field during enrollment</p>
            </div>
          </div>
          <Switch checked={settings.enable_referral} onCheckedChange={v => setSettings(prev => ({ ...prev, enable_referral: v }))} data-testid="toggle-referral" />
        </div>
        {settings.enable_referral && (
          <p className="text-[10px] text-green-600 bg-green-50 rounded px-3 py-1.5 mt-2">
            Participants will see a "Referred by a Divine Iris member" toggle + name field during enrollment.
          </p>
        )}
      </div>

      {/* Group Discount */}
      <div className="bg-white rounded-lg border p-5" data-testid="group-discount-section">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Group Discount</p>
              <p className="text-[10px] text-gray-500">Auto-discount when enrolling multiple participants</p>
            </div>
          </div>
          <Switch checked={settings.enable_group_discount} onCheckedChange={v => setSettings(prev => ({ ...prev, enable_group_discount: v }))} data-testid="toggle-group-discount" />
        </div>
        {settings.enable_group_discount && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-500">Discount tiers</Label>
              <Button size="sm" variant="outline" onClick={addGroupRule} className="text-xs h-7" data-testid="add-group-rule">
                <Plus size={12} className="mr-1" /> Add Rule
              </Button>
            </div>
            {settings.group_discount_rules.length === 0 && (
              <p className="text-[10px] text-gray-400 italic">No rules yet. Add a rule like "3+ participants = 10% off".</p>
            )}
            {settings.group_discount_rules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2" data-testid={`group-rule-${i}`}>
                <span className="text-xs text-gray-500 whitespace-nowrap">If</span>
                <Input type="number" value={rule.min_participants} onChange={e => updateGroupRule(i, 'min_participants', e.target.value)}
                  className="w-16 h-7 text-xs text-center" min={2} />
                <span className="text-xs text-gray-500 whitespace-nowrap">or more participants →</span>
                <Input type="number" value={rule.discount_pct} onChange={e => updateGroupRule(i, 'discount_pct', e.target.value)}
                  className="w-16 h-7 text-xs text-center" min={0} max={50} />
                <span className="text-xs text-gray-500">% off</span>
                <button onClick={() => removeGroupRule(i)} className="text-red-400 hover:text-red-600 ml-auto"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Combo Discount — Tiered Rules */}
      <div className="bg-white rounded-lg border p-5" data-testid="combo-discount-section">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
              <ShoppingCart size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Combo Discount</p>
              <p className="text-[10px] text-gray-500">Tiered discounts when multiple programs are in the cart. Each rule gets a tracking code.</p>
            </div>
          </div>
          <Switch checked={settings.enable_combo_discount} onCheckedChange={v => setSettings(prev => ({ ...prev, enable_combo_discount: v }))} data-testid="toggle-combo-discount" />
        </div>
        {settings.enable_combo_discount && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-500">Combo tiers (e.g. 2 programs = 10%, 3 programs = 15%)</Label>
              <Button size="sm" variant="outline" onClick={() => setSettings(prev => ({
                ...prev,
                combo_rules: [...(prev.combo_rules || []), { min_programs: 2, discount_pct: 10, code: `COMBO${(prev.combo_rules?.length || 0) + 2}`, label: '' }]
              }))} className="text-xs h-7" data-testid="add-combo-rule">
                <Plus size={12} className="mr-1" /> Add Rule
              </Button>
            </div>
            {(!settings.combo_rules || settings.combo_rules.length === 0) && (
              <p className="text-[10px] text-gray-400 italic">No combo rules yet. Add a rule like "2+ programs = 10% off (code: COMBO2)".</p>
            )}
            {(settings.combo_rules || []).map((rule, i) => (
              <div key={i} className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200" data-testid={`combo-rule-${i}`}>
                <span className="text-xs text-gray-500 whitespace-nowrap">If</span>
                <Input type="number" value={rule.min_programs} onChange={e => {
                  const rules = [...(settings.combo_rules || [])];
                  rules[i] = { ...rules[i], min_programs: parseInt(e.target.value) || 2 };
                  setSettings(prev => ({ ...prev, combo_rules: rules }));
                }} className="w-12 h-7 text-xs text-center" min={2} />
                <span className="text-xs text-gray-500 whitespace-nowrap">+ programs →</span>
                <Input type="number" value={rule.discount_pct} onChange={e => {
                  const rules = [...(settings.combo_rules || [])];
                  rules[i] = { ...rules[i], discount_pct: parseFloat(e.target.value) || 0 };
                  setSettings(prev => ({ ...prev, combo_rules: rules }));
                }} className="w-14 h-7 text-xs text-center" min={0} max={50} />
                <span className="text-xs text-gray-500">%</span>
                <span className="text-[9px] text-gray-400 mx-1">code:</span>
                <Input value={rule.code || ''} onChange={e => {
                  const rules = [...(settings.combo_rules || [])];
                  rules[i] = { ...rules[i], code: e.target.value.toUpperCase() };
                  setSettings(prev => ({ ...prev, combo_rules: rules }));
                }} className="w-24 h-7 text-xs font-mono bg-white" placeholder="COMBO2" />
                <span className="text-[9px] text-gray-400 mx-1">label:</span>
                <Input value={rule.label || ''} onChange={e => {
                  const rules = [...(settings.combo_rules || [])];
                  rules[i] = { ...rules[i], label: e.target.value };
                  setSettings(prev => ({ ...prev, combo_rules: rules }));
                }} className="w-32 h-7 text-xs" placeholder="Combo Package" />
                <button onClick={() => {
                  setSettings(prev => ({ ...prev, combo_rules: (prev.combo_rules || []).filter((_, j) => j !== i) }));
                }} className="text-red-400 hover:text-red-600 ml-auto"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loyalty Program */}
      <div className="bg-white rounded-lg border p-5" data-testid="loyalty-section">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-rose-100 rounded-lg flex items-center justify-center">
              <Heart size={18} className="text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Loyalty Program</p>
              <p className="text-[10px] text-gray-500">Auto-discount for returning clients who have an existing UID</p>
            </div>
          </div>
          <Switch checked={settings.enable_loyalty} onCheckedChange={v => setSettings(prev => ({ ...prev, enable_loyalty: v }))} data-testid="toggle-loyalty" />
        </div>
        {settings.enable_loyalty && (
          <div className="mt-3 flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Returning clients get</span>
            <Input type="number" value={settings.loyalty_discount_pct} onChange={e => setSettings(prev => ({ ...prev, loyalty_discount_pct: parseFloat(e.target.value) || 0 }))}
              className="w-16 h-7 text-xs text-center" min={0} max={50} />
            <span className="text-xs text-gray-500">% off their next enrollment</span>
          </div>
        )}
      </div>

      {/* Cross-Sell Program Discounts */}
      <div className="bg-white rounded-lg border p-5" data-testid="cross-sell-section">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <Gift size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Program Cross-Sell Discounts</p>
              <p className="text-[10px] text-gray-500">Buy Program A → Get discount on Program B (% or fixed amount)</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSettings(prev => ({
            ...prev,
            cross_sell_rules: [...(prev.cross_sell_rules || []), {
              buy_program_id: '', get_program_id: '', discount_type: 'percentage', discount_value: 10,
              code: `XSELL${(prev.cross_sell_rules?.length || 0) + 1}`, label: '', enabled: true,
            }]
          }))} className="text-xs h-7" data-testid="add-cross-sell-rule">
            <Plus size={12} className="mr-1" /> Add Rule
          </Button>
        </div>
        {(!settings.cross_sell_rules || settings.cross_sell_rules.length === 0) && (
          <p className="text-[10px] text-gray-400 italic mt-2">No cross-sell rules. Add one like "Buy AWRP → Get 15% off Quad Layer Healing".</p>
        )}
        <div className="mt-3 space-y-2">
          {(settings.cross_sell_rules || []).map((rule, i) => {
            const updateRule = (field, value) => {
              const rules = [...(settings.cross_sell_rules || [])];
              rules[i] = { ...rules[i], [field]: value };
              setSettings(prev => ({ ...prev, cross_sell_rules: rules }));
            };
            return (
              <div key={i} className={`rounded-lg px-3 py-2.5 border ${rule.enabled !== false ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-60'}`} data-testid={`cross-sell-rule-${i}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Switch checked={rule.enabled !== false} onCheckedChange={v => updateRule('enabled', v)} />
                  <span className="text-xs text-gray-600 whitespace-nowrap">Buy</span>
                  <select value={rule.buy_program_id || ''} onChange={e => { updateRule('buy_program_id', e.target.value); updateRule('buy_tier', ''); }}
                    className="border rounded px-2 py-1 text-xs bg-white h-7 min-w-[120px]">
                    <option value="">Select program</option>
                    {programs.filter(p => p.title).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                  {(() => {
                    const buyProg = programs.find(p => String(p.id) === String(rule.buy_program_id));
                    const buyTiers = buyProg?.duration_tiers || [];
                    return buyTiers.length > 0 ? (
                      <select value={rule.buy_tier ?? ''} onChange={e => updateRule('buy_tier', e.target.value)}
                        className="border rounded px-1 py-1 text-[10px] bg-amber-50 h-7 min-w-[80px]">
                        <option value="">Any tier</option>
                        {buyTiers.map((t, ti) => <option key={ti} value={ti}>{t.label}</option>)}
                      </select>
                    ) : null;
                  })()}
                  <span className="text-xs text-gray-600">→ Get</span>
                  <Input type="number" value={rule.discount_value || 0} onChange={e => updateRule('discount_value', parseFloat(e.target.value) || 0)}
                    className="w-14 h-7 text-xs text-center" min={0} />
                  <select value={rule.discount_type || 'percentage'} onChange={e => updateRule('discount_type', e.target.value)}
                    className="border rounded px-1 py-1 text-xs bg-white h-7">
                    <option value="percentage">%</option>
                    <option value="fixed">Fixed</option>
                  </select>
                  <span className="text-xs text-gray-600">off</span>
                  <select value={rule.get_program_id || ''} onChange={e => { updateRule('get_program_id', e.target.value); updateRule('get_tier', ''); }}
                    className="border rounded px-2 py-1 text-xs bg-white h-7 min-w-[120px]">
                    <option value="">Select program</option>
                    {programs.filter(p => p.title).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                  {(() => {
                    const getProg = programs.find(p => String(p.id) === String(rule.get_program_id));
                    const getTiers = getProg?.duration_tiers || [];
                    return getTiers.length > 0 ? (
                      <select value={rule.get_tier ?? ''} onChange={e => updateRule('get_tier', e.target.value)}
                        className="border rounded px-1 py-1 text-[10px] bg-green-50 h-7 min-w-[80px]">
                        <option value="">Any tier</option>
                        {getTiers.map((t, ti) => <option key={ti} value={ti}>{t.label}</option>)}
                      </select>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[9px] text-gray-400">Code:</span>
                  <Input value={rule.code || ''} onChange={e => updateRule('code', e.target.value.toUpperCase())}
                    className="w-24 h-6 text-[10px] font-mono" placeholder="XSELL1" />
                  <span className="text-[9px] text-gray-400">Label:</span>
                  <Input value={rule.label || ''} onChange={e => updateRule('label', e.target.value)}
                    className="w-40 h-6 text-[10px]" placeholder="e.g. AWRP 1M + 3M Bundle" />
                  {/* Live preview */}
                  {rule.buy_program_id && rule.get_program_id && rule.discount_value > 0 && (() => {
                    const bp = programs.find(p => String(p.id) === String(rule.buy_program_id));
                    const gp = programs.find(p => String(p.id) === String(rule.get_program_id));
                    const bLabel = bp ? (rule.buy_tier !== '' && rule.buy_tier !== undefined ? `${bp.title} (${bp.duration_tiers?.[rule.buy_tier]?.label || ''})` : bp.title) : '?';
                    const gLabel = gp ? (rule.get_tier !== '' && rule.get_tier !== undefined ? `${gp.title} (${gp.duration_tiers?.[rule.get_tier]?.label || ''})` : gp.title) : '?';
                    return (
                      <span className="text-[8px] text-green-600 bg-green-50 px-2 py-0.5 rounded ml-2">
                        Buy {bLabel} → {rule.discount_value}{rule.discount_type === 'percentage' ? '%' : ' AED'} off {gLabel}
                      </span>
                    );
                  })()}
                  <button onClick={() => setSettings(prev => ({ ...prev, cross_sell_rules: (prev.cross_sell_rules || []).filter((_, j) => j !== i) }))}
                    className="text-red-400 hover:text-red-600 ml-auto"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Profit Impact Calculator */}
      <div className="bg-gray-900 rounded-lg p-5 text-white" data-testid="profit-calculator">
        <p className="text-xs font-semibold text-[#D4AF37] mb-1 tracking-wider">LIVE PROFIT IMPACT</p>
        <p className="text-[9px] text-gray-500 mb-4">See how discounts affect your revenue per enrollment (AED)</p>

        {/* Per-program breakdown */}
        <div className="space-y-3 mb-4">
          {programs.filter(p => p.title && (p.is_upcoming || p.is_flagship)).map(p => {
            const tiers = p.duration_tiers || [];
            const rows = tiers.length > 0
              ? tiers.filter(t => t.price_aed > 0).map(t => ({ label: `${p.title} (${t.label})`, price: t.price_aed, offer: t.offer_price_aed || 0 }))
              : p.price_aed > 0 ? [{ label: p.title, price: p.price_aed, offer: p.offer_price_aed || 0 }] : [];
            if (rows.length === 0) return null;

            return rows.map((row, ri) => {
              const base = row.offer > 0 ? row.offer : row.price;
              // Combo: best matching rule
              const comboRules = settings.combo_rules || [];
              const bestCombo = comboRules.length > 0 ? comboRules.sort((a, b) => b.min_programs - a.min_programs)[0] : null;
              const comboPct = settings.enable_combo_discount && bestCombo ? bestCombo.discount_pct : 0;
              const comboAmt = Math.round(base * comboPct / 100);
              // Group: best matching rule
              const groupRules = settings.group_discount_rules || [];
              const bestGroup = groupRules.length > 0 ? groupRules.sort((a, b) => b.min_participants - a.min_participants)[0] : null;
              const groupPct = settings.enable_group_discount && bestGroup ? bestGroup.discount_pct : 0;
              const groupAmt = Math.round(base * groupPct / 100);
              // Loyalty
              const loyaltyPct = settings.enable_loyalty ? (settings.loyalty_discount_pct || 0) : 0;
              const loyaltyAmt = Math.round(base * loyaltyPct / 100);
              // Cross-sell
              let crossAmt = 0;
              (settings.cross_sell_rules || []).filter(r => r.enabled !== false).forEach(r => {
                if (String(r.get_program_id) === String(p.id) && r.discount_type === 'percentage') {
                  crossAmt += Math.round(base * (r.discount_value || 0) / 100);
                } else if (String(r.get_program_id) === String(p.id) && r.discount_type === 'fixed') {
                  crossAmt += r.discount_value || 0;
                }
              });

              const maxDiscount = comboAmt + groupAmt + loyaltyAmt + crossAmt;
              const minRevenue = Math.max(0, base - maxDiscount);
              const discountPct = base > 0 ? Math.round((maxDiscount / base) * 100) : 0;

              return (
                <div key={`${p.id}-${ri}`} className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-200 truncate max-w-[200px]">{row.label}</span>
                    <div className="flex items-center gap-2">
                      {row.offer > 0 && <span className="text-[9px] text-gray-500 line-through">AED {row.price.toLocaleString()}</span>}
                      <span className="text-sm font-bold text-[#D4AF37]">AED {base.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-[9px]">
                    {comboPct > 0 && (
                      <div className="bg-amber-900/30 rounded px-2 py-1">
                        <span className="text-amber-400 block">Combo {comboPct}%</span>
                        <span className="text-white font-mono">-{comboAmt}</span>
                      </div>
                    )}
                    {groupPct > 0 && (
                      <div className="bg-blue-900/30 rounded px-2 py-1">
                        <span className="text-blue-400 block">Group {groupPct}%</span>
                        <span className="text-white font-mono">-{groupAmt}</span>
                      </div>
                    )}
                    {loyaltyPct > 0 && (
                      <div className="bg-rose-900/30 rounded px-2 py-1">
                        <span className="text-rose-400 block">Loyalty {loyaltyPct}%</span>
                        <span className="text-white font-mono">-{loyaltyAmt}</span>
                      </div>
                    )}
                    {crossAmt > 0 && (
                      <div className="bg-green-900/30 rounded px-2 py-1">
                        <span className="text-green-400 block">Cross-Sell</span>
                        <span className="text-white font-mono">-{crossAmt}</span>
                      </div>
                    )}
                    <div className={`rounded px-2 py-1 ${discountPct > 25 ? 'bg-red-900/40' : 'bg-gray-700'}`}>
                      <span className="text-gray-400 block">You Get</span>
                      <span className={`font-bold font-mono ${discountPct > 25 ? 'text-red-400' : 'text-green-400'}`}>AED {minRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                  {discountPct > 0 && (
                    <div className="mt-1.5 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                      <div className={`h-full rounded-full ${discountPct > 25 ? 'bg-red-500' : discountPct > 15 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${100 - discountPct}%` }} />
                    </div>
                  )}
                </div>
              );
            });
          })}
        </div>

        {/* Active rules summary */}
        <div className="border-t border-gray-700 pt-3">
          <p className="text-[9px] text-gray-500 mb-2 uppercase tracking-wider">Active Rules</p>
          <div className="flex flex-wrap gap-2">
            {settings.enable_combo_discount && <span className="text-[9px] bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded">Combo ON</span>}
            {settings.enable_group_discount && <span className="text-[9px] bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded">Group ON</span>}
            {settings.enable_loyalty && <span className="text-[9px] bg-rose-900/40 text-rose-400 px-2 py-0.5 rounded">Loyalty {settings.loyalty_discount_pct}%</span>}
            {(settings.cross_sell_rules || []).filter(r => r.enabled !== false).map((r, i) => (
              <span key={i} className="text-[9px] bg-green-900/40 text-green-400 px-2 py-0.5 rounded font-mono">{r.code}</span>
            ))}
            {(settings.combo_rules || []).map((r, i) => (
              <span key={i} className="text-[9px] bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded font-mono">{r.code}: {r.discount_pct}%</span>
            ))}
            {!settings.enable_combo_discount && !settings.enable_group_discount && !settings.enable_loyalty && !(settings.cross_sell_rules || []).length && (
              <span className="text-[9px] text-gray-600">No active discounts</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
