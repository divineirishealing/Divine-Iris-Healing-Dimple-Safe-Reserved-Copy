import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { useToast } from '../../../hooks/use-toast';
import { Plus, Trash2, UserPlus, Save, Star, Upload, Tag, Layers } from 'lucide-react';
import DiscountBundleEditor from './DiscountBundleEditor';
import { DEFAULT_ANNUAL_APPLY } from '../../../lib/dashboardDiscountSettings';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DISCOUNT_PAYLOAD_KEYS = [
  'enable_referral',
  'enable_group_discount',
  'group_discount_rules',
  'enable_combo_discount',
  'combo_discount_pct',
  'combo_min_programs',
  'checkout_promo_code_visible',
  'combo_rules',
  'enable_loyalty',
  'loyalty_discount_pct',
  'enable_cross_sell',
  'cross_sell_rules',
  'special_offers',
  'discounts_apply_to_annual_portal',
];

function pickDiscountPayload(obj) {
  return DISCOUNT_PAYLOAD_KEYS.reduce((acc, k) => {
    if (obj[k] !== undefined) acc[k] = obj[k];
    return acc;
  }, {});
}

const ANNUAL_DISCOUNT_DEFAULTS = {
  enabled: false,
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
};

function pickAnnualDiscountPayload(obj) {
  const { enabled, ...rest } = { ...obj };
  return {
    enabled: !!enabled,
    ...pickDiscountPayload(rest),
  };
}

