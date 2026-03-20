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
    enable_cross_sell: false,
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
              <div key={i} className="bg-gray-50 rounded-lg px-3 py-2" data-testid={`group-rule-${i}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 whitespace-nowrap">If</span>
                  <Input type="text" inputMode="decimal" value={rule.min_participants} onChange={e => updateGroupRule(i, 'min_participants', e.target.value)}
                    className="w-16 h-7 text-xs text-center" min={2} />
                  <span className="text-xs text-gray-500 whitespace-nowrap">or more participants →</span>
                  <Input type="text" inputMode="decimal" value={rule.discount_pct} onChange={e => updateGroupRule(i, 'discount_pct', e.target.value)}
                    className="w-16 h-7 text-xs text-center" min={0} max={50} />
                  <span className="text-xs text-gray-500">% off</span>
                  <button onClick={() => removeGroupRule(i)} className="text-red-400 hover:text-red-600 ml-auto"><Trash2 size={14} /></button>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center mt-1.5">
                  <span className="text-[9px] text-gray-400">Programs:</span>
                  {programs.filter(p => p.title).map(p => {
                    const selected = (rule.program_ids || []).includes(String(p.id));
                    return (
                      <button key={p.id} onClick={() => {
                        const rules = [...settings.group_discount_rules];
                        const ids = rules[i].program_ids || [];
                        rules[i] = { ...rules[i], program_ids: selected ? ids.filter(x => x !== String(p.id)) : [...ids, String(p.id)] };
                        setSettings(prev => ({ ...prev, group_discount_rules: rules }));
                      }}
                        className={`text-[9px] px-2 py-0.5 rounded-full font-medium border transition-colors ${selected ? 'bg-blue-200 border-blue-400 text-blue-800' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300'}`}>
                        {p.title.length > 20 ? p.title.slice(0, 20) + '..' : p.title}
                      </button>
                    );
                  })}
                  {!(rule.program_ids || []).length && <span className="text-[8px] text-gray-400 italic">All programs (click to select specific ones)</span>}
                </div>
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
              <div key={i} className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200 flex-wrap" data-testid={`combo-rule-${i}`}>
                <span className="text-xs text-gray-500 whitespace-nowrap">If</span>
                <Input type="text" inputMode="decimal" value={rule.min_programs} onChange={e => {
                  const rules = [...(settings.combo_rules || [])];
                  rules[i] = { ...rules[i], min_programs: parseInt(e.target.value) || 2 };
                  setSettings(prev => ({ ...prev, combo_rules: rules }));
                }} className="w-12 h-7 text-xs text-center" min={2} />
                <span className="text-xs text-gray-500 whitespace-nowrap">+ programs →</span>
                <Input type="text" inputMode="decimal" value={rule.discount_pct} onChange={e => {
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
                {/* Program selection */}
                <div className="w-full mt-1.5 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[9px] text-gray-400">Programs:</span>
                  {programs.filter(p => p.title).map(p => {
                    const selected = (rule.program_ids || []).includes(String(p.id));
                    return (
                      <button key={p.id} onClick={() => {
                        const rules = [...(settings.combo_rules || [])];
                        const ids = rules[i].program_ids || [];
                        rules[i] = { ...rules[i], program_ids: selected ? ids.filter(x => x !== String(p.id)) : [...ids, String(p.id)] };
                        setSettings(prev => ({ ...prev, combo_rules: rules }));
                      }}
                        className={`text-[9px] px-2 py-0.5 rounded-full font-medium border transition-colors ${selected ? 'bg-amber-200 border-amber-400 text-amber-800' : 'bg-white border-gray-200 text-gray-500 hover:border-amber-300'}`}>
                        {p.title.length > 20 ? p.title.slice(0, 20) + '..' : p.title}
                      </button>
                    );
                  })}
                  {!(rule.program_ids || []).length && <span className="text-[8px] text-gray-400 italic">All programs (click to select specific ones)</span>}
                </div>
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
            <Input type="text" inputMode="decimal" value={settings.loyalty_discount_pct} onChange={e => setSettings(prev => ({ ...prev, loyalty_discount_pct: parseFloat(e.target.value) || 0 }))}
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
          <Switch checked={settings.enable_cross_sell || false} onCheckedChange={v => setSettings(prev => ({ ...prev, enable_cross_sell: v }))} data-testid="toggle-cross-sell" />
        </div>
        {settings.enable_cross_sell && (
        <>
        <div className="flex items-center justify-end mt-2">
          <Button size="sm" variant="outline" onClick={() => setSettings(prev => ({
            ...prev,
            cross_sell_rules: [...(prev.cross_sell_rules || []), {
              buy_program_id: '', get_program_id: '', discount_type: 'percentage', discount_value: 10,
              code: `XSELL${(prev.cross_sell_rules?.length || 0) + 1}`, label: '', enabled: true, targets: [],
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
              setSettings(prev => {
                const rules = [...(prev.cross_sell_rules || [])];
                rules[i] = { ...rules[i], [field]: value };
                return { ...prev, cross_sell_rules: rules };
              });
            };
            return (
              <div key={i} className={`rounded-lg px-3 py-2.5 border ${rule.enabled !== false ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-60'}`} data-testid={`cross-sell-rule-${i}`}>
                {/* Buy program */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Switch checked={rule.enabled !== false} onCheckedChange={v => updateRule('enabled', v)} />
                  <span className="text-xs text-gray-600 font-semibold">Buy</span>
                  <select value={rule.buy_program_id || ''} onChange={e => { updateRule('buy_program_id', e.target.value); updateRule('buy_tier', ''); }}
                    className="border rounded px-2 py-1 text-xs bg-white h-7 min-w-[140px]">
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
                  <span className="text-[9px] text-gray-400 ml-1">Code:</span>
                  <Input value={rule.code || ''} onChange={e => updateRule('code', e.target.value.toUpperCase())}
                    className="w-20 h-7 text-[10px] font-mono" placeholder="XSELL1" />
                  <span className="text-[9px] text-gray-400">Label:</span>
                  <Input value={rule.label || ''} onChange={e => updateRule('label', e.target.value)}
                    className="w-36 h-7 text-[10px]" placeholder="Bundle name" />
                  <button onClick={() => setSettings(prev => ({ ...prev, cross_sell_rules: (prev.cross_sell_rules || []).filter((_, j) => j !== i) }))}
                    className="text-red-400 hover:text-red-600 ml-auto"><Trash2 size={14} /></button>
                </div>

                {/* Target programs — multiple */}
                <div className="ml-8 space-y-1.5">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">Get discount on:</p>
                  {(() => {
                    // Migrate legacy single-target to targets array
                    const targets = rule.targets || (rule.get_program_id ? [{ program_id: rule.get_program_id, tier: rule.get_tier, discount_value: rule.discount_value, discount_type: rule.discount_type }] : []);
                    return targets.map((target, ti) => {
                      const updateTarget = (field, value) => {
                        setSettings(prev => {
                          const rules = [...(prev.cross_sell_rules || [])];
                          const curRule = rules[i] || {};
                          const curTargets = [...(curRule.targets || targets)];
                          curTargets[ti] = { ...curTargets[ti], [field]: value };
                          rules[i] = { ...curRule, targets: curTargets, get_program_id: '', get_tier: '' };
                          return { ...prev, cross_sell_rules: rules };
                        });
                      };
                      const tProg = programs.find(p => String(p.id) === String(target.program_id));
                      const tTiers = tProg?.duration_tiers || [];
                      return (
                        <div key={ti} className="flex items-center gap-1.5 bg-white rounded px-2 py-1.5 border border-green-200">
                          <select value={target.program_id || ''} onChange={e => updateTarget('program_id', e.target.value)}
                            className="border rounded px-1 py-1 text-[10px] bg-white h-6 min-w-[130px]">
                            <option value="">Select program</option>
                            {programs.filter(p => p.title).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                          </select>
                          {tTiers.length > 0 && (
                            <select value={target.tier ?? ''} onChange={e => updateTarget('tier', e.target.value)}
                              className="border rounded px-1 py-1 text-[9px] bg-green-50 h-6 min-w-[70px]">
                              <option value="">Any</option>
                              {tTiers.map((t, tti) => <option key={tti} value={tti}>{t.label}</option>)}
                            </select>
                          )}
                          <span className="text-[9px] text-gray-500">→</span>
                          <Input type="text" inputMode="decimal" value={target.discount_value || 0} onChange={e => updateTarget('discount_value', parseFloat(e.target.value) || 0)}
                            className="w-12 h-6 text-[10px] text-center" min={0} />
                          <select value={target.discount_type || 'percentage'} onChange={e => updateTarget('discount_type', e.target.value)}
                            className="border rounded px-0.5 py-0.5 text-[9px] bg-white h-6">
                            <option value="percentage">%</option>
                            <option value="fixed">Amt</option>
                          </select>
                          <span className="text-[9px] text-gray-500">off</span>
                          <button onClick={() => {
                            setSettings(prev => {
                              const rules = [...(prev.cross_sell_rules || [])];
                              const curTargets = [...(rules[i]?.targets || targets)].filter((_, j) => j !== ti);
                              rules[i] = { ...rules[i], targets: curTargets };
                              return { ...prev, cross_sell_rules: rules };
                            });
                          }} className="text-red-300 hover:text-red-500"><Trash2 size={11} /></button>
                        </div>
                      );
                    });
                  })()}
                  <button onClick={() => {
                    setSettings(prev => {
                      const rules = [...(prev.cross_sell_rules || [])];
                      const curRule = rules[i] || {};
                      const curTargets = [...(curRule.targets || (curRule.get_program_id ? [{ program_id: curRule.get_program_id, tier: curRule.get_tier, discount_value: curRule.discount_value, discount_type: curRule.discount_type }] : []))];
                      curTargets.push({ program_id: '', tier: '', discount_value: 10, discount_type: 'percentage' });
                      rules[i] = { ...curRule, targets: curTargets, get_program_id: '', get_tier: '' };
                      return { ...prev, cross_sell_rules: rules };
                    });
                  }} className="text-[9px] text-green-600 hover:underline font-medium flex items-center gap-1">
                    <Plus size={10} /> Add another program
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
