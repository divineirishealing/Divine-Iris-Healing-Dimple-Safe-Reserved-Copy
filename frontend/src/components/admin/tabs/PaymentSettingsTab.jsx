import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CreditCard, Save, Loader2, QrCode, Percent } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PaymentSettingsTab = () => {
  const { toast } = useToast();
  const [disclaimer, setDisclaimer] = useState('');
  const [upiId, setUpiId] = useState('');
  const [altDiscountPct, setAltDiscountPct] = useState(9);
  const [gstPct, setGstPct] = useState(18);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => {
      setDisclaimer(r.data.payment_disclaimer || '');
      setUpiId(r.data.india_upi_id || '');
      setAltDiscountPct(r.data.india_alt_discount_percent ?? 9);
      setGstPct(r.data.india_gst_percent ?? 18);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, {
        payment_disclaimer: disclaimer,
        india_upi_id: upiId,
        india_alt_discount_percent: parseFloat(altDiscountPct) || 9,
        india_gst_percent: parseFloat(gstPct) || 18,
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
      <p className="text-xs text-gray-500 mb-6">Manage payment disclaimer and India GPay/UPI payment options.</p>

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

      {/* GPay / UPI Settings */}
      <div className="mb-6 bg-green-50/50 border border-green-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <QrCode size={16} className="text-green-600" />
          <h3 className="text-sm font-semibold text-gray-900">GPay / UPI Payment</h3>
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-700 block mb-1">UPI ID</label>
          <p className="text-[10px] text-gray-400 mb-1.5">QR code will be auto-generated from this UPI ID.</p>
          <Input
            data-testid="india-upi-id-input"
            value={upiId}
            onChange={e => setUpiId(e.target.value)}
            placeholder="e.g., yourname@okhdfcbank"
            className="text-xs h-9 font-mono"
          />
        </div>
      </div>

      {/* India Pricing Adjustments */}
      <div className="mb-6 bg-blue-50/50 border border-blue-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Percent size={16} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">India Alt. Payment Pricing</h3>
        </div>
        <p className="text-[10px] text-gray-400 mb-3">When Indian users choose GPay/UPI, the receipt shows a reduced base price + GST.</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Alt. Payment Discount (%)</label>
            <p className="text-[10px] text-gray-400 mb-1.5">Discount on base price for UPI payment</p>
            <Input
              data-testid="india-alt-discount-input"
              type="number"
              value={altDiscountPct}
              onChange={e => setAltDiscountPct(e.target.value)}
              className="text-xs h-9"
              min={0}
              max={100}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">GST (%)</label>
            <p className="text-[10px] text-gray-400 mb-1.5">Added on top of discounted base price</p>
            <Input
              data-testid="india-gst-input"
              type="number"
              value={gstPct}
              onChange={e => setGstPct(e.target.value)}
              className="text-xs h-9"
              min={0}
              max={100}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="mt-3 bg-white rounded-lg p-3 border text-xs">
          <p className="text-gray-500 mb-1">Receipt Preview (example INR 10,000 base):</p>
          <p className="text-gray-700">Base after {altDiscountPct}% discount: <strong>INR {(10000 * (1 - (parseFloat(altDiscountPct) || 9) / 100)).toLocaleString()}</strong></p>
          <p className="text-gray-700">GST ({gstPct}%): <strong>INR {Math.round(10000 * (1 - (parseFloat(altDiscountPct) || 9) / 100) * (parseFloat(gstPct) || 18) / 100).toLocaleString()}</strong></p>
          <p className="text-[#D4AF37] font-bold">Total: INR {Math.round(10000 * (1 - (parseFloat(altDiscountPct) || 9) / 100) * (1 + (parseFloat(gstPct) || 18) / 100)).toLocaleString()}</p>
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
