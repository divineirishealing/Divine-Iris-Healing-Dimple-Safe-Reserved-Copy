import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { IndianRupee, Loader2, Pencil, RefreshCw, Search } from 'lucide-react';
import { getApiUrl } from '../../../lib/config';
import { buildClientFinancePutPayload } from '../../../lib/clientFinanceAdmin';
import { serverBandsToRows, validateBandRows } from '../../../lib/indiaDiscountBandsUi';
import ClientFinanceFields from '../ClientFinanceFields';
import {
  gstSummary,
  discountSummary,
  labelFrom,
  PREFERRED_LABEL,
  TAG_LABEL,
} from '../../../lib/adminClientAccessDisplay';
import { formatDateDdMonYyyy } from '../../../lib/utils';
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

function formatAnnualDate(raw) {
  const s = (raw || '').trim();
  if (!s) return '—';
  return formatDateDdMonYyyy(s.slice(0, 10)) || s;
}

function subscriptionBlock(cl) {
  return cl?.subscription && typeof cl.subscription === 'object' ? cl.subscription : {};
}

function irisTierLine(cl) {
  const sub = subscriptionBlock(cl);
  const y = sub.iris_year;
  const lbl = (cl.label || '').trim();
  const parts = [];
  if (y != null && y !== '') parts.push(`Year ${y}`);
  if (lbl) parts.push(lbl);
  return parts.length ? parts.join(' · ') : '—';
}

function annualFeeLine(cl) {
  const sub = subscriptionBlock(cl);
  const fee = sub.total_fee;
  const cur = (sub.currency || 'INR').toString().trim() || 'INR';
  if (fee == null || fee === '') return '—';
  const n = Number(fee);
  if (!Number.isFinite(n)) return `${fee} ${cur}`;
  return `${n.toLocaleString()} ${cur}`;
}

function paymentModeLine(cl) {
  const sub = subscriptionBlock(cl);
  const pm = (sub.payment_mode || '').trim();
  if (pm) return pm;
  const emis = sub.emis;
  if (Array.isArray(emis) && emis.length) return 'EMI schedule';
  return '—';
}

function paymentMethodSummary(cl) {
  const pref = (cl.preferred_payment_method || '').trim();
  const tag = (cl.india_payment_method || '').trim();
  const pl = pref ? labelFrom(PREFERRED_LABEL, pref) : '';
  const tl = tag ? labelFrom(TAG_LABEL, tag) : '';
  if (pl && tl && pl !== tl) return `${pl} · ${tl}`;
  if (pl) return pl;
  if (tl) return tl;
  return '—';
}

function emiProgressLine(cl) {
  const sub = subscriptionBlock(cl);
  const emis = sub.emis;
  if (!Array.isArray(emis) || !emis.length) return '—';
  const paid = emis.filter((e) => e.status === 'paid').length;
  return `${paid}/${emis.length} paid`;
}

/**
 * Annual CRM members only — dates, subscriber fee/EMI, payment rails, India discount/tax (editable).
 */
