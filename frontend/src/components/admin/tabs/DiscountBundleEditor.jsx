import React from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { Plus, Trash2, Users, ShoppingCart, Heart, Gift } from 'lucide-react';

/**
 * Group / combo / loyalty / cross-sell blocks (public site or annual portal bundle).
 */
function AnnualMemberApplyRow({ kind, annualApply, onAnnualApplyChange, tid }) {
  if (!annualApply || typeof onAnnualApplyChange !== 'function') return null;
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50/70 px-2.5 py-2">
      <span className="text-[10px] text-indigo-900 leading-snug">
        Apply for <strong>annual members</strong> on Sacred Home &amp; Divine Cart
      </span>
      <Switch
        checked={annualApply[kind] !== false}
        onCheckedChange={(v) => onAnnualApplyChange(kind, v)}
        data-testid={tid(`apply-${kind}-annual-portal`)}
      />
    </div>
  );
}

export default function DiscountBundleEditor({
  bundle,
  setBundle,
  programs,
  idPrefix = '',
  annualApply = null,
  onAnnualApplyChange = null,
}) {
  const tid = (name) => (idPrefix ? `${idPrefix}${name}` : name);

  const addGroupRule = () => {
    setBundle(prev => ({
      ...prev,
      group_discount_rules: [...(prev.group_discount_rules || []), { min_participants: 3, discount_pct: 10 }]
    }));
  };

  const updateGroupRule = (idx, field, value) => {
    const rules = [...(bundle.group_discount_rules || [])];
    rules[idx] = { ...rules[idx], [field]: field === 'label' || field === 'code' ? value : (parseFloat(value) || 0) };
    setBundle(prev => ({ ...prev, group_discount_rules: rules }));
  };

  const removeGroupRule = (idx) => {
    setBundle(prev => ({
      ...prev,
      group_discount_rules: (prev.group_discount_rules || []).filter((_, i) => i !== idx)
    }));
  };

  return (
    <div className="space-y-6">
      {/* Group Discount */}
      <div className="bg-white rounded-lg border p-5" data-testid={tid("group-discount-section")}>
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
          <Switch checked={bundle.enable_group_discount} onCheckedChange={v => setBundle(prev => ({ ...prev, enable_group_discount: v }))} data-testid={tid("toggle-group-discount")} />
        </div>
        <AnnualMemberApplyRow kind="group" annualApply={annualApply} onAnnualApplyChange={onAnnualApplyChange} tid={tid} />
        {bundle.enable_group_discount && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-500">Discount tiers</Label>
              <Button size="sm" variant="outline" onClick={addGroupRule} className="text-xs h-7" data-testid={tid("add-group-rule")}>
                <Plus size={12} className="mr-1" /> Add Rule
              </Button>
            </div>
            {!(bundle.group_discount_rules || []).length && (
              <p className="text-[10px] text-gray-400 italic">No rules yet. Add a rule like "3+ participants = 10% off".</p>
            )}
            {(bundle.group_discount_rules || []).map((rule, i) => (
              <div key={i} className="bg-gray-50 rounded-lg px-3 py-2" data-testid={`group-rule-${i}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 whitespace-nowrap">If</span>
                  <Input type="text" inputMode="decimal" value={rule.min_participants} onChange={e => updateGroupRule(i, 'min_participants', e.target.value)}
                    className="w-16 h-7 text-xs text-center" min={2} />
                  <span className="text-xs text-gray-500 whitespace-nowrap">or more participants →</span>
                  <Input type="text" inputMode="decimal" value={rule.discount_pct} onChange={e => updateGroupRule(i, 'discount_pct', e.target.value)}
                    className="w-16 h-7 text-xs text-center" min={0} max={50} />
                  <span className="text-xs text-gray-500">% off</span>
                  <span className="text-[9px] text-gray-400 ml-1">label:</span>
                  <Input value={rule.label || ''} onChange={e => updateGroupRule(i, 'label', e.target.value)}
                    className="w-32 h-7 text-xs" placeholder="e.g. Family Offer" />
                  <button onClick={() => removeGroupRule(i)} className="text-red-400 hover:text-red-600 ml-auto"><Trash2 size={14} /></button>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center mt-1.5">
                  <span className="text-[9px] text-gray-400">Programs:</span>
                  {programs.filter(p => p.title).map(p => {
                    const selected = (rule.program_ids || []).includes(String(p.id));
                    return (
                      <button key={p.id} onClick={() => {
                        const rules = [...bundle.group_discount_rules];
                        const ids = rules[i].program_ids || [];
                        rules[i] = { ...rules[i], program_ids: selected ? ids.filter(x => x !== String(p.id)) : [...ids, String(p.id)] };
                        setBundle(prev => ({ ...prev, group_discount_rules: rules }));
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
      <div className="bg-white rounded-lg border p-5" data-testid={tid("combo-discount-section")}>
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
          <Switch checked={bundle.enable_combo_discount} onCheckedChange={v => setBundle(prev => ({ ...prev, enable_combo_discount: v }))} data-testid={tid("toggle-combo-discount")} />
        </div>
        <AnnualMemberApplyRow kind="combo" annualApply={annualApply} onAnnualApplyChange={onAnnualApplyChange} tid={tid} />
        {bundle.enable_combo_discount && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-500">Combo tiers (e.g. 2 programs = 10%, 3 programs = 15%)</Label>
              <Button size="sm" variant="outline" onClick={() => setBundle(prev => ({
                ...prev,
                combo_rules: [...(prev.combo_rules || []), { min_programs: 2, discount_pct: 10, code: `COMBO${(prev.combo_rules?.length || 0) + 2}`, label: '' }]
              }))} className="text-xs h-7" data-testid={tid("add-combo-rule")}>
                <Plus size={12} className="mr-1" /> Add Rule
              </Button>
            </div>
            {(!bundle.combo_rules || bundle.combo_rules.length === 0) && (
              <p className="text-[10px] text-gray-400 italic">No combo rules yet. Add a rule like "2+ programs = 10% off (code: COMBO2)".</p>
            )}
            {(bundle.combo_rules || []).map((rule, i) => (
              <div key={i} className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200 flex-wrap" data-testid={`combo-rule-${i}`}>
                <span className="text-xs text-gray-500 whitespace-nowrap">If</span>
                <Input type="text" inputMode="decimal" value={rule.min_programs} onChange={e => {
                  const rules = [...(bundle.combo_rules || [])];
                  rules[i] = { ...rules[i], min_programs: parseInt(e.target.value) || 2 };
                  setBundle(prev => ({ ...prev, combo_rules: rules }));
                }} className="w-12 h-7 text-xs text-center" min={2} />
                <span className="text-xs text-gray-500 whitespace-nowrap">+ programs →</span>
                <Input type="text" inputMode="decimal" value={rule.discount_pct} onChange={e => {
                  const rules = [...(bundle.combo_rules || [])];
                  rules[i] = { ...rules[i], discount_pct: parseFloat(e.target.value) || 0 };
                  setBundle(prev => ({ ...prev, combo_rules: rules }));
                }} className="w-14 h-7 text-xs text-center" min={0} max={50} />
                <span className="text-xs text-gray-500">%</span>
                <span className="text-[9px] text-gray-400 mx-1">code:</span>
                <Input value={rule.code || ''} onChange={e => {
                  const rules = [...(bundle.combo_rules || [])];
                  rules[i] = { ...rules[i], code: e.target.value.toUpperCase() };
                  setBundle(prev => ({ ...prev, combo_rules: rules }));
                }} className="w-24 h-7 text-xs font-mono bg-white" placeholder="COMBO2" />
                <span className="text-[9px] text-gray-400 mx-1">label:</span>
                <Input value={rule.label || ''} onChange={e => {
                  const rules = [...(bundle.combo_rules || [])];
                  rules[i] = { ...rules[i], label: e.target.value };
                  setBundle(prev => ({ ...prev, combo_rules: rules }));
                }} className="w-32 h-7 text-xs" placeholder="Combo Package" />
                <button onClick={() => {
                  setBundle(prev => ({ ...prev, combo_rules: (prev.combo_rules || []).filter((_, j) => j !== i) }));
                }} className="text-red-400 hover:text-red-600 ml-auto"><Trash2 size={14} /></button>
                {/* Program selection */}
                <div className="w-full mt-1.5 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[9px] text-gray-400">Programs:</span>
                  {programs.filter(p => p.title).map(p => {
                    const selected = (rule.program_ids || []).includes(String(p.id));
                    return (
                      <button key={p.id} onClick={() => {
                        const rules = [...(bundle.combo_rules || [])];
                        const ids = rules[i].program_ids || [];
                        rules[i] = { ...rules[i], program_ids: selected ? ids.filter(x => x !== String(p.id)) : [...ids, String(p.id)] };
                        setBundle(prev => ({ ...prev, combo_rules: rules }));
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
      <div className="bg-white rounded-lg border p-5" data-testid={tid("loyalty-section")}>
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
          <Switch checked={bundle.enable_loyalty} onCheckedChange={v => setBundle(prev => ({ ...prev, enable_loyalty: v }))} data-testid={tid("toggle-loyalty")} />
        </div>
        <AnnualMemberApplyRow kind="loyalty" annualApply={annualApply} onAnnualApplyChange={onAnnualApplyChange} tid={tid} />
        {bundle.enable_loyalty && (
          <div className="mt-3 flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Returning clients get</span>
            <Input type="text" inputMode="decimal" value={bundle.loyalty_discount_pct} onChange={e => setBundle(prev => ({ ...prev, loyalty_discount_pct: parseFloat(e.target.value) || 0 }))}
              className="w-16 h-7 text-xs text-center" min={0} max={50} />
            <span className="text-xs text-gray-500">% off their next enrollment</span>
          </div>
        )}
      </div>

      <div className="bg-amber-50/60 border border-amber-100 rounded-lg px-4 py-3 text-[10px] text-amber-900">
        <strong>Points wallet</strong> is managed in{' '}
        <span className="font-semibold">Programs &amp; Offers → Points wallet</span> (redemption rules, earn rates, activities per program).
      </div>

      {/* Cross-Sell Program Discounts */}
      <div className="bg-white rounded-lg border p-5" data-testid={tid("cross-sell-section")}>
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
          <Switch checked={bundle.enable_cross_sell || false} onCheckedChange={v => setBundle(prev => ({ ...prev, enable_cross_sell: v }))} data-testid={tid("toggle-cross-sell")} />
        </div>
        <AnnualMemberApplyRow kind="cross_sell" annualApply={annualApply} onAnnualApplyChange={onAnnualApplyChange} tid={tid} />
        {bundle.enable_cross_sell && (
        <>
        <div className="flex items-center justify-end mt-2">
          <Button size="sm" variant="outline" onClick={() => setBundle(prev => ({
            ...prev,
            cross_sell_rules: [...(prev.cross_sell_rules || []), {
              buy_program_id: '', get_program_id: '', discount_type: 'percentage', discount_value: 10,
              code: `XSELL${(prev.cross_sell_rules?.length || 0) + 1}`, label: '', enabled: true, targets: [],
            }]
          }))} className="text-xs h-7" data-testid={tid("add-cross-sell-rule")}>
            <Plus size={12} className="mr-1" /> Add Rule
          </Button>
        </div>
        {(!bundle.cross_sell_rules || bundle.cross_sell_rules.length === 0) && (
          <p className="text-[10px] text-gray-400 italic mt-2">No cross-sell rules. Add one like "Buy AWRP → Get 15% off Quad Layer Healing".</p>
        )}
        <div className="mt-3 space-y-2">
          {(bundle.cross_sell_rules || []).map((rule, i) => {
            const updateRule = (field, value) => {
              setBundle(prev => {
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
                  <button onClick={() => setBundle(prev => ({ ...prev, cross_sell_rules: (prev.cross_sell_rules || []).filter((_, j) => j !== i) }))}
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
                        setBundle(prev => {
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
                            setBundle(prev => {
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
                    setBundle(prev => {
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
