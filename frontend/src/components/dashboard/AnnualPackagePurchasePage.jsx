import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CreditCard,
  Calendar,
  Clock,
  Info,
  Sparkles,
  ShoppingCart,
  User,
  Heart,
  Paperclip,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  cn,
  formatDateDdMonYyyy,
  nextDateWithDayOfMonth,
  addMonthsAnnualBundleEnd,
} from '../../lib/utils';
import { useToast } from '../../hooks/use-toast';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { getAuthHeaders } from '../../lib/authHeaders';
import { pickTierIndexForDashboard } from './dashboardUpcomingHelpers';
import DashboardUpcomingProgramsIrisBloom from './DashboardUpcomingProgramsIrisBloom';
import { getApiUrl } from '../../lib/config';
import { irisYearLabelNoPeriod } from '../../lib/irisJourney';
import { resolveIndiaDiscountRule, applyIndiaDiscountRuleToBase } from '../../lib/indiaClientPricing';

/** Mirrors backend `_HOME_COMING_INCLUDES` shorts — subtitle for Divine Iris bundle. */
const DIVINE_IRIS_HOME_COMING_PROGRAMS_LABEL =
  'AWRP · MMM · Turbo Release · Meta Downloads';

const HEART_QUOTE = 'You are exactly where you need to be — trust the becoming.';

/** Full Home Coming bundle contents (shown in ALL CAPS). Shared with Household overview. */
export const HOME_COMING_BUNDLE_INCLUDES_LINES = [
  '12-MONTH AWRP',
  '6-MONTH MMM',
  '4 TURBO RELEASE',
  '2 META DOWNLOADS',
];

const ALL_PAY_MODES = [
  { value: 'full', label: 'PAY IN FULL' },
  { value: 'emi_monthly', label: 'EMI — MONTHLY' },
  { value: 'emi_quarterly', label: 'EMI — QUARTERLY' },
  { value: 'emi_yearly', label: 'EMI — YEARLY' },
  { value: 'emi_flexi', label: 'FLEXI — ANY AMOUNT, ANY TIME' },
];