export default function DiscountsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discountScope, setDiscountScope] = useState(() => {
    try {
      const s = sessionStorage.getItem('discounts_initial_scope');
      sessionStorage.removeItem('discounts_initial_scope');
      return s === 'annual' ? 'annual' : 'public';
    } catch {
      return 'public';
    }
  });
  const [programs, setPrograms] = useState([]);
  const [settings, setSettings] = useState({
    enable_referral: true,
    enable_group_discount: false,
    group_discount_rules: [],
    enable_combo_discount: false,
    combo_discount_pct: 0,
    combo_min_programs: 2,
    checkout_promo_code_visible: true,
    combo_rules: [],
    enable_loyalty: false,
    loyalty_discount_pct: 0,
    enable_cross_sell: false,
    cross_sell_rules: [],
    special_offers: [],
    discounts_apply_to_annual_portal: { ...DEFAULT_ANNUAL_APPLY },
  });
  const [annualBundle, setAnnualBundle] = useState({ ...ANNUAL_DISCOUNT_DEFAULTS });

  const onAnnualApplyChange = (kind, value) => {
    setSettings((prev) => ({
      ...prev,
      discounts_apply_to_annual_portal: {
        ...(prev.discounts_apply_to_annual_portal || DEFAULT_ANNUAL_APPLY),
        [kind]: value,
      },
    }));
  };

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const [dRes, pRes] = await Promise.all([
        axios.get(`${API}/discounts/settings`),
        axios.get(`${API}/programs`),
      ]);
      setSettings((prev) => {
        const patch = pickDiscountPayload(dRes.data || {});
        if ('enable_cross_sell' in patch) patch.enable_cross_sell = !!patch.enable_cross_sell;
        return { ...prev, ...patch };
      });
      const ads = dRes.data?.dashboard_discount_settings || {};
      setAnnualBundle({
        ...ANNUAL_DISCOUNT_DEFAULTS,
        enabled: !!ads.enabled,
        ...pickDiscountPayload(ads),
      });
      setPrograms(pRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API}/settings`, {
        ...pickDiscountPayload(settings),
        dashboard_discount_settings: pickAnnualDiscountPayload(annualBundle),
      });
      if (res.data) {
        const patch = pickDiscountPayload(res.data);
        if ('enable_cross_sell' in patch) patch.enable_cross_sell = !!patch.enable_cross_sell;
        setSettings((prev) => ({ ...prev, ...patch }));
        const ads = res.data.dashboard_discount_settings || {};
        setAnnualBundle({
          ...ANNUAL_DISCOUNT_DEFAULTS,
          enabled: !!ads.enabled,
          ...pickDiscountPayload(ads),
        });
      }
      toast({ title: 'Discount settings saved!' });
    } catch (e) {
      toast({ title: 'Error saving', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const persistCheckoutPromoVisible = async (v) => {
    const prev = settings.checkout_promo_code_visible;
    setSettings((p) => ({ ...p, checkout_promo_code_visible: v }));
    try {
      await axios.put(`${API}/settings`, { checkout_promo_code_visible: v });
      toast({
        title: v ? 'Promo code field is now visible' : 'Promo code field is hidden',
        description: 'On cart and program enrollment pages.',
      });
    } catch {
      setSettings((p) => ({ ...p, checkout_promo_code_visible: prev }));
      toast({ title: 'Could not save setting', variant: 'destructive' });
    }
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

      <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-lg w-fit" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={discountScope === 'public'}
          onClick={() => setDiscountScope('public')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            discountScope === 'public' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
          data-testid="discounts-scope-public"
        >
          Public website
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={discountScope === 'annual'}
          onClick={() => setDiscountScope('annual')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            discountScope === 'annual' ? 'bg-indigo-700 text-white shadow-sm' : 'text-indigo-800 hover:bg-indigo-100'
          }`}
          data-testid="discounts-scope-annual"
        >
          Annual portal (Sacred Home)
        </button>
      </div>

      {discountScope === 'annual' ? (
        <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50/50 p-5 space-y-4" data-testid="annual-portal-discounts-section">
          <p className="text-xs text-indigo-950 leading-relaxed">
            For clients with <strong>Dashboard Access = Annual</strong>. Turn on <strong>Use annual rules</strong>, configure combo / group / loyalty / cross-sell, then <strong>Save Settings</strong>.
            Members see the combo banner on Sacred Home and discounts on Divine Cart checkout.
          </p>
          <div className="flex items-center justify-between gap-4 flex-wrap rounded-lg bg-white/80 border border-indigo-200 px-3 py-2">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-indigo-700" />
              <span className="text-sm font-semibold text-indigo-950">Use annual discount rules</span>
            </div>
            <Switch
              checked={!!annualBundle.enabled}
              onCheckedChange={(v) => setAnnualBundle((prev) => ({ ...prev, enabled: v }))}
              data-testid="toggle-annual-portal-discounts"
            />
          </div>
          {annualBundle.enabled ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs h-8 border-indigo-300 text-indigo-800"
                onClick={() => setAnnualBundle((prev) => ({
                  ...prev,
                  ...pickDiscountPayload(settings),
                }))}
              >
                Copy rules from public website
              </Button>
              <DiscountBundleEditor
                bundle={annualBundle}
                setBundle={setAnnualBundle}
                programs={programs}
                idPrefix="annual-"
              />
            </>
          ) : (
            <p className="text-[11px] text-indigo-900/70 italic">
              Toggle on to edit annual-only rules. While off, annual members use the <strong>Public website</strong> discount rules on dashboard checkout.
            </p>
          )}
        </div>
      ) : (
        <>
      {/* Checkout promo code visibility — saves immediately (no need to click Save Settings) */}
      <div className="bg-amber-50/80 rounded-xl border-2 border-amber-300 p-5 shadow-sm" data-testid="checkout-promo-visibility-section">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-amber-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <Tag size={18} className="text-amber-900" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Show promo code on cart & enrollment</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Saves immediately. When off, the promo box is hidden. Enrollment links with{' '}
                <code className="text-[10px] bg-white/80 px-1 rounded border">?promo=</code> still work.
              </p>
            </div>
          </div>
          <Switch
            data-testid="checkout-promo-visible-switch"
            checked={settings.checkout_promo_code_visible !== false}
            onCheckedChange={persistCheckoutPromoVisible}
          />
        </div>
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

      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-3">
        <p className="text-xs font-semibold text-indigo-950">Cart discounts (website + optional annual members)</p>
        <p className="text-[10px] text-indigo-900/80 mt-0.5 leading-relaxed">
          Under each discount below, turn on <strong>Apply for annual members</strong> so the same rule runs on Sacred Home and Divine Cart
          (clients with Dashboard Access = Annual). Default is on when you save.
        </p>
      </div>
      <DiscountBundleEditor
        bundle={settings}
        setBundle={setSettings}
        programs={programs}
        annualApply={settings.discounts_apply_to_annual_portal || DEFAULT_ANNUAL_APPLY}
        onAnnualApplyChange={onAnnualApplyChange}
      />

      {/* ════ SPECIAL OFFERS — Target by Email/Phone ════ */}
      <div className="bg-white rounded-lg border p-5" data-testid="special-offers-section">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
              <Star size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Special / VIP Offers</p>
              <p className="text-[10px] text-gray-500">Target specific people by email or phone. Upload Excel or add manually.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSettings(prev => ({
            ...prev,
            special_offers: [...(prev.special_offers || []), {
              id: Date.now().toString(), label: '', discount_pct: 10, discount_type: 'percentage', discount_amount: 0,
              emails: [], phones: [], enabled: true, code: `VIP${(prev.special_offers?.length || 0) + 1}`, program_ids: [],
            }]
          }))} className="text-xs h-7" data-testid="add-special-offer">
            <Plus size={12} className="mr-1" /> Add Offer
          </Button>
        </div>

        {(!settings.special_offers || settings.special_offers.length === 0) && (
          <p className="text-[10px] text-gray-400 italic mt-2">No special offers yet. Create one to give exclusive discounts to specific people.</p>
        )}

        <div className="mt-3 space-y-3">
          {(settings.special_offers || []).map((offer, i) => (
            <SpecialOfferCard key={offer.id || i} offer={offer} index={i} programs={programs}
              onUpdate={(field, value) => {
                setSettings(prev => {
                  const offers = [...(prev.special_offers || [])];
                  offers[i] = { ...offers[i], [field]: value };
                  return { ...prev, special_offers: offers };
                });
              }}
              onDelete={() => setSettings(prev => ({ ...prev, special_offers: (prev.special_offers || []).filter((_, j) => j !== i) }))} />
          ))}
        </div>
      </div>
        </>
      )}
    </div>
  );
}

