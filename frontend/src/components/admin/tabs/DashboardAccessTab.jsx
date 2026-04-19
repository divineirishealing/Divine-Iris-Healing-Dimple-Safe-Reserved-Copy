import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { KeyRound, RefreshCw, Search, Loader2, Pencil } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../ui/dialog';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PREFERRED_LABEL = {
  gpay_upi: 'GPay / UPI',
  bank_transfer: 'Bank transfer',
  cash_deposit: 'Cash deposit',
  stripe: 'Stripe',
  gpay: 'GPay',
  upi: 'UPI',
};

const TAG_LABEL = {
  gpay: 'GPay',
  upi: 'UPI',
  gpay_upi: 'GPay / UPI',
  bank_transfer: 'Bank transfer',
  bank: 'Bank transfer',
  any: 'Any / Multiple',
  stripe: 'Stripe',
  cash_deposit: 'Cash deposit',
  cash: 'Cash deposit',
};

function labelFrom(map, raw) {
  const k = String(raw || '').trim().toLowerCase();
  if (!k) return '—';
  return map[k] || raw;
}

function gstSummary(cl) {
  if (!cl.india_tax_enabled) return 'No';
  const pct = cl.india_tax_percent ?? 18;
  const lab = (cl.india_tax_label || 'GST').trim();
  return `${pct}% ${lab}`;
}

function discountSummary(cl) {
  const d = cl.india_discount_percent;
  if (d === null || d === undefined || d === '') return '—';
  const n = Number(d);
  if (Number.isNaN(n)) return '—';
  return `${n}%`;
}

/**
 * Effective “annual” for display hint only (subscription may still qualify).
 * Editable field is `annual_member_dashboard`.
 */
function isAnnualViaSubscription(cl) {
  const sub = cl.subscription || {};
  if (String(sub.annual_program || '').trim()) return true;
  if (sub.package_id) return true;
  for (const p of sub.programs_detail || []) {
    const blob = `${p.label || ''} ${p.name || ''}`.toLowerCase();
    if (blob.includes('annual') || blob.includes('year')) return true;
  }
  return false;
}

