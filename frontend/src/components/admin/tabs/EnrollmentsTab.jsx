import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { FileSpreadsheet, Download, Search, CreditCard, Building2, Upload, Globe, ChevronDown, ChevronUp, LayoutList, Table2, Mail } from 'lucide-react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const STATUS_MAP = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  checkout_started: { label: 'Checkout Started', color: 'bg-blue-100 text-blue-700' },
  india_payment_proof_submitted: { label: 'Proof Submitted', color: 'bg-indigo-100 text-indigo-700' },
  india_payment_approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  india_payment_rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  otp_verified: { label: 'OTP Verified', color: 'bg-purple-100 text-purple-700' },
  started: { label: 'Started', color: 'bg-gray-100 text-gray-600' },
  abandoned: { label: 'Abandoned', color: 'bg-gray-100 text-gray-500' },
};

const PAYMENT_MODE_MAP = {
  stripe: { label: 'Stripe', icon: CreditCard, color: 'text-blue-600 bg-blue-50' },
  india_bank: { label: 'Bank Transfer', icon: Building2, color: 'text-green-600 bg-green-50' },
  india_exly: { label: 'Exly', icon: Globe, color: 'text-purple-600 bg-purple-50' },
  manual_proof: { label: 'Manual Proof', icon: Upload, color: 'text-amber-600 bg-amber-50' },
  free: { label: 'Free', icon: CreditCard, color: 'text-gray-500 bg-gray-50' },
};

/** Admin analytics: normalize participant attendance for checkout-level summary. */
function attendanceBucket(mode) {
  const m = String(mode || '').toLowerCase().replace(/-/g, '_');
  if (m === 'offline') return 'offline';
  if (m === 'in_person') return 'in_person';
  return 'online';
}

/** One label per enrollment from participant rows (Online / Offline / In person / Mixed / —). */
function deriveCheckoutAttendanceLabel(participants) {
  const list = Array.isArray(participants) ? participants : [];
  if (list.length === 0) return '—';
  const buckets = list.map((p) => attendanceBucket(p.attendance_mode));
  const uniq = [...new Set(buckets)];
  if (uniq.length === 1) {
    if (uniq[0] === 'offline') return 'Offline';
    if (uniq[0] === 'in_person') return 'In person';
    return 'Online';
  }
  return 'Mixed';
}

/**
 * Convert stored payment amount to INR using /api/currency/exchange-rates keys (`usd_to_inr`, etc.).
 * Falls back to rough static rates for admin display when a pair is missing.
 */
function enrollmentAmountToInr(amount, currency, rates) {
  const n = Number(amount) || 0;
  if (n <= 0) return 0;
  const c = String(currency || 'inr').toLowerCase();
  if (c === 'inr') return Math.round(n);
  const key = `${c}_to_inr`;
  const r = rates && Number(rates[key]);
  if (r > 0) return Math.round(n * r);
  const fallback = { usd: 83, aed: 22.6, eur: 90, gbp: 105, cad: 60, aud: 55, sar: 22 };
  const mult = fallback[c];
  if (mult) return Math.round(n * mult);
  return Math.round(n);
}

const getPaymentMode = (enrollment) => {
  // Check explicit payment_method first
  const method = enrollment.payment_method || enrollment.payment?.payment_method || '';
  if (method === 'stripe') return 'stripe';
  if (method === 'manual_proof') return 'manual_proof';
  if (method === 'india_bank') return 'india_bank';
  if (method === 'exly') return 'india_exly';
  if (method === 'razorpay') return 'razorpay';
  // Fallback detection
  const status = enrollment.status || '';
  if (status.includes('india_payment')) return 'india_bank';
  if (enrollment.payment?.stripe_session_id || enrollment.stripe_session_id) return 'stripe';
  if (enrollment.is_india_alt) return 'manual_proof';
  if (enrollment.payment?.amount === 0 || enrollment.total === 0) return 'free';
  if (enrollment.payment) return 'stripe';
  return null;
};

