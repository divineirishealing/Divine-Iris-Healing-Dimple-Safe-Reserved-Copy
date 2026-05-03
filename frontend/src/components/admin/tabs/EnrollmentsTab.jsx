import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { FileSpreadsheet, Download, Search, CreditCard, Building2, Upload, Globe, ChevronDown, ChevronUp, LayoutList, Table2, Mail, ClipboardList, Columns3 } from 'lucide-react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Checkbox } from '../../ui/checkbox';
import { cn, formatDateDMonYyyyUpper, formatDateTimeDMonYyyyUpper } from '@/lib/utils';

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

/** Short labels for dense tables (no horizontal scroll). */
const PAYMENT_MODE_SHORT = {
  stripe: 'Card',
  india_bank: 'Bank',
  india_exly: 'Exly',
  manual_proof: 'Proof',
  free: 'Free',
};

const ENROLL_TABLE_INNER_CLASS = 'overflow-x-hidden w-full min-w-0';

const ENROLL_TABLE_CARD_CLASS =
  'rounded-xl border border-gray-200/90 bg-white shadow-sm overflow-hidden w-full min-w-0 max-w-full';

const ENROLL_COLS_STORAGE_KEY = 'enrollments-tab-columns-v1';

const SUMMARY_COLUMN_DEFS = [
  { id: 'serial', label: '#', weight: 2, headClass: 'text-left' },
  { id: 'invoice', label: 'Invoice', weight: 7, headClass: 'text-left leading-tight' },
  { id: 'booker', label: 'Booker', weight: 13, headClass: 'text-left leading-tight' },
  { id: 'program', label: 'Program', weight: 13, headClass: 'text-left leading-tight' },
  { id: 'origin', label: 'Src', weight: 5, headClass: 'text-left' },
  { id: 'pax', label: 'Pax', weight: 4, headClass: 'text-center' },
  { id: 'attend', label: 'Attend.', weight: 7, headClass: 'text-left leading-tight' },
  { id: 'pay', label: 'Pay', weight: 7, headClass: 'text-left leading-tight' },
  { id: 'status', label: 'Status', weight: 8, headClass: 'text-left leading-tight' },
  { id: 'date', label: 'When', weight: 10, headClass: 'text-left leading-tight' },
  { id: 'amtInr', label: 'Amt ₹', weight: 9, headClass: 'text-right leading-tight' },
  { id: 'runInr', label: 'Σ ₹', weight: 9, headClass: 'text-right leading-tight' },
  { id: 'expand', label: '▸', weight: 3, headClass: 'w-6 px-0.5' },
];

const PARTICIPANT_COLUMN_DEFS = [
  { id: 'slot', label: '#' },
  { id: 'name', label: 'Name' },
  { id: 'relation', label: 'Rel.' },
  { id: 'age', label: 'Age' },
  { id: 'gender', label: 'Gen.' },
  { id: 'country', label: 'Ctry' },
  { id: 'city', label: 'City' },
  { id: 'state', label: 'St' },
  { id: 'mode', label: 'Mode' },
  { id: 'notify', label: 'Ntf' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Ph' },
  { id: 'wa', label: 'WA' },
  { id: 'first', label: '1st' },
  { id: 'ref', label: 'Ref' },
  { id: 'refBy', label: 'By' },
  { id: 'amt', label: 'Amt' },
  { id: 'cur', label: 'Cur' },
  { id: 'prog', label: 'Prog' },
  { id: 'hcYear', label: 'HC yr' },
  { id: 'booker', label: 'Booker' },
  { id: 'invoice', label: 'Inv' },
  { id: 'origin', label: 'Orig' },
  { id: 'status', label: 'Stat' },
];

const PROGRAM_BATCH_COLUMN_DEFS = [
  { id: 'serial', label: '#', weight: 3, headClass: 'text-left' },
  { id: 'seat', label: 'Seat', weight: 5, headClass: 'text-left' },
  { id: 'name', label: 'Name', weight: 14, headClass: 'text-left leading-tight' },
  { id: 'age', label: 'Age', weight: 4, headClass: 'text-left' },
  { id: 'gender', label: 'Gen.', weight: 5, headClass: 'text-left' },
  { id: 'city', label: 'City', weight: 9, headClass: 'text-left' },
  { id: 'country', label: 'Ctry', weight: 8, headClass: 'text-left' },
  { id: 'cohort', label: 'Batch', weight: 8, headClass: 'text-left leading-tight' },
  { id: 'tier', label: 'Tier', weight: 8, headClass: 'text-left leading-tight' },
  { id: 'progStart', label: 'Start', weight: 7, headClass: 'text-left leading-tight' },
  { id: 'progEnd', label: 'End', weight: 7, headClass: 'text-left leading-tight' },
  { id: 'mode', label: 'Mode', weight: 7, headClass: 'text-left' },
  { id: 'origin', label: 'Src', weight: 6, headClass: 'text-left' },
  { id: 'status', label: 'Status', weight: 9, headClass: 'text-left leading-tight' },
  { id: 'amt', label: 'Amt', weight: 7, headClass: 'text-right leading-tight' },
  { id: 'inr', label: 'INR', weight: 8, headClass: 'text-right leading-tight' },
  { id: 'runInr', label: 'Σ INR', weight: 9, headClass: 'text-right leading-tight' },
];

/** Admin-only: 3-month program tier exploded to one row per calendar month of eligibility. */
const THREE_MO_MONTHLY_COLUMN_DEFS = [
  { id: 'serial', label: '#', weight: 4, headClass: 'text-left' },
  { id: 'eligMonth', label: 'Month', weight: 8, headClass: 'text-left font-mono' },
  { id: 'eligMonthLabel', label: 'Month (label)', weight: 10, headClass: 'text-left leading-tight' },
  { id: 'cohort', label: 'Batch', weight: 7, headClass: 'text-left leading-tight' },
  { id: 'tier', label: 'Tier', weight: 8, headClass: 'text-left leading-tight' },
  { id: 'progStart', label: 'Start', weight: 7, headClass: 'text-left leading-tight' },
  { id: 'progEnd', label: 'End', weight: 7, headClass: 'text-left leading-tight' },
  { id: 'name', label: 'Name', weight: 14, headClass: 'text-left leading-tight' },
  { id: 'city', label: 'City', weight: 8, headClass: 'text-left' },
  { id: 'country', label: 'Ctry', weight: 6, headClass: 'text-left' },
  { id: 'mode', label: 'Mode', weight: 6, headClass: 'text-left' },
  { id: 'origin', label: 'Src', weight: 5, headClass: 'text-left' },
  { id: 'invoice', label: 'Inv', weight: 8, headClass: 'text-left' },
  { id: 'enrollId', label: 'Enroll ID', weight: 10, headClass: 'text-left font-mono' },
];

function defaultsFromColumnDefs(defs) {
  return Object.fromEntries(defs.map((d) => [d.id, true]));
}

function ensureAtLeastOneVisible(vis, defs) {
  const merged = { ...defaultsFromColumnDefs(defs), ...vis };
  if (defs.some((d) => merged[d.id] !== false)) return merged;
  return defaultsFromColumnDefs(defs);
}

const DEFAULT_COLUMN_VISIBILITY = {
  summary: defaultsFromColumnDefs(SUMMARY_COLUMN_DEFS),
  participants: defaultsFromColumnDefs(PARTICIPANT_COLUMN_DEFS),
  programBatch: defaultsFromColumnDefs(PROGRAM_BATCH_COLUMN_DEFS),
  programThreeMo: defaultsFromColumnDefs(THREE_MO_MONTHLY_COLUMN_DEFS),
};

function loadColumnVisibility() {
  try {
    const raw = localStorage.getItem(ENROLL_COLS_STORAGE_KEY);
    if (!raw) {
      return {
        summary: { ...DEFAULT_COLUMN_VISIBILITY.summary },
        participants: { ...DEFAULT_COLUMN_VISIBILITY.participants },
        programBatch: { ...DEFAULT_COLUMN_VISIBILITY.programBatch },
        programThreeMo: { ...DEFAULT_COLUMN_VISIBILITY.programThreeMo },
      };
    }
    const parsed = JSON.parse(raw);
    return {
      summary: ensureAtLeastOneVisible(parsed.summary || {}, SUMMARY_COLUMN_DEFS),
      participants: ensureAtLeastOneVisible(parsed.participants || {}, PARTICIPANT_COLUMN_DEFS),
      programBatch: ensureAtLeastOneVisible(parsed.programBatch || {}, PROGRAM_BATCH_COLUMN_DEFS),
      programThreeMo: ensureAtLeastOneVisible(parsed.programThreeMo || {}, THREE_MO_MONTHLY_COLUMN_DEFS),
    };
  } catch {
    return {
      summary: { ...DEFAULT_COLUMN_VISIBILITY.summary },
      participants: { ...DEFAULT_COLUMN_VISIBILITY.participants },
      programBatch: { ...DEFAULT_COLUMN_VISIBILITY.programBatch },
      programThreeMo: { ...DEFAULT_COLUMN_VISIBILITY.programThreeMo },
    };
  }
}

function columnPickerMeta(viewMode) {
  if (viewMode === 'summary') return { defs: SUMMARY_COLUMN_DEFS, vk: 'summary', title: 'Checkout' };
  if (viewMode === 'participants') return { defs: PARTICIPANT_COLUMN_DEFS, vk: 'participants', title: 'Participant' };
  if (viewMode === 'program_three_month') {
    return { defs: THREE_MO_MONTHLY_COLUMN_DEFS, vk: 'programThreeMo', title: '3-mo by month' };
  }
  return { defs: PROGRAM_BATCH_COLUMN_DEFS, vk: 'programBatch', title: 'Program batch' };
}

function enrollmentOriginKey(originish) {
  const o = String(originish || '').toLowerCase();
  return o === 'dashboard' ? 'dashboard' : 'website';
}

/** Admin analytics: normalize participant attendance for checkout-level summary. */
function attendanceBucket(mode) {
  const m = String(mode || '').toLowerCase().replace(/-/g, '_');
  if (m === 'offline') return 'offline';
  if (m === 'in_person') return 'in_person';
  return 'online';
}

function parseReportDateMs(iso) {
  if (!iso) return 0;
  try {
    return new Date(String(iso).replace('Z', '+00:00')).getTime();
  } catch {
    return 0;
  }
}

/** Parse YYYY-MM-DD prefix for calendar-month eligibility (IST not required; date-only). */
function parseCalendarYmd(iso) {
  if (!iso) return null;
  const s = String(iso).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!y || mo < 1 || mo > 12) return null;
  return { y, m: mo };
}