export default function DashboardAccessTab() {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const searchRef = useRef(searchText);
  searchRef.current = searchText;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [annualMemberDashboard, setAnnualMemberDashboard] = useState(false);
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState('');
  const [indiaPaymentMethod, setIndiaPaymentMethod] = useState('');
  const [indiaDiscountPercent, setIndiaDiscountPercent] = useState('');
  const [indiaTaxEnabled, setIndiaTaxEnabled] = useState(false);
  const [indiaTaxPercent, setIndiaTaxPercent] = useState(18);
  const [indiaTaxLabel, setIndiaTaxLabel] = useState('GST');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = String(searchRef.current || '').trim();
      const params = {};
      if (q) params.search = q;
      const res = await axios.get(`${API}/clients`, { params });
      setClients(res.data || []);
    } catch (e) {
      console.error(e);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openEdit = (cl) => {
    setEditing(cl);
    setAnnualMemberDashboard(!!cl.annual_member_dashboard);
    setPreferredPaymentMethod(cl.preferred_payment_method || '');
    setIndiaPaymentMethod(cl.india_payment_method || '');
    setIndiaDiscountPercent(cl.india_discount_percent ?? '');
    setIndiaTaxEnabled(!!cl.india_tax_enabled);
    setIndiaTaxPercent(cl.india_tax_percent ?? 18);
    setIndiaTaxLabel(cl.india_tax_label || 'GST');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!editing?.id) return;
    setSaving(true);
    try {
      await axios.put(`${API}/clients/${editing.id}`, {
        annual_member_dashboard: annualMemberDashboard,
        // Empty string clears (backend treats "" as unset for these fields).
        preferred_payment_method: (preferredPaymentMethod || '').trim().toLowerCase() || '',
        india_payment_method: (indiaPaymentMethod || '').trim() || '',
        india_discount_percent:
          indiaDiscountPercent !== '' && indiaDiscountPercent !== null && indiaDiscountPercent !== undefined
            ? parseFloat(String(indiaDiscountPercent).replace(/,/g, '')) || 0
            : null,
        india_tax_enabled: indiaTaxEnabled,
        india_tax_percent: indiaTaxEnabled ? parseFloat(String(indiaTaxPercent)) || 0 : null,
        india_tax_label: (indiaTaxLabel || 'GST').trim() || 'GST',
      });
      toast({ title: 'Saved', description: 'Dashboard access fields updated.' });
      closeDialog();
      await fetchData();
    } catch (e) {
      console.error(e);
      toast({
        title: 'Save failed',
        description: e.response?.data?.detail || e.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => clients || [], [clients]);

  return (
    <div className="space-y-4" data-testid="admin-dashboard-access">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2">
          <KeyRound className="text-[#D4AF37] shrink-0 mt-0.5" size={22} />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Dashboard access</h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
              Set access type (annual on Sacred Home), preferred payment, India payment tag, GST, and per-client discount.
              Name, email, and phone are edited in Client Garden rows.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => fetchData()} className="shrink-0 gap-1.5">
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder="Search name, email, phone…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') fetchData();
          }}
          className="pl-9 text-sm"
        />
      </div>
      <p className="text-[10px] text-gray-400">Press Enter or use Refresh to run search.</p>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1080px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Preferred payment
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Payment tag
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Access type
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  GST
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Discount
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[88px]">
                  Edit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="inline animate-spin mr-2 align-middle" size={18} />
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">
                    No clients match.
                  </td>
                </tr>
              ) : (
                rows.map((cl) => {
                  const accessTagged = cl.annual_member_dashboard ? 'Annual' : 'Non-annual';
                  const subHint = !cl.annual_member_dashboard && isAnnualViaSubscription(cl);
                  return (
                    <tr key={cl.id} className="hover:bg-gray-50/80">
                      <td className="px-3 py-2 text-gray-900 font-medium max-w-[120px] truncate" title={cl.name}>
                        {cl.name || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate" title={cl.email}>
                        {(cl.email || '').trim() || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{(cl.phone || '').trim() || '—'}</td>
                      <td className="px-3 py-2 text-gray-700 text-xs max-w-[100px]">
                        {labelFrom(PREFERRED_LABEL, cl.preferred_payment_method)}
                      </td>
                      <td className="px-3 py-2 text-gray-700 text-xs max-w-[100px]">
                        {labelFrom(TAG_LABEL, cl.india_payment_method)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                            cl.annual_member_dashboard ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {accessTagged}
                        </span>
                        {subHint && (
                          <span className="block text-[9px] text-violet-600 mt-0.5" title="Also qualifies via subscription data">
                            +sub
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{gstSummary(cl)}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{discountSummary(cl)}</td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-[#D4AF37]"
                          onClick={() => openEdit(cl)}
                          data-testid={`dashboard-access-edit-${cl.id}`}
                        >
                          <Pencil size={14} />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="dashboard-access-edit-dialog">
          <DialogHeader>
            <DialogTitle>Edit dashboard access</DialogTitle>
            <DialogDescription>
              {editing?.name || 'Client'}
              {editing?.email ? (
                <span className="block text-xs text-gray-500 mt-1">{editing.email}</span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-gray-600">Access type (Sacred Home)</Label>
              <p className="text-[10px] text-gray-400 mb-1.5">Turn on for annual-member pricing on the dashboard.</p>
              <select
                value={annualMemberDashboard ? 'annual' : 'non_annual'}
                onChange={(e) => setAnnualMemberDashboard(e.target.value === 'annual')}
                className="w-full text-sm border rounded-md px-2 py-2 bg-white mt-1"
              >
                <option value="non_annual">Non-annual</option>
                <option value="annual">Annual</option>
              </select>
            </div>

            <div>
              <Label className="text-xs text-gray-600">Preferred payment method</Label>
              <select
                value={preferredPaymentMethod}
                onChange={(e) => setPreferredPaymentMethod(e.target.value)}
                className="w-full text-sm border rounded-md px-2 py-2 bg-white mt-1"
              >
                <option value="">— Not set —</option>
                <option value="gpay_upi">GPay / UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash_deposit">Cash deposit</option>
                <option value="stripe">Stripe</option>
              </select>
            </div>

            <div>
              <Label className="text-xs text-gray-600">Payment details tag</Label>
              <p className="text-[10px] text-gray-400 mb-1.5">Controls which India / manual options show on checkout.</p>
              <select
                value={indiaPaymentMethod}
                onChange={(e) => setIndiaPaymentMethod(e.target.value)}
                className="w-full text-sm border rounded-md px-2 py-2 bg-white mt-1"
              >
                <option value="">— Not tagged —</option>
                <option value="gpay_upi">GPay / UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash_deposit">Cash deposit</option>
                <option value="stripe">Stripe</option>
                <option value="any">Any / multiple</option>
              </select>
            </div>

            <div>
              <Label className="text-xs text-gray-600">Discount % on base price</Label>
              <p className="text-[10px] text-gray-400 mb-1">Applied before GST. Leave empty for no client-specific discount.</p>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={indiaDiscountPercent}
                  onChange={(e) => setIndiaDiscountPercent(e.target.value)}
                  placeholder="e.g. 9"
                  className="text-sm"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>

            <div className="rounded-lg border border-orange-100 bg-orange-50/40 px-3 py-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={indiaTaxEnabled}
                  onChange={(e) => setIndiaTaxEnabled(e.target.checked)}
                  className="rounded border-orange-300"
                />
                <span className="text-sm font-medium text-gray-800">GST / tax applicable on after-discount price</span>
              </label>
              {indiaTaxEnabled && (
                <div className="grid grid-cols-2 gap-2 pl-1">
                  <div>
                    <Label className="text-[10px] text-gray-500">Rate %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={indiaTaxPercent}
                      onChange={(e) => setIndiaTaxPercent(e.target.value)}
                      className="h-9 text-sm mt-0.5"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500">Label (e.g. GST)</Label>
                    <Input
                      value={indiaTaxLabel}
                      onChange={(e) => setIndiaTaxLabel(e.target.value)}
                      className="h-9 text-sm mt-0.5"
                      placeholder="GST"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" className="bg-[#D4AF37] hover:bg-[#b8962e]" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