const EnrollmentsTab = () => {
  const { toast } = useToast();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  /** summary = one row per checkout; participants = one row per person (all flows use the same enrollments DB). */
  const [viewMode, setViewMode] = useState('summary');
  const [participantRows, setParticipantRows] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [paidOnlyReport, setPaidOnlyReport] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const [autoReport, setAutoReport] = useState({
    enrollment_auto_report_enabled: false,
    enrollment_auto_report_emails: '',
    enrollment_auto_report_interval_hours: 24,
    enrollment_auto_report_paid_only: true,
    enrollment_auto_report_last_sent_at: '',
  });
  const [savingReport, setSavingReport] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  /** Flat map e.g. { usd_to_inr, aed_to_inr } for admin INR column */
  const [fxRates, setFxRates] = useState({});

  useEffect(() => { loadEnrollments(); }, []);

  useEffect(() => {
    axios
      .get(`${API}/currency/exchange-rates`)
      .then((r) => {
        const raw = r.data?.rates;
        if (raw && typeof raw === 'object') setFxRates(raw);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    axios.get(`${API}/settings`)
      .then((r) => {
        const d = r.data || {};
        setAutoReport({
          enrollment_auto_report_enabled: !!d.enrollment_auto_report_enabled,
          enrollment_auto_report_emails: d.enrollment_auto_report_emails || '',
          enrollment_auto_report_interval_hours: Math.min(168, Math.max(6, Number(d.enrollment_auto_report_interval_hours) || 24)),
          enrollment_auto_report_paid_only: d.enrollment_auto_report_paid_only !== false,
          enrollment_auto_report_last_sent_at: d.enrollment_auto_report_last_sent_at || '',
        });
      })
      .catch(() => {});
  }, []);

  const loadParticipantReport = async () => {
    setLoadingParticipants(true);
    try {
      const r = await axios.get(`${API}/india-payments/admin/enrollments/participant-rows`, {
        params: { paid_completed_only: paidOnlyReport },
      });
      setParticipantRows(Array.isArray(r.data) ? r.data : []);
    } catch {
      toast({ title: 'Failed to load participant report', variant: 'destructive' });
    } finally {
      setLoadingParticipants(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'participants') loadParticipantReport();
  }, [viewMode, paidOnlyReport]);

  const loadEnrollments = async () => {
    try {
      const r = await axios.get(`${API}/india-payments/admin/enrollments`);
      setEnrollments(r.data);
    } catch {
      toast({ title: 'Failed to load', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleExport = async () => {
    try {
      const r = await axios.get(`${API}/india-payments/admin/enrollments/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `enrollments_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click(); window.URL.revokeObjectURL(url);
      toast({ title: 'Excel downloaded!' });
    } catch { toast({ title: 'Export failed', variant: 'destructive' }); }
  };

  const saveAutoReportSettings = async () => {
    setSavingReport(true);
    try {
      const hrs = Math.min(168, Math.max(6, Number(autoReport.enrollment_auto_report_interval_hours) || 24));
      await axios.put(`${API}/settings`, {
        enrollment_auto_report_enabled: autoReport.enrollment_auto_report_enabled,
        enrollment_auto_report_emails: autoReport.enrollment_auto_report_emails.trim(),
        enrollment_auto_report_interval_hours: hrs,
        enrollment_auto_report_paid_only: autoReport.enrollment_auto_report_paid_only,
      });
      setAutoReport((prev) => ({ ...prev, enrollment_auto_report_interval_hours: hrs }));
      toast({ title: 'Automated report settings saved' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSavingReport(false);
    }
  };

  const sendReportTestNow = async () => {
    setSendingTest(true);
    try {
      const r = await axios.post(`${API}/admin/enrollment-report/send-now`);
      toast({ title: r.data?.message || 'Sent' });
    } catch (e) {
      toast({
        title: e.response?.data?.detail || 'Send failed — check emails & mail config',
        variant: 'destructive',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleCleanExport = async () => {
    try {
      const r = await axios.get(`${API}/india-payments/admin/enrollments/clean-export`, {
        params: { paid_completed_only: paidOnlyReport },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `enrollments_by_participant_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Participant report downloaded!' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const filtered = useMemo(
    () =>
      enrollments.filter((e) => {
        const matchSearch =
          !search ||
          [e.id, e.booker_name, e.booker_email, e.item_title, e.phone, e.invoice_number]
            .filter(Boolean)
            .some((f) => f.toLowerCase().includes(search.toLowerCase()));
        const matchStatus = statusFilter === 'all' || e.status === statusFilter;
        const mode = getPaymentMode(e);
        const matchPayment = paymentFilter === 'all' || mode === paymentFilter;
        return matchSearch && matchStatus && matchPayment;
      }),
    [enrollments, search, statusFilter, paymentFilter],
  );

  const statusCounts = {};
  enrollments.forEach(e => { const s = e.status || 'pending'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
  statusCounts.all = enrollments.length;

  const paymentCounts = {};
  enrollments.forEach(e => { const m = getPaymentMode(e) || 'unknown'; paymentCounts[m] = (paymentCounts[m] || 0) + 1; });

  /** Summary table: serial #, INR amounts, running total in INR (filtered order). */
  const summaryAnalyticsRows = useMemo(() => {
    let cumulativeInr = 0;
    return filtered.map((e, idx) => {
      const rawAmount = e.payment?.amount ?? e.dashboard_mixed_total ?? e.total ?? 0;
      const currency = e.payment?.currency || e.dashboard_mixed_currency || e.currency || 'inr';
      const amountInr = enrollmentAmountToInr(rawAmount, currency, fxRates);
      cumulativeInr += amountInr;
      return {
        enrollment: e,
        serial: idx + 1,
        amountInr,
        cumulativeInr,
        attendanceLabel: deriveCheckoutAttendanceLabel(e.participants),
        sourceCurrency: String(currency || '').toLowerCase() || 'inr',
      };
    });
  }, [filtered, fxRates]);

  const filteredParticipants = participantRows.filter((row) => {
    if (!participantSearch.trim()) return true;
    const q = participantSearch.toLowerCase();
    return [
      row.participant_name,
      row.booker_name,
      row.booker_email,
      row.participant_email,
      row.phone,
      row.whatsapp,
      row.country,
      row.city,
      row.state,
      row.relationship,
      row.program,
      row.invoice_number,
      row.enrollment_id,
      row.notify_enrollment,
      row.referral_source,
      row.referred_by_name,
      row.referred_by_email,
    ].filter(Boolean).some((f) => String(f).toLowerCase().includes(q));
  });

  return (
    <div data-testid="enrollments-tab" className="w-full min-w-0 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-[#D4AF37]" />
          <h2 className="text-lg font-semibold text-gray-900">Enrollments</h2>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{enrollments.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-gray-200 p-0.5 bg-gray-50">
            <button
              type="button"
              onClick={() => setViewMode('summary')}
              className={`flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-full font-medium ${viewMode === 'summary' ? 'bg-white shadow text-purple-800' : 'text-gray-600'}`}
            >
              <Table2 size={12} /> By checkout
            </button>
            <button
              type="button"
              onClick={() => setViewMode('participants')}
              data-testid="enrollments-view-participants"
              className={`flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-full font-medium ${viewMode === 'participants' ? 'bg-white shadow text-purple-800' : 'text-gray-600'}`}
            >
              <LayoutList size={12} /> By participant
            </button>
          </div>
          {viewMode === 'summary' ? (
            <button onClick={handleExport} data-testid="export-enrollments"
              className="flex items-center gap-1.5 text-[10px] px-4 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 font-medium">
              <Download size={12} /> Full Excel
            </button>
          ) : (
            <button onClick={handleCleanExport} data-testid="export-enrollments-clean"
              className="flex items-center gap-1.5 text-[10px] px-4 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 font-medium">
              <Download size={12} /> Participant Excel
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-violet-200 bg-violet-50/40 p-4" data-testid="enrollment-auto-report">
        <div className="flex items-center gap-2 mb-2">
          <Mail size={16} className="text-violet-700" />
          <h3 className="text-sm font-semibold text-gray-900">Automated enrollment reports</h3>
        </div>
        <p className="text-[11px] text-gray-600 mb-3 max-w-2xl">
          On a schedule, the server emails the same <strong>participant-level</strong> Excel as &quot;Participant Excel&quot; below.
          Uses your SMTP or Resend keys (Admin → API Keys). Check runs every hour; minimum gap between sends is 6 hours, maximum 1 week.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center justify-between gap-2 rounded-md bg-white/80 border border-violet-100 px-3 py-2">
            <Label className="text-[11px] text-gray-700">Enable schedule</Label>
            <Switch
              checked={autoReport.enrollment_auto_report_enabled}
              onCheckedChange={(v) => setAutoReport((p) => ({ ...p, enrollment_auto_report_enabled: v }))}
              data-testid="enrollment-auto-report-enabled"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-[10px] text-gray-500">Email addresses (comma-separated)</Label>
            <Input
              className="text-xs h-9 mt-0.5"
              placeholder="you@example.com, ops@example.com"
              value={autoReport.enrollment_auto_report_emails}
              onChange={(e) => setAutoReport((p) => ({ ...p, enrollment_auto_report_emails: e.target.value }))}
              data-testid="enrollment-auto-report-emails"
            />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Hours between sends (6–168)</Label>
            <Input
              type="number"
              min={6}
              max={168}
              className="text-xs h-9 mt-0.5"
              value={autoReport.enrollment_auto_report_interval_hours}
              onChange={(e) => setAutoReport((p) => ({ ...p, enrollment_auto_report_interval_hours: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2 rounded-md bg-white/80 border border-violet-100 px-3 py-2">
            <input
              type="checkbox"
              id="auto-report-paid-only"
              className="rounded border-gray-300"
              checked={autoReport.enrollment_auto_report_paid_only}
              onChange={(e) => setAutoReport((p) => ({ ...p, enrollment_auto_report_paid_only: e.target.checked }))}
            />
            <label htmlFor="auto-report-paid-only" className="text-[11px] text-gray-700 cursor-pointer">
              Paid / completed rows only
            </label>
          </div>
          <div className="text-[10px] text-gray-500 flex items-end">
            {autoReport.enrollment_auto_report_last_sent_at
              ? `Last sent: ${new Date(autoReport.enrollment_auto_report_last_sent_at).toLocaleString()}`
              : 'Last sent: —'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={saveAutoReportSettings}
            disabled={savingReport}
            className="text-[10px] px-4 py-2 rounded-full bg-violet-700 text-white hover:bg-violet-800 disabled:opacity-50 font-medium"
          >
            {savingReport ? 'Saving…' : 'Save automation'}
          </button>
          <button
            type="button"
            onClick={sendReportTestNow}
            disabled={sendingTest || !autoReport.enrollment_auto_report_emails.trim()}
            data-testid="enrollment-auto-report-send-now"
            className="text-[10px] px-4 py-2 rounded-full border border-violet-300 text-violet-800 hover:bg-violet-100 disabled:opacity-50 font-medium"
          >
            {sendingTest ? 'Sending…' : 'Send test now'}
          </button>
        </div>
      </div>

      {viewMode === 'participants' && (
        <p className="text-[11px] text-gray-600 mb-3 max-w-3xl">
          Every path—program page, session, upcoming, cart, checkout, or student dashboard pay—creates a record in <strong>Enrollments</strong>.
          <strong>By participant</strong> lists one row per person (not merged): relationship, city/state, attendance, notify, referral, participant email, etc. Checkout total repeats on each row when several people enroll together.
        </p>
      )}

      {viewMode === 'participants' && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="flex items-center gap-2 text-[11px] text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={paidOnlyReport}
              onChange={(ev) => setPaidOnlyReport(ev.target.checked)}
              className="rounded border-gray-300"
            />
            Paid / completed only
          </label>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              placeholder="Search participant, phone, program…"
              className="pl-9 text-xs h-9"
            />
          </div>
        </div>
      )}

      {/* Search + Filters (summary) */}
      {viewMode === 'summary' && (
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, phone, invoice..." className="pl-9 text-xs h-9" />
        </div>

        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {['all', 'completed', 'paid', 'checkout_started', 'otp_verified', 'india_payment_proof_submitted', 'pending'].map(k => {
            const count = statusCounts[k] || 0;
            if (k !== 'all' && count === 0) return null;
            const label = k === 'all' ? 'All' : (STATUS_MAP[k]?.label || k);
            return (
              <button key={k} onClick={() => setStatusFilter(k)}
                className={`text-[9px] px-2.5 py-1 rounded-full transition-colors ${statusFilter === k ? 'bg-[#D4AF37] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Payment mode filter */}
        <div className="flex gap-1">
          <button onClick={() => setPaymentFilter('all')}
            className={`text-[9px] px-2.5 py-1 rounded-full ${paymentFilter === 'all' ? 'bg-[#5D3FD3] text-white' : 'bg-gray-100 text-gray-600'}`}>
            All modes
          </button>
          {Object.entries(PAYMENT_MODE_MAP).map(([k, v]) => (
            paymentCounts[k] > 0 && (
              <button key={k} onClick={() => setPaymentFilter(k)}
                className={`text-[9px] px-2.5 py-1 rounded-full flex items-center gap-1 ${paymentFilter === k ? 'bg-[#5D3FD3] text-white' : 'bg-gray-100 text-gray-600'}`}>
                <v.icon size={9} /> {v.label} ({paymentCounts[k]})
              </button>
            )
          ))}
        </div>
      </div>
      )}

      {viewMode === 'summary' && loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : viewMode === 'summary' && filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No enrollments found</div>
      ) : viewMode === 'summary' ? (
        <div className="w-full min-w-0 rounded-lg border overflow-hidden">
          <p className="text-[10px] text-gray-500 px-2 sm:px-3 py-2 bg-gray-50/80 border-b break-words">
            Admin analytics: <strong>Amount (INR)</strong> and <strong>Running total (INR)</strong> use stored checkout currency and{' '}
            <span className="font-mono">/api/currency/exchange-rates</span> when available; otherwise rough fallbacks.
          </p>
          <div className="w-full min-w-0 overflow-x-hidden">
          <table className="w-full table-fixed text-[10px] sm:text-xs border-collapse">
            <colgroup>
              <col style={{ width: '2.5%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '3.5%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '3.5%' }} />
            </colgroup>
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-1 sm:px-2 py-1.5 font-semibold text-gray-600">#</th>
                <th className="text-left px-1 sm:px-2 py-1.5 font-semibold text-gray-600">Invoice</th>
                <th className="text-left px-1 sm:px-2 py-1.5 font-semibold text-gray-600">Booker</th>
                <th className="text-left px-1 sm:px-2 py-1.5 font-semibold text-gray-600">Program</th>
                <th className="text-left px-1 sm:px-2 py-1.5 font-semibold text-gray-600">Origin</th>
                <th className="text-center px-1 sm:px-2 py-1.5 font-semibold text-gray-600">Pax</th>
                <th className="text-left px-1 sm:px-2 py-1.5 font-semibold text-gray-600 leading-tight">Online / off</th>
                <th className="text-left px-1 sm:px-2 py-1.5 font-semibold text-gray-600 leading-tight">Payment</th>
                <th className="text-left px-1 sm:px-2 py-1.5 font-semibold text-gray-600">Status</th>
                <th className="text-left px-1 sm:px-2 py-1.5 font-semibold text-gray-600">Date</th>
                <th className="text-right px-1 sm:px-2 py-1.5 font-semibold text-gray-600 leading-tight">Amt ₹</th>
                <th className="text-right px-1 sm:px-2 py-1.5 font-semibold text-gray-600 leading-tight">Σ ₹</th>
                <th className="w-6 px-0"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summaryAnalyticsRows.map(({ enrollment: e, serial, amountInr, cumulativeInr, attendanceLabel, sourceCurrency }) => {
                const s = STATUS_MAP[e.status] || { label: e.status || 'Unknown', color: 'bg-gray-100 text-gray-600' };
                const mode = getPaymentMode(e);
                const modeInfo = mode ? PAYMENT_MODE_MAP[mode] : null;
                const ModeIcon = modeInfo?.icon || CreditCard;
                const isExpanded = expandedId === e.id;
                const rawAmount = e.payment?.amount ?? e.dashboard_mixed_total ?? e.total ?? 0;
                const currency = e.payment?.currency || e.dashboard_mixed_currency || e.currency || '';

                return (
                  <React.Fragment key={e.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer align-top" onClick={() => setExpandedId(isExpanded ? null : e.id)}>
                      <td className="px-1 sm:px-2 py-1.5 text-gray-500 tabular-nums font-medium">{serial}</td>
                      <td className="px-1 sm:px-2 py-1.5 font-mono text-purple-700 font-medium text-[9px] break-all">
                        {e.invoice_number || e.id?.slice(0, 8) || '-'}
                      </td>
                      <td className="px-1 sm:px-2 py-1.5 min-w-0">
                        <p className="font-medium text-gray-900 truncate" title={e.booker_name || ''}>{e.booker_name || '-'}</p>
                        <p className="text-gray-400 text-[9px] truncate" title={e.booker_email || ''}>{e.booker_email || ''}</p>
                        {e.phone && <p className="text-gray-400 text-[9px] truncate" title={e.phone}>{e.phone}</p>}
                      </td>
                      <td className="px-1 sm:px-2 py-1.5 min-w-0">
                        <p className="text-gray-700 line-clamp-2 break-words" title={e.item_title || ''}>{e.item_title || '-'}</p>
                        <p className="text-gray-400 capitalize text-[9px] truncate">{e.item_type || ''}</p>
                      </td>
                      <td className="px-1 sm:px-2 py-1.5 min-w-0">
                        <span className={`inline-block text-[9px] px-1 py-0.5 rounded font-medium max-w-full truncate ${e.enrollment_origin === 'dashboard' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                          {e.enrollment_origin === 'dashboard' ? 'Dash' : 'Web'}
                        </span>
                      </td>
                      <td className="px-1 sm:px-2 py-1.5 text-center">
                        <span className="font-medium">{e.participant_count || e.participants?.length || 0}</span>
                      </td>
                      <td className="px-1 sm:px-2 py-1.5 text-gray-800 text-[9px] break-words leading-tight" title={attendanceLabel}>
                        {attendanceLabel}
                      </td>
                      <td className="px-1 sm:px-2 py-1.5 min-w-0">
                        {modeInfo ? (
                          <span className={`inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded font-medium max-w-full truncate ${modeInfo.color}`} title={modeInfo.label}>
                            <ModeIcon size={9} className="shrink-0" /> <span className="truncate">{modeInfo.label}</span>
                          </span>
                        ) : <span className="text-gray-400 text-[9px]">—</span>}
                      </td>
                      <td className="px-1 sm:px-2 py-1.5 min-w-0">
                        <span className={`inline-block text-[9px] px-1 py-0.5 rounded font-medium max-w-full truncate ${s.color}`} title={s.label}>{s.label}</span>
                      </td>
                      <td className="px-1 sm:px-2 py-1.5 text-gray-500 text-[9px] whitespace-nowrap">
                        {e.created_at ? new Date(e.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '-'}
                      </td>
                      <td className="px-1 sm:px-2 py-1.5 text-right font-medium text-gray-900 tabular-nums text-[9px] sm:text-[10px] whitespace-nowrap">
                        {rawAmount > 0 ? (
                          <span title={sourceCurrency !== 'inr' ? `Stored: ${String(currency || '').toUpperCase()}` : ''}>
                            ₹{amountInr.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          'FREE'
                        )}
                      </td>
                      <td className="px-1 sm:px-2 py-1.5 text-right font-semibold text-violet-900 tabular-nums text-[9px] sm:text-[10px] whitespace-nowrap">
                        ₹{cumulativeInr.toLocaleString('en-IN')}
                      </td>
                      <td className="px-0 py-1.5 text-center w-6">
                        {isExpanded ? <ChevronUp size={12} className="text-gray-400 mx-auto" /> : <ChevronDown size={12} className="text-gray-400 mx-auto" />}
                      </td>
                    </tr>
                    {/* Expanded details */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={13} className="bg-gray-50 px-4 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                            <div><span className="text-gray-400 block">Enrollment ID</span><span className="font-mono">{e.id}</span></div>
                            <div><span className="text-gray-400 block">Origin</span>{e.enrollment_origin === 'dashboard' ? 'Dashboard' : 'Website'}</div>
                            <div><span className="text-gray-400 block">Country</span>{e.booker_country || '-'}</div>
                            <div><span className="text-gray-400 block">Stored currency</span>{(currency || '').toUpperCase() || '—'}</div>
                            <div><span className="text-gray-400 block">Amount (analytics INR)</span>₹{amountInr.toLocaleString('en-IN')}</div>
                            <div><span className="text-gray-400 block">Attendance (summary)</span>{attendanceLabel}</div>
                            <div><span className="text-gray-400 block">Tier</span>{e.tier_index != null ? `Tier ${e.tier_index + 1}` : '-'}</div>
                            <div><span className="text-gray-400 block">Promo Code</span>{e.promo_code || '-'}</div>
                            <div><span className="text-gray-400 block">Bank/Account</span>{e.bank_name || e.payment?.bank_name || '-'}</div>
                            <div><span className="text-gray-400 block">VPN Detected</span>{e.vpn_detected ? 'Yes' : 'No'}</div>
                            <div><span className="text-gray-400 block">Stripe Session</span><span className="font-mono truncate block max-w-[150px]">{e.stripe_session_id || '-'}</span></div>
                            <div><span className="text-gray-400 block">Updated</span>{e.updated_at ? new Date(e.updated_at).toLocaleString() : '-'}</div>
                          </div>
                          {/* Participants */}
                          {e.participants?.length > 0 && (
                            <div className="mt-3">
                              <span className="text-[10px] text-gray-400 font-semibold">Participants:</span>
                              <div className="mt-1 space-y-1">
                                {e.participants.map((p, pi) => (
                                  <div key={pi} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] bg-white rounded px-2 py-1 border">
                                    <span className="font-medium text-gray-900">{p.name || '-'}</span>
                                    {p.age != null && p.age !== '' && <span className="text-gray-500">Age {p.age}</span>}
                                    <span className="text-gray-500">{p.email || ''}</span>
                                    <span className="text-gray-500">Ph {p.phone || '—'}</span>
                                    <span className="text-gray-500">WA {p.whatsapp || p.phone || '—'}</span>
                                    <span className="text-gray-400 capitalize">{p.attendance_mode || ''}</span>
                                    <span className="text-gray-400">{p.country || ''}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      ) : null}

      {/* Table — one row per participant */}
      {viewMode === 'participants' && (
        loadingParticipants ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading participant report…</div>
        ) : filteredParticipants.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No rows match this filter.</div>
        ) : (
          <div className="w-full min-w-0 rounded-lg border overflow-hidden" data-testid="enrollments-participant-table">
            <div className="w-full min-w-0 overflow-x-hidden">
            <table className="w-full table-fixed text-[9px] sm:text-[10px] border-collapse">
              <colgroup>
                {Array.from({ length: 23 }).map((_, i) => (
                  <col key={i} style={{ width: `${100 / 23}%` }} />
                ))}
              </colgroup>
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">#</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600 leading-tight">Name</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Rel.</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Age</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600 leading-tight">Gen.</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Ctry</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">City</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">St</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Mode</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Ntf</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Ph</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600 leading-tight">WA</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">1st</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Ref</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600 leading-tight">By</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Amt</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Cur</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Prog</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Booker</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Inv</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Orig</th>
                  <th className="text-left px-1 py-1.5 font-semibold text-gray-600">Stat</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredParticipants.map((row) => {
                  const cur = (row.payment_currency || '').toLowerCase();
                  const symbols = { inr: '\u20B9', aed: 'AED ', usd: '$' };
                  const sym = symbols[cur] || (cur ? `${cur.toUpperCase()} ` : '');
                  const amt = row.payment_amount;
                  const pTotal = Number(row.participant_total);
                  const pIdx = Number(row.participant_index);
                  let slot = '—';
                  if (Number.isFinite(pTotal) && pTotal > 1 && Number.isFinite(pIdx) && pIdx > 0) {
                    slot = `${pIdx}/${pTotal}`;
                  } else if (Number.isFinite(pIdx) && pIdx > 0) {
                    slot = String(pIdx);
                  }
                  const cell = 'px-1 py-1 align-top min-w-0 break-words';
                  return (
                    <tr
                      key={`${row.enrollment_id}-${row.participant_index ?? row.participant_name}-${row.participant_email}`}
                      className="hover:bg-gray-50"
                    >
                      <td className={`${cell} text-gray-500 tabular-nums`}>{slot}</td>
                      <td className={`${cell} font-medium text-gray-900`} title={row.participant_name || ''}>{row.participant_name || '—'}</td>
                      <td className={`${cell} text-gray-700`} title={row.relationship}>{row.relationship || '—'}</td>
                      <td className={`${cell} text-gray-700`}>{row.age !== '' && row.age != null ? row.age : '—'}</td>
                      <td className={`${cell} text-gray-700`} title={row.gender}>{row.gender || '—'}</td>
                      <td className={`${cell} text-gray-700`}>{row.country || '—'}</td>
                      <td className={`${cell} text-gray-700`} title={row.city}>{row.city || '—'}</td>
                      <td className={`${cell} text-gray-700`} title={row.state}>{row.state || '—'}</td>
                      <td className={`${cell} text-gray-700`} title={row.attendance_mode}>{row.attendance_mode || '—'}</td>
                      <td className={`${cell} text-gray-800`}>{row.notify_enrollment || '—'}</td>
                      <td className={`${cell} text-gray-600`} title={row.participant_email}>{row.participant_email || '—'}</td>
                      <td className={`${cell} text-gray-600 font-mono`} title={row.phone}>{row.phone || '—'}</td>
                      <td className={`${cell} text-gray-600 font-mono`} title={row.whatsapp}>{row.whatsapp || '—'}</td>
                      <td className={`${cell} text-gray-700`}>{row.is_first_time || '—'}</td>
                      <td className={`${cell} text-gray-600`} title={row.referral_source}>{row.referral_source || '—'}</td>
                      <td className={`${cell} text-gray-600`} title={row.referred_by_name}>{row.referred_by_name || '—'}</td>
                      <td className={`${cell} font-medium text-gray-900 tabular-nums`}>
                        {amt > 0 ? `${sym}${Number(amt).toLocaleString()}` : '0'}
                      </td>
                      <td className={`${cell} uppercase text-gray-600`}>{cur || '—'}</td>
                      <td className={`${cell} text-gray-700`} title={row.program}>{row.program || '—'}</td>
                      <td className={`${cell} text-gray-600`}>
                        <span className="block" title={row.booker_name}>{row.booker_name || '—'}</span>
                        <span className="block text-gray-400" title={row.booker_phone || ''}>{row.booker_phone || ''}</span>
                      </td>
                      <td className={`${cell} font-mono text-purple-700 break-all`} title={row.invoice_number || ''}>{row.invoice_number || row.enrollment_id?.slice(0, 10) || '—'}</td>
                      <td className={cell}>
                        <span className={`inline-block text-[9px] px-1 py-0.5 rounded font-medium ${row.enrollment_origin === 'dashboard' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                          {row.enrollment_origin === 'dashboard' ? 'Dash' : 'Web'}
                        </span>
                      </td>
                      <td className={`${cell} text-gray-600`} title={row.enrollment_status || row.payment_status}>{row.enrollment_status || row.payment_status || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default EnrollmentsTab;