export default function ClientFinancesTab() {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const [indiaSite, setIndiaSite] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

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
      const q = String(searchText || '').trim();
      const params = {};
      if (q) params.search = q;
      const { data } = await axios.get(`${API}/clients/annual-finance-roster`, { params });
      setClients(Array.isArray(data?.clients) ? data.clients : []);
    } catch (e) {
      console.error(e);
      setClients([]);
      toast({
        title: 'Could not load roster',
        description: e.response?.data?.detail || e.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [searchText]);

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
    setPaymentHistory([]);
  };

  useEffect(() => {
    if (!dialogOpen || !editing?.id) {
      setPaymentHistory([]);
      return;
    }
    let cancelled = false;
    setLoadingPayments(true);
    axios
      .get(`${API}/payment-mgmt/history/${editing.id}`)
      .then((r) => {
        if (!cancelled) setPaymentHistory(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {
        if (!cancelled) setPaymentHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPayments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, editing?.id]);

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
      toast({ title: 'Saved', description: 'Finance fields updated.' });
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

  const rows = useMemo(() => clients || [], [clients]);

  const editingSub = subscriptionBlock(editing);
  const editingAnnual = editing?.annual_subscription && typeof editing.annual_subscription === 'object'
    ? editing.annual_subscription
    : {};
  const editingEmis = Array.isArray(editingSub.emis) ? editingSub.emis : [];

  const colCount = 13;

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6">
      <div className="flex items-center gap-2 mb-1 shrink-0">
        <IndianRupee size={20} className="text-[#D4AF37]" />
        <h2 className="text-lg font-semibold text-gray-900">Client finances</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4 shrink-0 max-w-3xl">
        <strong>Annual money view:</strong> Home Coming window, subscriber fee &amp; EMI mode from Excel/Subscribers, CRM
        payment rails, India discounts &amp; taxes. Includes anyone with the <strong>Annual</strong> CRM flag, Home
        Coming start/end dates, or a priced subscriber row (package, fee, or EMIs). Edit subscription totals in{' '}
        <strong>Subscribers</strong> or <strong>Annual + dashboard</strong>; open a row for proof submissions.
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
          Search / refresh
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-lg border bg-white">
        <table className="w-full text-xs min-w-[72rem]">
          <thead className="bg-gray-50 border-b sticky top-0 z-10">
            <tr>
              <th className="text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap">Name</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap">Email</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap">Start</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap">End</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap">Status</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap">Iris / label</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap">Annual fee</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap">Pay method</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap">Mode</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap">EMIs</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap">Discount</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700 whitespace-nowrap">Tax</th>
              <th className="text-right px-2 py-2 font-semibold text-gray-700 w-20">Edit</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-12 text-center text-gray-400 text-sm">
                  <Loader2 className="h-6 w-6 animate-spin inline-block mr-2 align-middle" />
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-12 text-center text-gray-400 text-sm">
                  No one qualifies yet. Enable <strong>Annual</strong> in Dashboard access, or set Home Coming dates /
                  subscriber fee (Excel or Subscribers) so this list can pick them up.
                </td>
              </tr>
            ) : (
              rows.map((cl) => {
                const asub = cl.annual_subscription || {};
                const life = cl.annual_portal_lifecycle;
                return (
                  <tr key={cl.id || cl.email} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="px-2 py-2 font-medium text-gray-900 whitespace-nowrap">
                      {(cl.name || '').trim() || '—'}
                    </td>
                    <td className="px-2 py-2 text-gray-600 max-w-[9rem] truncate" title={cl.email}>
                      {(cl.email || '').trim() || '—'}
                    </td>
                    <td className="px-2 py-2 tabular-nums whitespace-nowrap">{formatAnnualDate(asub.start_date)}</td>
                    <td className="px-2 py-2 tabular-nums whitespace-nowrap">{formatAnnualDate(asub.end_date)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{life?.label ?? '—'}</td>
                    <td className="px-2 py-2 text-[11px] text-gray-800 max-w-[10rem] leading-snug">
                      {irisTierLine(cl)}
                    </td>
                    <td className="px-2 py-2 tabular-nums whitespace-nowrap">{annualFeeLine(cl)}</td>
                    <td className="px-2 py-2 text-[11px] max-w-[8rem] leading-snug">{paymentMethodSummary(cl)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{paymentModeLine(cl)}</td>
                    <td className="px-2 py-2 tabular-nums whitespace-nowrap">{emiProgressLine(cl)}</td>
                    <td className="px-2 py-2 text-[11px]">{discountSummary(cl)}</td>
                    <td className="px-2 py-2 text-[11px]">{gstSummary(cl)}</td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-[#D4AF37] px-2"
                        onClick={() => openEdit(cl)}
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

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="client-finances-edit-dialog">
          <DialogHeader>
            <DialogTitle>Annual subscriber finances</DialogTitle>
            <DialogDescription>
              {(editing?.name || 'Client').trim()}
              {editing?.email ? ` · ${(editing.email || '').trim()}` : null}
              {editing?.id ? (
                <span className="block text-[10px] text-gray-400 mt-1 font-mono">{editing.id}</span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-violet-200/80 bg-violet-50/50 px-3 py-3 space-y-2 text-xs">
              <p className="font-semibold text-gray-900">Annual window &amp; package (read-only)</p>
              <p className="text-[10px] text-gray-500 -mt-1">
                Change dates and package totals via <strong>Annual + dashboard</strong> or <strong>Subscribers</strong>.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-gray-500">Start</span>
                  <p className="font-medium tabular-nums">{formatAnnualDate(editingAnnual.start_date)}</p>
                </div>
                <div>
                  <span className="text-gray-500">End</span>
                  <p className="font-medium tabular-nums">{formatAnnualDate(editingAnnual.end_date)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Iris / label</span>
                  <p className="font-medium">{irisTierLine(editing || {})}</p>
                </div>
                <div>
                  <span className="text-gray-500">Annual fee</span>
                  <p className="font-medium tabular-nums">{annualFeeLine(editing || {})}</p>
                </div>
                <div>
                  <span className="text-gray-500">Payment mode</span>
                  <p className="font-medium">{paymentModeLine(editing || {})}</p>
                </div>
                <div>
                  <span className="text-gray-500">Voluntary credits</span>
                  <p className="font-medium tabular-nums">
                    {Number(editingSub.voluntary_credits_total || 0).toLocaleString()}{' '}
                    {(editingSub.currency || 'INR').toString().trim() || 'INR'}
                  </p>
                </div>
              </div>
            </div>

            {editingEmis.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-3">
                <p className="text-xs font-semibold text-gray-900 mb-2">EMI schedule</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-1 pr-2">#</th>
                        <th className="py-1 pr-2">Due</th>
                        <th className="py-1 pr-2">Amount</th>
                        <th className="py-1 pr-2">Status</th>
                        <th className="py-1 pr-2">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingEmis.map((e) => (
                        <tr key={e.number} className="border-b border-gray-100">
                          <td className="py-1 pr-2 tabular-nums">{e.number}</td>
                          <td className="py-1 pr-2 tabular-nums whitespace-nowrap">
                            {formatAnnualDate(e.due_date)}
                          </td>
                          <td className="py-1 pr-2 tabular-nums">{Number(e.amount || 0).toLocaleString()}</td>
                          <td className="py-1 pr-2 capitalize">{e.status || '—'}</td>
                          <td className="py-1 pr-2 tabular-nums">
                            {e.remaining != null ? Number(e.remaining).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-sky-200/70 bg-sky-50/40 px-3 py-3">
              <p className="text-xs font-semibold text-gray-900 mb-1">Manual payment proofs</p>
              <p className="text-[10px] text-gray-500 mb-2">
                Student-submitted proofs (admin approves in Subscribers → pending payments).
              </p>
              {loadingPayments ? (
                <p className="text-xs text-gray-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </p>
              ) : paymentHistory.length === 0 ? (
                <p className="text-xs text-gray-500">No submissions on file.</p>
              ) : (
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-1 pr-2">When</th>
                        <th className="py-1 pr-2">EMI #</th>
                        <th className="py-1 pr-2">Amount</th>
                        <th className="py-1 pr-2">Method</th>
                        <th className="py-1 pr-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((p) => (
                        <tr key={p.id} className="border-b border-gray-100">
                          <td className="py-1 pr-2 whitespace-nowrap">
                            {(p.submitted_at || '').slice(0, 16).replace('T', ' ') || '—'}
                          </td>
                          <td className="py-1 pr-2 tabular-nums">
                            {p.is_voluntary ? 'vol.' : p.emi_number ?? '—'}
                          </td>
                          <td className="py-1 pr-2 tabular-nums">{Number(p.amount || 0).toLocaleString()}</td>
                          <td className="py-1 pr-2">{p.payment_method || '—'}</td>
                          <td className="py-1 pr-2 capitalize">{p.status || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-800 mb-2">CRM: rails, discounts &amp; taxes</p>
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
              {saving ? 'Saving…' : 'Save CRM finance fields'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
