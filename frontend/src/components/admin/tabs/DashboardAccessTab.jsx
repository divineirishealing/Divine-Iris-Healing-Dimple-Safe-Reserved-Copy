import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { KeyRound, RefreshCw, Search, Loader2, Pencil, Bell, Trash2, Lock, SlidersHorizontal, Eye } from 'lucide-react';
import { buildIndiaGpayOptions, buildIndiaBankOptions } from '../../../lib/indiaPaymentTags';
import {
  PREFERRED_LABEL,
  TAG_LABEL,
  labelFrom,
  gstSummary,
  discountSummary,
  formatTaggedPaymentDetails,
} from '../../../lib/adminClientAccessDisplay';
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
import { useAuth } from '../../../context/AuthContext';
import { getBackendUrl } from '../../../lib/config';
import { serverBandsToRows, validateBandRows } from '../../../lib/indiaDiscountBandsUi';
import { buildClientFinancePutPayload } from '../../../lib/clientFinanceAdmin';
import ClientFinanceFields from '../ClientFinanceFields';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join('; ');
  if (d && typeof d === 'object') return JSON.stringify(d);
  return err.message || 'Request failed';
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

/** Intake "new" queue: pending only while Google login is still blocked. */
function isPendingIntakeReview(cl) {
  return !!cl?.intake_pending && cl.portal_login_allowed === false;
}

