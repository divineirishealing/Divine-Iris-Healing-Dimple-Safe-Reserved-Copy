import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CreditCard, Save, Loader2, Percent, ExternalLink, Building2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
  const [bankAccounts, setBankAccounts] = useState([
    { label: '', account_name: '', account_number: '', ifsc: '', bank_name: '', branch: '' }
  ]);
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
      // Support both old single bank and new multi-bank format
      if (r.data.india_bank_accounts && r.data.india_bank_accounts.length > 0) {
        setBankAccounts(r.data.india_bank_accounts);
      } else if (r.data.india_bank_details?.account_number) {
        setBankAccounts([{ label: r.data.india_bank_details.bank_name || 'Primary', ...r.data.india_bank_details }]);
      }
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
        india_bank_details: bankAccounts[0] || {},
        india_bank_accounts: bankAccounts.filter(b => b.account_number),
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

      {/* India Payment Master Toggle */}
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
      <div className="mb-6 bg-blue-50/50 border border-blue-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Divine Iris Bank Details</h3>
            <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{bankAccounts.length} account{bankAccounts.length > 1 ? 's' : ''}</span>
          </div>
          <button onClick={() => setBankAccounts([...bankAccounts, { label: '', account_name: '', account_number: '', ifsc: '', bank_name: '', branch: '' }])}
            className="text-[10px] px-3 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors font-medium">
            + Add Bank
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mb-3">Add your bank accounts. Users will see a dropdown to select which bank they transferred to.</p>

        <div className="space-y-4">
          {bankAccounts.map((bank, idx) => {
            const updateBank = (field, val) => {
              const updated = [...bankAccounts];
              updated[idx] = { ...updated[idx], [field]: val };
              setBankAccounts(updated);
            };
            return (
              <div key={idx} className="bg-white border rounded-lg p-4 relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] flex items-center justify-center font-bold">{idx + 1}</span>
                    <Input value={bank.label} onChange={e => updateBank('label', e.target.value)}
                      placeholder="Label (e.g., HDFC Savings, SBI Current)" className="text-xs h-8 w-56 font-semibold" />
                  </div>
                  {bankAccounts.length > 1 && (
                    <button onClick={() => setBankAccounts(bankAccounts.filter((_, i) => i !== idx))}
                      className="text-[10px] text-red-400 hover:text-red-600 px-2 py-0.5 rounded hover:bg-red-50">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-gray-500 block mb-0.5">Account Name</label>
                    <Input value={bank.account_name} onChange={e => updateBank('account_name', e.target.value)}
                      placeholder="Account holder name" className="text-xs h-8" />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-500 block mb-0.5">Account Number</label>
                    <Input value={bank.account_number} onChange={e => updateBank('account_number', e.target.value)}
                      placeholder="Account number" className="text-xs h-8 font-mono" />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-500 block mb-0.5">IFSC Code</label>
                    <Input value={bank.ifsc} onChange={e => updateBank('ifsc', e.target.value)}
                      placeholder="e.g., HDFC0001234" className="text-xs h-8 font-mono" />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-500 block mb-0.5">Bank Name</label>
                    <Input value={bank.bank_name} onChange={e => updateBank('bank_name', e.target.value)}
                      placeholder="e.g., HDFC Bank" className="text-xs h-8" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[9px] text-gray-500 block mb-0.5">Branch</label>
                    <Input value={bank.branch} onChange={e => updateBank('branch', e.target.value)}
                      placeholder="Branch name" className="text-xs h-8" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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

      <Button onClick={save} disabled={saving} className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white" data-testid="save-payment-settings-btn">
        {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
        Save Payment Settings
      </Button>
    </div>
  );
};

export default PaymentSettingsTab;
