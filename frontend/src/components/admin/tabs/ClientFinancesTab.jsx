import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { IndianRupee, Loader2, Pencil, RefreshCw, Search } from 'lucide-react';
import { getApiUrl } from '../../../lib/config';
import { buildClientFinancePutPayload } from '../../../lib/clientFinanceAdmin';
import { serverBandsToRows, validateBandRows } from '../../../lib/indiaDiscountBandsUi';
import ClientFinanceFields from '../ClientFinanceFields';
import { gstSummary, discountSummary } from '../../../lib/adminClientAccessDisplay';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../ui/dialog';
import { useToast } from '../../../hooks/use-toast';

const API = getApiUrl();
const FINANCE_PRESELECT_KEY = 'admin_finance_focus_client_id';

/**
 * Dedicated list + editor for per-client payment rails, India discount/tax/bands, CRM portal fees.
 * Same PUT fields as Dashboard access (finance section only) — no duplicated business logic.
 */
export default function ClientFinancesTab() {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const searchRef = useRef(searchText);
  searchRef.current = searchText;

  const [indiaSite, setIndiaSite] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState('');
  const [indiaPaymentMethod, setIndiaPaymentMethod] = useState('');
  const [preferredIndiaGpayId, setPreferredIndiaGpayId] = useState('');
  const [preferredIndiaBankId, setPreferredIndiaBankId] = useState('');
  const [indiaDiscountPercent, setIndiaDiscountPercent] = useState('');
  const [indiaDiscountBandRows, setIndiaDiscountBandRows] = useState([]);
  const [indiaTaxEnabled, setIndiaTaxEnabled] = useState(false);
  const [indiaTaxPercent, setIndiaTaxPercent] = useState(18);
  const [indiaTaxLabel, setIndiaTaxLabel] = useState('GST');
  const [crmLateFeePerDay, setCrmLateFeePerDay] = useState('');
  const [crmChannelizationFee, setCrmChannelizationFee] = useState('');
  const [crmShowLateFees, setCrmShowLateFees] = useState('');

  useEffect(() => {
    axios
      .get(`${API}/settings`)
      .then((r) => setIndiaSite(r.data || {}))
      .catch(() => setIndiaSite({}));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = String(searchRef.current || '').trim();
      const params = {};
      if (q) params.search = q;
      const { data } = await axios.get(`${API}/clients`, { params });
      setClients(Array.isArray(data) ? data : []);
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

  const setIndiaMethodTagged = (v) => {
    setIndiaPaymentMethod(v);
    const gpayOk = v === 'gpay_upi' || v === 'any' || v === '';
    const bankOk = v === 'bank_transfer' || v === 'cash_deposit' || v === 'any' || v === '';
    if (!gpayOk) setPreferredIndiaGpayId('');
    if (!bankOk) setPreferredIndiaBankId('');
  };

  const onPreferredPaymentChange = (v) => {
    const low = (v || '').trim().toLowerCase();
    setPreferredPaymentMethod(v);
    if (low === 'stripe') {
      setPreferredIndiaGpayId('');
      setPreferredIndiaBankId('');
    } else if (low === 'bank_transfer' || low === 'cash_deposit') {
      setPreferredIndiaGpayId('');
    } else if (low === 'gpay_upi') {
      setPreferredIndiaBankId('');
    }
  };

  const openEdit = useCallback((cl) => {
    setEditing(cl);
    setPreferredPaymentMethod(cl.preferred_payment_method || '');
    setIndiaPaymentMethod(cl.india_payment_method || '');
    setPreferredIndiaGpayId(cl.preferred_india_gpay_id || '');
    setPreferredIndiaBankId(cl.preferred_india_bank_id || '');
    setIndiaDiscountPercent(cl.india_discount_percent ?? '');
    setIndiaDiscountBandRows(serverBandsToRows(cl.india_discount_member_bands || []));
    setIndiaTaxEnabled(!!cl.india_tax_enabled);
    setIndiaTaxPercent(cl.india_tax_percent ?? 18);
    setIndiaTaxLabel(cl.india_tax_label || 'GST');
    setCrmLateFeePerDay(
      cl.crm_late_fee_per_day != null && cl.crm_late_fee_per_day !== '' ? String(cl.crm_late_fee_per_day) : '',
    );
    setCrmChannelizationFee(
      cl.crm_channelization_fee != null && cl.crm_channelization_fee !== ''
        ? String(cl.crm_channelization_fee)
        : '',
    );
    {
      const sh = cl.crm_show_late_fees;
      setCrmShowLateFees(sh === true ? 'true' : sh === false ? 'false' : '');
    }
    setDialogOpen(true);
  }, []);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!editing?.id) return;
    const bandErr = validateBandRows(indiaDiscountBandRows);
    if (bandErr) {
      toast({ title: 'Group discount rules', description: bandErr, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/clients/${editing.id}`, {
        ...buildClientFinancePutPayload({
          preferredPaymentMethod,
          indiaPaymentMethod,
          preferredIndiaGpayId,
          preferredIndiaBankId,
          indiaDiscountPercent,
          indiaDiscountBandRows,
          indiaTaxEnabled,
          indiaTaxPercent,
          indiaTaxLabel,
          crmLateFeePerDay,
          crmChannelizationFee,
          crmShowLateFees,
        }),
      });
      toast({ title: 'Saved', description: 'Client finance fields updated.' });
      closeDialog();
      await fetchData();
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e.response?.data?.detail || e.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!clients.length) return;
    const id = localStorage.getItem(FINANCE_PRESELECT_KEY);
    if (!id) return;
    localStorage.removeItem(FINANCE_PRESELECT_KEY);
    const cl = clients.find((c) => c.id === id);
    if (cl) openEdit(cl);
  }, [clients, openEdit]);

  const rows = useMemo(() => {
    const list = [...(clients || [])];
    list.sort((a, b) => {
      const tb = new Date(b.updated_at || b.created_at || 0).getTime();
      const ta = new Date(a.updated_at || a.created_at || 0).getTime();
      return tb - ta;
    });
    return list;
  }, [clients]);

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6">
      <div className="flex items-center gap-2 mb-1 shrink-0">
        <IndianRupee size={20} className="text-[#D4AF37]" />
        <h2 className="text-lg font-semibold text-gray-900">Client finances</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4 shrink-0 max-w-3xl">
        Payment rails (preferred / tagged), India discount and GST rules, Sacred Home late &amp; channelization CRM
        defaults. Edits apply to the same Client Garden record as{' '}
        <strong className="text-gray-700">Dashboard access</strong> (only the finance fields are sent from here). Site
        defaults stay under <strong className="text-gray-700">Indian Payment</strong>; subscriber Excel still overrides
        when filled on an authoritative row.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
        <div className="relative flex-1 min-w-[12rem] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            placeholder="Search name, email, phone, id…"
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1" onClick={() => fetchData()}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Name</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Email</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">GST / tax</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Discount</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-700 w-24">Edit</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">
                  <Loader2 className="h-6 w-6 animate-spin inline-block mr-2 align-middle" />
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">
                  No clients match.
                </td>
              </tr>
            ) : (
              rows.map((cl) => (
                <tr key={cl.id || cl.email} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-3 py-2 font-medium text-gray-900">{(cl.name || '').trim() || '—'}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={cl.email}>
                    {(cl.email || '').trim() || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{gstSummary(cl)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{discountSummary(cl)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-[#D4AF37]"
                      onClick={() => openEdit(cl)}
                    >
                      <Pencil size={14} />
                      Edit
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="client-finances-edit-dialog">
          <DialogHeader>
            <DialogTitle>Client finances</DialogTitle>
            <DialogDescription>
              {(editing?.name || 'Client').trim()}
              {editing?.email ? ` · ${(editing.email || '').trim()}` : null}
              {editing?.id ? (
                <span className="block text-[10px] text-gray-400 mt-1 font-mono">{editing.id}</span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <ClientFinanceFields
              indiaSite={indiaSite}
              preferredPaymentMethod={preferredPaymentMethod}
              onPreferredPaymentChange={onPreferredPaymentChange}
              indiaPaymentMethod={indiaPaymentMethod}
              onIndiaPaymentMethodChange={setIndiaMethodTagged}
              preferredIndiaGpayId={preferredIndiaGpayId}
              onPreferredIndiaGpayIdChange={setPreferredIndiaGpayId}
              preferredIndiaBankId={preferredIndiaBankId}
              onPreferredIndiaBankIdChange={setPreferredIndiaBankId}
              indiaDiscountPercent={indiaDiscountPercent}
              onIndiaDiscountPercentChange={setIndiaDiscountPercent}
              indiaDiscountBandRows={indiaDiscountBandRows}
              onIndiaDiscountBandRowsChange={setIndiaDiscountBandRows}
              indiaTaxEnabled={indiaTaxEnabled}
              onIndiaTaxEnabledChange={setIndiaTaxEnabled}
              indiaTaxPercent={indiaTaxPercent}
              onIndiaTaxPercentChange={setIndiaTaxPercent}
              indiaTaxLabel={indiaTaxLabel}
              onIndiaTaxLabelChange={setIndiaTaxLabel}
              crmLateFeePerDay={crmLateFeePerDay}
              onCrmLateFeePerDayChange={setCrmLateFeePerDay}
              crmChannelizationFee={crmChannelizationFee}
              onCrmChannelizationFeeChange={setCrmChannelizationFee}
              crmShowLateFees={crmShowLateFees}
              onCrmShowLateFeesChange={setCrmShowLateFees}
              testIdPrefix="client-finances"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#D4AF37] hover:bg-[#b8962e]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