/* ─── Special Offer Card ─── */
const SpecialOfferCard = ({ offer, index, programs, onUpdate, onDelete }) => {
  const fileRef = React.useRef(null);

  const people = offer.people || [];

  const addPerson = () => {
    onUpdate('people', [...people, { name: '', email: '', phone: '' }]);
  };

  const updatePerson = (pi, field, value) => {
    const updated = [...people];
    updated[pi] = { ...updated[pi], [field]: value };
    onUpdate('people', updated);
  };

  const removePerson = (pi) => {
    onUpdate('people', people.filter((_, j) => j !== pi));
  };

  const handleExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const imported = [];
      lines.forEach((line, li) => {
        if (li === 0 && (line.toLowerCase().includes('name') || line.toLowerCase().includes('email'))) return; // skip header
        const parts = line.split(/[,\t;]+/).map(p => p.trim().replace(/"/g, ''));
        const person = { name: '', email: '', phone: '' };
        parts.forEach(p => {
          if (p.includes('@')) person.email = p.toLowerCase();
          else if (p.match(/^\+?\d[\d\s-]{6,}/)) person.phone = p.replace(/[\s-]/g, '');
          else if (!person.name && p.length > 1) person.name = p;
        });
        if (person.email || person.phone) imported.push(person);
      });
      onUpdate('people', [...people, ...imported]);
      alert(`Imported ${imported.length} people`);
    } catch { alert('Error reading file'); }
    e.target.value = '';
  };

  return (
    <div className={`rounded-lg border p-4 ${offer.enabled ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200 opacity-60'}`} data-testid={`special-offer-${index}`}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Switch checked={offer.enabled !== false} onCheckedChange={v => onUpdate('enabled', v)} />
        <Input value={offer.label || ''} onChange={e => onUpdate('label', e.target.value)}
          placeholder="Offer name (e.g. Family Discount)" className="h-7 text-xs flex-1 min-w-[140px]" />
        <Input value={offer.code || ''} onChange={e => onUpdate('code', e.target.value.toUpperCase())}
          placeholder="Code" className="h-7 text-xs w-20 font-mono" />
        <Input type="text" inputMode="decimal" value={offer.discount_type === 'fixed' ? (offer.discount_amount || 0) : (offer.discount_pct || 0)}
          onChange={e => {
            const val = parseFloat(e.target.value) || 0;
            offer.discount_type === 'fixed' ? onUpdate('discount_amount', val) : onUpdate('discount_pct', val);
          }} className="h-7 text-xs w-16 text-center" />
        <select value={offer.discount_type || 'percentage'} onChange={e => onUpdate('discount_type', e.target.value)}
          className="border rounded px-1 py-1 text-xs bg-white h-7">
          <option value="percentage">%</option>
          <option value="fixed">Fixed</option>
        </select>
        <span className="text-xs text-gray-500">off</span>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 ml-auto"><Trash2 size={14} /></button>
      </div>

      {/* Programs */}
      <div className="flex flex-wrap gap-1 items-center mb-3">
        <span className="text-[9px] text-gray-400">Programs:</span>
        {programs.filter(p => p.title).map(p => {
          const selected = (offer.program_ids || []).includes(String(p.id));
          return (
            <button key={p.id} onClick={() => {
              const ids = offer.program_ids || [];
              onUpdate('program_ids', selected ? ids.filter(x => x !== String(p.id)) : [...ids, String(p.id)]);
            }} className={`text-[9px] px-2 py-0.5 rounded-full font-medium border transition-colors ${selected ? 'bg-purple-200 border-purple-400 text-purple-800' : 'bg-white border-gray-200 text-gray-500 hover:border-purple-300'}`}>
              {p.title.length > 18 ? p.title.slice(0, 18) + '..' : p.title}
            </button>
          );
        })}
        {!(offer.program_ids || []).length && <span className="text-[8px] text-gray-400 italic">All programs</span>}
      </div>

      {/* People — Excel-style table */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-2 py-1.5 font-semibold text-gray-600 w-8">#</th>
              <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Name</th>
              <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Email</th>
              <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Phone</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {people.map((p, pi) => (
              <tr key={pi} className="border-b hover:bg-purple-50/30">
                <td className="px-2 py-1 text-gray-400">{pi + 1}</td>
                <td className="px-1 py-0.5">
                  <input value={p.name || ''} onChange={e => updatePerson(pi, 'name', e.target.value)}
                    placeholder="Name" className="w-full h-6 px-1.5 text-[10px] border-0 bg-transparent outline-none focus:bg-purple-50 rounded" />
                </td>
                <td className="px-1 py-0.5">
                  <input value={p.email || ''} onChange={e => updatePerson(pi, 'email', e.target.value.toLowerCase())}
                    placeholder="email@example.com" className="w-full h-6 px-1.5 text-[10px] border-0 bg-transparent outline-none focus:bg-purple-50 rounded" />
                </td>
                <td className="px-1 py-0.5">
                  <input value={p.phone || ''} onChange={e => updatePerson(pi, 'phone', e.target.value)}
                    placeholder="+91 98765 43210" className="w-full h-6 px-1.5 text-[10px] border-0 bg-transparent outline-none focus:bg-purple-50 rounded" />
                </td>
                <td className="px-1"><button onClick={() => removePerson(pi)} className="text-red-300 hover:text-red-500"><Trash2 size={10} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-t">
          <button onClick={addPerson} className="text-[9px] text-purple-600 hover:underline font-medium flex items-center gap-1">
            <Plus size={10} /> Add Row
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="text-[9px] px-2 py-1 bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-50 flex items-center gap-1">
              <Upload size={9} /> Upload CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={handleExcel} />
            <span className="text-[8px] text-gray-400">{people.length} people</span>
          </div>
        </div>
      </div>
    </div>
  );
};
