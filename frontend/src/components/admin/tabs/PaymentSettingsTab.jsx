import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CreditCard, Save, Loader2, Percent, ExternalLink, Building2, IndianRupee, Check, X, Plus, Trash2, Key, Mail, Copy } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { useToast } from '../../../hooks/use-toast';
import CollapsibleSection from '../CollapsibleSection';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;
const SITE_URL = (process.env.REACT_APP_BACKEND_URL || window.location.origin || '').replace('/api', '').replace('api/', '');

const PaymentSettingsTab = () => {
  const { toast } = useToast();
  const [disclaimer, setDisclaimer] = useState('');
  const [disclaimerEnabled, setDisclaimerEnabled] = useState(true);
  const [disclaimerStyle, setDisclaimerStyle] = useState({ font_size: '14px', font_weight: '600', font_color: '#991b1b', bg_color: '#fef2f2', border_color: '#f87171' });
  const [indiaEnabled, setIndiaEnabled] = useState(false);
  const [manualFormEnabled, setManualFormEnabled] = useState(true);
  const [exlyLink, setExlyLink] = useState('');
  const [altDiscountPct, setAltDiscountPct] = useState(9);
  const [gstPct, setGstPct] = useState(18);
  const [platformPct, setPlatformPct] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => {
      setDisclaimer(r.data.payment_disclaimer || '');
      setDisclaimerEnabled(r.data.payment_disclaimer_enabled !== false);
      if (r.data.payment_disclaimer_style) setDisclaimerStyle(prev => ({ ...prev, ...r.data.payment_disclaimer_style }));
      setIndiaEnabled(r.data.india_payment_enabled || false);
      setManualFormEnabled(r.data.manual_form_enabled !== false);
      setExlyLink(r.data.india_exly_link || '');
      setAltDiscountPct(r.data.india_alt_discount_percent ?? 9);
      setGstPct(r.data.india_gst_percent ?? 18);
      setPlatformPct(r.data.india_platform_charge_percent ?? 3);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, {
        payment_disclaimer: disclaimer,
        payment_disclaimer_enabled: disclaimerEnabled,
        payment_disclaimer_style: disclaimerStyle,
        india_payment_enabled: indiaEnabled,
        manual_form_enabled: manualFormEnabled,
        india_exly_link: exlyLink,
        india_alt_discount_percent: parseFloat(altDiscountPct) || 9,
        india_gst_percent: parseFloat(gstPct) || 18,
        india_platform_charge_percent: parseFloat(platformPct) || 3,
      });
      toast({ title: 'Payment settings saved!' });
    } catch (err) {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>;

  return (
    <div data-testid="payment-settings-tab">
      <div className="flex items-center gap-2 mb-1">
        <CreditCard size={18} className="text-[#D4AF37]" />
        <h2 className="text-lg font-semibold text-gray-900">Payment Settings</h2>
      </div>
      <p className="text-xs text-gray-500 mb-6">Manage payment disclaimer, Exly gateway, and bank transfer details for India.</p>

      {/* Disclaimer */}
      <CollapsibleSection title="Payment Disclaimer" subtitle="Shown on enrollment pages" defaultOpen={true}>
      <div className="mb-6 bg-gray-50 border rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Payment Disclaimer</h3>
            <p className="text-[10px] text-gray-400">Shown near pricing on enrollment and payment pages</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer" data-testid="disclaimer-toggle">
            <input type="checkbox" checked={disclaimerEnabled} onChange={e => setDisclaimerEnabled(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            <span className="ml-2 text-xs font-medium text-gray-700">{disclaimerEnabled ? 'Visible' : 'Hidden'}</span>
          </label>
        </div>
        {disclaimerEnabled && (
          <>
          <textarea
            data-testid="payment-disclaimer-input"
            value={disclaimer}
            onChange={e => setDisclaimer(e.target.value)}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-xs text-gray-700 resize-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] mb-3"
            placeholder="We love aligning our work with the natural solar cycle..."
          />
          <div className="grid grid-cols-5 gap-2 mb-3">
            <div>
              <label className="text-[9px] text-gray-500 block mb-0.5">Font Size</label>
              <select value={disclaimerStyle.font_size} onChange={e => setDisclaimerStyle(s => ({ ...s, font_size: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-xs bg-white">
                <option value="9px">9px</option>
                <option value="10px">10px</option>
                <option value="11px">11px</option>
                <option value="12px">12px</option>
                <option value="13px">13px</option>
                <option value="14px">14px</option>
                <option value="16px">16px</option>
                <option value="18px">18px</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-0.5">Weight</label>
              <select value={disclaimerStyle.font_weight} onChange={e => setDisclaimerStyle(s => ({ ...s, font_weight: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-xs bg-white">
                <option value="400">Normal</option>
                <option value="500">Medium</option>
                <option value="600">Semi-Bold</option>
                <option value="700">Bold</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-0.5">Text Color</label>
              <input type="color" value={disclaimerStyle.font_color} onChange={e => setDisclaimerStyle(s => ({ ...s, font_color: e.target.value }))}
                className="w-full h-8 border rounded cursor-pointer" />
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-0.5">Background</label>
              <input type="color" value={disclaimerStyle.bg_color} onChange={e => setDisclaimerStyle(s => ({ ...s, bg_color: e.target.value }))}
                className="w-full h-8 border rounded cursor-pointer" />
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-0.5">Border</label>
              <input type="color" value={disclaimerStyle.border_color} onChange={e => setDisclaimerStyle(s => ({ ...s, border_color: e.target.value }))}
                className="w-full h-8 border rounded cursor-pointer" />
            </div>
          </div>
          <div className="rounded-xl p-4 border-2" style={{ backgroundColor: disclaimerStyle.bg_color, borderColor: disclaimerStyle.border_color }}>
            <p style={{ fontSize: disclaimerStyle.font_size, fontWeight: disclaimerStyle.font_weight, color: disclaimerStyle.font_color, lineHeight: '1.5' }}>
              {disclaimer || 'Preview text will appear here...'}
            </p>
          </div>
          </>
        )}
      </div>
      </CollapsibleSection>

      {/* India Payment Master Toggle */}
      <CollapsibleSection title="India Payment Options" subtitle={indiaEnabled ? 'Enabled' : 'Disabled'}>
      <div className="mb-6 bg-gray-50 border rounded-lg p-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">India Payment Options</h3>
          <p className="text-[10px] text-gray-400">Show Exly & Bank Transfer options on enrollment page for Indian users</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer" data-testid="india-payment-toggle">
          <input type="checkbox" checked={indiaEnabled} onChange={e => setIndiaEnabled(e.target.checked)} className="sr-only peer" />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
          <span className="ml-2 text-xs font-medium text-gray-700">{indiaEnabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>

      {/* Manual Payment Form Toggle */}
      <div className="mb-6 bg-gray-50 border rounded-lg p-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Manual Payment Form</h3>
          <p className="text-[10px] text-gray-400">Show manual proof submission option on enrollment page & enable shareable link</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer" data-testid="manual-form-toggle">
          <input type="checkbox" checked={manualFormEnabled} onChange={e => setManualFormEnabled(e.target.checked)} className="sr-only peer" />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
          <span className="ml-2 text-xs font-medium text-gray-700">{manualFormEnabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>

      {/* Exly Payment Gateway */}
      <div className="mb-6 bg-purple-50/50 border border-purple-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <ExternalLink size={16} className="text-purple-600" />
          <h3 className="text-sm font-semibold text-gray-900">Exly Payment Gateway</h3>
          <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">India Primary</span>
        </div>
        <p className="text-[10px] text-gray-400 mb-2">Exly handles GPay, debit & credit cards for Indian users. Payments are processed automatically.</p>
        <div>
          <label className="text-xs font-semibold text-gray-700 block mb-1">Exly Payment Link</label>
          <Input
            data-testid="india-exly-link-input"
            value={exlyLink}
            onChange={e => setExlyLink(e.target.value)}
            placeholder="e.g., divineirishealing.exlyapp.com/pay"
            className="text-xs h-9 font-mono"
          />
        </div>
      </div>

      {/* Divine Iris Bank Details — Multiple Accounts */}
      {/* India Pricing Adjustments */}
      <div className="mb-6 bg-green-50/50 border border-green-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Percent size={16} className="text-green-600" />
          <h3 className="text-sm font-semibold text-gray-900">India Alt. Payment Pricing</h3>
        </div>
        <p className="text-[10px] text-gray-400 mb-3">When Indian users choose Exly or bank transfer, the receipt shows a reduced base price + GST.</p>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Alt. Payment Discount (%)</label>
            <p className="text-[10px] text-gray-400 mb-1.5">Discount on base price</p>
            <Input data-testid="india-alt-discount-input" type="number" value={altDiscountPct}
              onChange={e => setAltDiscountPct(e.target.value)} className="text-xs h-9" min={0} max={100} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">GST (%)</label>
            <p className="text-[10px] text-gray-400 mb-1.5">On taxable amount</p>
            <Input data-testid="india-gst-input" type="number" value={gstPct}
              onChange={e => setGstPct(e.target.value)} className="text-xs h-9" min={0} max={100} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Platform Charges (%)</label>
            <p className="text-[10px] text-gray-400 mb-1.5">On taxable amount</p>
            <Input data-testid="india-platform-input" type="number" value={platformPct}
              onChange={e => setPlatformPct(e.target.value)} className="text-xs h-9" min={0} max={100} />
          </div>
        </div>

        <div className="mt-3 bg-white rounded-lg p-3 border text-xs">
          <p className="text-gray-500 mb-1">Receipt Preview (example INR 10,000 base):</p>
          <p className="text-gray-700">Taxable (after {altDiscountPct}% discount): <strong>INR {(10000 * (1 - (parseFloat(altDiscountPct) || 9) / 100)).toLocaleString()}</strong></p>
          <p className="text-gray-700">GST ({gstPct}%): <strong>INR {Math.round(10000 * (1 - (parseFloat(altDiscountPct) || 9) / 100) * (parseFloat(gstPct) || 18) / 100).toLocaleString()}</strong></p>
          <p className="text-gray-700">Platform ({platformPct}%): <strong>INR {Math.round(10000 * (1 - (parseFloat(altDiscountPct) || 9) / 100) * (parseFloat(platformPct) || 3) / 100).toLocaleString()}</strong></p>
          <p className="text-[#D4AF37] font-bold">Total: INR {Math.round(10000 * (1 - (parseFloat(altDiscountPct) || 9) / 100) * (1 + (parseFloat(gstPct) || 18) / 100 + (parseFloat(platformPct) || 3) / 100)).toLocaleString()}</p>
        </div>
      </div>
      </CollapsibleSection>

      {/* ════ INDIA PAYMENT GATEWAY ════ */}
      <CollapsibleSection title="India Payment Gateway" badge="Exly / Razorpay / PayU">
        <IndiaGatewayConfig />
      </CollapsibleSection>

      {/* ════ INR FOR NRI STUDENTS ════ */}
      <CollapsibleSection title="INR Pricing for NRI Students" badge="Whitelist, Tokens, Promo">
        <InrOverrideConfig />
      </CollapsibleSection>

      <Button onClick={save} disabled={saving} className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white" data-testid="save-payment-settings-btn">
        {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
        Save Payment Settings
      </Button>
    </div>
  );
};

/* ─── India Gateway Config ─── */
const IndiaGatewayConfig = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState({ gateway_type: 'exly_link', exly_link: '', api_key: '', api_secret: '', merchant_id: '', enabled: false, notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => {
      if (r.data?.india_payment_gateway) setConfig(prev => ({ ...prev, ...r.data.india_payment_gateway }));
    }).catch(() => {});
  }, []);

  const saveGateway = async () => {
    setSaving(true);
    try { await axios.put(`${API}/settings`, { india_payment_gateway: config }); toast({ title: 'Gateway saved!' }); }
    catch { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><p className="text-sm font-medium">Enable Gateway</p><p className="text-[10px] text-gray-500">Indian users will see this payment option</p></div>
        <Switch checked={config.enabled} onCheckedChange={v => setConfig(prev => ({ ...prev, enabled: v }))} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">Gateway Type</label>
        <select value={config.gateway_type} onChange={e => setConfig(prev => ({ ...prev, gateway_type: e.target.value }))} className="w-full h-9 border rounded-lg px-3 text-sm bg-white">
          <option value="exly_link">Exly (URL Link)</option>
          <option value="razorpay">Razorpay (API)</option>
          <option value="payu">PayU (API)</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      {config.gateway_type === 'exly_link' && (
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Exly Payment Link</label>
          <Input value={config.exly_link} onChange={e => setConfig(prev => ({ ...prev, exly_link: e.target.value }))} placeholder="https://www.exly.in/yourlink" className="h-9 text-sm" />
          <p className="text-[9px] text-gray-400 mt-1">Users will be redirected here to pay.</p>
        </div>
      )}
      {config.gateway_type !== 'exly_link' && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-medium text-gray-700 block mb-1">API Key</label>
            <Input value={config.api_key} onChange={e => setConfig(prev => ({ ...prev, api_key: e.target.value }))} placeholder="Key ID" className="h-9 text-sm font-mono" /></div>
          <div><label className="text-xs font-medium text-gray-700 block mb-1">API Secret</label>
            <Input type="password" value={config.api_secret} onChange={e => setConfig(prev => ({ ...prev, api_secret: e.target.value }))} placeholder="Secret" className="h-9 text-sm font-mono" /></div>
        </div>
      )}
      <div><label className="text-xs font-medium text-gray-700 block mb-1">Notes</label>
        <Input value={config.notes} onChange={e => setConfig(prev => ({ ...prev, notes: e.target.value }))} placeholder="Your notes" className="h-9 text-sm" /></div>
      <button onClick={saveGateway} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2">
        <Check size={14} /> {saving ? 'Saving...' : 'Save Gateway'}
      </button>
    </div>
  );
};

/* ─── INR Override for NRI ─── */
const InrOverrideConfig = () => {
  const { toast } = useToast();
  const [whitelist, setWhitelist] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newMaxUses, setNewMaxUses] = useState(10);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => setWhitelist(r.data?.inr_whitelist_emails || [])).catch(() => {});
    axios.get(`${API}/enrollment/inr-override/tokens`).then(r => setTokens(r.data || [])).catch(() => {});
  }, []);

  const saveWhitelist = async (list) => {
    setWhitelist(list);
    await axios.put(`${API}/settings`, { inr_whitelist_emails: list });
    toast({ title: 'Whitelist saved' });
  };

  const generateToken = async () => {
    try {
      const r = await axios.post(`${API}/enrollment/inr-override/generate-token`, { label: newLabel, max_uses: newMaxUses });
      setTokens(prev => [{ token: r.data.token, label: newLabel, max_uses: newMaxUses, used_count: 0, active: true }, ...prev]);
      setNewLabel(''); toast({ title: `Token: ${r.data.token}` });
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const copyLink = (token) => {
    navigator.clipboard.writeText(`${SITE_URL}/enroll/program/1?inr_token=${token}`);
    toast({ title: 'Link copied!' });
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">3 ways to give INR pricing to Indian students living abroad</p>

      {/* Whitelist */}
      <div>
        <p className="text-sm font-medium mb-1 flex items-center gap-1"><Mail size={14} className="text-blue-500" /> Email Whitelist</p>
        <div className="flex gap-2 mb-2">
          <Input value={newEmail} onChange={e => setNewEmail(e.target.value.toLowerCase())} placeholder="student@email.com" className="h-8 text-xs flex-1" />
          <Button size="sm" onClick={() => { if (newEmail.includes('@')) { saveWhitelist([...whitelist, newEmail.trim()]); setNewEmail(''); } }} className="h-8 bg-blue-500 text-white text-xs"><Plus size={12} /></Button>
        </div>
        <div className="flex flex-wrap gap-1">{whitelist.map((e, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded-full border border-blue-200">
            {e} <button onClick={() => saveWhitelist(whitelist.filter((_, j) => j !== i))} className="text-blue-400 hover:text-red-500"><X size={8} /></button>
          </span>
        ))}</div>
      </div>

      {/* Tokens */}
      <div>
        <p className="text-sm font-medium mb-1 flex items-center gap-1"><Key size={14} className="text-amber-500" /> Invite Tokens</p>
        <div className="flex gap-2 mb-2">
          <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label" className="h-8 text-xs flex-1" />
          <Input type="text" inputMode="decimal" value={newMaxUses} onChange={e => setNewMaxUses(parseInt(e.target.value) || 10)} className="h-8 text-xs w-16 text-center" />
          <Button size="sm" onClick={generateToken} className="h-8 bg-amber-500 text-white text-xs"><Plus size={12} /></Button>
        </div>
        <div className="space-y-1.5">{tokens.map(t => (
          <div key={t.token} className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200 text-xs">
            <span className="font-mono font-bold text-amber-800">{t.token}</span>
            <span className="text-gray-500">{t.label || '-'}</span>
            <span className="text-gray-400">Used: {t.used_count || 0}/{t.max_uses || 10}</span>
            <button onClick={() => copyLink(t.token)} className="ml-auto text-amber-600 hover:underline flex items-center gap-0.5"><Copy size={10} /> Link</button>
            <button onClick={async () => { await axios.delete(`${API}/enrollment/inr-override/tokens/${t.token}`); setTokens(prev => prev.filter(x => x.token !== t.token)); }} className="text-red-400"><Trash2 size={12} /></button>
          </div>
        ))}</div>
      </div>

      {/* Promo note */}
      <div className="bg-gray-50 rounded-lg p-3 text-[10px] text-gray-500">
        <strong>Method 3:</strong> Create an INR promo code in <strong>Promotions</strong> tab. When applied, it forces INR pricing.
      </div>
    </div>
  );
};

export default PaymentSettingsTab;
