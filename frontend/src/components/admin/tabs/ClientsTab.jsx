import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { buildIndiaGpayOptions, buildIndiaBankOptions } from '../../../lib/indiaPaymentTags';
import IndiaDiscountBandsEditor from '../IndiaDiscountBandsEditor';
import { serverBandsToRows, rowsToBandsPayload, validateBandRows } from '../../../lib/indiaDiscountBandsUi';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Users, Search, Download, RefreshCw,
  Droplets, Sprout, TreeDeciduous, Flower2, Star, Sparkles, Crown,
  Clock, Tag, Edit2, Save, X, Trash2, UserPlus, Lock, Bell, CheckCircle,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LABEL_CONFIG = {
  Dew:           { icon: Droplets,       bg: 'bg-sky-50',    border: 'border-sky-200',    text: 'text-sky-700',    badge: 'bg-sky-100 text-sky-700',    desc: 'Default for new leads — until a program is fully paid' },
  Seed:          { icon: Sprout,         bg: 'bg-lime-50',   border: 'border-lime-200',   text: 'text-lime-700',   badge: 'bg-lime-100 text-lime-700',  desc: 'Joined a workshop' },
  Root:          { icon: TreeDeciduous,  bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700', desc: 'Converted to a flagship program' },
  Bloom:         { icon: Flower2,        bg: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-700',   badge: 'bg-pink-100 text-pink-700',  desc: 'Multiple programs or repeat client' },
  Iris:          { icon: Star,           bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700', desc: 'Annual Program Subscriber' },
  'Purple Bees': { icon: Sparkles,       bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700', desc: 'Soulful referral partner' },
  'Iris Bees':   { icon: Crown,          bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700', desc: 'Brand Ambassador' },
};

const ALL_LABELS = ['Dew', 'Seed', 'Root', 'Bloom', 'Iris', 'Purple Bees', 'Iris Bees'];

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const ClientsTab = () => {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ total: 0, by_label: {} });
  const [filterLabel, setFilterLabel] = useState('');
  const [searchText, setSearchText] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    label_manual: '',
  });
  const [addingClient, setAddingClient] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (filterLabel) params.label = filterLabel;
      if (searchText.trim()) params.search = searchText.trim();
      const [cRes, sRes] = await Promise.all([
        axios.get(`${API}/clients`, { params }),
        axios.get(`${API}/clients/stats`),
      ]);
      setClients(cRes.data || []);
      setStats(sRes.data || { total: 0, by_label: {} });
    } catch (e) { console.error(e); }
  }, [filterLabel, searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/clients/sync`);
      toast({ title: 'Sync complete!', description: `${res.data.stats.new_clients} new, ${res.data.stats.updated} updated` });
      fetchData();
    } catch { toast({ title: 'Sync failed', variant: 'destructive' }); }
    setSyncing(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this client?')) return;
    try {
      await axios.delete(`${API}/clients/${id}`);
      toast({ title: 'Client removed' });
      fetchData();
    } catch { toast({ title: 'Delete failed', variant: 'destructive' }); }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    const name = addForm.name.trim();
    const email = addForm.email.trim();
    const phone = addForm.phone.trim();
    if (!name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (!email && !phone) {
      toast({ title: 'Add an email or phone', variant: 'destructive' });
      return;
    }
    setAddingClient(true);
    try {
      const res = await axios.post(`${API}/clients`, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        notes: addForm.notes.trim() || undefined,
        label_manual: addForm.label_manual || undefined,
      });
      toast({ title: 'Client added', description: name });
      setAddForm({ name: '', email: '', phone: '', notes: '', label_manual: '' });
      setShowAddClient(false);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail;
      toast({
        title: 'Could not add client',
        description: typeof msg === 'string' ? msg : err.message,
        variant: 'destructive',
      });
    } finally {
      setAddingClient(false);
    }
  };

  return (
    <div data-testid="clients-tab">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-[#D4AF37]" /> Client Garden
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            Your unified client database — track every soul&apos;s journey from Dew to Iris. New dashboard access
            requests and pricing preview are handled under the <strong className="font-semibold text-gray-700">Dashboard Access</strong> tab.
            <span className="block mt-1 text-[10px] text-gray-400">
              Auto-label stays <strong className="font-medium text-gray-600">Dew</strong> for first-time contacts and anyone who has not finished a paid checkout yet.
              After payment completes, the garden stage updates from enrollments. You can always override the label on each client (Label &amp; Notes → Edit).
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="clients-add-manual-toggle"
            onClick={() => setShowAddClient((v) => !v)}
            variant="outline"
            className="text-[10px] h-8 gap-1.5 border-[#5D3FD3] text-[#5D3FD3] hover:bg-[#5D3FD3]/10"
          >
            <UserPlus size={12} /> {showAddClient ? 'Close form' : 'Add client'}
          </Button>
          <Button data-testid="clients-sync" onClick={handleSync} disabled={syncing} variant="outline" className="text-[10px] h-8 gap-1.5">
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync All Data'}
          </Button>
          <Button data-testid="clients-download" onClick={() => window.open(`${API}/clients/export/csv`, '_blank')} variant="outline" className="text-[10px] h-8 gap-1.5 border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10">
            <Download size={12} /> Export Excel
          </Button>
        </div>
      </div>

      {showAddClient && (
        <form
          onSubmit={handleAddClient}
          data-testid="clients-add-manual-form"
          className="mb-4 rounded-xl border border-[#5D3FD3]/25 bg-gradient-to-r from-purple-50/80 to-white p-4 space-y-3"
        >
          <p className="text-xs font-semibold text-gray-800">Add client manually</p>
          <p className="text-[10px] text-gray-500">Trial-friendly: creates a garden record with source &quot;Manual&quot;. Requires name and at least email or phone.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[9px] text-gray-500">Name *</Label>
              <Input
                data-testid="clients-add-name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                className="h-9 text-xs mt-1"
                placeholder="Full name"
                autoComplete="name"
              />
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">Garden label</Label>
              <select
                data-testid="clients-add-label"
                value={addForm.label_manual}
                onChange={(e) => setAddForm((f) => ({ ...f, label_manual: e.target.value }))}
                className="w-full h-9 text-xs border rounded-md px-2 mt-1"
              >
                <option value="">Auto — Dew until a paid program, then from conversions</option>
                {ALL_LABELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">Email</Label>
              <Input
                data-testid="clients-add-email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                className="h-9 text-xs mt-1"
                placeholder="email@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">Phone</Label>
              <Input
                data-testid="clients-add-phone"
                value={addForm.phone}
                onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                className="h-9 text-xs mt-1"
                placeholder="Optional if email set"
                autoComplete="tel"
              />
            </div>
          </div>
          <div>
            <Label className="text-[9px] text-gray-500">Notes</Label>
            <Textarea
              data-testid="clients-add-notes"
              value={addForm.notes}
              onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="text-xs mt-1"
              placeholder="Optional internal notes"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={addingClient} size="sm" className="text-[10px] h-8 bg-[#5D3FD3] hover:bg-[#4c32b3] gap-1" data-testid="clients-add-submit">
              <UserPlus size={12} /> {addingClient ? 'Saving…' : 'Save client'}
            </Button>
            <Button type="button" variant="outline" size="sm" className="text-[10px] h-8" onClick={() => setShowAddClient(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Label Stats Cards */}
      <div className="grid grid-cols-7 gap-2 mb-4" data-testid="clients-label-stats">
        {ALL_LABELS.map(label => {
          const cfg = LABEL_CONFIG[label];
          const Icon = cfg.icon;
          const count = stats.by_label[label] || 0;
          const isActive = filterLabel === label;
          return (
            <button key={label} data-testid={`clients-label-${label.replace(/\s/g, '-')}`}
              onClick={() => setFilterLabel(isActive ? '' : label)}
              className={`flex flex-col items-center p-2.5 rounded-xl border-2 transition-all ${isActive ? `${cfg.bg} ${cfg.border} shadow-md scale-[1.02]` : 'bg-white border-gray-100 hover:border-gray-200'}`}>
              <Icon size={16} className={isActive ? cfg.text : 'text-gray-400'} />
              <span className={`text-lg font-bold mt-1 ${isActive ? cfg.text : 'text-gray-800'}`}>{count}</span>
              <span className="text-[8px] text-gray-500 leading-tight text-center">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Total + Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-semibold">
          {stats.total} Total Clients
        </div>
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input data-testid="clients-search" type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="Search name, email, phone, or household key..." className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" />
        </div>
        {filterLabel && (
          <button onClick={() => { setFilterLabel(''); }} className="text-[10px] text-gray-500 hover:text-gray-700 flex items-center gap-1 border rounded px-2 py-1">
            <X size={10} /> Clear filter
          </button>
        )}
      </div>

      {/* Client list — table summary row + full detail row (always visible, not collapsible) */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden overflow-x-auto" data-testid="clients-table-wrap">
        {clients.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No clients found. Use Add client or Sync All Data to populate.</p>
          </div>
        ) : (
          <table className="w-full min-w-[860px] text-left border-collapse" data-testid="clients-table">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-500">
                <th className="py-2.5 pl-3 pr-2 font-semibold">Client</th>
                <th className="py-2.5 px-2 font-semibold w-[88px]">Label</th>
                <th className="py-2.5 px-2 font-semibold w-[120px]">DID</th>
                <th className="py-2.5 px-2 font-semibold min-w-[140px]">Email</th>
                <th className="py-2.5 px-2 font-semibold min-w-[100px]">Phone</th>
                <th className="py-2.5 px-2 font-semibold w-[100px]">Activity</th>
                <th className="py-2.5 pr-3 pl-2 font-semibold w-[72px]">Updated</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((cl) => {
                const cfg = LABEL_CONFIG[cl.label] || LABEL_CONFIG.Dew;
                const Icon = cfg.icon;
                return (
                  <React.Fragment key={cl.id}>
                    <tr
                      data-testid={`client-${cl.id}`}
                      className="border-b border-gray-100 bg-white align-middle hover:bg-violet-50/40"
                    >
                      <td className="py-2.5 pl-3 pr-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-full ${cfg.bg} ${cfg.border} border flex items-center justify-center shrink-0`}>
                            <Icon size={12} className={cfg.text} />
                          </div>
                          <div className="min-w-0 flex flex-col">
                            <span className="text-xs font-semibold text-gray-900 truncate max-w-[180px]" title={cl.name || ''}>
                              {cl.name || 'Unknown'}
                            </span>
                            {(cl.household_key || cl.is_primary_household_contact) && (
                              <span className="text-[9px] text-slate-500 truncate max-w-[200px]" title={[cl.household_key, cl.is_primary_household_contact ? 'Primary contact' : ''].filter(Boolean).join(' · ')}>
                                {cl.household_key ? <span className="font-mono text-slate-600">{cl.household_key}</span> : null}
                                {cl.household_key && cl.is_primary_household_contact ? <span className="text-slate-400"> · </span> : null}
                                {cl.is_primary_household_contact ? (
                                  <span className="text-amber-700 font-medium">Primary</span>
                                ) : null}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${cfg.badge}`}>{cl.label}</span>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[10px] text-purple-700 truncate max-w-[120px]" title={cl.did || ''}>
                        {cl.did || '—'}
                      </td>
                      <td className="py-2.5 px-2 text-[10px] text-gray-800 truncate max-w-[200px]" title={cl.email || ''}>
                        {cl.email || '—'}
                      </td>
                      <td className="py-2.5 px-2 text-[10px] text-gray-600 whitespace-nowrap">{cl.phone || '—'}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex flex-col gap-0.5">
                          {cl.conversions?.length > 0 && (
                            <span className="text-[9px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full w-fit font-medium">
                              {cl.conversions.length} conv.
                            </span>
                          )}
                          {cl.intake_pending && (
                            <span className="text-[9px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full w-fit font-medium">
                              Intake
                            </span>
                          )}
                          {!cl.conversions?.length && !cl.intake_pending && (
                            <span className="text-[10px] text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 pl-2 text-[10px] text-gray-500 whitespace-nowrap">
                        {timeAgo(cl.updated_at || cl.created_at)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 bg-[#faf9fc]">
                      <td colSpan={7} className="p-0 align-top">
                        <ClientDetail
                          client={cl}
                          labelConfig={cfg}
                          omitContactSummary
                          onUpdate={fetchData}
                          onDelete={() => handleDelete(cl.id)}
                          onRefresh={fetchData}
                          toast={toast}
                        />
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const ClientDetail = ({
  client: cl,
  labelConfig: cfg,
  onUpdate,
  onDelete,
  onRefresh,
  toast,
  /** When true, hide duplicate name/email/phone grid (shown in table row above). */
  omitContactSummary = false,
}) => {
  const [editing, setEditing] = useState(false);
  const [labelManual, setLabelManual] = useState(cl.label_manual || '');
  const [notes, setNotes] = useState(cl.notes || '');
  const [householdKey, setHouseholdKey] = useState(cl.household_key || '');
  const [primaryHouseholdContact, setPrimaryHouseholdContact] = useState(!!cl.is_primary_household_contact);
  const [familyEditApproved, setFamilyEditApproved] = useState(cl.immediate_family_editing_approved !== false);
  const [portalLoginAllowed, setPortalLoginAllowed] = useState(cl.portal_login_allowed !== false);
  const [indiaPaymentMethod, setIndiaPaymentMethod] = useState(cl.india_payment_method || '');
  const [indiaDiscountPercent, setIndiaDiscountPercent] = useState(cl.india_discount_percent ?? '');
  const [indiaDiscountBandRows, setIndiaDiscountBandRows] = useState([]);
  const [indiaTaxEnabled, setIndiaTaxEnabled] = useState(!!cl.india_tax_enabled);
  const [indiaTaxPercent, setIndiaTaxPercent] = useState(cl.india_tax_percent ?? 18);
  const [indiaTaxLabel, setIndiaTaxLabel] = useState(cl.india_tax_label || 'GST');
  const [indiaTaxVisibleOnDashboard, setIndiaTaxVisibleOnDashboard] = useState(cl.india_tax_visible_on_dashboard !== false);
  const [annualMemberDashboard, setAnnualMemberDashboard] = useState(!!cl.annual_member_dashboard);
  const [preferredIndiaGpayId, setPreferredIndiaGpayId] = useState(cl.preferred_india_gpay_id || '');
  const [preferredIndiaBankId, setPreferredIndiaBankId] = useState(cl.preferred_india_bank_id || '');
  const [indiaSite, setIndiaSite] = useState(null);
  const [saving, setSaving] = useState(false);

  const indiaGpayOpts = useMemo(() => buildIndiaGpayOptions(indiaSite || {}), [indiaSite]);
  const indiaBankOpts = useMemo(() => buildIndiaBankOptions(indiaSite || {}), [indiaSite]);

  useEffect(() => {
    axios.get(`${API}/settings`).then((r) => setIndiaSite(r.data)).catch(() => setIndiaSite({}));
  }, []);

  useEffect(() => {
    setFamilyEditApproved(cl.immediate_family_editing_approved !== false);
    setPortalLoginAllowed(cl.portal_login_allowed !== false);
    setIndiaPaymentMethod(cl.india_payment_method || '');
    setIndiaDiscountPercent(cl.india_discount_percent ?? '');
    setIndiaDiscountBandRows(serverBandsToRows(cl.india_discount_member_bands || []));
    setIndiaTaxEnabled(!!cl.india_tax_enabled);
    setIndiaTaxPercent(cl.india_tax_percent ?? 18);
    setIndiaTaxLabel(cl.india_tax_label || 'GST');
    setIndiaTaxVisibleOnDashboard(cl.india_tax_visible_on_dashboard !== false);
    setAnnualMemberDashboard(!!cl.annual_member_dashboard);
    setPreferredIndiaGpayId(cl.preferred_india_gpay_id || '');
    setPreferredIndiaBankId(cl.preferred_india_bank_id || '');
    setHouseholdKey(cl.household_key || '');
    setPrimaryHouseholdContact(!!cl.is_primary_household_contact);
  }, [cl.id, cl.immediate_family_editing_approved, cl.portal_login_allowed, cl.india_payment_method, cl.india_discount_percent, cl.india_discount_member_bands, cl.india_tax_enabled, cl.india_tax_percent, cl.india_tax_label, cl.india_tax_visible_on_dashboard, cl.annual_member_dashboard, cl.preferred_india_gpay_id, cl.preferred_india_bank_id, cl.household_key, cl.is_primary_household_contact]);

  const setPaymentMethodTagged = (v) => {
    setIndiaPaymentMethod(v);
    const gpayOk = v === 'gpay_upi' || v === 'any' || v === '';
    const bankOk = v === 'bank_transfer' || v === 'cash_deposit' || v === 'any' || v === '';
    if (!gpayOk) setPreferredIndiaGpayId('');
    if (!bankOk) setPreferredIndiaBankId('');
  };

  const handleSave = async () => {
    const bandErr = validateBandRows(indiaDiscountBandRows);
    if (bandErr) {
      toast({ title: 'Group discount rules', description: bandErr, variant: 'destructive' });
      return;
    }
    const bandsPayload = rowsToBandsPayload(indiaDiscountBandRows);
    setSaving(true);
    try {
      await axios.put(`${API}/clients/${cl.id}`, {
        label_manual: labelManual,
        notes,
        immediate_family_editing_approved: familyEditApproved,
        portal_login_allowed: portalLoginAllowed,
        india_payment_method: indiaPaymentMethod || null,
        india_discount_percent: indiaDiscountPercent !== '' ? parseFloat(indiaDiscountPercent) || 0 : null,
        india_discount_member_bands: bandsPayload,
        india_tax_enabled: indiaTaxEnabled,
        india_tax_percent: indiaTaxEnabled ? parseFloat(indiaTaxPercent) || 0 : null,
        india_tax_label: indiaTaxLabel || 'GST',
        india_tax_visible_on_dashboard: indiaTaxVisibleOnDashboard,
        annual_member_dashboard: annualMemberDashboard,
        preferred_india_gpay_id: preferredIndiaGpayId || '',
        preferred_india_bank_id: preferredIndiaBankId || '',
        household_key: householdKey.trim() || null,
        is_primary_household_contact: primaryHouseholdContact,
      });
      toast({ title: 'Client updated' });
      setEditing(false);
      onUpdate();
    } catch { toast({ title: 'Save failed', variant: 'destructive' }); }
    setSaving(false);
  };

  // Sort timeline by date descending
  const timeline = [...(cl.timeline || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const hasImmediateFamilyNames = (cl.immediate_family || []).some((m) => (m.name || '').trim());
  const familyListLocked = !!cl.immediate_family_locked || hasImmediateFamilyNames;

  return (
    <div
      className={`${omitContactSummary ? 'border-0 bg-white/90 px-4 py-3' : `border-t ${cfg.bg} px-4 py-4`}`}
      data-testid={`client-detail-${cl.id}`}
    >
      {/* Info Grid — omitted in table layout (summary row shows contact fields) */}
      {!omitContactSummary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {cl.did && <InfoField label="Divine Iris ID" value={cl.did} />}
          <InfoField label="Name" value={cl.name} />
          <InfoField label="Email" value={cl.email} />
          <InfoField label="Phone" value={cl.phone} />
          <InfoField label="First Contact" value={cl.created_at ? new Date(cl.created_at).toLocaleDateString() : ''} />
        </div>
      )}

      {/* Sources */}
      <div className="mb-4">
        <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Sources</p>
        <div className="flex flex-wrap gap-1">
          {(cl.sources || []).map((s, i) => (
            <span key={i} className="text-[10px] bg-white border rounded-full px-2 py-0.5 text-gray-600">{s}</span>
          ))}
        </div>
      </div>

      {/* Label & Notes Editor */}
      <div className="bg-white rounded-lg border p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-800 flex items-center gap-1.5"><Tag size={12} className="text-[#D4AF37]" /> Label & Notes</p>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="text-[10px] text-[#D4AF37] hover:underline flex items-center gap-1"><Edit2 size={10} /> Edit</button>
          ) : (
            <div className="flex gap-1">
              <button onClick={() => setEditing(false)} className="text-[10px] text-gray-400 hover:text-gray-600"><X size={12} /></button>
            </div>
          )}
        </div>
        <p className="text-[9px] text-gray-500 leading-relaxed mb-2">
          Without an override, the badge follows paid enrollments only: <span className="font-medium text-gray-600">Dew</span> until checkout completes, then Seed / Root / Bloom / Iris from what they bought.
          Pick any stage below to lock it yourself; choose Auto to clear your override.
        </p>
        {!editing && (cl.household_key || cl.is_primary_household_contact) && (
          <div className="flex flex-wrap gap-1.5 mb-2 text-[10px]">
            {cl.household_key ? (
              <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-700 rounded px-2 py-0.5 font-mono max-w-full truncate" title={cl.household_key}>
                <Users size={10} className="shrink-0 text-slate-500" />
                {cl.household_key}
              </span>
            ) : null}
            {cl.is_primary_household_contact ? (
              <span className="inline-flex items-center text-[9px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">Primary household contact</span>
            ) : null}
          </div>
        )}
        {editing ? (
          <div className="space-y-2">
            <div>
              <Label className="text-[9px] text-gray-500">Override label</Label>
              <select data-testid="client-label-select" value={labelManual} onChange={e => setLabelManual(e.target.value)}
                className="w-full text-xs border rounded-lg px-2 py-1.5 mt-1 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]">
                <option value="">Auto (Dew until paid program, then from conversions)</option>
                {ALL_LABELS.map(l => <option key={l} value={l}>{l} — {LABEL_CONFIG[l]?.desc}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">Notes</Label>
              <Textarea data-testid="client-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs mt-1" placeholder="Personal notes about this client..." />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-2 space-y-2">
              <p className="text-[10px] font-semibold text-slate-800 flex items-center gap-1">
                <Users size={12} className="text-slate-500" /> Household (CRM)
              </p>
              <p className="text-[9px] text-slate-500 leading-snug">
                Use the <strong className="font-medium text-slate-700">same household key</strong> on each family member’s client row. Optionally mark the person who handles renewals and comms as primary — each person still keeps their own email.
              </p>
              <div>
                <Label className="text-[9px] text-gray-500">Household key</Label>
                <Input
                  data-testid="client-household-key"
                  value={householdKey}
                  onChange={(e) => setHouseholdKey(e.target.value)}
                  className="h-8 text-xs mt-1 font-mono"
                  placeholder="e.g. Sharma-annual-2026"
                  maxLength={200}
                />
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="client-primary-household-contact"
                  checked={primaryHouseholdContact}
                  onChange={(e) => setPrimaryHouseholdContact(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span className="text-[10px] text-slate-800">Primary household contact</span>
              </label>
            </div>
            {!cl.family_approved && (
              <div className="rounded-lg border border-violet-100 bg-violet-50/40 px-2 py-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="client-family-edit-approved"
                    checked={familyEditApproved}
                    onChange={(e) => setFamilyEditApproved(e.target.checked)}
                    className="mt-0.5 rounded border-violet-300"
                  />
                  <span>
                    <span className="text-[10px] font-semibold text-gray-800 flex items-center gap-1">
                      <Lock size={10} className="text-violet-600" />
                      Allow member to edit immediate family (dashboard)
                    </span>
                    <span className="text-[9px] text-gray-500 block mt-0.5 leading-snug">
                      On by default so members can maintain their list. Turn off to block edits once their names are saved, unless you allow a temporary unlock below.
                    </span>
                  </span>
                </label>
              </div>
            )}
            <div className={`rounded-lg border px-2 py-2 ${portalLoginAllowed ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/30'}`}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="client-portal-login-allowed"
                  checked={portalLoginAllowed}
                  onChange={(e) => setPortalLoginAllowed(e.target.checked)}
                  className="mt-0.5 rounded border-green-300"
                />
                <span>
                  <span className="text-[10px] font-semibold text-gray-800 flex items-center gap-1">
                    <Lock size={10} className={portalLoginAllowed ? 'text-green-600' : 'text-red-500'} />
                    Allow Google login to student dashboard
                  </span>
                  <span className="text-[9px] text-gray-500 block mt-0.5 leading-snug">
                    When enabled, this client can sign in via Google and access their student portal.
                    Turn off to block dashboard access for this individual.
                    {' '}
                    <span className="text-violet-700/90">
                      The first time you turn this on after access was blocked, they receive a short welcome email at this client&apos;s address with a link to sign in.
                    </span>
                  </span>
                </span>
              </label>
            </div>
            <div className={`rounded-lg border px-2 py-2 ${annualMemberDashboard ? 'border-purple-200 bg-purple-50/40' : 'border-gray-200 bg-gray-50/40'}`}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="client-annual-member-dashboard"
                  checked={annualMemberDashboard}
                  onChange={(e) => setAnnualMemberDashboard(e.target.checked)}
                  className="mt-0.5 rounded border-purple-300"
                />
                <span>
                  <span className="text-[10px] font-semibold text-gray-800">Sacred Home: use annual-member pricing</span>
                  <span className="text-[9px] text-gray-500 block mt-0.5 leading-snug">
                    Turn on after you verify they are on the annual path. This unlocks package-inclusion and annual-offer logic like the Subscribers sheet, without requiring an Excel subscriber row.
                  </span>
                </span>
              </label>
            </div>
            {/* India Payments */}
            <div className="rounded-lg border border-orange-200 bg-orange-50/30 px-3 py-2.5 space-y-3">
              <p className="text-[10px] font-semibold text-orange-800 flex items-center gap-1.5">
                ₹ India / Card Payments
              </p>

              {/* Row 1: Payment method tag */}
              <div>
                <Label className="text-[9px] text-gray-500 block mb-0.5">Payment method tag</Label>
                <select
                  value={indiaPaymentMethod}
                  onChange={(e) => setPaymentMethodTagged(e.target.value)}
                  className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white"
                >
                  <option value="">— Not tagged —</option>
                  <option value="gpay_upi">GPay / UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash_deposit">Cash Deposit</option>
                  <option value="stripe">Stripe</option>
                  <option value="any">Any / Multiple</option>
                </select>
              </div>

              {/* Row 2: Discount on base price */}
              <div>
                <Label className="text-[9px] text-gray-500 block mb-0.5">Discount % on base price</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={indiaDiscountPercent}
                    onChange={(e) => setIndiaDiscountPercent(e.target.value)}
                    className="h-7 text-xs flex-1"
                    placeholder="e.g. 9 (leave blank to use site default)"
                  />
                  <span className="text-[10px] text-gray-400 flex-shrink-0">%</span>
                </div>
                <p className="text-[9px] text-gray-400 mt-0.5">
                  Applied on base price before GST. Optional bands below override this for specific headcounts.
                </p>
              </div>

              <div>
                <Label className="text-[9px] text-gray-500 block mb-0.5">Optional: group discount by # of people</Label>
                <p className="text-[9px] text-gray-400 mb-1.5">
                  Sacred Exchange total participants. First matching rule wins. Otherwise the flat % above or site default.
                </p>
                <IndiaDiscountBandsEditor
                  compact
                  rows={indiaDiscountBandRows}
                  onChange={setIndiaDiscountBandRows}
                />
              </div>

              {(indiaGpayOpts.length >= 1) && (indiaPaymentMethod === 'gpay_upi' || indiaPaymentMethod === 'any') && (
                <div>
                  <Label className="text-[9px] text-gray-500 block mb-0.5">Tagged UPI (India proof row)</Label>
                  <p className="text-[9px] text-gray-400 mb-1 leading-snug">
                    Same as Subscribers: pick one row from Site Settings → India payment so this client only sees that UPI on Sacred Exchange.
                    If they also have a Subscribers record, tags on that row take priority.
                  </p>
                  <select
                    value={preferredIndiaGpayId}
                    onChange={(e) => setPreferredIndiaGpayId(e.target.value)}
                    className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white"
                    data-testid="client-preferred-india-gpay"
                  >
                    <option value="">All UPIs (full list on payment page)</option>
                    {indiaGpayOpts.map((o) => (
                      <option key={o.tag_id} value={o.tag_id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {(indiaBankOpts.length >= 1) && (indiaPaymentMethod === 'bank_transfer' || indiaPaymentMethod === 'cash_deposit' || indiaPaymentMethod === 'any') && (
                <div>
                  <Label className="text-[9px] text-gray-500 block mb-0.5">Tagged bank account (India proof)</Label>
                  <p className="text-[9px] text-gray-400 mb-1 leading-snug">
                    Pin one bank row for bank transfer / cash-deposit flows. Subscriber row overrides when set.
                  </p>
                  <select
                    value={preferredIndiaBankId}
                    onChange={(e) => setPreferredIndiaBankId(e.target.value)}
                    className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white"
                    data-testid="client-preferred-india-bank"
                  >
                    <option value="">All accounts (student picks)</option>
                    {indiaBankOpts.map((o) => (
                      <option key={o.tag_id} value={o.tag_id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Row 3: GST */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`india-tax-${cl.id}`}
                    checked={indiaTaxEnabled}
                    onChange={(e) => setIndiaTaxEnabled(e.target.checked)}
                    className="rounded border-orange-300"
                  />
                  <label htmlFor={`india-tax-${cl.id}`} className="text-[9px] font-semibold text-gray-700 cursor-pointer">
                    Apply GST on after-discount price
                  </label>
                </div>
                {indiaTaxEnabled && (
                  <div className="pl-5 space-y-1.5">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-[9px] text-gray-500">GST %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={indiaTaxPercent}
                          onChange={(e) => setIndiaTaxPercent(e.target.value)}
                          className="h-7 text-xs mt-0.5"
                          placeholder="18"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-[9px] text-gray-500">Label shown to them</Label>
                        <Input
                          value={indiaTaxLabel}
                          onChange={(e) => setIndiaTaxLabel(e.target.value)}
                          className="h-7 text-xs mt-0.5"
                          placeholder="GST"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={indiaTaxVisibleOnDashboard}
                        onChange={(e) => setIndiaTaxVisibleOnDashboard(e.target.checked)}
                        className="rounded border-orange-300"
                      />
                      <span className="text-[9px] text-gray-600">Show tax breakdown on their dashboard</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <Button data-testid="client-save" onClick={handleSave} disabled={saving} size="sm" className="text-[10px] bg-[#D4AF37] hover:bg-[#b8962e] gap-1">
              <Save size={10} /> {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cl.label}</span>
              {cl.label_manual && <span className="text-[9px] text-gray-400">(manually set)</span>}
            </div>
            {cl.notes && <p className="text-[10px] text-gray-600 mt-1">{cl.notes}</p>}
            {cl.intake_pending && (
              <div className="mt-2 flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-orange-700">
                  <Bell size={10} /> Pending Review — submitted via intake form
                  {cl.intake_submitted_at && <span className="font-normal text-orange-500">· {timeAgo(cl.intake_submitted_at)}</span>}
                </span>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await axios.put(`${API}/clients/${cl.id}`, { intake_pending: false });
                    onRefresh();
                  }}
                  className="text-[9px] px-2 py-0.5 bg-orange-200 hover:bg-orange-300 text-orange-800 rounded font-semibold transition-colors"
                >
                  Mark reviewed
                </button>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold ${portalLoginAllowed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                <Lock size={8} />
                Dashboard: {portalLoginAllowed ? 'Access allowed' : 'Access blocked'}
              </span>
              {indiaPaymentMethod && (
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">
                  ₹ {{ gpay_upi: 'GPay / UPI', gpay: 'GPay / UPI', upi: 'GPay / UPI', bank_transfer: 'Bank Transfer', cash_deposit: 'Cash Deposit', stripe: 'Stripe', any: 'Any / Multiple' }[indiaPaymentMethod] || indiaPaymentMethod}
                </span>
              )}
              {indiaDiscountPercent !== '' && indiaDiscountPercent !== null && (
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700">
                  {indiaDiscountPercent}% India discount
                </span>
              )}
              {indiaTaxEnabled && (
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800">
                  +{indiaTaxPercent}% {indiaTaxLabel}
                </span>
              )}
              {cl.intake_claims_annual_member && (
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold bg-violet-100 text-violet-800">
                  Intake: annual path (self-reported)
                </span>
              )}
              {annualMemberDashboard && (
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-800">
                  Sacred Home: annual pricing
                </span>
              )}
              {preferredIndiaGpayId && (
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 max-w-[240px] truncate" title={preferredIndiaGpayId}>
                  UPI tag: {indiaGpayOpts.find((o) => o.tag_id === preferredIndiaGpayId)?.label || preferredIndiaGpayId}
                </span>
              )}
              {preferredIndiaBankId && (
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 max-w-[240px] truncate" title={preferredIndiaBankId}>
                  Bank tag: {indiaBankOpts.find((o) => o.tag_id === preferredIndiaBankId)?.label || preferredIndiaBankId}
                </span>
              )}
            </div>
            {(cl.city || cl.state || cl.country_name || cl.preferred_payment_method) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(cl.city || cl.state || cl.country_name) && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    📍 {[cl.city, cl.state, cl.country_name].filter(Boolean).join(', ')}
                  </span>
                )}
                {cl.preferred_payment_method && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium border border-teal-200">
                    Prefers: {{ gpay_upi: 'GPay / UPI', bank_transfer: 'Bank Transfer', cash_deposit: 'Cash Deposit', stripe: 'Stripe' }[cl.preferred_payment_method] || cl.preferred_payment_method}
                  </span>
                )}
              </div>
            )}
            <div className="mt-3 pt-2 border-t border-gray-100 space-y-2">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Lock size={9} /> Immediate family list
              </p>

              {cl.family_approved ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                  <p className="text-[10px] text-green-800 font-medium">Approved &amp; permanently frozen — client cannot edit.</p>
                </div>
              ) : cl.family_pending_review ? (
                <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-orange-700">
                    <Bell size={10} /> Family list submitted — pending your review
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await axios.put(`${API}/clients/${cl.id}`, { family_approved: true });
                      onRefresh();
                    }}
                    className="text-[9px] px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition-colors whitespace-nowrap"
                  >
                    Approve &amp; Freeze
                  </button>
                </div>
              ) : familyListLocked ? (
                <p className="text-[10px] text-gray-600">
                  List is <span className="font-semibold">locked</span>.{" "}
                  {cl.immediate_family_editing_approved !== false
                    ? "Edits currently allowed — turn off above to re-lock."
                    : 'Enable "Allow member to edit immediate family" above to let them update it.'}
                </p>
              ) : (
                <p className="text-[10px] text-gray-400 italic">
                  Not submitted yet — open to the client until they save names for the first time.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Conversions */}
      {cl.conversions?.length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-2">Conversions ({cl.conversions.length})</p>
          <div className="space-y-1.5">
            {cl.conversions.map((c, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-lg border px-3 py-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.is_flagship ? 'bg-purple-500' : 'bg-green-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-800 truncate">{c.program_title || `Enrollment (${c.status})`}</p>
                  <p className="text-[9px] text-gray-400">{c.item_type || 'program'} {c.tier_label ? `| ${c.tier_label}` : ''} | {c.status}</p>
                </div>
                <span className="text-[9px] text-gray-400 flex-shrink-0">{c.date ? new Date(c.date).toLocaleDateString() : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-2">Journey Timeline</p>
          <div className="relative pl-4 border-l-2 border-gray-200 space-y-3">
            {timeline.slice(0, 10).map((t, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-[#D4AF37] border-2 border-white" />
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-medium text-gray-700">{t.type}</span>
                  <span className="text-[9px] text-gray-400 flex items-center gap-1"><Clock size={8} />{t.date ? timeAgo(t.date) : ''}</span>
                </div>
                {t.detail && <p className="text-[9px] text-gray-500 mt-0.5 truncate">{t.detail}</p>}
              </div>
            ))}
            {timeline.length > 10 && <p className="text-[9px] text-gray-400 italic">+{timeline.length - 10} more events</p>}
          </div>
        </div>
      )}

      {/* Delete */}
      <div className="flex justify-end">
        <button data-testid="client-delete" onClick={onDelete} className="text-red-400 hover:text-red-600 text-[10px] flex items-center gap-1">
          <Trash2 size={12} /> Remove Client
        </button>
      </div>
    </div>
  );
};

const InfoField = ({ label, value }) => (
  <div>
    <p className="text-[9px] text-gray-400 uppercase tracking-wider">{label}</p>
    <p className="text-[11px] text-gray-800 font-medium truncate" title={value || '—'}>{value || '—'}</p>
  </div>
);

export default ClientsTab;
