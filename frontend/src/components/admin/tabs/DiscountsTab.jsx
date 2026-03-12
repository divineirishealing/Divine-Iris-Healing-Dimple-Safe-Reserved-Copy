import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { useToast } from '../../../hooks/use-toast';
import { Plus, Trash2, Users, ShoppingCart, Heart, UserPlus, Save } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DiscountsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    enable_referral: true,
    enable_group_discount: false,
    group_discount_rules: [],
    enable_combo_discount: false,
    combo_discount_pct: 0,
    combo_min_programs: 2,
    enable_loyalty: false,
    loyalty_discount_pct: 0,
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const res = await axios.get(`${API}/discounts/settings`);
      setSettings(res.data);
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

      {/* Combo Discount */}
      <div className="bg-white rounded-lg border p-5" data-testid="combo-discount-section">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
              <ShoppingCart size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Combo Discount</p>
              <p className="text-[10px] text-gray-500">Discount when multiple programs are in the cart</p>
            </div>
          </div>
          <Switch checked={settings.enable_combo_discount} onCheckedChange={v => setSettings(prev => ({ ...prev, enable_combo_discount: v }))} data-testid="toggle-combo-discount" />
        </div>
        {settings.enable_combo_discount && (
          <div className="mt-3 flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">When cart has</span>
            <Input type="number" value={settings.combo_min_programs} onChange={e => setSettings(prev => ({ ...prev, combo_min_programs: parseInt(e.target.value) || 2 }))}
              className="w-14 h-7 text-xs text-center" min={2} />
            <span className="text-xs text-gray-500 whitespace-nowrap">or more programs → apply</span>
            <Input type="number" value={settings.combo_discount_pct} onChange={e => setSettings(prev => ({ ...prev, combo_discount_pct: parseFloat(e.target.value) || 0 }))}
              className="w-16 h-7 text-xs text-center" min={0} max={50} />
            <span className="text-xs text-gray-500">% off</span>
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

      {/* Preview */}
      <div className="bg-gray-900 rounded-lg p-5 text-white">
        <p className="text-xs font-semibold text-[#D4AF37] mb-3 tracking-wider">ACTIVE DISCOUNTS PREVIEW</p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${settings.enable_referral ? 'bg-green-400' : 'bg-gray-600'}`} />
            <span className={settings.enable_referral ? 'text-gray-200' : 'text-gray-500'}>Referral: {settings.enable_referral ? 'ON' : 'OFF'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${settings.enable_group_discount ? 'bg-green-400' : 'bg-gray-600'}`} />
            <span className={settings.enable_group_discount ? 'text-gray-200' : 'text-gray-500'}>
              Group: {settings.enable_group_discount ? `ON — ${settings.group_discount_rules.length} rule(s)` : 'OFF'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${settings.enable_combo_discount ? 'bg-green-400' : 'bg-gray-600'}`} />
            <span className={settings.enable_combo_discount ? 'text-gray-200' : 'text-gray-500'}>
              Combo: {settings.enable_combo_discount ? `ON — ${settings.combo_discount_pct}% off for ${settings.combo_min_programs}+ programs` : 'OFF'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${settings.enable_loyalty ? 'bg-green-400' : 'bg-gray-600'}`} />
            <span className={settings.enable_loyalty ? 'text-gray-200' : 'text-gray-500'}>
              Loyalty: {settings.enable_loyalty ? `ON — ${settings.loyalty_discount_pct}% off for returning clients` : 'OFF'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