export default function DashboardAccessTab() {
  const { toast } = useToast();
  const { checkAuth } = useAuth();
  const [clients, setClients] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const searchRef = useRef(searchText);
  searchRef.current = searchText;
  /** Site Settings — Indian Payment GPay rows & bank rows (same source as Client Garden). */
  const [indiaSite, setIndiaSite] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [clientEmail, setClientEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [annualMemberDashboard, setAnnualMemberDashboard] = useState(false);
  /** When False, student Home Coming package page hides EMI — monthly for this client only. */
  const [annualPackageOfferMonthlyEmiVisible, setAnnualPackageOfferMonthlyEmiVisible] = useState(true);
  const [portalLoginAllowed, setPortalLoginAllowed] = useState(true);
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState('');
  const [indiaPaymentMethod, setIndiaPaymentMethod] = useState('');
  const [preferredIndiaGpayId, setPreferredIndiaGpayId] = useState('');
  const [preferredIndiaBankId, setPreferredIndiaBankId] = useState('');
  const [indiaDiscountPercent, setIndiaDiscountPercent] = useState('');
  const [indiaDiscountBandRows, setIndiaDiscountBandRows] = useState([]);
  const [indiaTaxEnabled, setIndiaTaxEnabled] = useState(false);
  const [indiaTaxPercent, setIndiaTaxPercent] = useState(18);
  const [indiaTaxLabel, setIndiaTaxLabel] = useState('GST');
  /** CRM portal fee defaults: empty = follow site / subscription merge. */
  const [crmLateFeePerDay, setCrmLateFeePerDay] = useState('');
  const [crmChannelizationFee, setCrmChannelizationFee] = useState('');
  /** '' | 'true' | 'false' — empty = use site default in merge. */
  const [crmShowLateFees, setCrmShowLateFees] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [bulkFieldsOpen, setBulkFieldsOpen] = useState(false);
  const [bulkFieldsSaving, setBulkFieldsSaving] = useState(false);
  const [bulkApply, setBulkApply] = useState({
    access: false,
    preferred: false,
    tag: false,
    gpay: false,
    bank: false,
    discount: false,
    tax: false,
  });
  const [bulkAnnualMember, setBulkAnnualMember] = useState(false);
  const [bulkPreferred, setBulkPreferred] = useState('');
  const [bulkIndiaMethod, setBulkIndiaMethod] = useState('');
  const [bulkGpayId, setBulkGpayId] = useState('');
  const [bulkBankId, setBulkBankId] = useState('');
  const [bulkDiscountStr, setBulkDiscountStr] = useState('');
  const [bulkTaxEnabled, setBulkTaxEnabled] = useState(false);
  const [bulkTaxPct, setBulkTaxPct] = useState('18');
  const [bulkTaxLabel, setBulkTaxLabel] = useState('GST');

  const [pricingPreviewOpen, setPricingPreviewOpen] = useState(false);
  const [pricingPreviewClient, setPricingPreviewClient] = useState(null);
  const [pricingPreviewData, setPricingPreviewData] = useState(null);
  const [pricingPreviewLoading, setPricingPreviewLoading] = useState(false);
  const [previewAdminPassword, setPreviewAdminPassword] = useState('');
  const [openingDashboard, setOpeningDashboard] = useState(false);

  const indiaGpayOpts = useMemo(() => buildIndiaGpayOptions(indiaSite || {}), [indiaSite]);
  const indiaBankOpts = useMemo(() => buildIndiaBankOptions(indiaSite || {}), [indiaSite]);

  const showBulkGpayPicker = useMemo(() => {
    const pref = (bulkPreferred || '').trim().toLowerCase();
    const tag = (bulkIndiaMethod || '').trim().toLowerCase();
    return (
      pref === 'gpay_upi' ||
      tag === 'gpay_upi' ||
      tag === 'gpay' ||
      tag === 'upi' ||
      tag === 'any'
    );
  }, [bulkPreferred, bulkIndiaMethod]);

  const showBulkBankPicker = useMemo(() => {
    const pref = (bulkPreferred || '').trim().toLowerCase();
    const tag = (bulkIndiaMethod || '').trim().toLowerCase();
    return (
      pref === 'bank_transfer' ||
      pref === 'cash_deposit' ||
      tag === 'bank_transfer' ||
      tag === 'cash_deposit' ||
      tag === 'cash' ||
      tag === 'any'
    );
  }, [bulkPreferred, bulkIndiaMethod]);

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
      const [cRes, pcRes] = await Promise.all([
        axios.get(`${API}/clients`, { params }),
        axios.get(`${API}/client-intake/pending-count`),
      ]);
      setClients(cRes.data || []);
      setPendingCount(pcRes.data?.count ?? 0);
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

  const loadPricingPreview = async (cl, pwd = '') => {
    if (!cl?.id) return;
    setPricingPreviewLoading(true);
    setPricingPreviewData(null);
    try {
      const adminTok = (typeof localStorage !== 'undefined' && localStorage.getItem('admin_token')) || '';
      const headers = {};
      if (adminTok) headers['X-Admin-Session'] = adminTok;
      const body = {};
      if (String(pwd || '').trim()) body.admin_password = String(pwd).trim();
      const res = await axios.post(
        `${API}/admin/clients/${cl.id}/dashboard-pricing-preview?currency=inr`,
        body,
        { headers }
      );
      setPricingPreviewData(res.data);
    } catch (err) {
      toast({
        title: 'Could not load pricing preview',
        description: formatApiError(err),
        variant: 'destructive',
      });
    } finally {
      setPricingPreviewLoading(false);
    }
  };

  const openPricingPreview = (cl) => {
    setPricingPreviewClient(cl);
    setPreviewAdminPassword('');
    setPricingPreviewOpen(true);
    void loadPricingPreview(cl, '');
  };

  const openFullStudentDashboard = async () => {
    const cl = pricingPreviewClient;
    const em = (cl?.email || '').trim();
    const cid = (cl?.id || '').trim();
    if (!em && !cid) {
      toast({
        title: 'Cannot open dashboard',
        description: 'This record has no id — save it in Iris Garden first.',
        variant: 'destructive',
      });
      return;
    }
    setOpeningDashboard(true);
    try {
      const adminTok = (typeof localStorage !== 'undefined' && localStorage.getItem('admin_token')) || '';
      const headers = {};
      if (adminTok) headers['X-Admin-Session'] = adminTok;
      const payload = em ? { email: em } : { client_id: cid };
      if (previewAdminPassword.trim()) payload.admin_password = previewAdminPassword.trim();
      const res = await axios.post(`${getBackendUrl()}/api/auth/impersonate`, payload, {
        withCredentials: true,
        headers,
      });
      if (res.data.session_token) {
        localStorage.setItem('session_token', res.data.session_token);
      }
      await checkAuth();
      setPricingPreviewOpen(false);
      window.location.href = '/dashboard';
    } catch (err) {
      toast({
        title: 'Could not open their dashboard',
        description: formatApiError(err),
        variant: 'destructive',
      });
    } finally {
      setOpeningDashboard(false);
    }
  };

  const openEdit = (cl) => {
    setEditing(cl);
    setClientEmail((cl.email || '').trim());
    setAnnualMemberDashboard(!!cl.annual_member_dashboard);
    setAnnualPackageOfferMonthlyEmiVisible(cl.annual_package_offer_monthly_emi_visible !== false);
    setPortalLoginAllowed(cl.portal_login_allowed !== false);
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
  };

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
      const wasPending = isPendingIntakeReview(editing);
      const newlyGrantedPortal = editing.portal_login_allowed === false && portalLoginAllowed === true;
      await axios.put(`${API}/clients/${editing.id}`, {
        email: (clientEmail || '').trim().toLowerCase(),
        annual_member_dashboard: annualMemberDashboard,
        annual_package_offer_monthly_emi_visible: annualPackageOfferMonthlyEmiVisible,
        portal_login_allowed: portalLoginAllowed,
        intake_pending: false,
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
      toast({
        title: 'Saved',
        description:
          newlyGrantedPortal
            ? 'Dashboard access saved. A welcome email was sent so they can sign in with Google using their address.'
            : wasPending
              ? 'Dashboard access updated and this request is marked reviewed (no longer “new”).'
              : 'Dashboard access fields updated.',
      });
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

  const rows = useMemo(() => {
    const list = [...(clients || [])];
    list.sort((a, b) => {
      const pa = isPendingIntakeReview(a);
      const pb = isPendingIntakeReview(b);
      if (pa !== pb) return pa ? -1 : 1;
      const tb = new Date(b.updated_at || b.created_at || 0).getTime();
      const ta = new Date(a.updated_at || a.created_at || 0).getTime();
      return tb - ta;
    });
    return list;
  }, [clients]);

  const allVisibleSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selectedIds.includes(r.id)),
    [rows, selectedIds],
  );

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((r) => r.id));
    }
  };

  const toggleRowSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkAllowGoogle = async () => {
    if (!selectedIds.length || bulkLoading) return;
    const n = selectedIds.length;
    const blockedAmong = rows.filter(
      (r) => selectedIds.includes(r.id) && r.portal_login_allowed === false,
    ).length;
    const msg =
      blockedAmong > 0
        ? `Enable Google login for ${n} selected client(s)? Welcome emails will be sent for ${blockedAmong} who were blocked.`
        : `Enable Google login for ${n} selected client(s)? (Those already allowed stay unchanged; no extra emails.)`;
    if (!window.confirm(msg)) return;
    setBulkLoading(true);
    try {
      const res = await axios.post(`${API}/clients/bulk-set-portal-login`, {
        client_ids: selectedIds,
        portal_login_allowed: true,
      });
      const d = res.data || {};
      const failed = d.welcome_emails_failed || 0;
      toast({
        title: 'Bulk update complete',
        description: `Updated ${d.updated ?? n} client(s). Welcome emails sent: ${d.welcome_emails_sent ?? 0}${
          failed ? ` (${failed} email delivery issue(s))` : ''
        }.`,
      });
      setSelectedIds([]);
      await fetchData();
    } catch (e) {
      console.error(e);
      toast({
        title: 'Bulk update failed',
        description: e.response?.data?.detail || e.message,
        variant: 'destructive',
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const openBulkFieldsDialog = () => {
    if (!selectedIds.length) return;
    const first = rows.find((r) => selectedIds.includes(r.id));
    setBulkAnnualMember(!!first?.annual_member_dashboard);
    setBulkPreferred(first?.preferred_payment_method || '');
    setBulkIndiaMethod(first?.india_payment_method || '');
    setBulkGpayId(first?.preferred_india_gpay_id || '');
    setBulkBankId(first?.preferred_india_bank_id || '');
    const d = first?.india_discount_percent;
    setBulkDiscountStr(d !== null && d !== undefined && d !== '' ? String(d) : '');
    setBulkTaxEnabled(!!first?.india_tax_enabled);
    setBulkTaxPct(first?.india_tax_percent != null ? String(first.india_tax_percent) : '18');
    setBulkTaxLabel(first?.india_tax_label || 'GST');
    setBulkApply({
      access: false,
      preferred: false,
      tag: false,
      gpay: false,
      bank: false,
      discount: false,
      tax: false,
    });
    setBulkFieldsOpen(true);
  };

  const onBulkPreferredChange = (v) => {
    const low = (v || '').trim().toLowerCase();
    setBulkPreferred(v);
    if (low === 'stripe') {
      setBulkGpayId('');
      setBulkBankId('');
    } else if (low === 'bank_transfer' || low === 'cash_deposit') {
      setBulkGpayId('');
    } else if (low === 'gpay_upi') {
      setBulkBankId('');
    }
  };

  const setBulkIndiaMethodTagged = (v) => {
    setBulkIndiaMethod(v);
    const gpayOk = v === 'gpay_upi' || v === 'any' || v === '';
    const bankOk = v === 'bank_transfer' || v === 'cash_deposit' || v === 'any' || v === '';
    if (!gpayOk) setBulkGpayId('');
    if (!bankOk) setBulkBankId('');
  };

  const handleBulkFieldsSave = async () => {
    if (!selectedIds.length || bulkFieldsSaving) return;
    const patch = { client_ids: selectedIds };
    if (bulkApply.access) patch.annual_member_dashboard = bulkAnnualMember;
    if (bulkApply.preferred) patch.preferred_payment_method = (bulkPreferred || '').trim().toLowerCase() || '';
    if (bulkApply.tag) patch.india_payment_method = (bulkIndiaMethod || '').trim() || '';
    if (bulkApply.gpay) patch.preferred_india_gpay_id = (bulkGpayId || '').trim() || '';
    if (bulkApply.bank) patch.preferred_india_bank_id = (bulkBankId || '').trim() || '';
    if (bulkApply.discount) {
      patch.india_discount_percent =
        bulkDiscountStr !== '' && bulkDiscountStr != null && bulkDiscountStr !== undefined
          ? parseFloat(String(bulkDiscountStr).replace(/,/g, '')) || 0
          : null;
    }
    if (bulkApply.tax) {
      patch.india_tax_enabled = bulkTaxEnabled;
      patch.india_tax_percent = bulkTaxEnabled ? parseFloat(String(bulkTaxPct)) || 0 : null;
      patch.india_tax_label = (bulkTaxLabel || 'GST').trim() || 'GST';
    }
    const extraKeys = Object.keys(patch).filter((k) => k !== 'client_ids');
    if (!extraKeys.length) {
      toast({
        title: 'Choose fields to apply',
        description: 'Check at least one section below (access type, payment, GST, etc.).',
        variant: 'destructive',
      });
      return;
    }
    setBulkFieldsSaving(true);
    try {
      const res = await axios.post(`${API}/clients/bulk-update-dashboard-access`, patch);
      const d = res.data || {};
      toast({
        title: 'Bulk update complete',
        description: `Updated ${d.updated ?? selectedIds.length} client(s).`,
      });
      setBulkFieldsOpen(false);
      setSelectedIds([]);
      await fetchData();
    } catch (e) {
      console.error(e);
      toast({
        title: 'Bulk update failed',
        description: e.response?.data?.detail || e.message,
        variant: 'destructive',
      });
    } finally {
      setBulkFieldsSaving(false);
    }
  };

  const markReviewed = async (cl, e) => {
    if (e) e.stopPropagation();
    try {
      await axios.put(`${API}/clients/${cl.id}`, { intake_pending: false });
      toast({
        title: 'Marked reviewed',
        description: `${cl.name || cl.email || 'Client'} removed from new requests.`,
      });
      await fetchData();
    } catch (err) {
      toast({
        title: 'Could not update',
        description: err.response?.data?.detail || err.message,
        variant: 'destructive',
      });
    }
  };

  const confirmDelete = async (cl) => {
    if (!window.confirm(`Remove ${cl.name || cl.email || 'this client'} from the database? This cannot be undone.`)) {
      return;
    }
    try {
      await axios.delete(`${API}/clients/${cl.id}`);
      toast({ title: 'Client removed', description: cl.name || cl.email || 'Deleted.' });
      await fetchData();
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err.response?.data?.detail || err.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4" data-testid="admin-dashboard-access">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2">
          <KeyRound className="text-[#D4AF37] shrink-0 mt-0.5" size={22} />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Dashboard access</h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
              Tagged payment shows rows from <strong>Site Settings → Indian Payment</strong> (e.g. pin “Priyanka” UPI). Set
              access type, <strong>Google login</strong>, preferred payment, tags, GST, and discount — including allowing their
              student portal (welcome email sends the first time you enable login after it was blocked).
              Use the checkboxes + <strong>Allow Google login for selected</strong> or{' '}
              <strong>Bulk edit access &amp; payments</strong> to update many clients at once.{' '}
              <strong>View as</strong> opens a popup with their upcoming-program portal pricing (no new tab — uses your admin session).
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

      {!loading && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="dashboard-access-bulk-bar">
          <span className="text-[11px] text-gray-500">
            Select rows, then enable Google login for many at once.
          </span>
          {selectedIds.length > 0 && (
            <>
              <span className="text-xs font-semibold text-gray-700">{selectedIds.length} selected</span>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 bg-green-700 hover:bg-green-800 text-white"
                disabled={bulkLoading}
                onClick={handleBulkAllowGoogle}
                data-testid="dashboard-access-bulk-allow-google"
              >
                {bulkLoading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                Allow Google login for selected
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
                onClick={openBulkFieldsDialog}
                data-testid="dashboard-access-bulk-fields"
              >
                <SlidersHorizontal size={14} />
                Bulk edit access & payments
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedIds([])}>
                Clear selection
              </Button>
            </>
          )}
        </div>
      )}

      {pendingCount > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-200 bg-orange-50/90 px-4 py-3 text-sm text-orange-900"
          data-testid="dashboard-access-pending-banner"
        >
          <span className="flex items-center gap-2 font-medium">
            <Bell size={18} className="text-orange-500 shrink-0" />
            <span>
              <strong>{pendingCount}</strong> new intake request{pendingCount === 1 ? '' : 's'} — highlight below; set payment tags, then save or mark reviewed.
            </span>
          </span>
        </div>
      )}

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden w-full">
        <div className="w-full overflow-x-auto md:overflow-x-visible">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[3%]" />
              <col className="w-[7%]" />
              <col className="w-[11%]" />
              <col className="w-[7%]" />
              <col className="w-[6%]" />
              <col className="w-[8%]" />
              <col className="w-[14%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[6%]" />
              <col className="w-[5%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-1 py-2.5 w-8 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    title="Select all rows in this list"
                    data-testid="dashboard-access-select-all"
                  />
                </th>
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
                  Google login
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Preferred payment
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Tagged payment (site)
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Annual member? (intake)
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
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="inline animate-spin mr-2 align-middle" size={18} />
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-gray-400 text-sm">
                    No clients match.
                  </td>
                </tr>
              ) : (
                rows.map((cl) => {
                  const accessTagged = cl.annual_member_dashboard ? 'Annual' : 'Non-annual';
                  const subHint = !cl.annual_member_dashboard && isAnnualViaSubscription(cl);
                  const taggedDetail = formatTaggedPaymentDetails(cl, indiaSite);
                  return (
                    <tr
                      key={cl.id}
                      className={`hover:bg-gray-50/80 ${isPendingIntakeReview(cl) ? 'bg-orange-50/60' : ''}`}
                      data-intake-pending={isPendingIntakeReview(cl) ? 'true' : undefined}
                    >
                      <td className="px-1 py-2 align-top text-center w-8">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedIds.includes(cl.id)}
                          onChange={() => toggleRowSelected(cl.id)}
                          data-testid={`dashboard-access-select-${cl.id}`}
                        />
                      </td>
                      <td
                        className={`px-3 py-2 text-gray-900 font-medium align-top ${isPendingIntakeReview(cl) ? 'border-l-[3px] border-l-orange-400 pl-2' : ''}`}
                        title={cl.name}
                      >
                        <div className="flex items-start gap-1.5 min-w-0">
                          {isPendingIntakeReview(cl) && (
                            <span
                              className="shrink-0 mt-0.5 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-200 text-orange-900"
                              title="Submitted via dashboard access form — not reviewed yet"
                            >
                              New
                            </span>
                          )}
                          <span className="truncate leading-snug">{cl.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate" title={cl.email}>
                        {(cl.email || '').trim() || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{(cl.phone || '').trim() || '—'}</td>
                      <td className="px-3 py-2 text-[10px] text-gray-800 align-top">
                        {cl.portal_login_allowed === false ? (
                          <span className="font-semibold text-red-600">Blocked</span>
                        ) : (
                          <span className="font-semibold text-green-700">Allowed</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700 text-xs max-w-[100px]">
                        {labelFrom(PREFERRED_LABEL, cl.preferred_payment_method)}
                      </td>
                      <td
                        className="px-3 py-2 text-gray-800 text-[11px] align-top leading-snug break-words"
                        title={taggedDetail}
                      >
                        {taggedDetail}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {cl.intake_claims_annual_member === true
                          ? 'Yes'
                          : cl.intake_claims_annual_member === false
                            ? 'No'
                            : '—'}
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
                      <td className="px-2 py-2 align-top">
                        <div className="flex flex-col items-end gap-1.5">
                          {isPendingIntakeReview(cl) && (
                            <button
                              type="button"
                              onClick={(e) => markReviewed(cl, e)}
                              className="text-[9px] font-semibold text-orange-700 hover:text-orange-900 hover:underline whitespace-nowrap"
                              data-testid={`dashboard-access-reviewed-${cl.id}`}
                            >
                              Mark reviewed
                            </button>
                          )}
                          <div className="flex items-center gap-0.5 flex-wrap justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-[#5D3FD3] px-2"
                              onClick={() => openPricingPreview(cl)}
                              data-testid={`dashboard-access-view-as-${cl.id}`}
                            >
                              <Eye size={14} />
                              View as
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-[#D4AF37] px-2"
                              onClick={() => openEdit(cl)}
                              data-testid={`dashboard-access-edit-${cl.id}`}
                            >
                              <Pencil size={14} />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                              onClick={() => confirmDelete(cl)}
                              title="Delete client"
                              data-testid={`dashboard-access-delete-${cl.id}`}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dashboard-access-edit-dialog">
          <DialogHeader>
            <DialogTitle>Edit dashboard access</DialogTitle>
            <DialogDescription>{editing?.name || 'Client'}</DialogDescription>
          </DialogHeader>

          {editing && isPendingIntakeReview(editing) && (
            <p
              className="text-[11px] text-orange-800 bg-orange-50 border border-orange-200 rounded-md px-3 py-2 -mt-1"
              data-testid="dashboard-access-new-request-notice"
            >
              <strong>New request.</strong> When you save, this row is marked reviewed and the orange “New” highlight is cleared — or enable Google login below to clear it automatically.
            </p>
          )}

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-gray-600">Iris Garden email</Label>
              <p className="text-[10px] text-gray-400 mb-1">
                You may use the same address on multiple clients. Google sign-in resolves to one row (newest with access
                enabled). Welcome mail uses this address when you enable login below.
              </p>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="mt-1"
                placeholder="name@example.com"
                data-testid="dashboard-access-client-email"
              />
            </div>

            <div>
              <Label className="text-xs text-gray-600">Access type (Sacred Home)</Label>
              <p className="text-[10px] text-gray-400 mb-1.5">
                Turn on for annual-member pricing on the dashboard. If <strong>End Date</strong> under Annual + dashboard
                is in the past, Sacred Home still treats the subscription as expired until you extend dates there (or via
                Excel).
              </p>
              <select
                value={annualMemberDashboard ? 'annual' : 'non_annual'}
                onChange={(e) => setAnnualMemberDashboard(e.target.value === 'annual')}
                className="w-full text-sm border rounded-md px-2 py-2 bg-white mt-1"
              >
                <option value="non_annual">Non-annual</option>
                <option value="annual">Annual</option>
              </select>
              {annualMemberDashboard && (
                <div className="mt-2 rounded-lg border border-violet-200/80 bg-violet-50/40 px-3 py-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={annualPackageOfferMonthlyEmiVisible}
                      onChange={(e) => setAnnualPackageOfferMonthlyEmiVisible(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300"
                      data-testid="dashboard-access-monthly-emi-on-package-page"
                    />
                    <span className="text-[11px] text-gray-800 leading-snug">
                      <span className="font-semibold">Show monthly EMI</span> on the student{' '}
                      <strong>Home Coming package</strong> page. Uncheck to hide the monthly installment option for this
                      client only (quarterly, yearly, full pay, and Flexi stay available).
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div
              className={`rounded-lg border px-3 py-2.5 ${
                portalLoginAllowed ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/40'
              }`}
            >
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={portalLoginAllowed}
                  onChange={(e) => setPortalLoginAllowed(e.target.checked)}
                  className="mt-1 rounded border-gray-300"
                  data-testid="dashboard-access-portal-login-allowed"
                />
                <span>
                  <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                    <Lock size={14} className={portalLoginAllowed ? 'text-green-600' : 'text-red-500'} />
                    Allow Google login to student dashboard
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-1 leading-snug">
                    When you enable this for someone who was blocked (e.g. after intake), they receive a welcome email at this address with a link to sign in.{' '}
                    The <strong>Annual + dashboard</strong> sheet lists everyone tagged Annual; <strong>Excel import</strong> still skips rows with login blocked until you allow sign-in here.
                  </span>
                </span>
              </label>
            </div>

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
              testIdPrefix="dashboard-access"
            />
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

      <Dialog open={bulkFieldsOpen} onOpenChange={(o) => !o && setBulkFieldsOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dashboard-access-bulk-dialog">
          <DialogHeader>
            <DialogTitle>Bulk edit access & payments</DialogTitle>
            <DialogDescription>
              Check each section you want to overwrite, then apply to{' '}
              <strong>{selectedIds.length}</strong> selected client(s). Unchecked sections are left unchanged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={bulkApply.access}
                  onChange={(e) => setBulkApply((p) => ({ ...p, access: e.target.checked }))}
                  data-testid="bulk-apply-access"
                />
                <span className="text-xs font-semibold text-gray-800">Access type (Sacred Home)</span>
              </label>
              <select
                value={bulkAnnualMember ? 'annual' : 'non_annual'}
                onChange={(e) => setBulkAnnualMember(e.target.value === 'annual')}
                disabled={!bulkApply.access}
                className="w-full text-sm border rounded-md px-2 py-2 bg-white disabled:opacity-50"
              >
                <option value="non_annual">Non-annual</option>
                <option value="annual">Annual</option>
              </select>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={bulkApply.preferred}
                  onChange={(e) => setBulkApply((p) => ({ ...p, preferred: e.target.checked }))}
                />
                <span className="text-xs font-semibold text-gray-800">Preferred payment method</span>
              </label>
              <select
                value={bulkPreferred}
                onChange={(e) => onBulkPreferredChange(e.target.value)}
                disabled={!bulkApply.preferred}
                className="w-full text-sm border rounded-md px-2 py-2 bg-white disabled:opacity-50"
              >
                <option value="">— Not set —</option>
                <option value="gpay_upi">GPay / UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash_deposit">Cash deposit</option>
                <option value="stripe">Stripe</option>
              </select>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={bulkApply.tag}
                  onChange={(e) => setBulkApply((p) => ({ ...p, tag: e.target.checked }))}
                />
                <span className="text-xs font-semibold text-gray-800">Payment method tag (checkout)</span>
              </label>
              <select
                value={bulkIndiaMethod}
                onChange={(e) => setBulkIndiaMethodTagged(e.target.value)}
                disabled={!bulkApply.tag}
                className="w-full text-sm border rounded-md px-2 py-2 bg-white disabled:opacity-50"
              >
                <option value="">— Not tagged —</option>
                <option value="gpay_upi">GPay / UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash_deposit">Cash deposit</option>
                <option value="stripe">Stripe</option>
                <option value="any">Any / multiple</option>
              </select>
            </div>

            {showBulkGpayPicker && indiaGpayOpts.length >= 1 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={bulkApply.gpay}
                    onChange={(e) => setBulkApply((p) => ({ ...p, gpay: e.target.checked }))}
                  />
                  <span className="text-xs font-semibold text-gray-800">Tagged UPI (Indian Payment)</span>
                </label>
                <select
                  value={bulkGpayId}
                  onChange={(e) => setBulkGpayId(e.target.value)}
                  disabled={!bulkApply.gpay}
                  className="w-full text-sm border rounded-md px-2 py-2 bg-white disabled:opacity-50"
                >
                  <option value="">All UPIs (full list on payment)</option>
                  {indiaGpayOpts.map((o) => (
                    <option key={o.tag_id} value={o.tag_id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showBulkBankPicker && indiaBankOpts.length >= 1 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={bulkApply.bank}
                    onChange={(e) => setBulkApply((p) => ({ ...p, bank: e.target.checked }))}
                  />
                  <span className="text-xs font-semibold text-gray-800">Tagged bank account (Indian Payment)</span>
                </label>
                <select
                  value={bulkBankId}
                  onChange={(e) => setBulkBankId(e.target.value)}
                  disabled={!bulkApply.bank}
                  className="w-full text-sm border rounded-md px-2 py-2 bg-white disabled:opacity-50"
                >
                  <option value="">All accounts (student picks)</option>
                  {indiaBankOpts.map((o) => (
                    <option key={o.tag_id} value={o.tag_id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={bulkApply.discount}
                  onChange={(e) => setBulkApply((p) => ({ ...p, discount: e.target.checked }))}
                />
                <span className="text-xs font-semibold text-gray-800">Discount % on base price</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={bulkDiscountStr}
                  onChange={(e) => setBulkDiscountStr(e.target.value)}
                  placeholder="Leave empty to clear"
                  disabled={!bulkApply.discount}
                  className="text-sm disabled:opacity-50"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>

            <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={bulkApply.tax}
                  onChange={(e) => setBulkApply((p) => ({ ...p, tax: e.target.checked }))}
                />
                <span className="text-xs font-semibold text-gray-800">GST / tax on after-discount price</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer pl-1">
                <input
                  type="checkbox"
                  checked={bulkTaxEnabled}
                  onChange={(e) => setBulkTaxEnabled(e.target.checked)}
                  disabled={!bulkApply.tax}
                  className="rounded border-orange-300 disabled:opacity-50"
                />
                <span className="text-sm text-gray-800">Tax applicable</span>
              </label>
              {bulkTaxEnabled && bulkApply.tax && (
                <div className="grid grid-cols-2 gap-2 pl-1">
                  <div>
                    <Label className="text-[10px] text-gray-500">Rate % (0 = no tax)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={bulkTaxPct}
                      onChange={(e) => setBulkTaxPct(e.target.value)}
                      className="h-9 text-sm mt-0.5"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500">Label</Label>
                    <Input
                      value={bulkTaxLabel}
                      onChange={(e) => setBulkTaxLabel(e.target.value)}
                      className="h-9 text-sm mt-0.5"
                      placeholder="GST"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setBulkFieldsOpen(false)} disabled={bulkFieldsSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#D4AF37] hover:bg-[#b8962e]"
              onClick={handleBulkFieldsSave}
              disabled={bulkFieldsSaving}
              data-testid="dashboard-access-bulk-apply"
            >
              {bulkFieldsSaving ? 'Applying…' : `Apply to ${selectedIds.length} client(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pricingPreviewOpen}
        onOpenChange={(o) => {
          if (!o) {
            setPricingPreviewOpen(false);
            setPricingPreviewClient(null);
            setPricingPreviewData(null);
            setPreviewAdminPassword('');
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dashboard-access-pricing-preview-dialog">
          <DialogHeader>
            <DialogTitle>Dashboard pricing preview</DialogTitle>
            <DialogDescription className="text-left text-xs">
              {pricingPreviewClient?.name || 'Client'}
              {pricingPreviewClient?.email ? (
                <span className="block text-gray-600 mt-0.5">{pricingPreviewClient.email}</span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 space-y-2">
            <p className="text-[10px] text-gray-600">
              If pricing fails to load, enter your <strong>site admin password</strong> and click Retry (session may have expired).
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <Label htmlFor="preview-admin-password" className="text-[10px] text-gray-500">
                  Admin password (optional)
                </Label>
                <Input
                  id="preview-admin-password"
                  type="password"
                  autoComplete="current-password"
                  className="h-8 text-xs mt-0.5"
                  value={previewAdminPassword}
                  onChange={(e) => setPreviewAdminPassword(e.target.value)}
                  placeholder="Only when needed"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={pricingPreviewLoading || !pricingPreviewClient}
                onClick={() => pricingPreviewClient && loadPricingPreview(pricingPreviewClient, previewAdminPassword)}
              >
                Retry load
              </Button>
            </div>
          </div>

          {pricingPreviewLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-gray-600 justify-center">
              <Loader2 className="animate-spin" size={18} />
              Loading portal quotes…
            </div>
          ) : pricingPreviewData ? (
            <div className="space-y-3">
              <div className="text-[11px] space-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p>
                  <span className="font-semibold text-gray-800">Dashboard access:</span>{' '}
                  {pricingPreviewData.annual_member_dashboard ? 'Annual' : 'Non-annual'}
                </p>
                <p>
                  <span className="font-semibold text-gray-800">Annual (subscription data):</span>{' '}
                  {pricingPreviewData.is_annual_subscriber ? 'Yes' : 'No'}
                </p>
                <p className="text-[10px] text-gray-500 leading-snug">
                  Self-seat amounts for each upcoming program — same calculation as their Sacred Home pricing block (no guests).
                </p>
              </div>
              {!pricingPreviewData.programs?.length ? (
                <p className="text-sm text-gray-500 py-4 text-center">No upcoming programs with open enrollment.</p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-md">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-2 py-2 font-semibold text-gray-600">Program</th>
                        <th className="text-right px-2 py-2 font-semibold text-gray-600">Your seat</th>
                        <th className="text-center px-2 py-2 font-semibold text-gray-600">Annual pkg</th>
                        <th className="text-left px-2 py-2 font-semibold text-gray-600">Rule</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pricingPreviewData.programs.map((row) => (
                        <tr key={row.program_id}>
                          <td className="px-2 py-2 align-top text-gray-900 max-w-[200px]">{row.program_title}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-gray-900">
                            ₹{Number(row.self_after_promos ?? 0).toLocaleString()}
                            {row.quote_show_tax && row.tax_included_estimate != null && row.currency === 'inr' ? (
                              <span className="block text-[10px] text-gray-500 font-normal">
                                ~GST incl. ₹{Number(row.tax_included_estimate).toLocaleString()}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 text-center text-gray-700">
                            {row.included_in_annual_package ? 'Yes' : '—'}
                          </td>
                          <td className="px-2 py-2 text-[10px] text-gray-600 capitalize">
                            {(row.member_pricing_rule || '—').replace(/_/g, ' ')}
                            {row.portal_pricing_override ? (
                              <span className="block text-violet-600 mt-0.5">Portal override</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between border-t border-gray-100 pt-3 mt-2">
            <Button
              type="button"
              className="bg-[#5D3FD3] hover:bg-[#4c32b3] w-full sm:w-auto"
              disabled={
                openingDashboard ||
                pricingPreviewLoading ||
                (!(pricingPreviewClient?.email || '').trim() && !(pricingPreviewClient?.id || '').trim())
              }
              onClick={openFullStudentDashboard}
              data-testid="dashboard-access-open-full-dashboard"
            >
              {openingDashboard ? 'Opening…' : 'Open their dashboard (full view)'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPricingPreviewOpen(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