/** Inclusive list of YYYY-MM keys from chosen tier start/end dates. */
function calendarMonthsBetweenInclusive(startIso, endIso) {
  const a = parseCalendarYmd(startIso);
  const b = parseCalendarYmd(endIso);
  if (!a || !b) return [];
  if (a.y > b.y || (a.y === b.y && a.m > b.m)) return [];
  const out = [];
  let y = a.y;
  let mo = a.m;
  for (;;) {
    out.push(`${y}-${String(mo).padStart(2, '0')}`);
    if (y === b.y && mo === b.m) break;
    if (mo === 12) {
      y += 1;
      mo = 1;
    } else {
      mo += 1;
    }
  }
  return out;
}

function formatEligibilityMonthLabel(ymKey) {
  if (!ymKey || typeof ymKey !== 'string') return '—';
  const parts = ymKey.split('-');
  if (parts.length !== 2) return ymKey;
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  if (!y || mo < 1 || mo > 12) return ymKey;
  try {
    return new Date(y, mo - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  } catch {
    return ymKey;
  }
}

/** Admin enrollment table: D-MON-YYYY, HH:MM (local), month uppercase (e.g. 3-MAY-2026, 14:05). */
function formatEnrollReportDateTime(iso) {
  if (!iso) return '-';
  try {
    const s = formatDateTimeDMonYyyyUpper(String(iso).replace('Z', '+00:00'));
    return s === '—' ? '-' : s;
  } catch {
    return '-';
  }
}

/** Program tier / batch date cells: D-MON-YYYY from YYYY-MM-DD or ISO. */
function formatProgramYmd(iso) {
  if (!iso) return '—';
  const s = formatDateDMonYyyyUpper(iso);
  return s || '—';
}

/** Program batch filter: show catalog name only; batch window is in Start / End columns. */
function programTitleWithoutBatchSuffix(raw) {
  const s = String(raw || '').trim();
  if (!s) return '(Untitled program)';
  return s.replace(/\s*·\s*batch\s+.+$/i, '').trim() || '(Untitled program)';
}

/** Single-participant row: human-readable attendance from stored mode. */
function participantAttendanceLabel(mode) {
  const b = attendanceBucket(mode);
  if (b === 'offline') return 'Offline';
  if (b === 'in_person') return 'In person';
  if (!mode) return '—';
  return 'Online';
}

function originLabel(origin) {
  const o = String(origin || '').toLowerCase();
  if (o === 'dashboard') return 'Dashboard';
  return 'Website';
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
  /** summary = checkout; participants = per person; program_analytics = roster+Σ; program_three_month = 3-mo tier by calendar month. */
  const [viewMode, setViewMode] = useState('summary');
  const [participantRows, setParticipantRows] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  /** null = all programs (no title filter); string[] = only those program titles */
  const [selectedProgramTitles, setSelectedProgramTitles] = useState(null);
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
  const [originFilter, setOriginFilter] = useState('all');
  const [columnVisibility, setColumnVisibility] = useState(loadColumnVisibility);

  useEffect(() => {
    setColumnVisibility((prev) => ({
      summary: ensureAtLeastOneVisible(prev.summary, SUMMARY_COLUMN_DEFS),
      participants: ensureAtLeastOneVisible(prev.participants, PARTICIPANT_COLUMN_DEFS),
      programBatch: ensureAtLeastOneVisible(prev.programBatch, PROGRAM_BATCH_COLUMN_DEFS),
      programThreeMo: ensureAtLeastOneVisible(prev.programThreeMo || {}, THREE_MO_MONTHLY_COLUMN_DEFS),
    }));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ENROLL_COLS_STORAGE_KEY, JSON.stringify(columnVisibility));
    } catch {
      /* ignore */
    }
  }, [columnVisibility]);

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
    if (viewMode === 'participants' || viewMode === 'program_analytics' || viewMode === 'program_three_month') {
      loadParticipantReport();
    }
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
        const matchOrigin =
          originFilter === 'all' || enrollmentOriginKey(e.enrollment_origin) === originFilter;
        return matchSearch && matchStatus && matchPayment && matchOrigin;
      }),
    [enrollments, search, statusFilter, paymentFilter, originFilter],
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
    const matchOrigin =
      originFilter === 'all' || enrollmentOriginKey(row.enrollment_origin) === originFilter;
    if (!matchOrigin) return false;
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
      row.home_coming_year,
      row.invoice_number,
      row.enrollment_id,
      row.notify_enrollment,
      row.referral_source,
      row.referred_by_name,
      row.referred_by_email,
    ].filter(Boolean).some((f) => String(f).toLowerCase().includes(q));
  });

  const programBatchTitles = useMemo(() => {
    const set = new Set();
    participantRows.forEach((r) => {
      const full = (r.program || '').trim() || '(Untitled program)';
      set.add(programTitleWithoutBatchSuffix(full));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [participantRows]);

  useEffect(() => {
    if (viewMode !== 'program_analytics' && viewMode !== 'program_three_month') return;
    if (programBatchTitles.length === 0) return;
    setSelectedProgramTitles((prev) => {
      if (prev == null) return null;
      const next = prev.filter((t) => programBatchTitles.includes(t));
      return next.length === 0 ? null : next;
    });
  }, [viewMode, programBatchTitles]);

  const programBatchBaseRows = useMemo(() => {
    if (viewMode !== 'program_analytics' && viewMode !== 'program_three_month') return [];
    return participantRows.filter((row) => {
      const title = (row.program || '').trim() || '(Untitled program)';
      const filterKey = programTitleWithoutBatchSuffix(title);
      if (
        selectedProgramTitles != null &&
        selectedProgramTitles.length > 0 &&
        !selectedProgramTitles.includes(filterKey)
      ) {
        return false;
      }
      if (originFilter !== 'all' && enrollmentOriginKey(row.enrollment_origin) !== originFilter) {
        return false;
      }
      if (!participantSearch.trim()) return true;
      const q = participantSearch.toLowerCase();
      return [
        row.participant_name,
        row.participant_email,
        row.invoice_number,
        row.enrollment_id,
        row.portal_cohort,
        row.chosen_start_date,
        row.chosen_end_date,
        formatProgramYmd(row.chosen_start_date),
        formatProgramYmd(row.chosen_end_date),
        row.tier_label,
        row.home_coming_year,
      ].filter(Boolean).some((f) => String(f).toLowerCase().includes(q));
    });
  }, [participantRows, selectedProgramTitles, participantSearch, originFilter, viewMode]);

  const programBatchFilterLabel = useMemo(() => {
    if (programBatchTitles.length === 0) return '—';
    if (selectedProgramTitles == null) return 'All programs';
    if (selectedProgramTitles.length === 0) return 'All programs';
    if (selectedProgramTitles.length === 1) {
      const t = selectedProgramTitles[0];
      return t.length > 42 ? `${t.slice(0, 40)}…` : t;
    }
    return `${selectedProgramTitles.length} programs`;
  }, [programBatchTitles.length, selectedProgramTitles]);

  const programBatchCsvSlug = useMemo(() => {
    if (selectedProgramTitles == null || selectedProgramTitles.length === 0) return 'all_programs';
    if (selectedProgramTitles.length === 1) {
      return selectedProgramTitles[0].replace(/[^\w\-]+/g, '_').slice(0, 60);
    }
    return `multi_${selectedProgramTitles.length}_programs`;
  }, [selectedProgramTitles]);

  const threeMonthMonthlyRows = useMemo(() => {
    if (viewMode !== 'program_three_month') return [];
    const base = programBatchBaseRows.filter((row) => {
      const it = String(row.item_type || '').toLowerCase();
      if (it !== 'program') return false;
      if (!row.is_three_month_tier) return false;
      return !!(row.chosen_start_date && row.chosen_end_date);
    });
    const exploded = [];
    base.forEach((row) => {
      const months = calendarMonthsBetweenInclusive(row.chosen_start_date, row.chosen_end_date);
      months.forEach((mk) => {
        exploded.push({
          ...row,
          eligibility_month: mk,
          eligibility_month_label: formatEligibilityMonthLabel(mk),
          _explodeKey: `${row.enrollment_id}-${row.participant_index}-${mk}`,
        });
      });
    });
    exploded.sort((a, b) => {
      const c = String(a.eligibility_month || '').localeCompare(String(b.eligibility_month || ''));
      if (c !== 0) return c;
      return String(a.participant_name || '').localeCompare(String(b.participant_name || ''));
    });
    return exploded;
  }, [programBatchBaseRows, viewMode]);

  const threeMonthMonthCounts = useMemo(() => {
    const m = new Map();
    threeMonthMonthlyRows.forEach((r) => {
      const k = r.eligibility_month || '';
      if (!k) return;
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [threeMonthMonthlyRows]);

  const programBatchAnalyticsRows = useMemo(() => {
    const sorted = [...programBatchBaseRows].sort(
      (a, b) => parseReportDateMs(a.created_at) - parseReportDateMs(b.created_at),
    );
    let cumulativeInr = 0;
    return sorted.map((row, i) => {
      const pIdx = Number(row.participant_index);
      const countsForRunning = !Number.isFinite(pIdx) || pIdx === 1;
      const rawAmount = row.payment_amount;
      const currency = row.payment_currency;
      const amountInr = enrollmentAmountToInr(rawAmount, currency, fxRates);
      const contributionInr = countsForRunning ? amountInr : 0;
      cumulativeInr += contributionInr;
      return {
        row,
        serial: i + 1,
        amountInr,
        cumulativeInr,
        countsForRunning,
        sourceCurrency: String(currency || '').toLowerCase() || 'inr',
      };
    });
  }, [programBatchBaseRows, fxRates]);

  const visSummaryCols = useMemo(
    () => SUMMARY_COLUMN_DEFS.filter((d) => columnVisibility.summary[d.id] !== false),
    [columnVisibility.summary],
  );
  const summaryColWeightSum = useMemo(
    () => Math.max(1, visSummaryCols.reduce((s, d) => s + d.weight, 0)),
    [visSummaryCols],
  );

  const visParticipantCols = useMemo(
    () => PARTICIPANT_COLUMN_DEFS.filter((d) => columnVisibility.participants[d.id] !== false),
    [columnVisibility.participants],
  );

  const visProgramBatchCols = useMemo(
    () => PROGRAM_BATCH_COLUMN_DEFS.filter((d) => columnVisibility.programBatch[d.id] !== false),
    [columnVisibility.programBatch],
  );
  const programBatchWeightSum = useMemo(
    () => Math.max(1, visProgramBatchCols.reduce((s, d) => s + d.weight, 0)),
    [visProgramBatchCols],
  );

  const visProgramThreeMoCols = useMemo(() => {
    const vis = columnVisibility.programThreeMo || defaultsFromColumnDefs(THREE_MO_MONTHLY_COLUMN_DEFS);
    return THREE_MO_MONTHLY_COLUMN_DEFS.filter((d) => vis[d.id] !== false);
  }, [columnVisibility.programThreeMo]);
  const programThreeMoWeightSum = useMemo(
    () => Math.max(1, visProgramThreeMoCols.reduce((s, d) => s + d.weight, 0)),
    [visProgramThreeMoCols],
  );

  const downloadProgramBatchCsv = () => {
    if (programBatchAnalyticsRows.length === 0) return;
    const headers = [
      '#',
      'Participant',
      'Age',
      'Gender',
      'City',
      'Country',
      'Batch (program start, DD-MON-YYYY)',
      'Catalog program (Mongo)',
      'Home Coming year',
      'Tier',
      'Start (DD-MON-YYYY)',
      'End (DD-MON-YYYY)',
      'Mode',
      'Origin',
      'Status',
      'Amount',
      'Currency',
      'Amount INR',
      'Running total INR',
      'Counts in running total',
      'Invoice',
      'Enrollment ID',
    ];
    const lines = [headers.join(',')];
    programBatchAnalyticsRows.forEach(
      ({ row, serial, amountInr, cumulativeInr, countsForRunning }) => {
        const cur = (row.payment_currency || '').toUpperCase();
        const amt = row.payment_amount;
        const esc = (v) => {
          const s = v == null ? '' : String(v);
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        };
        lines.push(
          [
            serial,
            esc(row.participant_name),
            esc(row.age),
            esc(row.gender),
            esc(row.city),
            esc(row.country),
            esc(formatProgramYmd(row.chosen_start_date)),
            esc(row.catalog_program_title),
            esc(row.home_coming_year),
            esc(row.tier_label),
            esc(formatProgramYmd(row.chosen_start_date)),
            esc(formatProgramYmd(row.chosen_end_date)),
            esc(participantAttendanceLabel(row.attendance_mode)),
            esc(originLabel(row.enrollment_origin)),
            esc(row.enrollment_status || row.payment_status),
            amt > 0 ? String(amt) : '0',
            esc(cur),
            amountInr,
            cumulativeInr,
            countsForRunning ? 'yes' : 'no',
            esc(row.invoice_number),
            esc(row.enrollment_id),
          ].join(','),
        );
      },
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `program_batch_${programBatchCsvSlug}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ title: 'CSV downloaded' });
  };

  const handleProgramBatchExcel = async () => {
    if (programBatchAnalyticsRows.length === 0) return;
    try {
      const programs =
        selectedProgramTitles != null && selectedProgramTitles.length > 0
          ? selectedProgramTitles.join('|||')
          : '';
      const r = await axios.get(`${API}/india-payments/admin/enrollments/program-batch-export`, {
        params: {
          paid_completed_only: paidOnlyReport,
          programs,
          origin: originFilter === 'all' ? '' : originFilter,
          search: participantSearch.trim(),
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `program_batch_${programBatchCsvSlug}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Program batch Excel downloaded' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const downloadThreeMonthCsv = () => {
    if (threeMonthMonthlyRows.length === 0) return;
    const headers = [
      '#',
      'Eligibility month',
      'Month label',
      'Batch (program start, DD-MON-YYYY)',
      'Catalog program (Mongo)',
      'Tier',
      'Start (DD-MON-YYYY)',
      'End (DD-MON-YYYY)',
      'Participant',
      'City',
      'Country',
      'Mode',
      'Origin',
      'Invoice',
      'Enrollment ID',
    ];
    const lines = [headers.join(',')];
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    threeMonthMonthlyRows.forEach((row, i) => {
      lines.push(
        [
          i + 1,
          esc(row.eligibility_month),
          esc(row.eligibility_month_label),
          esc(formatProgramYmd(row.chosen_start_date)),
          esc(row.catalog_program_title),
          esc(row.tier_label),
          esc(formatProgramYmd(row.chosen_start_date)),
          esc(formatProgramYmd(row.chosen_end_date)),
          esc(row.participant_name),
          esc(row.city),
          esc(row.country),
          esc(participantAttendanceLabel(row.attendance_mode)),
          esc(originLabel(row.enrollment_origin)),
          esc(row.invoice_number),
          esc(row.enrollment_id),
        ].join(','),
      );
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `program_3mo_monthly_${programBatchCsvSlug}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ title: 'CSV downloaded' });
  };

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
          <div className="flex rounded-full border border-gray-200/90 p-0.5 bg-gray-50/90 shadow-sm">
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
            <button
              type="button"
              onClick={() => setViewMode('program_analytics')}
              data-testid="enrollments-view-program-batch"
              className={`flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-full font-medium ${viewMode === 'program_analytics' ? 'bg-white shadow text-purple-800' : 'text-gray-600'}`}
            >
              <ClipboardList size={12} /> Program batch
            </button>
            <button
              type="button"
              onClick={() => setViewMode('program_three_month')}
              data-testid="enrollments-view-program-3mo-monthly"
              className={`flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-full font-medium ${viewMode === 'program_three_month' ? 'bg-white shadow text-purple-800' : 'text-gray-600'}`}
            >
              <ClipboardList size={12} /> 3-mo by month
            </button>
          </div>
          {viewMode === 'summary' ? (
            <button onClick={handleExport} data-testid="export-enrollments"
              className="flex items-center gap-1.5 text-[10px] px-4 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 font-medium">
              <Download size={12} /> Full Excel
            </button>
          ) : viewMode === 'participants' ? (
            <button onClick={handleCleanExport} data-testid="export-enrollments-clean"
              className="flex items-center gap-1.5 text-[10px] px-4 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 font-medium">
              <Download size={12} /> Participant Excel
            </button>
          ) : viewMode === 'program_three_month' ? (
            <button
              type="button"
              onClick={downloadThreeMonthCsv}
              disabled={threeMonthMonthlyRows.length === 0}
              data-testid="export-program-3mo-csv"
              className="flex items-center gap-1.5 text-[10px] px-4 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 font-medium disabled:opacity-50"
            >
              <Download size={12} /> 3-mo CSV
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleProgramBatchExcel}
                disabled={programBatchAnalyticsRows.length === 0}
                data-testid="export-program-batch-excel"
                className="flex items-center gap-1.5 text-[10px] px-4 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 font-medium disabled:opacity-50"
              >
                <Download size={12} /> Program Excel
              </button>
              <button
                type="button"
                onClick={downloadProgramBatchCsv}
                disabled={programBatchAnalyticsRows.length === 0}
                data-testid="export-program-batch-csv"
                className="flex items-center gap-1.5 text-[10px] px-4 py-2 rounded-full bg-white border border-green-600 text-green-700 hover:bg-green-50 font-medium disabled:opacity-50"
              >
                <Download size={12} /> Program CSV
              </button>
            </div>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="enrollments-column-picker"
                className="flex items-center gap-1 text-[10px] px-3 py-2 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-medium shadow-sm"
              >
                <Columns3 size={12} /> Columns
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 max-h-[min(24rem,70vh)] flex flex-col">
              <p className="text-[11px] font-semibold text-gray-800 mb-2 shrink-0">
                Visible columns ({columnPickerMeta(viewMode).title})
              </p>
              <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0">
                {columnPickerMeta(viewMode).defs.map((def) => {
                  const { vk, defs } = columnPickerMeta(viewMode);
                  return (
                    <label key={def.id} className="flex items-center gap-2 text-[11px] text-gray-700 cursor-pointer">
                      <Checkbox
                        checked={(columnVisibility[vk] || {})[def.id] !== false}
                        onCheckedChange={(v) =>
                          setColumnVisibility((prev) => {
                            const nextVis = { ...(prev[vk] || {}), [def.id]: v === true };
                            const remaining = defs.filter((d) => nextVis[d.id] !== false).length;
                            if (remaining < 1) return prev;
                            return { ...prev, [vk]: nextVis };
                          })
                        }
                      />
                      <span>{def.label || def.id}</span>
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                className="mt-3 text-[10px] text-violet-700 font-medium hover:underline shrink-0 text-left"
                onClick={() => {
                  const { vk, defs } = columnPickerMeta(viewMode);
                  setColumnVisibility((prev) => ({
                    ...prev,
                    [vk]: defaultsFromColumnDefs(defs),
                  }));
                }}
              >
                Reset this view to default
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <details className="mb-4 rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white shadow-sm group" data-testid="enrollment-auto-report">
        <summary className="cursor-pointer list-none flex items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
          <Mail size={16} className="text-violet-700 shrink-0" />
          <span>Automated enrollment reports</span>
          <span className="text-xs font-normal text-violet-600/80">— click to expand</span>
          <ChevronDown size={14} className="ml-auto text-gray-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4 pt-0 border-t border-violet-100/80">
        <p className="text-[11px] text-gray-600 mb-3 max-w-2xl pt-3">
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
              ? `Last sent: ${formatDateTimeDMonYyyyUpper(autoReport.enrollment_auto_report_last_sent_at)}`
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
      </details>

      {viewMode === 'participants' && (
        <p className="text-[10px] text-gray-500 mb-2">
          One row per person; checkout total repeats for multi-seat bookings. Scroll the page to see all rows; use <strong>Columns</strong> to hide fields.
        </p>
      )}

      {(viewMode === 'program_analytics' || viewMode === 'program_three_month') && (
        <>
          {viewMode === 'program_analytics' && (
            <p className="text-[10px] text-gray-500 mb-2">
              <strong>Program batch:</strong> roster + running Σ (INR); each payment counted once (seat 1). Filter by origin below; hide columns from the Columns button.{' '}
              <span className="text-gray-600">
                <strong>Program</strong> prefers the label the member saw at checkout (e.g. Home Coming Annual Program) when it was stored on the enrollment; the underlying catalog row may still be AWRP.
              </span>
            </p>
          )}
          {viewMode === 'program_three_month' && (
            <p className="text-[10px] text-gray-500 mb-2">
              <strong>3-month by month:</strong> program checkouts on the catalog <strong>3-month</strong> tier only. Each row is one participant for one calendar month overlapping the tier&apos;s{' '}
              <strong>start</strong> and <strong>end</strong> use <strong>DD-MON-YYYY</strong> (e.g. 3-MAY-2026). <strong>Batch</strong> is the program start date (same as Start).
            </p>
          )}
        </>
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
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wide">Origin</span>
            {[
              { k: 'all', label: 'All' },
              { k: 'dashboard', label: 'Dash' },
              { k: 'website', label: 'Web' },
            ].map(({ k, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => setOriginFilter(k)}
                className={`text-[9px] px-2 py-1 rounded-full ${
                  originFilter === k ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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

      {(viewMode === 'program_analytics' || viewMode === 'program_three_month') && (
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
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wide">Origin</span>
            {[
              { k: 'all', label: 'All' },
              { k: 'dashboard', label: 'Dash' },
              { k: 'website', label: 'Web' },
            ].map(({ k, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => setOriginFilter(k)}
                className={`text-[9px] px-2 py-1 rounded-full ${
                  originFilter === k ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-gray-600 whitespace-nowrap">Program</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  id="program-batch-select"
                  data-testid="program-batch-program-select"
                  className="flex items-center justify-between gap-2 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white min-w-[200px] max-w-md text-left hover:bg-gray-50"
                >
                  <span className="truncate text-gray-900">{programBatchFilterLabel}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="start">
                <div className="p-2 border-b border-gray-100 space-y-2">
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer text-xs font-medium text-gray-900">
                    <Checkbox
                      checked={selectedProgramTitles == null}
                      onCheckedChange={(c) => {
                        if (c === true) setSelectedProgramTitles(null);
                        else if (programBatchTitles.length > 0) setSelectedProgramTitles([programBatchTitles[0]]);
                      }}
                    />
                    All programs
                  </label>
                  <button
                    type="button"
                    className="text-[10px] text-violet-700 hover:underline px-2 text-left disabled:opacity-40"
                    onClick={() => setSelectedProgramTitles([...programBatchTitles])}
                    disabled={programBatchTitles.length === 0}
                  >
                    Select every program in the list (then untick to narrow)
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto p-2 space-y-0.5">
                  {programBatchTitles.map((t) => {
                    const checked = selectedProgramTitles != null && selectedProgramTitles.includes(t);
                    return (
                      <label
                        key={t}
                        className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer text-[11px] text-gray-800 leading-snug"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            if (c === true) {
                              setSelectedProgramTitles((prev) => {
                                if (prev == null) return [t];
                                if (prev.includes(t)) return prev;
                                return [...prev, t];
                              });
                            } else {
                              setSelectedProgramTitles((prev) => {
                                if (prev == null) return null;
                                const next = prev.filter((x) => x !== t);
                                return next.length === 0 ? null : next;
                              });
                            }
                          }}
                          className="mt-0.5"
                        />
                        <span className="break-words">{t}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              placeholder="Filter by name, email, invoice…"
              className="pl-9 text-xs h-9"
            />
          </div>
          {viewMode === 'program_analytics' && programBatchAnalyticsRows.length > 0 && (
            <span className="text-[11px] text-gray-500">
              {programBatchAnalyticsRows.length} row{programBatchAnalyticsRows.length !== 1 ? 's' : ''} · Last Σ{' '}
              <span className="font-semibold text-violet-900 tabular-nums">
                ₹
                {programBatchAnalyticsRows[programBatchAnalyticsRows.length - 1].cumulativeInr.toLocaleString(
                  'en-IN',
                )}
              </span>
            </span>
          )}
          {viewMode === 'program_three_month' && threeMonthMonthlyRows.length > 0 && (
            <span className="text-[10px] text-gray-600 max-w-xl leading-snug">
              <span className="font-medium text-gray-800">{threeMonthMonthlyRows.length}</span> eligibility row
              {threeMonthMonthlyRows.length !== 1 ? 's' : ''}
              {threeMonthMonthCounts.length > 0 ? (
                <>
                  {' '}
                  ·{' '}
                  <span className="font-mono">{threeMonthMonthCounts.map(([k, n]) => `${k}: ${n}`).join(' · ')}</span>
                </>
              ) : null}
            </span>
          )}
        </div>
      )}

      {/* Search + Filters (summary) */}
      {viewMode === 'summary' && (
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px] max-w-md">
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

        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wide">Origin</span>
          {[
            { k: 'all', label: 'All' },
            { k: 'dashboard', label: 'Dashboard' },
            { k: 'website', label: 'Website' },
          ].map(({ k, label }) => (
            <button
              key={k}
              type="button"
              onClick={() => setOriginFilter(k)}
              className={`text-[9px] px-2.5 py-1 rounded-full transition-colors ${
                originFilter === k ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      )}

      {viewMode === 'summary' && loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : viewMode === 'summary' && filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No enrollments found</div>
      ) : viewMode === 'summary' ? (
        <div className={ENROLL_TABLE_CARD_CLASS} data-testid="enrollments-summary-table-wrap">
          <p className="text-[10px] text-gray-600 px-3 py-2.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 leading-relaxed">
            <strong className="text-gray-800">INR columns</strong> use checkout currency and exchange rates when available. Scroll the page to see all rows; show or hide fields with <strong>Columns</strong>.
          </p>
          <div className={ENROLL_TABLE_INNER_CLASS}>
            <table className="w-full table-fixed border-collapse text-[10px] sm:text-[11px]">
              <colgroup>
                {visSummaryCols.map((d) => (
                  <col key={d.id} style={{ width: `${(d.weight / summaryColWeightSum) * 100}%` }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-100">
                <tr>
                  {visSummaryCols.map((d) => (
                    <th
                      key={d.id}
                      className={cn('px-1 sm:px-2 py-2 font-semibold text-gray-700', d.headClass)}
                      aria-label={d.id === 'expand' ? 'Expand row' : undefined}
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
              {summaryAnalyticsRows.map(({ enrollment: e, serial, amountInr, cumulativeInr, attendanceLabel, sourceCurrency }) => {
                const s = STATUS_MAP[e.status] || { label: e.status || 'Unknown', color: 'bg-gray-100 text-gray-600' };
                const mode = getPaymentMode(e);
                const modeInfo = mode ? PAYMENT_MODE_MAP[mode] : null;
                const ModeIcon = modeInfo?.icon || CreditCard;
                const isExpanded = expandedId === e.id;
                const rawAmount = e.payment?.amount ?? e.dashboard_mixed_total ?? e.total ?? 0;
                const currency = e.payment?.currency || e.dashboard_mixed_currency || e.currency || '';
                const payShort = mode ? (PAYMENT_MODE_SHORT[mode] || (modeInfo ? modeInfo.label.split(' ')[0] : mode)) : '—';
                const tc = 'px-1 sm:px-2 py-1.5 align-top min-w-0';

                return (
                  <React.Fragment key={e.id}>
                    <tr className="cursor-pointer odd:bg-white even:bg-violet-50/30 hover:bg-amber-50/40 transition-colors" onClick={() => setExpandedId(isExpanded ? null : e.id)}>
                      {visSummaryCols.map((def) => {
                        switch (def.id) {
                          case 'serial':
                            return <td key={def.id} className={`${tc} text-gray-500 tabular-nums font-medium`}>{serial}</td>;
                          case 'invoice':
                            return (
                              <td key={def.id} className={`${tc} font-mono text-purple-800 font-medium break-all text-[9px] sm:text-[10px]`} title={e.invoice_number || e.id}>
                                {e.invoice_number || e.id?.slice(0, 8) || '-'}
                              </td>
                            );
                          case 'booker':
                            return (
                              <td key={def.id} className={tc}>
                                <p className="font-medium text-gray-900 leading-snug line-clamp-2" title={e.booker_name || ''}>{e.booker_name || '-'}</p>
                                <p className="text-gray-500 text-[9px] truncate" title={e.booker_email || ''}>{e.booker_email || ''}</p>
                              </td>
                            );
                          case 'program':
                            return (
                              <td key={def.id} className={tc}>
                                <p className="text-gray-800 leading-snug line-clamp-2" title={e.item_title || ''}>{e.item_title || '-'}</p>
                                {e.item_type ? <p className="text-gray-400 capitalize text-[9px] truncate">{e.item_type}</p> : null}
                              </td>
                            );
                          case 'origin':
                            return (
                              <td key={def.id} className={tc}>
                                <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-md font-medium ${e.enrollment_origin === 'dashboard' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
                                  {e.enrollment_origin === 'dashboard' ? 'Dash' : 'Web'}
                                </span>
                              </td>
                            );
                          case 'pax':
                            return (
                              <td key={def.id} className={`${tc} text-center tabular-nums`}>
                                <span className="font-medium text-gray-900">{e.participant_count || e.participants?.length || 0}</span>
                              </td>
                            );
                          case 'attend':
                            return (
                              <td key={def.id} className={`${tc} text-gray-800 text-[9px] sm:text-[10px] leading-tight`} title={attendanceLabel}>
                                <span className="line-clamp-2 break-words">{attendanceLabel}</span>
                              </td>
                            );
                          case 'pay':
                            return (
                              <td key={def.id} className={tc}>
                                {modeInfo ? (
                                  <span className={`inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded-md font-medium max-w-full ${modeInfo.color}`} title={modeInfo.label}>
                                    <ModeIcon size={10} className="shrink-0 opacity-80" />
                                    <span className="truncate min-w-0">{payShort}</span>
                                  </span>
                                ) : <span className="text-gray-400 text-[9px]">—</span>}
                              </td>
                            );
                          case 'status':
                            return (
                              <td key={def.id} className={tc}>
                                <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-md font-medium max-w-full truncate ${s.color}`} title={s.label}>{s.label}</span>
                              </td>
                            );
                          case 'date':
                            return (
                              <td
                                key={def.id}
                                className={`${tc} text-gray-600 text-[9px] sm:text-[10px] leading-tight max-w-[7.5rem]`}
                                title={e.created_at ? String(e.created_at) : ''}
                              >
                                {formatEnrollReportDateTime(e.created_at)}
                              </td>
                            );
                          case 'amtInr':
                            return (
                              <td key={def.id} className={`${tc} text-right font-medium text-gray-900 tabular-nums text-[10px] sm:text-[11px]`}>
                                {rawAmount > 0 ? (
                                  <span title={sourceCurrency !== 'inr' ? `Stored: ${String(currency || '').toUpperCase()}` : ''}>
                                    ₹{amountInr.toLocaleString('en-IN')}
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 font-semibold">FREE</span>
                                )}
                              </td>
                            );
                          case 'runInr':
                            return (
                              <td key={def.id} className={`${tc} text-right font-semibold text-violet-900 tabular-nums text-[10px] sm:text-[11px]`}>
                                ₹{cumulativeInr.toLocaleString('en-IN')}
                              </td>
                            );
                          case 'expand':
                            return (
                              <td key={def.id} className={`${tc} text-center`}>
                                {isExpanded ? <ChevronUp size={14} className="text-gray-500 mx-auto" /> : <ChevronDown size={14} className="text-gray-500 mx-auto" />}
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                    {/* Expanded details */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={Math.max(1, visSummaryCols.length)} className="bg-gray-50 px-4 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                            <div><span className="text-gray-400 block">Enrollment ID</span><span className="font-mono">{e.id}</span></div>
                            <div><span className="text-gray-400 block">Origin</span>{e.enrollment_origin === 'dashboard' ? 'Dashboard' : 'Website'}</div>
                            <div><span className="text-gray-400 block">Country</span>{e.booker_country || '-'}</div>
                            <div><span className="text-gray-400 block">Booker phone</span>{e.phone || '—'}</div>
                            <div><span className="text-gray-400 block">Stored currency</span>{(currency || '').toUpperCase() || '—'}</div>
                            <div><span className="text-gray-400 block">Amount (analytics INR)</span>₹{amountInr.toLocaleString('en-IN')}</div>
                            <div><span className="text-gray-400 block">Attendance (summary)</span>{attendanceLabel}</div>
                            <div><span className="text-gray-400 block">Tier</span>{e.tier_index != null ? `Tier ${e.tier_index + 1}` : '-'}</div>
                            <div><span className="text-gray-400 block">Promo Code</span>{e.promo_code || '-'}</div>
                            <div><span className="text-gray-400 block">Bank/Account</span>{e.bank_name || e.payment?.bank_name || '-'}</div>
                            <div><span className="text-gray-400 block">VPN Detected</span>{e.vpn_detected ? 'Yes' : 'No'}</div>
                            <div><span className="text-gray-400 block">Stripe Session</span><span className="font-mono truncate block max-w-[150px]">{e.stripe_session_id || '-'}</span></div>
                            <div><span className="text-gray-400 block">Updated</span>{e.updated_at ? formatDateTimeDMonYyyyUpper(e.updated_at) : '-'}</div>
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
          <div className={ENROLL_TABLE_CARD_CLASS} data-testid="enrollments-participant-table">
            <p className="text-[10px] text-gray-600 px-3 py-2 bg-gray-50/80 border-b border-gray-100">
              Truncated cells show full text on hover. Scroll the page for more rows.
            </p>
            <div className={ENROLL_TABLE_INNER_CLASS}>
              <table className="w-full table-fixed border-collapse text-[9px] sm:text-[10px]">
                <colgroup>
                  {visParticipantCols.map((d) => (
                    <col key={d.id} style={{ width: `${100 / Math.max(1, visParticipantCols.length)}%` }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-100">
                  <tr>
                    {visParticipantCols.map((d) => (
                      <th
                        key={d.id}
                        className={cn(
                          'text-left px-1 sm:px-1.5 py-2 font-semibold text-gray-700',
                          ['name', 'wa', 'refBy'].includes(d.id) && 'leading-tight',
                        )}
                      >
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
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
                    const pc = 'px-1 sm:px-1.5 py-1.5 align-top min-w-0 break-words';
                    return (
                      <tr
                        key={`${row.enrollment_id}-${row.participant_index ?? row.participant_name}-${row.participant_email}`}
                        className="odd:bg-white even:bg-violet-50/25 hover:bg-amber-50/35 transition-colors"
                      >
                        {visParticipantCols.map((def) => {
                          switch (def.id) {
                            case 'slot':
                              return <td key={def.id} className={`${pc} text-gray-500 tabular-nums`}>{slot}</td>;
                            case 'name':
                              return <td key={def.id} className={`${pc} font-medium text-gray-900`} title={row.participant_name || ''}>{row.participant_name || '—'}</td>;
                            case 'relation':
                              return <td key={def.id} className={`${pc} text-gray-700`} title={row.relationship}>{row.relationship || '—'}</td>;
                            case 'age':
                              return <td key={def.id} className={`${pc} text-gray-700 tabular-nums`}>{row.age !== '' && row.age != null ? row.age : '—'}</td>;
                            case 'gender':
                              return <td key={def.id} className={`${pc} text-gray-700`} title={row.gender}>{row.gender || '—'}</td>;
                            case 'country':
                              return <td key={def.id} className={`${pc} text-gray-700`} title={row.country}>{row.country || '—'}</td>;
                            case 'city':
                              return <td key={def.id} className={`${pc} text-gray-700`} title={row.city}>{row.city || '—'}</td>;
                            case 'state':
                              return <td key={def.id} className={`${pc} text-gray-700`} title={row.state}>{row.state || '—'}</td>;
                            case 'mode':
                              return <td key={def.id} className={`${pc} text-gray-700`} title={row.attendance_mode}>{row.attendance_mode || '—'}</td>;
                            case 'notify':
                              return <td key={def.id} className={`${pc} text-gray-800`}>{row.notify_enrollment || '—'}</td>;
                            case 'email':
                              return <td key={def.id} className={`${pc} text-gray-600`} title={row.participant_email}>{row.participant_email || '—'}</td>;
                            case 'phone':
                              return <td key={def.id} className={`${pc} text-gray-600 font-mono`} title={row.phone}>{row.phone || '—'}</td>;
                            case 'wa':
                              return <td key={def.id} className={`${pc} text-gray-600 font-mono`} title={row.whatsapp}>{row.whatsapp || '—'}</td>;
                            case 'first':
                              return <td key={def.id} className={`${pc} text-gray-700`}>{row.is_first_time || '—'}</td>;
                            case 'ref':
                              return <td key={def.id} className={`${pc} text-gray-600`} title={row.referral_source}>{row.referral_source || '—'}</td>;
                            case 'refBy':
                              return <td key={def.id} className={`${pc} text-gray-600`} title={row.referred_by_name}>{row.referred_by_name || '—'}</td>;
                            case 'amt':
                              return (
                                <td key={def.id} className={`${pc} font-medium text-gray-900 tabular-nums`}>
                                  {amt > 0 ? `${sym}${Number(amt).toLocaleString()}` : '0'}
                                </td>
                              );
                            case 'cur':
                              return <td key={def.id} className={`${pc} uppercase text-gray-600`}>{cur || '—'}</td>;
                            case 'prog':
                              return <td key={def.id} className={`${pc} text-gray-700`} title={row.program}>{row.program || '—'}</td>;
                            case 'hcYear':
                              return (
                                <td key={def.id} className={`${pc} text-gray-700 tabular-nums`} title={row.home_coming_year || ''}>
                                  {row.home_coming_year || '—'}
                                </td>
                              );
                            case 'booker':
                              return (
                                <td key={def.id} className={`${pc} text-gray-600`}>
                                  <span className="block" title={row.booker_name}>{row.booker_name || '—'}</span>
                                  <span className="block text-gray-400" title={row.booker_phone || ''}>{row.booker_phone || ''}</span>
                                </td>
                              );
                            case 'invoice':
                              return <td key={def.id} className={`${pc} font-mono text-purple-800 break-all`} title={row.invoice_number || ''}>{row.invoice_number || row.enrollment_id?.slice(0, 10) || '—'}</td>;
                            case 'origin':
                              return (
                                <td key={def.id} className={pc}>
                                  <span className={`inline-block text-[9px] px-1 py-0.5 rounded-md font-medium ${row.enrollment_origin === 'dashboard' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
                                    {row.enrollment_origin === 'dashboard' ? 'Dash' : 'Web'}
                                  </span>
                                </td>
                              );
                            case 'status':
                              return <td key={def.id} className={`${pc} text-gray-700`} title={row.enrollment_status || row.payment_status}>{row.enrollment_status || row.payment_status || '—'}</td>;
                            default:
                              return null;
                          }
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {viewMode === 'program_analytics' && (
        loadingParticipants ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading program data…</div>
        ) : programBatchTitles.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No participant rows loaded. Adjust filters or confirm enrollments exist.
          </div>
        ) : programBatchAnalyticsRows.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No rows for this program and filter.</div>
        ) : (
          <div className={ENROLL_TABLE_CARD_CLASS} data-testid="enrollments-program-batch-table">
            <p className="text-[10px] text-gray-600 px-3 py-2.5 bg-gray-50/80 border-b border-gray-100 leading-relaxed">
              Sorted by enrollment <strong>created</strong> (oldest first). <strong>Σ INR</strong> counts each checkout once (seat 1). Scroll for more rows.
            </p>
            <div className={ENROLL_TABLE_INNER_CLASS}>
              <table className="w-full table-fixed border-collapse text-[10px] sm:text-[11px]">
                <colgroup>
                  {visProgramBatchCols.map((d) => (
                    <col key={d.id} style={{ width: `${(d.weight / programBatchWeightSum) * 100}%` }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-100">
                  <tr>
                    {visProgramBatchCols.map((d) => (
                      <th key={d.id} className={cn('px-1 sm:px-2 py-2 font-semibold text-gray-700', d.headClass)}>
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {programBatchAnalyticsRows.map(({ row, serial, amountInr, cumulativeInr, countsForRunning, sourceCurrency }) => {
                    const cur = (row.payment_currency || '').toLowerCase();
                    const symbols = { inr: '\u20B9', aed: 'AED ', usd: '$' };
                    const sym = symbols[cur] || (cur ? `${cur.toUpperCase()} ` : '');
                    const amt = row.payment_amount;
                    const pTotal = Number(row.participant_total);
                    const pIdx = Number(row.participant_index);
                    let seat = '—';
                    if (Number.isFinite(pTotal) && pTotal > 1 && Number.isFinite(pIdx) && pIdx > 0) {
                      seat = `${pIdx}/${pTotal}`;
                    } else if (Number.isFinite(pIdx) && pIdx > 0) {
                      seat = String(pIdx);
                    }
                    const st = (row.enrollment_status || row.payment_status || '—').toLowerCase();
                    const stInfo = STATUS_MAP[st] || { label: row.enrollment_status || row.payment_status || '—', color: 'bg-gray-100 text-gray-600' };
                    const bc = 'px-1 sm:px-2 py-1.5 align-top min-w-0';
                    return (
                      <tr
                        key={`${row.enrollment_id}-${row.participant_index ?? row.participant_name}-${row.participant_email}-${serial}`}
                        className={`odd:bg-white even:bg-violet-50/25 hover:bg-amber-50/35 transition-colors ${countsForRunning ? '' : 'opacity-[0.92]'}`}
                      >
                        {visProgramBatchCols.map((def) => {
                          switch (def.id) {
                            case 'serial':
                              return <td key={def.id} className={`${bc} text-gray-500 tabular-nums`}>{serial}</td>;
                            case 'seat':
                              return (
                                <td key={def.id} className={`${bc} text-gray-500 tabular-nums text-[9px]`} title={countsForRunning ? 'Counts toward Σ' : 'Same checkout'}>
                                  {seat}
                                </td>
                              );
                            case 'name':
                              return <td key={def.id} className={`${bc} font-medium text-gray-900`} title={row.participant_name || ''}>{row.participant_name || '—'}</td>;
                            case 'age':
                              return <td key={def.id} className={`${bc} text-gray-700 tabular-nums`}>{row.age !== '' && row.age != null ? row.age : '—'}</td>;
                            case 'gender':
                              return <td key={def.id} className={`${bc} text-gray-700`} title={row.gender}>{row.gender || '—'}</td>;
                            case 'city':
                              return <td key={def.id} className={`${bc} text-gray-700`} title={row.city}>{row.city || '—'}</td>;
                            case 'country':
                              return <td key={def.id} className={`${bc} text-gray-700`} title={row.country}>{row.country || '—'}</td>;
                            case 'cohort': {
                              const cohortTip = [row.portal_cohort && `Cohort: ${row.portal_cohort}`, row.chosen_start_date && `ISO: ${row.chosen_start_date}`]
                                .filter(Boolean)
                                .join(' · ');
                              return (
                                <td key={def.id} className={`${bc} text-teal-900 font-mono text-[9px]`} title={cohortTip || ''}>
                                  {formatProgramYmd(row.chosen_start_date)}
                                </td>
                              );
                            }
                            case 'tier': {
                              const tip = [
                                row.catalog_program_title,
                                row.tier_label,
                                formatProgramYmd(row.chosen_start_date),
                                formatProgramYmd(row.chosen_end_date),
                              ]
                                .filter((x) => x && x !== '—')
                                .join(' · ');
                              return (
                                <td key={def.id} className={`${bc} text-gray-800 leading-tight`} title={tip}>
                                  {row.tier_label || row.catalog_program_title || '—'}
                                </td>
                              );
                            }
                            case 'progStart':
                              return (
                                <td
                                  key={def.id}
                                  className={`${bc} text-gray-700 text-[9px] font-mono`}
                                  title={[row.catalog_program_title, row.chosen_start_date].filter(Boolean).join(' · ')}
                                >
                                  {formatProgramYmd(row.chosen_start_date)}
                                </td>
                              );
                            case 'progEnd':
                              return (
                                <td
                                  key={def.id}
                                  className={`${bc} text-gray-700 text-[9px] font-mono`}
                                  title={[row.catalog_program_title, row.chosen_end_date].filter(Boolean).join(' · ')}
                                >
                                  {formatProgramYmd(row.chosen_end_date)}
                                </td>
                              );
                            case 'mode':
                              return (
                                <td key={def.id} className={`${bc} text-gray-700 text-[9px] sm:text-[10px]`} title={participantAttendanceLabel(row.attendance_mode)}>
                                  {participantAttendanceLabel(row.attendance_mode)}
                                </td>
                              );
                            case 'origin':
                              return (
                                <td key={def.id} className={bc}>
                                  <span className={`inline-block text-[9px] px-1 py-0.5 rounded-md font-medium ${row.enrollment_origin === 'dashboard' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
                                    {row.enrollment_origin === 'dashboard' ? 'Dash' : 'Web'}
                                  </span>
                                </td>
                              );
                            case 'status':
                              return (
                                <td key={def.id} className={bc}>
                                  <span className={`inline-block text-[9px] px-1 py-0.5 rounded-md font-medium max-w-full truncate ${stInfo.color}`} title={stInfo.label}>{stInfo.label}</span>
                                </td>
                              );
                            case 'amt':
                              return (
                                <td key={def.id} className={`${bc} text-right font-medium text-gray-900 tabular-nums text-[10px] sm:text-[11px]`}>
                                  {amt > 0 ? (
                                    <span title={sourceCurrency !== 'inr' ? `Stored: ${String(row.payment_currency || '').toUpperCase()}` : ''}>
                                      {sym}{Number(amt).toLocaleString()}
                                    </span>
                                  ) : (
                                    '0'
                                  )}
                                </td>
                              );
                            case 'inr':
                              return <td key={def.id} className={`${bc} text-right tabular-nums text-gray-800`}>₹{amountInr.toLocaleString('en-IN')}</td>;
                            case 'runInr':
                              return <td key={def.id} className={`${bc} text-right font-semibold text-violet-900 tabular-nums`}>₹{cumulativeInr.toLocaleString('en-IN')}</td>;
                            default:
                              return null;
                          }
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {viewMode === 'program_three_month' && (
        loadingParticipants ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading program data…</div>
        ) : programBatchTitles.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No participant rows loaded. Adjust filters or confirm enrollments exist.
          </div>
        ) : threeMonthMonthlyRows.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
            No 3-month tier rows for this program and filters. Requires <strong>item type program</strong>, checkout{' '}
            <strong>tier_index</strong> pointing at a catalog tier labeled like &quot;3 Months&quot;, and that tier must have{' '}
            <strong>start_date</strong> / <strong>end_date</strong> in the program catalog.
          </div>
        ) : (
          <div className={ENROLL_TABLE_CARD_CLASS} data-testid="enrollments-program-3mo-monthly-table">
            <p className="text-[10px] text-gray-600 px-3 py-2.5 bg-gray-50/80 border-b border-gray-100 leading-relaxed">
              Sorted by <strong>eligibility month</strong> (YYYY-MM), then participant name. One row per person per month overlapping the chosen tier window.
            </p>
            <div className={ENROLL_TABLE_INNER_CLASS}>
              <table className="w-full table-fixed border-collapse text-[10px] sm:text-[11px]">
                <colgroup>
                  {visProgramThreeMoCols.map((d) => (
                    <col key={d.id} style={{ width: `${(d.weight / programThreeMoWeightSum) * 100}%` }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-100">
                  <tr>
                    {visProgramThreeMoCols.map((d) => (
                      <th key={d.id} className={cn('px-1 sm:px-2 py-2 font-semibold text-gray-700', d.headClass)}>
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {threeMonthMonthlyRows.map((row, idx) => {
                    const serial = idx + 1;
                    const bc = 'px-1 sm:px-2 py-1.5 align-top min-w-0';
                    return (
                      <tr
                        key={row._explodeKey || `${row.enrollment_id}-${row.participant_index}-${row.eligibility_month}`}
                        className="odd:bg-white even:bg-violet-50/25 hover:bg-amber-50/35 transition-colors"
                      >
                        {visProgramThreeMoCols.map((def) => {
                          switch (def.id) {
                            case 'serial':
                              return <td key={def.id} className={`${bc} text-gray-500 tabular-nums`}>{serial}</td>;
                            case 'eligMonth':
                              return (
                                <td key={def.id} className={`${bc} font-mono text-gray-900`} title={row.eligibility_month || ''}>
                                  {row.eligibility_month || '—'}
                                </td>
                              );
                            case 'eligMonthLabel':
                              return (
                                <td key={def.id} className={`${bc} text-gray-800`} title={row.eligibility_month_label || ''}>
                                  {row.eligibility_month_label || '—'}
                                </td>
                              );
                            case 'cohort': {
                              const cohortTip3 = [row.portal_cohort && `Cohort: ${row.portal_cohort}`, row.chosen_start_date && `ISO: ${row.chosen_start_date}`]
                                .filter(Boolean)
                                .join(' · ');
                              return (
                                <td key={def.id} className={`${bc} text-teal-900 font-mono text-[9px]`} title={cohortTip3 || ''}>
                                  {formatProgramYmd(row.chosen_start_date)}
                                </td>
                              );
                            }
                            case 'tier': {
                              const tip3 = [
                                row.catalog_program_title,
                                row.tier_label,
                                formatProgramYmd(row.chosen_start_date),
                                formatProgramYmd(row.chosen_end_date),
                              ]
                                .filter((x) => x && x !== '—')
                                .join(' · ');
                              return (
                                <td key={def.id} className={`${bc} text-gray-800 leading-tight`} title={tip3}>
                                  {row.tier_label || row.catalog_program_title || '—'}
                                </td>
                              );
                            }
                            case 'progStart':
                              return (
                                <td
                                  key={def.id}
                                  className={`${bc} text-gray-700 text-[9px] font-mono`}
                                  title={[row.catalog_program_title, row.chosen_start_date].filter(Boolean).join(' · ')}
                                >
                                  {formatProgramYmd(row.chosen_start_date)}
                                </td>
                              );
                            case 'progEnd':
                              return (
                                <td
                                  key={def.id}
                                  className={`${bc} text-gray-700 text-[9px] font-mono`}
                                  title={[row.catalog_program_title, row.chosen_end_date].filter(Boolean).join(' · ')}
                                >
                                  {formatProgramYmd(row.chosen_end_date)}
                                </td>
                              );
                            case 'name':
                              return <td key={def.id} className={`${bc} font-medium text-gray-900`} title={row.participant_name || ''}>{row.participant_name || '—'}</td>;
                            case 'city':
                              return <td key={def.id} className={`${bc} text-gray-700`} title={row.city}>{row.city || '—'}</td>;
                            case 'country':
                              return <td key={def.id} className={`${bc} text-gray-700`} title={row.country}>{row.country || '—'}</td>;
                            case 'mode':
                              return (
                                <td key={def.id} className={`${bc} text-gray-700 text-[9px] sm:text-[10px]`} title={participantAttendanceLabel(row.attendance_mode)}>
                                  {participantAttendanceLabel(row.attendance_mode)}
                                </td>
                              );
                            case 'origin':
                              return (
                                <td key={def.id} className={bc}>
                                  <span className={`inline-block text-[9px] px-1 py-0.5 rounded-md font-medium ${row.enrollment_origin === 'dashboard' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
                                    {row.enrollment_origin === 'dashboard' ? 'Dash' : 'Web'}
                                  </span>
                                </td>
                              );
                            case 'invoice':
                              return (
                                <td key={def.id} className={`${bc} font-mono text-purple-800 break-all`} title={row.invoice_number || ''}>
                                  {row.invoice_number || '—'}
                                </td>
                              );
                            case 'enrollId':
                              return (
                                <td key={def.id} className={`${bc} font-mono text-gray-600 break-all text-[9px]`} title={row.enrollment_id || ''}>
                                  {row.enrollment_id || '—'}
                                </td>
                              );
                            default:
                              return null;
                          }
                        })}
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
