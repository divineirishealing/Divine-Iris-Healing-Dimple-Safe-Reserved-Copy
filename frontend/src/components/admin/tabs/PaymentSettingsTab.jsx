import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CreditCard, Plus, Trash2, Save, Loader2, GripVertical, ExternalLink } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LINK_TYPES = [
  { value: 'exly', label: 'Exly' },
  { value: 'gpay', label: 'Google Pay' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'custom', label: 'Custom Link' },
];

const PaymentSettingsTab = () => {
  const { toast } = useToast();
  const [disclaimer, setDisclaimer] = useState('');
  const [indiaLinks, setIndiaLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => {
      setDisclaimer(r.data.payment_disclaimer || '');
      setIndiaLinks(r.data.india_payment_links || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const addLink = () => {
    setIndiaLinks([...indiaLinks, { type: 'exly', label: '', url: '', details: '', enabled: true }]);
  };

  const updateLink = (i, field, value) => {
    const updated = [...indiaLinks];
    updated[i] = { ...updated[i], [field]: value };
    setIndiaLinks(updated);
  };

  const removeLink = (i) => setIndiaLinks(indiaLinks.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, {
        payment_disclaimer: disclaimer,
        india_payment_links: indiaLinks,
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
      <p className="text-xs text-gray-500 mb-6">Manage payment disclaimer and India-specific payment options.</p>

      {/* Disclaimer */}
      <div className="mb-6">
        <label className="text-xs font-semibold text-gray-700 block mb-1.5">Payment Disclaimer</label>
        <p className="text-[10px] text-gray-400 mb-2">Shown near pricing on enrollment and payment pages.</p>
        <textarea
          data-testid="payment-disclaimer-input"
          value={disclaimer}
          onChange={e => setDisclaimer(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-xs text-gray-700 resize-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
          placeholder="We love aligning our work with the natural solar cycle..."
        />
      </div>

      {/* India Payment Links */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="text-xs font-semibold text-gray-700">India Payment Options</label>
            <p className="text-[10px] text-gray-400">Alternative payment links shown to Indian users (Exly, GPay, Bank Transfer, etc.)</p>
          </div>
          <Button variant="outline" size="sm" onClick={addLink} data-testid="add-india-link-btn">
            <Plus size={12} className="mr-1" /> Add Link
          </Button>
        </div>

        {indiaLinks.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed text-xs text-gray-400">
            No India payment links configured. Indian users will only see Stripe card payment.
          </div>
        )}

        <div className="space-y-3">
          {indiaLinks.map((link, i) => (
            <div key={i} className="bg-white border rounded-lg p-4" data-testid={`india-link-${i}`}>
              <div className="flex items-start gap-3">
                <GripVertical size={14} className="text-gray-300 mt-2 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] text-gray-500 block mb-0.5">Type</label>
                      <select value={link.type} onChange={e => updateLink(i, 'type', e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-xs bg-white">
                        {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-500 block mb-0.5">Label (shown to user)</label>
                      <Input value={link.label} onChange={e => updateLink(i, 'label', e.target.value)}
                        placeholder="Pay with Exly" className="text-xs h-8" />
                    </div>
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <label className="text-[9px] text-gray-500 block mb-0.5">Enabled</label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={link.enabled} onChange={e => updateLink(i, 'enabled', e.target.checked)}
                            className="rounded border-gray-300 text-[#D4AF37] focus:ring-[#D4AF37]" />
                          <span className="text-[10px] text-gray-500">{link.enabled ? 'Active' : 'Hidden'}</span>
                        </label>
                      </div>
                      <button onClick={() => removeLink(i)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-500 block mb-0.5">URL / Payment Link</label>
                    <div className="flex gap-1">
                      <Input value={link.url} onChange={e => updateLink(i, 'url', e.target.value)}
                        placeholder="https://..." className="text-xs h-8 flex-1 font-mono" />
                      {link.url && (
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 flex-shrink-0">
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-500 block mb-0.5">Description / Benefits (optional)</label>
                    <Input value={link.details || ''} onChange={e => updateLink(i, 'details', e.target.value)}
                      placeholder="e.g., No international fees, instant confirmation" className="text-xs h-8" />
                  </div>
                </div>
              </div>
            </div>
          ))}
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