/** Calendar YYYY-MM-DD + delta days (UTC noon) for renewal window copy. */
function ymdAddDays(ymd, deltaDays) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const d = new Date(`${ymd}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function emiInstallmentCount(mode, durationMonths) {
  const d = Math.max(1, Number(durationMonths) || 12);
  if (mode === 'emi_monthly') return d;
  if (mode === 'emi_quarterly') return Math.max(1, Math.ceil(d / 3));
  if (mode === 'emi_yearly') return Math.max(1, Math.ceil(d / 12));
  return 1;
}

/** Pick admin catalog offer for the member's pricing hub (offer_total keys: INR, AED, USD, …). */
function offerTotalForCurrency(offerTotal, currency) {
  if (!offerTotal || typeof offerTotal !== 'object') return null;
  const c = (currency || 'inr').toString();
  const up = c.toUpperCase();
  const lo = c.toLowerCase();
  for (const k of [up, lo, c]) {
    if (k in offerTotal && offerTotal[k] != null && String(offerTotal[k]).trim() !== '') {
      const n = Number(offerTotal[k]);
      if (!Number.isNaN(n)) return n;
    }
  }
  for (const [key, val] of Object.entries(offerTotal)) {
    if (String(key).toLowerCase() === lo) {
      const n = Number(val);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

/** Split ``total`` into ``n`` equal parts (2 dp); remainder cents spread across first rows. */
function splitAmountsEqually(total, n) {
  const t = Math.max(0, Number(total) || 0);
  const count = Math.max(1, Math.floor(Number(n)) || 1);
  if (t <= 0) return Array(count).fill(0);
  const cents = Math.round(t * 100);
  const base = Math.floor(cents / count);
  const rem = cents - base * count;
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push((base + (i < rem ? 1 : 0)) / 100);
  }
  return arr;
}

/** Home Coming illustrative schedule: every installment due on this calendar day (clamped to month length). */
const HOME_COMING_EMI_DUE_DOM = 27;
/** First EMI is in the month *before* bundle start (e.g. 27 Apr when the batch starts 3 May). */
const HOME_COMING_EMI_FIRST_MONTH_OFFSET = -1;

function pad2Ymd(n) {
  return String(n).padStart(2, '0');
}

function utcYmdWithDom(year, month0, dom) {
  const dim = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const day = Math.min(dom, dim);
  return `${year}-${pad2Ymd(month0 + 1)}-${pad2Ymd(day)}`;
}

function shiftCalendarMonths(year, month0, delta) {
  const t = month0 + delta;
  const yy = year + Math.floor(t / 12);
  const mm = ((t % 12) + 12) % 12;
  return { y: yy, m0: mm };
}

function buildEmiPreview(mode, total, startYmd, durationMonths) {
  if (!total || total <= 0 || mode === 'full' || mode === 'emi_flexi') return [];
  const n = emiInstallmentCount(mode, durationMonths);
  const amounts = splitAmountsEqually(total, n);
  let startY;
  let startM0;
  if (startYmd && /^\d{4}-\d{2}-\d{2}$/.test(startYmd)) {
    const [ys, ms] = startYmd.split('-').map(Number);
    startY = ys;
    startM0 = ms - 1;
  } else {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    startY = now.getFullYear();
    startM0 = now.getMonth();
  }
  const out = [];
  for (let i = 0; i < n; i += 1) {
    let offsetMonths = HOME_COMING_EMI_FIRST_MONTH_OFFSET;
    if (mode === 'emi_monthly') offsetMonths = HOME_COMING_EMI_FIRST_MONTH_OFFSET + i;
    else if (mode === 'emi_quarterly') offsetMonths = HOME_COMING_EMI_FIRST_MONTH_OFFSET + i * 3;
    else offsetMonths = HOME_COMING_EMI_FIRST_MONTH_OFFSET + i * 12;
    const { y, m0 } = shiftCalendarMonths(startY, startM0, offsetMonths);
    const due = utcYmdWithDom(y, m0, HOME_COMING_EMI_DUE_DOM);
    out.push({
      n: i + 1,
      due,
      amount: amounts[i] ?? 0,
    });
  }
  return out;
}

/** Rows for the illustrative schedule table (all payment modes). */
function buildPaymentScheduleRows(mode, total, startYmd, durationMonths) {
  const totalNum = Math.max(0, Number(total) || 0);

  if (mode === 'full') {
    let due;
    if (startYmd && /^\d{4}-\d{2}-\d{2}$/.test(startYmd)) {
      due = startYmd;
    } else {
      due = new Date().toISOString().slice(0, 10);
    }
    return [
      {
        key: 'pay-full',
        n: 1,
        due,
        dueDisplay: null,
        amount: totalNum,
        amountDisplay: null,
      },
    ];
  }

  if (mode === 'emi_flexi') {
    const rows = [
      {
        key: 'flex-a',
        n: 1,
        due: null,
        dueDisplay: 'Whenever you choose',
        amount: null,
        amountDisplay: 'Any amount you wish',
      },
    ];
    if (totalNum > 0) {
      rows.push({
        key: 'flex-ref',
        n: '—',
        due: null,
        dueDisplay: 'Balance reference (quoted total)',
        amount: totalNum,
        amountDisplay: null,
      });
    }
    return rows;
  }

  if (totalNum <= 0) {
    return [
      {
        key: 'emi-pending',
        n: 1,
        due: null,
        dueDisplay: 'Confirmed with your host',
        amount: null,
        amountDisplay: 'Installment amounts when total is set',
      },
    ];
  }

  const emi = buildEmiPreview(mode, totalNum, startYmd, durationMonths);
  return emi.map((r) => ({
    key: `emi-${r.n}`,
    n: r.n,
    due: r.due,
    dueDisplay: null,
    amount: r.amount,
    amountDisplay: null,
  }));
}

function formatSchedulePayTag(raw) {
  const k = String(raw || '').trim().toLowerCase();
  if (!k) return 'As set with host';
  if (k === 'gpay_upi' || k === 'gpay' || k === 'upi') return 'GPay / UPI';
  if (k === 'bank_transfer' || k === 'bank' || k === 'neft' || k === 'rtgs' || k === 'imps') return 'Bank transfer';
  if (k === 'cash_deposit' || k === 'cash') return 'Cash deposit';
  if (k === 'stripe' || k === 'card' || k === 'cards') return 'Stripe';
  if (k === 'any' || k === 'multiple' || k === 'all') return 'GPay / UPI / Bank';
  if (k === 'razorpay') return 'Razorpay';
  return k.replace(/_/g, ' ');
}

/**
 * Dedicated Home Coming / annual bundle page: purchase options, illustrative EMI plan, and link to live payment status on Financials.
 */
export default function AnnualPackagePurchasePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { syncProgramLineItem, itemCount: cartCount } = useCart();
  const { baseCurrency, symbol, toDisplay } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [homeData, setHomeData] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const prefsSaveTimer = useRef(null);
  const prefsInitDone = useRef(false);

  const [desiredStart, setDesiredStart] = useState('');
  const [paymentMode, setPaymentMode] = useState('full');
  /** Home Coming annual path: online vs offline only (no in-person seat on this bundle). */
  const [annualParticipationMode, setAnnualParticipationMode] = useState('online');
  const [emiNotes, setEmiNotes] = useState('');

  const refresh = useCallback(() => {
    setLoading(true);
    axios
      .get(`${getApiUrl()}/student/home`, { withCredentials: true })
      .then((res) => setHomeData(res.data))
      .catch(() => {
        setHomeData(null);
        toast({
          title: 'Could not load dashboard',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pinnedProgram = useMemo(() => {
    const list = homeData?.upcoming_programs || [];
    const pin = list.find((p) => p.dashboard_annual_product_pin);
    return pin || list[0] || null;
  }, [homeData?.upcoming_programs]);

  const pkg = homeData?.package || {};
  const fin = homeData?.financials || {};
  const sacredMoneyCurrency = useMemo(
    () => (baseCurrency || fin.currency || 'aed').toString().toUpperCase(),
    [baseCurrency, fin.currency],
  );
  const emis = fin.emis || [];
  const emiByNumber = useMemo(() => {
    const m = new Map();
    for (const e of emis) {
      if (!e || e.number == null) continue;
      const n = Number(e.number);
      if (!Number.isNaN(n)) m.set(n, e);
    }
    return m;
  }, [emis]);
  const schedulePayTag = useMemo(() => {
    const pref = (homeData?.preferred_payment_method || '').trim();
    const indiaTag = (homeData?.client_india_pricing?.india_payment_method || '').trim();
    const finMode = (fin.payment_mode || '').trim();
    return formatSchedulePayTag(pref || indiaTag || finMode);
  }, [homeData?.preferred_payment_method, homeData?.client_india_pricing?.india_payment_method, fin.payment_mode]);
  const durationMonths = Math.max(1, Number(pkg.duration_months) || 12);
  const preferredDom = Math.min(
    28,
    Math.max(0, typeof pkg.preferred_membership_day_of_month === 'number' ? pkg.preferred_membership_day_of_month : parseInt(pkg.preferred_membership_day_of_month, 10) || 0),
  );
  const catalogFrom = (pkg.catalog_valid_from || '').trim().slice(0, 10);
  const catalogTo = (pkg.catalog_valid_to || '').trim().slice(0, 10);
  const hc = homeData?.home_coming;
  const subtitleFourPrograms =
    hc?.includes?.length > 0
      ? hc.includes.map((i) => (i && typeof i === 'object' ? i.short : '') || '').filter(Boolean).join(' · ') ||
        DIVINE_IRIS_HOME_COMING_PROGRAMS_LABEL
      : DIVINE_IRIS_HOME_COMING_PROGRAMS_LABEL;

  const catalogBundle = homeData?.annual_catalog_bundle;
  const catalogOfferTotal = catalogBundle?.offer_total;
  const catalogAmountHub = useMemo(
    () => offerTotalForCurrency(catalogOfferTotal, baseCurrency),
    [catalogOfferTotal, baseCurrency],
  );
  const catalogDisplayAmount = catalogAmountHub != null ? toDisplay(catalogAmountHub) : null;

  /** CRM-only discount on catalog list (same basis as Sacred Home quotes); excludes site portal default %. */
  const catalogCourtesyBreakdown = useMemo(() => {
    if (catalogAmountHub == null || !(Number(catalogAmountHub) > 0) || !homeData) return null;
    const src = homeData.client_discount_source;
    if (!src) return null;
    const hasBands =
      Array.isArray(src.india_discount_member_bands) && src.india_discount_member_bands.length > 0;
    const hasPct = src.india_discount_percent != null && src.india_discount_percent !== '';
    if (!hasBands && !hasPct) return null;
    const fam = homeData.immediate_family;
    const n = Math.max(1, 1 + (Array.isArray(fam) ? fam.length : 0));
    const cp = {
      india_discount_percent: src.india_discount_percent,
      india_discount_member_bands: src.india_discount_member_bands,
    };
    const rule = resolveIndiaDiscountRule(cp, n, 0);
    const hubCur = (baseCurrency || 'inr').toLowerCase();
    if (rule.mode === 'amount' && rule.amountInr > 0 && hubCur !== 'inr') {
      return null;
    }
    const listNum = Number(catalogAmountHub);
    const applied = applyIndiaDiscountRuleToBase(listNum, rule);
    const discountAmt = Math.round(Number(applied.discountAmt || 0) * 100) / 100;
    if (discountAmt <= 0) return null;
    const finalNum = Math.max(0, Math.round((listNum - discountAmt) * 100) / 100);
    const listDisplay = toDisplay(listNum);
    const finalDisplay = toDisplay(finalNum);
    const pctLabel =
      applied.discountKind === 'percent' && applied.discountNominalPercent != null
        ? `${Number(applied.discountNominalPercent).toFixed(1).replace(/\.0$/, '')}%`
        : null;
    return {
      ruleLabel: rule.fromBand ? 'Group offer' : 'Special offer',
      discountAmt,
      finalNum,
      listDisplay,
      finalDisplay,
      pctLabel,
      isAmountBand: rule.mode === 'amount' && rule.amountInr > 0,
    };
  }, [catalogAmountHub, homeData, baseCurrency, toDisplay]);

  const catalogOtherCurrencies = useMemo(() => {
    if (!catalogOfferTotal || typeof catalogOfferTotal !== 'object') return [];
    const hub = (baseCurrency || 'inr').toLowerCase();
    return Object.entries(catalogOfferTotal).filter(
      ([k]) => k && String(k).toLowerCase() !== hub && Number(catalogOfferTotal[k]) > 0,
    );
  }, [catalogOfferTotal, baseCurrency]);

  /** Non-empty catalog amounts (fallback when user's hub key is missing). */
  const catalogAllPositiveEntries = useMemo(() => {
    if (!catalogOfferTotal || typeof catalogOfferTotal !== 'object') return [];
    return Object.entries(catalogOfferTotal).filter(
      ([, v]) =>
        v != null &&
        String(v).trim() !== '' &&
        !Number.isNaN(Number(v)) &&
        Number(v) >= 0,
    );
  }, [catalogOfferTotal]);

  const lap = homeData?.last_annual_package;
  const portalLife = homeData?.annual_portal_lifecycle;
  const lapEndYmd = (lap?.end_date || '').trim().slice(0, 10);
  const lapStartYmd = (lap?.start_date || '').trim().slice(0, 10);
  const todayYmd = new Date().toISOString().slice(0, 10);
  const lapEnded = lapEndYmd.length === 10 && lapEndYmd < todayYmd;
  const isRenewalSeason =
    portalLife?.status === 'expired' ||
    portalLife?.status === 'renewal_due' ||
    lapEnded;
  const lapOnRecordIsCurrent =
    lapStartYmd.length === 10 &&
    lapEndYmd.length === 10 &&
    lapStartYmd <= todayYmd &&
    todayYmd <= lapEndYmd;
  const renewalWindowOpensYmd = lapEndYmd.length === 10 ? ymdAddDays(lapEndYmd, -15) : '';
  const onRecordCycleBannerTitle = lapOnRecordIsCurrent
    ? 'CURRENT ANNUAL CYCLE · ON RECORD'
    : lapEnded
      ? 'PREVIOUS ANNUAL CYCLE · ON RECORD'
      : 'ANNUAL CYCLE · ON RECORD';
  const showNextSacredHomeEnrollment = isRenewalSeason || !lapOnRecordIsCurrent;
  const preferOnFilePackagePricing =
    lapOnRecordIsCurrent &&
    !isRenewalSeason &&
    Number(fin.total_fee || 0) > 0;
  const needsAdminEmiBackfillHint =
    lapOnRecordIsCurrent &&
    !isRenewalSeason &&
    Number(fin.total_fee || 0) > 0 &&
    (emis.length === 0 ||
      !emis.every((e) => e && String(e.status).toLowerCase() === 'paid')) &&
    Number(fin.remaining ?? 1) > 0;
  const subscriptionStartYmd = (pkg.start_date || '').trim().slice(0, 10);
  const subscriptionEndYmd = (pkg.end_date || '').trim().slice(0, 10);
  const recordStartYmd = /^\d{4}-\d{2}-\d{2}$/.test(subscriptionStartYmd)
    ? subscriptionStartYmd
    : lapStartYmd;
  const recordEndYmd = /^\d{4}-\d{2}-\d{2}$/.test(subscriptionEndYmd)
    ? subscriptionEndYmd
    : lapEndYmd;
  const anyEmiPaid = useMemo(
    () => (emis || []).some((e) => e && String(e.status).toLowerCase() === 'paid'),
    [emis],
  );
  const hasRecordedAnnualPayment =
    anyEmiPaid ||
    (Number(fin.total_fee || 0) > 0 && Number(fin.total_paid || 0) > 0);
  /** After a payment is on file, subscription dates are fixed (renewal season opens choosing the next cycle). */
  const membershipCycleDatesLocked =
    !isRenewalSeason &&
    hasRecordedAnnualPayment &&
    /^\d{4}-\d{2}-\d{2}$/.test(recordStartYmd);
  const cycleDisplayStart = useMemo(() => {
    if (membershipCycleDatesLocked) return recordStartYmd;
    return desiredStart;
  }, [membershipCycleDatesLocked, recordStartYmd, desiredStart]);
  const cycleDisplayEnd = useMemo(() => {
    if (membershipCycleDatesLocked && /^\d{4}-\d{2}-\d{2}$/.test(recordEndYmd)) {
      return recordEndYmd;
    }
    if (cycleDisplayStart && /^\d{4}-\d{2}-\d{2}$/.test(cycleDisplayStart)) {
      return addMonthsAnnualBundleEnd(cycleDisplayStart, durationMonths) || '';
    }
    return '';
  }, [membershipCycleDatesLocked, recordEndYmd, cycleDisplayStart, durationMonths]);
  const autoRenewalYear = useMemo(
    () => Math.min(12, Math.max(1, parseInt(homeData?.renewal_entering_iris_year, 10) || 1)),
    [homeData?.renewal_entering_iris_year],
  );
  const memberFirstName = useMemo(() => {
    const raw =
      typeof homeData?.user_details?.full_name === 'string'
        ? homeData.user_details.full_name.trim()
        : '';
    if (!raw) return '';
    return raw.split(/\s+/)[0];
  }, [homeData?.user_details?.full_name]);

  const visiblePayModes = useMemo(() => {
    const monthlyOk = homeData?.annual_package_offer_monthly_emi_visible !== false;
    return ALL_PAY_MODES.filter((m) => m.value !== 'emi_monthly' || monthlyOk);
  }, [homeData?.annual_package_offer_monthly_emi_visible]);

  const nextSacredYearTitleLine = useMemo(() => irisYearLabelNoPeriod(autoRenewalYear), [autoRenewalYear]);

  /** Rich title for the on-record cycle (package name + Iris year for that window). */
  const lastAnnualCycleDisplayName = useMemo(() => {
    if (!lap?.start_date && !lap?.end_date) return '';
    const raw = (lap.program_label || '').trim();
    const pkgName = (pkg.program_name || '').trim();
    const programBit =
      raw && !/^annual program$/i.test(raw)
        ? raw
        : pkgName && !/^no active package$/i.test(pkgName)
          ? pkgName
          : 'Divine Iris Home Coming';
    const lapEndStr = (lap.end_date || '').trim().slice(0, 10);
    const completed = lapEndStr.length === 10 && lapEndStr < todayYmd;
    const ijYear = Math.min(12, Math.max(1, Number(homeData?.iris_journey?.year) || autoRenewalYear));
    const nameYear = completed ? Math.max(1, ijYear - 1) : ijYear;
    return `${programBit} · ${irisYearLabelNoPeriod(nameYear)}`;
  }, [lap, pkg.program_name, homeData?.iris_journey?.year, autoRenewalYear, todayYmd]);

  /** Opening lines: renewal season vs in-journey vs Year 1 welcome. */
  const irisWelcomeLeadEl = useMemo(() => {
    const ij = homeData?.iris_journey;
    const y = Math.min(12, Math.max(1, Number(ij?.year) || 1));
    const strip = (t) => String(t || '').replace(/\.\s*$/, '').trim();
    const currentClean = strip(ij?.label) || irisYearLabelNoPeriod(y);
    const namePrefix = memberFirstName ? (
      <>
        <span className="font-semibold text-[#4c1d95]">{memberFirstName}</span>,{' '}
      </>
    ) : null;
    const renewLbl = irisYearLabelNoPeriod(autoRenewalYear);

    if (isRenewalSeason) {
      return (
        <>
          {namePrefix}
          thank you for walking your Sacred Home path. Your previous annual window on file has completed or is in its
          renewal season; the path continues with <span className="font-semibold text-[#4c1d95]">{renewLbl}</span>.
          Anchor your next start date below — we show the matching bundle end date for that cycle, then you can checkout
          in one step when you feel a full yes.
        </>
      );
    }

    if (y >= 2) {
      const prevClean = irisYearLabelNoPeriod(y - 1);
      return (
        <>
          {namePrefix}
          thank you for completing {prevClean}. Your presence weaves luminous thread through this lineage;
          we hold you softly as you continue into sacred growth and higher becoming with {currentClean}.
        </>
      );
    }

    return (
      <>
        {namePrefix}
        thank you for choosing Divine Iris as you step into {currentClean}. Your presence weaves luminous
        thread through this lineage; we hold you softly as you deepen into sacred growth and higher becoming.
      </>
    );
  }, [homeData?.iris_journey, memberFirstName, isRenewalSeason, autoRenewalYear]);

  useEffect(() => {
    if (!homeData || prefsInitDone.current) return;
    prefsInitDone.current = true;
    const p = homeData.annual_package_offer_prefs;
    const monthlyOk = homeData.annual_package_offer_monthly_emi_visible !== false;
    const allowed = new Set(['full', 'emi_quarterly', 'emi_yearly', 'emi_flexi']);
    if (monthlyOk) allowed.add('emi_monthly');
    if (p && typeof p === 'object') {
      if (p.desired_start_date) setDesiredStart(String(p.desired_start_date).slice(0, 10));
      if (p.payment_mode) {
        const pm = String(p.payment_mode).trim();
        setPaymentMode(allowed.has(pm) ? pm : 'full');
      }
      if (p.emi_notes) setEmiNotes(String(p.emi_notes));
      if (p.participation_mode === 'offline' || p.participation_mode === 'online') {
        setAnnualParticipationMode(p.participation_mode);
      }
    } else if (preferredDom >= 1 && preferredDom <= 28) {
      const ymd = nextDateWithDayOfMonth(null, preferredDom);
      if (ymd) setDesiredStart(ymd);
    }
    setPrefsLoaded(true);
  }, [homeData, preferredDom]);

  useEffect(() => {
    if (!homeData || !prefsLoaded) return;
    const monthlyOk = homeData.annual_package_offer_monthly_emi_visible !== false;
    if (!monthlyOk && paymentMode === 'emi_monthly') {
      setPaymentMode('full');
    }
  }, [homeData, homeData?.annual_package_offer_monthly_emi_visible, prefsLoaded, paymentMode]);

  useEffect(() => {
    if (!prefsLoaded || !homeData) return;
    const allowed = new Set(visiblePayModes.map((m) => m.value));
    if (!allowed.has(paymentMode)) {
      setPaymentMode('full');
    }
  }, [prefsLoaded, homeData, visiblePayModes, paymentMode]);

  useEffect(() => {
    if (!homeData || !prefsLoaded || !membershipCycleDatesLocked) return;
    if (/^\d{4}-\d{2}-\d{2}$/.test(recordStartYmd)) {
      setDesiredStart((prev) => (prev === recordStartYmd ? prev : recordStartYmd));
    }
  }, [homeData, prefsLoaded, membershipCycleDatesLocked, recordStartYmd]);

  useEffect(() => {
    if (!pinnedProgram || !baseCurrency) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    const tierIdx = pickTierIndexForDashboard(pinnedProgram, true);
    const tiers = pinnedProgram.duration_tiers || [];
    const params = {
      program_id: pinnedProgram.id,
      currency: baseCurrency,
      family_count: 0,
      booker_joins: true,
    };
    if (pinnedProgram.is_flagship && tiers.length > 0 && tierIdx != null) {
      params.tier_index = tierIdx;
    }
    axios
      .get(`${getApiUrl()}/student/dashboard-quote`, {
        params,
        withCredentials: true,
        headers: getAuthHeaders(),
      })
      .then((r) => setQuote(r.data))
      .catch(() => setQuote(null))
      .finally(() => setQuoteLoading(false));
  }, [pinnedProgram, baseCurrency]);

  const persistPrefs = useCallback(() => {
    if (!homeData?.client_id) return;
    axios
      .put(
        `${getApiUrl()}/student/annual-package-offer-preferences`,
        {
          desired_start_date: desiredStart,
          payment_mode: paymentMode,
          participation_mode: annualParticipationMode,
          emi_notes: emiNotes,
        },
        { withCredentials: true },
      )
      .catch(() => {})
  }, [homeData?.client_id, desiredStart, paymentMode, annualParticipationMode, emiNotes]);

  useEffect(() => {
    if (!prefsLoaded) return;
    if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current);
    prefsSaveTimer.current = setTimeout(() => {
      persistPrefs();
    }, 700);
    return () => {
      if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current);
    };
  }, [desiredStart, paymentMode, annualParticipationMode, emiNotes, prefsLoaded, persistPrefs]);

  const totalRaw = Number(quote?.total ?? 0);

  /** True when Client Garden /student/home financials fee is in the same currency as the member's portal hub (e.g. AED). */
  const crmSubscriptionFeeMatchesHub = useMemo(() => {
    const n = Number(fin.total_fee || 0);
    if (n <= 0) return false;
    const fc = (fin.currency || '').toString().trim().toLowerCase();
    const hub = (baseCurrency || '').toString().trim().toLowerCase();
    return Boolean(fc && hub && fc === hub);
  }, [fin.total_fee, fin.currency, baseCurrency]);

  /** Divine Cart / checkout line title — pinned program title is AWRP; members expect Home Coming wording + Iris year. */
  const homeComingCartTitle = useMemo(() => {
    if (!homeData) return 'Home Coming Annual Program';
    const yCurrent = Math.min(12, Math.max(1, Number(homeData.iris_journey?.year) || 1));
    const yRenew = Math.min(
      12,
      Math.max(1, Number(homeData.renewal_entering_iris_year) || yCurrent),
    );
    const y = isRenewalSeason || showNextSacredHomeEnrollment ? yRenew : yCurrent;
    return `Home Coming Annual Program · Year ${y}`;
  }, [homeData, isRenewalSeason, showNextSacredHomeEnrollment]);

  /** Basis for splitting the payment schedule: quote, then CRM fee in hub, then on-file guard, then hub-matched catalog only. */
  const scheduleSplitTotal = useMemo(() => {
    const onFileFee = Number(fin.total_fee || 0);
    if (totalRaw > 0) return totalRaw;
    if (crmSubscriptionFeeMatchesHub && onFileFee > 0) return onFileFee;
    if (preferOnFilePackagePricing && onFileFee > 0) return onFileFee;
    if (
      catalogCourtesyBreakdown != null &&
      Number(catalogCourtesyBreakdown.finalNum) > 0
    ) {
      return Number(catalogCourtesyBreakdown.finalNum);
    }
    if (catalogAmountHub != null && Number(catalogAmountHub) > 0) return Number(catalogAmountHub);
    return 0;
  }, [
    preferOnFilePackagePricing,
    crmSubscriptionFeeMatchesHub,
    fin.total_fee,
    totalRaw,
    catalogAmountHub,
    catalogCourtesyBreakdown,
  ]);

  const paymentScheduleRows = useMemo(
    () => buildPaymentScheduleRows(paymentMode, scheduleSplitTotal, desiredStart, durationMonths),
    [paymentMode, scheduleSplitTotal, desiredStart, durationMonths],
  );

  const paymentScheduleNumericTotal = useMemo(() => {
    let s = 0;
    for (const row of paymentScheduleRows) {
      if (row.amount == null || row.amountDisplay != null || Number.isNaN(Number(row.amount))) continue;
      const k = String(row.key || '');
      if (k.startsWith('emi-') || k === 'pay-full' || k === 'flex-ref') {
        s += Number(row.amount);
      }
    }
    return Math.round(s * 100) / 100;
  }, [paymentScheduleRows]);

  const paymentScheduleEmiRowCount = useMemo(
    () => paymentScheduleRows.filter((r) => String(r.key || '').startsWith('emi-')).length,
    [paymentScheduleRows],
  );

  /** Payable total: live quote and/or catalog offer amount. */
  const hasPayableCheckoutTotal = totalRaw > 0 || scheduleSplitTotal > 0;
  const canContinueToCheckout = Boolean(
    pinnedProgram &&
      !quoteLoading &&
      (hasPayableCheckoutTotal || quote?.included_in_annual_package === true),
  );

  const scheduleTitle = useMemo(() => {
    if (paymentMode === 'full') return 'PAYMENT SCHEDULE · PAY IN FULL';
    if (paymentMode === 'emi_flexi') return 'PAYMENT SCHEDULE · FLEXI';
    const n = paymentScheduleRows.length;
    return `PAYMENT SCHEDULE · ${n} INSTALLMENT${n === 1 ? '' : 'S'}`;
  }, [paymentMode, paymentScheduleRows.length]);

  const memberHasStripe = useMemo(() => {
    const pm = homeData?.payment_methods;
    if (!pm || !Array.isArray(pm) || pm.length === 0) return true;
    return pm.some((m) => String(m).toLowerCase() === 'stripe');
  }, [homeData?.payment_methods]);

  /** Single-click Pay on schedule: jump straight to Stripe Checkout when subscription allows Stripe and India-only is not chosen. */
  const useAutoStripeCheckout = useMemo(() => {
    if (!memberHasStripe) return false;
    const pref = String(homeData?.preferred_payment_method || '').trim().toLowerCase();
    const india = String(homeData?.client_india_pricing?.india_payment_method || '').trim().toLowerCase();
    const mode = String(fin.payment_mode || '').trim().toLowerCase();
    const raw = pref || india || mode;
    const indiaOnly =
      raw &&
      (raw.includes('gpay') ||
        raw.includes('upi') ||
        raw.includes('bank') ||
        raw === 'manual' ||
        raw.includes('exly') ||
        raw.includes('neft') ||
        raw.includes('cash'));
    if (indiaOnly) return false;
    if (schedulePayTag === 'Stripe') return true;
    if (!raw) return true;
    return raw.includes('stripe') || raw === 'card' || raw === 'cards';
  }, [
    memberHasStripe,
    schedulePayTag,
    homeData?.preferred_payment_method,
    homeData?.client_india_pricing?.india_payment_method,
    fin.payment_mode,
  ]);

  /** Minimal valid booker row so Divine Cart autoPay can pass validateAndProceed without empty placeholders. */
  const buildSacredHomeQuickPayParticipants = useCallback(
    (_program) => {
      const name =
        (homeData?.user_details?.full_name || user?.full_name || user?.name || '').trim() ||
        'Sacred Home member';
      const hub = (baseCurrency || 'inr').toLowerCase();
      const country =
        String(user?.country || '').trim() ||
        (hub === 'inr' ? 'IN' : hub === 'aed' ? 'AE' : hub === 'usd' ? 'US' : 'AE');
      const city = String(homeData?.user_details?.city || '').trim() || '—';
      const state =
        String(homeData?.user_details?.state || homeData?.user_details?.city || '—').trim() || '—';
      const attendance_mode = annualParticipationMode === 'offline' ? 'offline' : 'online';
      return [
        {
          name,
          relationship: 'Myself',
          age: '',
          gender: 'Other',
          country,
          city,
          state,
          attendance_mode,
          notify: attendance_mode === 'online',
          email: '',
          phone: '',
          phone_code: '',
          wa_code: '',
          whatsapp: '',
          is_first_time: false,
          referral_source: '',
          referred_by_email: '',
          referred_by_name: '',
          has_referral: false,
        },
      ];
    },
    [homeData?.user_details, user, baseCurrency, annualParticipationMode],
  );

  /** Amount sent to Divine Cart / Stripe for Home Coming — one installment for EMI, never the full bundle total. */
  const resolveHomeComingQuotedTotal = useCallback(
    (clickedRow) => {
      if (paymentMode === 'full') {
        return scheduleSplitTotal;
      }
      if (paymentMode === 'emi_flexi') {
        if (clickedRow && typeof clickedRow.amount === 'number' && clickedRow.amount > 0) {
          return clickedRow.amount;
        }
        return scheduleSplitTotal;
      }
      if (
        clickedRow &&
        typeof clickedRow.amount === 'number' &&
        !Number.isNaN(clickedRow.amount) &&
        clickedRow.amount > 0
      ) {
        return clickedRow.amount;
      }
      const firstInst = paymentScheduleRows.find(
        (r) =>
          String(r.key || '').startsWith('emi-') &&
          typeof r.amount === 'number' &&
          !Number.isNaN(r.amount) &&
          r.amount > 0,
      );
      return firstInst ? firstInst.amount : scheduleSplitTotal;
    },
    [paymentMode, scheduleSplitTotal, paymentScheduleRows],
  );

  const resolveHomeComingPayInstallmentN = useCallback(
    (clickedRow) => {
      if (paymentMode !== 'emi_monthly' && paymentMode !== 'emi_quarterly' && paymentMode !== 'emi_yearly') {
        return null;
      }
      if (typeof clickedRow?.n === 'number' && !Number.isNaN(clickedRow.n) && clickedRow.n >= 1) {
        return clickedRow.n;
      }
      return 1;
    },
    [paymentMode],
  );

  /** Optional `clickedRow`: schedule row when using Pay · Stripe on a specific installment. */
  const goCheckout = (clickedRow = null) => {
    const autoQs = useAutoStripeCheckout ? '?autoPay=1' : '';
    if (pinnedProgram) {
      const tierIdx = pickTierIndexForDashboard(pinnedProgram, true) ?? 0;
      const participants = buildSacredHomeQuickPayParticipants(pinnedProgram);
      const quoted = resolveHomeComingQuotedTotal(clickedRow);
      const payInstallmentN = resolveHomeComingPayInstallmentN(clickedRow);
      const schedulePreview =
        paymentMode !== 'full' && paymentMode !== 'emi_flexi'
          ? paymentScheduleRows
              .filter((r) => r.key !== 'flex-a' && r.key !== 'flex-ref')
              .slice(0, 36)
              .map((r) => ({
                n: r.n,
                due: r.due || null,
                amount: typeof r.amount === 'number' ? r.amount : null,
              }))
          : null;
      flushSync(() => {
        const meta = {
          fromAnnualOfferPage: true,
          homeComingCartTitle,
          /** Roster pricing must treat the booker as package-covered so subtotal is not the full tier (only `homeComingQuotedTotal` is payable). */
          annualIncluded: true,
          annualOfferParticipation: annualParticipationMode,
          ...(quoted > 0 ? { homeComingQuotedTotal: quoted } : {}),
          annualOfferPaymentMode: paymentMode,
          ...(schedulePreview && schedulePreview.length ? { annualOfferSchedulePreview: schedulePreview } : {}),
        };
        if (payInstallmentN != null) {
          meta.homeComingPayInstallmentN = payInstallmentN;
        }
        syncProgramLineItem(pinnedProgram, tierIdx, participants, meta);
      });
      navigate(`/dashboard/combined-checkout${autoQs}`);
      return;
    }
    /* Illustrative schedule or no catalog pin: still send members somewhere to pay (combined-checkout needs a line item). */
    navigate('/dashboard/financials');
  };

  if (loading) {
    return (
      <section
        className="w-full max-w-[68rem] mx-auto pl-4 pr-6 sm:pr-8 md:pr-10 lg:pr-12 py-6 md:py-8"
        data-testid="annual-package-purchase-loading"
      >
        <div className="rounded-[28px] border border-[rgba(160,100,240,0.2)] bg-white/45 backdrop-blur-xl px-5 py-16 flex flex-col items-center justify-center gap-3 text-slate-600 shadow-[0_4px_48px_rgba(140,60,220,0.1)]">
          <Clock className="h-8 w-8 animate-spin text-[#5D3FD3]" aria-hidden />
          <p className="text-sm font-light tracking-wide">Gathering your sanctuary…</p>
        </div>
      </section>
    );
  }

  if (!homeData) {
    return (
      <section
        className="w-full max-w-[68rem] mx-auto pl-4 pr-6 sm:pr-8 md:pr-10 lg:pr-12 py-6 md:py-8"
        data-testid="annual-package-purchase-error"
      >
        <div className="rounded-[28px] border border-red-200/90 bg-white/85 backdrop-blur-xl px-5 py-12 flex flex-col items-center justify-center gap-4 text-center text-slate-800 shadow-[0_4px_48px_rgba(140,60,220,0.08)]">
          <p className="text-sm font-medium text-[#5b21b6] max-w-md">We could not load your Sacred Home data from the server.</p>
          <p className="text-xs text-slate-600 max-w-md">
            Try again, or use the circle menu at the bottom-left for Financials · Sign out.
          </p>
          <Button type="button" className="bg-[#5D3FD3]" onClick={() => refresh()}>
            Retry
          </Button>
        </div>
      </section>
    );
  }

  const glassOuter =
    'rounded-[28px] border border-[rgba(160,100,240,0.2)] bg-white/45 backdrop-blur-xl shadow-[0_4px_48px_rgba(140,60,220,0.1)] overflow-hidden';

  const glassInset =
    'rounded-2xl border border-[rgba(160,100,240,0.15)] bg-gradient-to-br from-white/55 to-[rgba(250,245,255,0.45)] backdrop-blur-md px-4 py-4 md:px-5 md:py-5';

  return (
    <>
    <div
      className="relative w-full min-h-[calc(100vh-6rem)] animate-[fadeSlideUpHc_0.85s_ease-out_both]"
      data-testid="annual-package-purchase-page"
    >
      <section className="w-full max-w-[68rem] mx-auto pl-4 pr-6 sm:pr-8 md:pr-10 lg:pr-12 pb-12 md:pb-16 pt-4 md:pt-6">
        <div className={glassOuter}>
          <div className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-[#c084fc]/80 via-[#f5c840]/70 via-[#f9a8d4]/80 to-transparent shrink-0" />

          <div className="mb-5 md:mb-6 mt-6 md:mt-7 flex flex-col items-center text-center px-3 sm:px-5">
            <DashboardUpcomingProgramsIrisBloom />
            <h1
              id="divine-iris-home-coming-title"
              className="font-[family-name:'Cinzel',serif] mt-2 px-2 text-xl font-bold tracking-[0.16em] uppercase text-[#3b0764] drop-shadow-sm md:text-2xl lg:text-[1.85rem]"
              data-testid="divine-iris-home-coming-title"
            >
              Divine Iris Home Coming
            </h1>
            <p
              className="mt-2.5 text-sm sm:text-base text-[rgba(60,25,115,0.68)] font-medium tracking-[0.04em]"
              data-testid="divine-iris-home-coming-subtitle"
            >
              {subtitleFourPrograms}
            </p>
            <div className="mt-6 w-full flex justify-center md:justify-end lg:justify-end md:pl-2 lg:pl-3 md:pr-[min(11vw,8.5rem)] lg:pr-[min(13vw,10rem)]">
              <div
                className="w-full max-w-[min(46rem,100%)] md:max-w-[min(54rem,calc(100%-0.25rem))] lg:max-w-[min(60rem,calc(100%-max(7rem,8vw)))] xl:max-w-[min(62rem,calc(100%-max(6.5rem,7vw)))] rounded-[22px] border border-[rgba(196,168,252,0.45)] bg-gradient-to-br from-[#faf8ff]/96 via-[#fffefd]/93 to-[#f5f0ff]/93 px-4 py-5 sm:px-5 sm:py-6 md:px-6 md:py-6 text-center shadow-[0_12px_48px_rgba(124,58,237,0.12)] backdrop-blur-sm"
                data-testid="home-coming-welcome-banner"
              >
              <div className="flex flex-col items-center gap-4 sm:gap-5">
                <Sparkles
                  className="h-9 w-9 shrink-0 text-[#a855f7] opacity-[0.92] drop-shadow-[0_0_12px_rgba(168,85,247,0.35)]"
                  aria-hidden
                />
                <div className="w-full min-w-0 space-y-4">
                  <p
                    className="font-[family-name:'Playfair_Display',Georgia,serif] text-[17px] sm:text-lg leading-relaxed text-[#2e1067]/92"
                    data-testid="home-coming-welcome-lead"
                  >
                    {irisWelcomeLeadEl}
                  </p>
                  {lap?.start_date || lap?.end_date ? (
                    <div className="rounded-2xl border border-white/80 bg-white/58 px-4 py-3.5 shadow-sm shadow-violet-200/40">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[rgba(100,55,155,0.42)] font-semibold mb-2">
                        {onRecordCycleBannerTitle}
                      </p>
                      <p className="text-sm font-semibold text-[#3b0764]" data-testid="last-annual-package-label">
                        {lastAnnualCycleDisplayName || lap.program_label || 'Annual program'}
                      </p>
                      <dl className="mt-3 flex flex-wrap justify-center gap-x-10 gap-y-2 text-[13px] text-[rgba(60,35,115,0.88)] tabular-nums">
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.1em] text-[rgba(100,55,155,0.4)] mb-1">START DATE</dt>
                          <dd>{lap.start_date ? formatDateDdMonYyyy(lap.start_date) : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.1em] text-[rgba(100,55,155,0.4)] mb-1">END DATE</dt>
                          <dd>{lap.end_date ? formatDateDdMonYyyy(lap.end_date) : '—'}</dd>
                        </div>
                      </dl>
                    </div>
                  ) : null}
                  <div className="rounded-2xl border border-[rgba(124,58,237,0.35)] bg-gradient-to-br from-violet-50/90 to-white/70 px-4 py-3.5 shadow-sm shadow-violet-200/30 space-y-3">
                    {showNextSacredHomeEnrollment ? (
                      <>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[rgba(100,55,155,0.48)] font-semibold">
                          Next Sacred Home cycle
                        </p>
                        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
                          <div className="min-w-0 max-w-full flex flex-col items-center">
                            <Label className="text-[10px] flex flex-col items-center gap-2 text-[rgba(70,35,125,0.65)] uppercase tracking-[0.12em] font-semibold leading-snug">
                              <Calendar size={12} className="opacity-70 shrink-0" aria-hidden />
                              <span className="text-center">
                                <span className="block text-[10px] font-bold tracking-[0.14em] text-[rgba(100,55,155,0.45)] uppercase">
                                  {nextSacredYearTitleLine}
                                </span>
                                <span className="block text-[10px] font-bold tracking-[0.14em] text-[rgba(100,55,155,0.45)] mt-1 uppercase">
                                  Anchor your membership start
                                </span>
                                <span className="block normal-case tracking-normal text-[11px] font-medium text-[rgba(60,35,115,0.65)] mt-1 mx-auto max-w-none w-full">
                                  Choose your bundle start date. Your Iris year follows your Iris Garden path automatically.
                                </span>
                              </span>
                            </Label>
                            <Input
                              type="date"
                              className={cn(
                                'h-10 mt-1.5 w-[11.75rem] max-w-full border-[rgba(160,80,220,0.22)] bg-white/75 mx-auto',
                                membershipCycleDatesLocked &&
                                  'cursor-not-allowed opacity-95 bg-violet-50/80 border-violet-200/90',
                              )}
                              value={desiredStart}
                              onChange={(e) => setDesiredStart(e.target.value)}
                              disabled={membershipCycleDatesLocked}
                              data-testid="annual-offer-start-date-hero"
                            />
                            {membershipCycleDatesLocked ? (
                              <p className="text-[10px] text-[rgba(80,45,130,0.72)] mt-1.5 leading-snug max-w-md mx-auto">
                                Start and bundle end are locked to your Sacred Exchange record after payment.
                              </p>
                            ) : null}
                          </div>
                          {preferredDom >= 1 && preferredDom <= 28 && !membershipCycleDatesLocked ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-10 border-violet-200/90 text-violet-900 bg-white/70 hover:bg-violet-50 shrink-0"
                              onClick={() => {
                                const ymd = nextDateWithDayOfMonth(null, preferredDom);
                                if (ymd) setDesiredStart(ymd);
                              }}
                            >
                              Next {preferredDom}
                              {preferredDom === 1 ? 'st' : preferredDom === 2 ? 'nd' : preferredDom === 3 ? 'rd' : 'th'} of month
                            </Button>
                          ) : null}
                        </div>
                        {cycleDisplayEnd ? (
                          <div className="rounded-xl border border-violet-200/60 bg-white/65 px-3 py-2.5 sm:px-4">
                            <p className="text-[12px] sm:text-[13px] font-bold uppercase tracking-[0.14em] text-[#3b0764] leading-snug text-center">
                              {irisYearLabelNoPeriod(autoRenewalYear).replace(/\s+/g, ' ').trim().toUpperCase()}
                            </p>
                            <dl className="mt-3 flex flex-wrap justify-center gap-x-10 gap-y-3 sm:gap-x-12 tabular-nums">
                              <div className="min-w-[7.5rem]">
                                <dt className="text-[9px] uppercase tracking-[0.12em] text-[rgba(100,55,155,0.42)] mb-1 font-semibold">
                                  New cycle start
                                </dt>
                                <dd className="text-center text-[13px] sm:text-sm font-bold uppercase tracking-[0.08em] text-[#3b0764]">
                                  {formatDateDdMonYyyy(cycleDisplayStart).toUpperCase()}
                                </dd>
                              </div>
                              <div className="min-w-[7.5rem]">
                                <dt className="text-[9px] uppercase tracking-[0.12em] text-[rgba(100,55,155,0.42)] mb-1 font-semibold">
                                  Bundle end ({durationMonths} mo)
                                </dt>
                                <dd className="text-center text-[13px] sm:text-sm font-bold uppercase tracking-[0.08em] text-[#3b0764]">
                                  {formatDateDdMonYyyy(cycleDisplayEnd).toUpperCase()}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[rgba(90,55,135,0.62)] max-w-none mx-auto">
                            Pick a start date to see bundle end (30th of the month before the anniversary) and the installment
                            schedule (due on the 27th).
                          </p>
                        )}
                        {!pinnedProgram ? (
                          <p className="text-[11px] text-amber-900/85 bg-amber-50/90 border border-amber-200/80 rounded-lg px-2.5 py-2 text-left sm:text-center">
                            Your host still needs to pin the Home Coming catalog program on Sacred Home — then checkout opens
                            here with your dates.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[rgba(100,55,155,0.48)] font-semibold">
                          Next renewal window
                        </p>
                        <p className="text-[12px] sm:text-[13px] text-[rgba(60,35,115,0.88)] leading-relaxed text-left sm:text-center max-w-xl mx-auto">
                          You are in the <span className="font-semibold text-[#3b0764]">current</span> Sacred Home annual
                          window (through{' '}
                          <span className="font-semibold tabular-nums">
                            {lapEndYmd ? formatDateDdMonYyyy(lapEndYmd) : '—'}
                          </span>
                          ). Member renewal flow typically opens in the{' '}
                          <span className="font-semibold">15 days before</span> that end date
                          {renewalWindowOpensYmd ? (
                            <>
                              {' '}
                              (around <span className="font-semibold tabular-nums">{formatDateDdMonYyyy(renewalWindowOpensYmd)}</span>{' '}
                              onward — same rule as your Sacred Home banner)
                            </>
                          ) : null}
                          .
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </div>
            <p className="mt-4 max-w-[min(40rem,100%)] md:max-w-[min(50rem,100%)] mx-auto text-[13px] sm:text-sm italic leading-relaxed font-[family-name:'Playfair_Display',Georgia,serif] text-[rgba(90,40,135,0.55)]">
              {HEART_QUOTE}
              <Heart className="inline-block ml-1.5 w-3 h-3 text-rose-400/70 align-middle" aria-hidden />
            </p>
          </div>

          <div className="flex flex-col gap-5 px-5 md:px-8 pb-7 md:pb-9 pt-2">
            {catalogBundle ? (
              <div
                className={cn(glassInset, 'relative text-center sm:text-left')}
                data-testid="home-coming-catalog-total"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-2 pr-0 sm:pr-1">
                  <div className="min-w-0 flex items-start gap-2 text-left">
                    <ShoppingCart size={18} className="text-[#5D3FD3] shrink-0 mt-1" aria-hidden />
                    <div className="min-w-0">
                      <h2
                        className="text-base sm:text-lg md:text-xl font-[family-name:'Cinzel',serif] font-bold text-[#3b0764] tracking-[0.12em] uppercase leading-tight"
                        data-testid="home-coming-annual-program-title"
                      >
                        Home Coming Annual Program
                      </h2>
                      <p className="text-[11px] text-[rgba(60,35,115,0.55)] mt-1.5 leading-snug tracking-normal font-normal">
                        {preferOnFilePackagePricing
                          ? `${catalogBundle.package_name || 'Home Coming'} · ${typeof catalogBundle.duration_months === 'number' ? `${catalogBundle.duration_months}-month bundle` : 'Annual bundle'} — your active cycle is on file; catalog totals are for future renewals.`
                          : (
                            <>
                              {catalogBundle.package_name || 'Home Coming'}
                              {typeof catalogBundle.duration_months === 'number'
                                ? ` · ${catalogBundle.duration_months}-month bundle`
                                : ''}
                              {' — '}totals from your Sacred Home catalog offer.
                            </>
                          )}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0 gap-2 border-[rgba(160,80,220,0.28)] bg-white/90 hover:bg-violet-50/90 text-slate-800 shadow-sm sm:mt-1 self-end sm:self-start"
                    onClick={() => navigate('/dashboard/combined-checkout')}
                  >
                    <CreditCard size={15} className="text-violet-700 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Divine cart</span>
                    {cartCount > 0 ? (
                      <span className="min-w-[1.15rem] h-5 px-1 rounded-full bg-violet-600 text-white text-[9px] font-bold tabular-nums flex items-center justify-center">
                        {cartCount}
                      </span>
                    ) : null}
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-[rgba(160,100,240,0.14)]">
                  <div className="min-w-0 space-y-3 lg:pr-8 lg:py-0.5">
                    {preferOnFilePackagePricing ? (
                      <div className="space-y-2 text-left">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[rgba(100,55,155,0.45)]">
                          Your package amount (on file)
                        </p>
                        <p className="text-left">
                          <span className="text-[2rem] sm:text-[2.35rem] font-bold text-[#1a0a3d] tabular-nums tracking-tight">
                            {symbol}
                            {Number(toDisplay(Number(fin.total_fee || 0))).toLocaleString()}
                          </span>{' '}
                          <span className="text-lg font-semibold text-[rgba(80,55,145,0.55)]">
                            {(sacredMoneyCurrency || 'AED')}
                          </span>
                        </p>
                        <p className="text-[11px] text-[rgba(60,35,115,0.65)] leading-snug">
                          This is the annual energy exchange recorded for your current Sacred Home cycle
                          {lastAnnualCycleDisplayName ? (
                            <>
                              {' '}
                              (<span className="font-medium">{lastAnnualCycleDisplayName}</span>)
                            </>
                          ) : null}
                          . Inclusions for this path are listed on the right.
                        </p>
                        {catalogAmountHub != null && catalogDisplayAmount != null ? (
                          <p className="text-[10px] text-[rgba(90,55,135,0.5)] leading-snug pt-1 border-t border-violet-100/80 mt-2">
                            <span className="font-semibold uppercase tracking-wide text-[9px] text-[rgba(100,55,155,0.4)]">
                              Catalog reference (new renewals)
                            </span>{' '}
                            — list offer {symbol}
                            {Number(
                              catalogCourtesyBreakdown
                                ? catalogCourtesyBreakdown.finalDisplay
                                : catalogDisplayAmount,
                            ).toLocaleString()}{' '}
                            {(baseCurrency || 'inr').toUpperCase()} (not a new balance for your active cycle).
                          </p>
                        ) : null}
                      </div>
                    ) : catalogAmountHub != null && catalogDisplayAmount != null ? (
                      <>
                        {catalogCourtesyBreakdown ? (
                          <>
                            <p className="text-[11px] text-left text-[rgba(60,35,115,0.5)]">
                              <span className="uppercase tracking-[0.12em] font-semibold text-[rgba(100,55,155,0.45)]">
                                Catalog price
                              </span>
                            </p>
                            <p className="text-left">
                              <span className="text-xl sm:text-2xl font-semibold text-[rgba(80,55,145,0.45)] tabular-nums line-through decoration-[rgba(120,80,160,0.35)]">
                                {symbol}
                                {Number(catalogCourtesyBreakdown.listDisplay).toLocaleString()}
                              </span>{' '}
                              <span className="text-sm font-medium text-[rgba(80,55,145,0.45)]">
                                {(baseCurrency || 'inr').toUpperCase()}
                              </span>
                            </p>
                            <div className="rounded-xl border border-[rgba(212,175,55,0.35)] bg-gradient-to-r from-[#fffbf0]/95 via-white/90 to-[#fdf6e3]/90 px-3.5 py-3 text-left shadow-sm shadow-amber-900/5">
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b6914] mb-1">
                                {catalogCourtesyBreakdown.ruleLabel}
                              </p>
                              <p className="text-[12px] text-[#5c4a12] leading-snug">
                                {catalogCourtesyBreakdown.pctLabel ? (
                                  <>
                                    <strong className="text-[#6b5210]">{catalogCourtesyBreakdown.pctLabel}</strong> off your
                                    catalog bundle
                                  </>
                                ) : catalogCourtesyBreakdown.isAmountBand ? (
                                  <>
                                    <strong className="text-[#6b5210] tabular-nums">
                                      {symbol}
                                      {Number(catalogCourtesyBreakdown.discountAmt).toLocaleString()}
                                    </strong>{' '}
                                    courtesy on this bundle
                                  </>
                                ) : (
                                  <>
                                    Courtesy savings:{' '}
                                    <strong className="text-[#6b5210] tabular-nums">
                                      {symbol}
                                      {Number(catalogCourtesyBreakdown.discountAmt).toLocaleString()}
                                    </strong>
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="pt-1">
                              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#3b0764]/80 mb-1 text-left">
                                Final price
                              </p>
                              <p className="text-left">
                                <span className="text-[2rem] sm:text-[2.35rem] font-bold text-[#1a0a3d] tabular-nums tracking-tight">
                                  {symbol}
                                  {Number(catalogCourtesyBreakdown.finalDisplay).toLocaleString()}
                                </span>{' '}
                                <span className="text-lg font-semibold text-[rgba(80,55,145,0.55)]">
                                  {(baseCurrency || 'inr').toUpperCase()}
                                </span>
                              </p>
                            </div>
                          </>
                        ) : (
                          <p className="mt-0 text-left">
                            <span className="text-[2rem] sm:text-[2.35rem] font-bold text-[#1a0a3d] tabular-nums tracking-tight">
                              {symbol}
                              {Number(catalogDisplayAmount).toLocaleString()}
                            </span>{' '}
                            <span className="text-lg font-semibold text-[rgba(80,55,145,0.55)]">
                              {(baseCurrency || 'inr').toUpperCase()}
                            </span>
                          </p>
                        )}
                      </>
                    ) : crmSubscriptionFeeMatchesHub && Number(fin.total_fee || 0) > 0 ? (
                      <div className="space-y-2 text-left">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[rgba(100,55,155,0.45)]">
                          Your annual exchange
                        </p>
                        <p className="text-left">
                          <span className="text-[2rem] sm:text-[2.35rem] font-bold text-[#1a0a3d] tabular-nums tracking-tight">
                            {symbol}
                            {Number(toDisplay(Number(fin.total_fee || 0))).toLocaleString()}
                          </span>{' '}
                          <span className="text-lg font-semibold text-[rgba(80,55,145,0.55)]">
                            {sacredMoneyCurrency || 'AED'}
                          </span>
                        </p>
                        <p className="text-[10px] text-[rgba(60,35,115,0.55)] leading-snug">
                          From <span className="font-semibold">Iris Annual Abundance</span> in your portal hub (
                          {(baseCurrency || 'inr').toUpperCase()}). For a public list price in this hub, your host can add{' '}
                          {(baseCurrency || 'aed').toUpperCase()} under <span className="font-semibold">Home Coming catalog</span>{' '}
                          → package offer.
                        </p>
                        {catalogAllPositiveEntries.length > 0 ? (
                          <div className="pt-2 mt-2 border-t border-violet-100/80 space-y-1">
                            <p className="text-[9px] uppercase tracking-wide text-[rgba(100,55,155,0.4)] font-semibold">
                              Catalog (other hubs)
                            </p>
                            {catalogAllPositiveEntries.map(([k, v]) => (
                              <p
                                key={String(k)}
                                className="text-[11px] font-semibold tabular-nums text-[rgba(60,35,115,0.75)]"
                              >
                                {String(k).toUpperCase()} {Number(v).toLocaleString()}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : catalogAllPositiveEntries.length > 0 ? (
                      <div className="space-y-1">
                        {catalogAllPositiveEntries.map(([k, v]) => (
                          <p
                            key={String(k)}
                            className="text-[1.35rem] sm:text-[1.5rem] font-bold text-[#1a0a3d] tabular-nums"
                          >
                            <span className="text-base font-semibold text-[rgba(80,55,145,0.55)] mr-1.5 inline-block">
                              {String(k).toUpperCase()}
                            </span>
                            {Number(v).toLocaleString()}
                          </p>
                        ))}
                        {catalogAmountHub == null ? (
                          <p className="text-[10px] text-[rgba(60,35,115,0.45)] mt-2 max-w-xl leading-relaxed">
                            No catalog amount published for your current pricing hub (
                            {(baseCurrency || 'inr').toUpperCase()}). Listed amounts above are entered in Admin.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-amber-900/90 bg-amber-50/95 border border-amber-200/80 rounded-xl px-3 py-2.5 leading-snug text-left">
                        Your host has not entered the catalog package offer total yet. They set it under{' '}
                        <strong>Admin → Home Coming catalog → Package offer</strong>
                        {' — '}then your total annual price will show here.
                      </p>
                    )}
                    {catalogOtherCurrencies.length > 0 && catalogAmountHub != null ? (
                      <p className="text-[10px] text-[rgba(60,35,115,0.48)] leading-relaxed text-left">
                        Other pricing hubs:{' '}
                        {catalogOtherCurrencies.map(([k, v], idx) => (
                          <span key={`${k}-${idx}`}>
                            {idx > 0 ? ' · ' : ''}
                            <span className="font-semibold tabular-nums">
                              {String(k).toUpperCase()} {Number(v).toLocaleString()}
                            </span>
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-0 lg:pl-8 lg:pr-8 lg:py-0.5 pt-6 lg:pt-0 border-t border-slate-200 lg:border-t-0 text-left">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm">
                    <p className="font-[family-name:'Playfair_Display',Georgia,serif] text-[12px] sm:text-[13px] leading-relaxed text-slate-700">
                      One gentle annual home for your soul — what is held in this bundle:
                    </p>
                    <ul className="mt-3 space-y-2.5 text-[11px] sm:text-[12px] font-extrabold uppercase tracking-[0.09em] text-slate-800 list-none pl-0 border-l-2 border-amber-200/80 pl-3">
                      {HOME_COMING_BUNDLE_INCLUDES_LINES.map((line) => (
                        <li key={line} className="leading-snug">
                          {line}
                        </li>
                      ))}
                    </ul>
                    {(catalogFrom || catalogTo) && (
                      <p className="text-[11px] mt-4 text-[#6b4420] bg-[rgba(255,251,235,0.85)] border border-[rgba(212,175,55,0.28)] rounded-xl px-3 py-2.5 text-left">
                        Offer window{catalogFrom ? ` from ${formatDateDdMonYyyy(catalogFrom)}` : ''}
                        {catalogTo ? ` · to ${formatDateDdMonYyyy(catalogTo)}` : ''} — when this catalog bundle may be purchased.
                      </p>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {!pinnedProgram ? (
              <div className={cn(glassInset, 'text-center py-10')}>
                <User className="mx-auto text-violet-300/90 mb-4" size={42} aria-hidden />
                <p className="font-[family-name:'Cinzel',serif] text-[#3b0764] font-semibold text-base tracking-wide">
                  The path is forming…
                </p>
                <p className="text-sm text-[rgba(60,35,115,0.55)] mt-2 max-w-md mx-auto leading-relaxed">
                  Your host can pin the Home Coming catalog program under Sacred Home settings, or go to{' '}
                  <Link to="/dashboard#sacred-home-programs" className="font-semibold text-[#7c3aed] hover:underline">
                    Upcoming programs
                  </Link>{' '}
                  from your overview.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {!catalogBundle ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-5 shadow-sm text-left">
                    <p className="font-[family-name:'Playfair_Display',Georgia,serif] text-[12px] sm:text-[13px] leading-relaxed text-slate-700">
                      One gentle annual home for your soul — what is held in this bundle:
                    </p>
                    <ul className="mt-3 space-y-2.5 text-[11px] sm:text-[12px] font-extrabold uppercase tracking-[0.09em] text-slate-800 list-none pl-0 border-l-2 border-amber-200/80 pl-3">
                      {HOME_COMING_BUNDLE_INCLUDES_LINES.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div className="space-y-2 min-w-0">
                    <Label className="text-[11px] uppercase tracking-[0.12em] text-[rgba(70,35,125,0.65)] font-semibold">
                      Payment structure (preference)
                    </Label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger
                        className="h-10 w-full max-w-none md:max-w-none border-[rgba(160,80,220,0.22)] bg-white/75 text-[13px] font-medium text-[rgba(50,35,95,0.92)] uppercase"
                        data-testid="annual-offer-payment-mode-select"
                      >
                        <SelectValue placeholder="CHOOSE HOW YOU WISH TO PAY" />
                      </SelectTrigger>
                      <SelectContent>
                        {visiblePayModes.map((m) => (
                          <SelectItem
                            key={m.value}
                            value={m.value}
                            className="text-[13px] uppercase"
                            data-testid={`annual-offer-mode-${m.value}`}
                          >
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label className="text-[11px] uppercase tracking-[0.12em] text-[rgba(70,35,125,0.65)] font-semibold">
                      Participation (annual path)
                    </Label>
                    <Select value={annualParticipationMode} onValueChange={setAnnualParticipationMode}>
                      <SelectTrigger
                        className="h-10 w-full max-w-none md:max-w-none border-[rgba(160,80,220,0.22)] bg-white/75 text-[13px] font-medium text-[rgba(50,35,95,0.92)] uppercase"
                        data-testid="annual-offer-participation-select"
                      >
                        <SelectValue placeholder="ONLINE OR OFFLINE" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online" className="text-[13px] uppercase" data-testid="annual-offer-participation-online">
                          ONLINE
                        </SelectItem>
                        <SelectItem value="offline" className="text-[13px] uppercase" data-testid="annual-offer-participation-offline">
                          OFFLINE
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  </div>
                  <p className="text-[10px] text-[rgba(60,35,115,0.48)] leading-relaxed">
                    Home Coming annual programs use online or offline participation only — there is no in-person seat type for this bundle.
                  </p>
                  <p className="text-[10px] text-[rgba(60,35,115,0.5)] flex items-start gap-1.5 leading-relaxed">
                    <Info size={12} className="shrink-0 mt-0.5 text-violet-500" aria-hidden />
                    We save your choices for your host. Pay in full, EMIs, or Flexi — all walk side by side below.
                  </p>
                </div>

                {needsAdminEmiBackfillHint ? (
                  <div
                    className="rounded-xl border border-sky-200/90 bg-sky-50/95 px-3 py-2.5 text-left text-[11px] text-sky-950 leading-relaxed"
                    data-testid="annual-offer-admin-emi-hint"
                  >
                    <span className="font-semibold">Paid before Sacred Exchange tracked it?</span> Your host can record that
                    in <span className="font-semibold">Admin → Iris Annual Abundance</span> (open your row → save fee / EMIs)
                    or under <span className="font-semibold">Subscribers</span>: set installment status to{' '}
                    <span className="font-semibold">paid</span>, add paid date / receipt if needed — refresh here and the
                    schedule below will mirror your garden record.
                  </div>
                ) : null}

                {pinnedProgram && paymentScheduleRows.length > 0 ? (
                  <div
                    className="rounded-2xl border border-[rgba(160,100,240,0.15)] bg-white/40 backdrop-blur-sm overflow-hidden"
                    data-testid="annual-offer-payment-schedule"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(80,55,145,0.55)] px-3 py-2.5 bg-[rgba(250,245,255,0.7)] border-b border-[rgba(160,100,240,0.08)]">
                      {scheduleTitle}
                    </p>
                    <div className="overflow-x-auto max-h-[min(28rem,70vh)] overflow-y-auto">
                      <table className="w-full min-w-[720px] table-fixed border-collapse text-center text-[10px]">
                        <colgroup>
                          <col style={{ width: '7%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '16%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '21%' }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-[rgba(252,250,255,0.95)] border-b border-[rgba(160,100,240,0.12)] text-[rgba(80,55,145,0.75)]">
                            <th className="font-bold uppercase tracking-wide px-1.5 py-2 align-bottom whitespace-nowrap">
                              Sr #
                            </th>
                            <th className="font-bold uppercase tracking-wide py-2 pl-1 pr-5 align-bottom whitespace-nowrap -translate-x-0.5">
                              Energy Exchange
                            </th>
                            <th className="font-bold uppercase tracking-wide py-2 pl-3 pr-1.5 align-bottom whitespace-nowrap">
                              Due date
                            </th>
                            <th className="font-bold uppercase tracking-wide px-1.5 py-2 align-bottom whitespace-nowrap">
                              Total amount
                            </th>
                            <th className="font-bold uppercase tracking-wide px-1.5 py-2 align-bottom whitespace-nowrap">
                              Pay here
                            </th>
                            <th className="font-bold uppercase tracking-wide px-1.5 py-2 align-bottom whitespace-nowrap">
                              Paid date
                            </th>
                            <th className="font-bold uppercase tracking-wide px-1.5 py-2 align-bottom whitespace-nowrap">
                              Receipt
                            </th>
                          </tr>
                        </thead>
                        <tbody className="text-[rgba(50,35,95,0.9)]">
                          {paymentScheduleRows.map((row) => {
                            const dueStr = row.dueDisplay ?? (row.due ? formatDateDdMonYyyy(row.due) : '—');
                            const hasNumericAmount =
                              row.amount != null && row.amountDisplay == null && !Number.isNaN(Number(row.amount));
                            const energyExchangeShown =
                              row.amountDisplay != null
                                ? row.amountDisplay
                                : hasNumericAmount
                                  ? `${symbol}${Number(toDisplay(row.amount)).toLocaleString()}`
                                  : '—';
                            const totalAmountShown =
                              hasNumericAmount
                                ? `${symbol}${Number(toDisplay(Number(row.amount))).toLocaleString()}`
                                : energyExchangeShown;
                            const emiRow =
                              typeof row.n === 'number' && !Number.isNaN(row.n)
                                ? emiByNumber.get(row.n)
                                : null;
                            let paidDateCell = '—';
                            if (emiRow && emiRow.status === 'paid') {
                              const rawPd = emiRow.paid_date || emiRow.date || '';
                              paidDateCell = rawPd
                                ? formatDateDdMonYyyy(String(rawPd).slice(0, 10)) || '—'
                                : 'Paid';
                            }
                            const payHereLabel = emiRow?.payment_method
                              ? formatSchedulePayTag(emiRow.payment_method)
                              : schedulePayTag;
                            const receiptHref =
                              emiRow?.receipt_url && String(emiRow.receipt_url).trim()
                                ? `${getApiUrl()}${emiRow.receipt_url}`
                                : null;
                            const payHereOpensEmiModal =
                              typeof row.n === 'number' &&
                              !Number.isNaN(row.n) &&
                              emiRow &&
                              emiRow.status !== 'paid' &&
                              emiRow.status !== 'submitted';
                            const onPayHereClick = () => {
                              if (payHereOpensEmiModal) {
                                navigate(`/dashboard/financials?payEmi=${row.n}`);
                                return;
                              }
                              goCheckout(row);
                            };
                            return (
                              <tr
                                key={row.key}
                                className="border-b border-[rgba(160,100,240,0.08)] last:border-b-0 align-top"
                              >
                                <td className="px-1.5 py-2.5 align-middle tabular-nums">
                                  <span className="font-bold text-[#3b0764]">{row.n}</span>
                                </td>
                                <td className="py-2.5 pl-1 pr-5 align-middle font-semibold tabular-nums break-words -translate-x-0.5">
                                  {energyExchangeShown}
                                </td>
                                <td className="py-2.5 pl-3 pr-1.5 align-middle break-words text-[9px] sm:text-[10px] font-medium">
                                  {dueStr}
                                </td>
                                <td className="px-1.5 py-2.5 align-middle font-semibold tabular-nums break-words">
                                  {totalAmountShown}
                                </td>
                                <td className="px-1.5 py-2.5 align-middle">
                                  {emiRow?.status === 'paid' ? (
                                    <span
                                      className="mx-auto inline-flex max-w-full min-w-0 items-center justify-center rounded-md bg-emerald-100/90 px-1.5 py-1 text-[8px] font-semibold uppercase leading-tight tracking-wide text-emerald-900"
                                      title="This installment is paid"
                                    >
                                      Paid · {payHereLabel}
                                    </span>
                                  ) : emiRow?.status === 'submitted' ? (
                                    <button
                                      type="button"
                                      onClick={() => navigate('/dashboard/financials')}
                                      className="mx-auto w-full max-w-full rounded-md border border-amber-200/90 bg-amber-50/90 px-1.5 py-1 text-[8px] font-semibold uppercase leading-tight tracking-wide text-amber-950 hover:bg-amber-100/90"
                                      title="Open Sacred Exchange to see proof status"
                                    >
                                      Pending review
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={onPayHereClick}
                                      className="mx-auto w-full max-w-full cursor-pointer rounded-md border border-violet-200/80 bg-violet-100/90 px-1.5 py-1 text-[8px] font-semibold uppercase leading-tight tracking-wide text-[#4c1d95] shadow-sm hover:bg-violet-200/70"
                                      title={
                                        payHereOpensEmiModal
                                          ? `Pay with ${payHereLabel} — opens checkout on Sacred Exchange`
                                          : 'Continue to checkout for your Home Coming bundle'
                                      }
                                    >
                                      Pay · {payHereLabel}
                                    </button>
                                  )}
                                </td>
                                <td className="px-1.5 py-2.5 align-middle break-words text-[9px] text-[rgba(80,55,145,0.75)] tabular-nums">
                                  {paidDateCell}
                                </td>
                                <td className="px-1.5 py-2.5 align-middle break-words">
                                  {receiptHref ? (
                                    <a
                                      href={receiptHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mx-auto inline-flex max-w-full min-w-0 items-center justify-center gap-1 break-words text-[9px] font-semibold text-[#6d28d9] hover:text-[#5b21b6] hover:underline"
                                    >
                                      <Paperclip size={12} className="shrink-0 opacity-80" aria-hidden />
                                      Receipt file
                                    </a>
                                  ) : emiRow?.status === 'paid' ? (
                                    <span className="text-[9px] text-[rgba(90,55,135,0.55)]">
                                      Receipt with host
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-[rgba(90,55,135,0.38)]">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {paymentScheduleNumericTotal > 0 ? (
                          <tfoot>
                            <tr className="bg-[rgba(244,240,255,0.95)] border-t-2 border-[rgba(160,100,240,0.22)] text-[#3b0764]">
                              <td colSpan={2} className="px-1.5 py-2.5 text-left text-[9px] font-bold uppercase tracking-wide">
                                ROW TOTAL
                                {paymentScheduleEmiRowCount > 0
                                  ? ` · ${paymentScheduleEmiRowCount} INSTALLMENT${paymentScheduleEmiRowCount !== 1 ? 'S' : ''}`
                                  : null}
                              </td>
                              <td className="py-2.5 text-[9px] text-[rgba(80,55,145,0.55)]">—</td>
                              <td className="px-1.5 py-2.5 text-[10px] font-bold tabular-nums">
                                {symbol}
                                {Number(toDisplay(paymentScheduleNumericTotal)).toLocaleString()}
                              </td>
                              <td colSpan={3} className="px-1.5 py-2.5 text-[9px] text-[rgba(80,55,145,0.65)] text-left font-semibold uppercase tracking-wide">
                                ILLUSTRATIVE TOTAL · MATCHES QUOTED BUNDLE
                              </td>
                            </tr>
                          </tfoot>
                        ) : null}
                      </table>
                    </div>
                    <p className="border-t border-[rgba(160,100,240,0.08)] bg-[rgba(250,245,255,0.4)] px-3 py-2 text-[9px] leading-snug text-[rgba(80,55,145,0.58)]">
                      First installment is due the <strong>month before</strong> your batch start on the <strong>27th</strong> (e.g. 27 Apr when the batch opens 3 May). Following rows stay on the 27th (or the last day in shorter months).
                    </p>
                  </div>
                ) : null}

                <div>
                  <Label className="text-[11px] uppercase tracking-[0.1em] text-[rgba(70,35,125,0.55)] font-semibold">Note for your host (optional)</Label>
                  <Input
                    value={emiNotes}
                    onChange={(e) => setEmiNotes(e.target.value.slice(0, 800))}
                    placeholder="e.g. align EMIs with salary date — anything your heart wishes your host to know"
                    className="h-10 mt-1.5 border-[rgba(160,80,220,0.22)] bg-white/70"
                    data-testid="annual-offer-emi-notes"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    type="button"
                    className="flex-1 h-11 bg-gradient-to-r from-violet-700 to-[#6d28d9] hover:from-violet-800 hover:to-violet-800 shadow-lg shadow-violet-900/20 text-[11px] font-bold uppercase tracking-wide"
                    disabled={!canContinueToCheckout}
                    onClick={goCheckout}
                    data-testid="annual-offer-checkout"
                  >
                    <ShoppingCart size={18} className="mr-2 shrink-0" />
                    CONTINUE TO DIVINE CART
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-11 border-[rgba(160,80,220,0.35)] bg-white/60 hover:bg-white/90 text-[11px] font-bold uppercase tracking-wide"
                    asChild
                  >
                    <Link to="/dashboard#sacred-home-programs">BROWSE ALL UPCOMING PROGRAMS</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
    <style>{`
      @keyframes fadeSlideUpHc {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
    </>
  );
}
