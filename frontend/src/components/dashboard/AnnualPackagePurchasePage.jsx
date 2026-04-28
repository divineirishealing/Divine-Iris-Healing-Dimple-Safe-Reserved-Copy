import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CreditCard,
  Calendar,
  Clock,
  Info,
  Sparkles,
  TrendingUp,
  ShoppingCart,
  User,
  Heart,
  Paperclip,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { cn, formatDateDdMonYyyy, formatDashboardStatDate, nextDateWithDayOfMonth } from '../../lib/utils';
import { useToast } from '../../hooks/use-toast';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';
import { getAuthHeaders } from '../../lib/authHeaders';
import { pickTierIndexForDashboard } from './dashboardUpcomingHelpers';
import DashboardUpcomingProgramsIrisBloom from './DashboardUpcomingProgramsIrisBloom';
import { getApiUrl } from '../../lib/config';
import { irisYearLabelNoPeriod } from '../../lib/irisJourney';

/** Mirrors backend `_HOME_COMING_INCLUDES` shorts — subtitle for Divine Iris bundle. */
const DIVINE_IRIS_HOME_COMING_PROGRAMS_LABEL =
  'AWRP · MMM · Turbo Release · Meta Downloads';

const HEART_QUOTE = 'You are exactly where you need to be — trust the becoming.';

const ALL_PAY_MODES = [
  { value: 'full', label: 'PAY IN FULL (CHECKOUT NOW)' },
  { value: 'emi_monthly', label: 'EMI — MONTHLY' },
  { value: 'emi_quarterly', label: 'EMI — QUARTERLY' },
  { value: 'emi_yearly', label: 'EMI — YEARLY' },
  { value: 'emi_flexi', label: 'FLEXI — ANY AMOUNT, ANY TIME' },
];

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

function buildEmiPreview(mode, total, startYmd, durationMonths) {
  if (!total || total <= 0 || mode === 'full' || mode === 'emi_flexi') return [];
  const n = emiInstallmentCount(mode, durationMonths);
  const amounts = splitAmountsEqually(total, n);
  let base;
  if (startYmd && /^\d{4}-\d{2}-\d{2}$/.test(startYmd)) {
    base = new Date(`${startYmd}T12:00:00`);
  } else {
    base = new Date();
    base.setHours(12, 0, 0, 0);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const due = new Date(base);
    if (mode === 'emi_monthly') {
      due.setMonth(due.getMonth() + i);
    } else if (mode === 'emi_quarterly') {
      due.setMonth(due.getMonth() + i * 3);
    } else {
      due.setFullYear(due.getFullYear() + i);
    }
    out.push({
      n: i + 1,
      due: due.toISOString().slice(0, 10),
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
  const lateFeePerDay = Number(homeData?.late_fee_per_day ?? 0);
  const channelizationFee = Number(homeData?.channelization_fee ?? 0);
  const showLateFeesOnFile = homeData?.show_late_fees === true;
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
  const memberFirstName = useMemo(() => {
    const raw =
      typeof homeData?.user_details?.full_name === 'string'
        ? homeData.user_details.full_name.trim()
        : '';
    if (!raw) return '';
    return raw.split(/\s+/)[0];
  }, [homeData?.user_details?.full_name]);

  const userTier =
    typeof homeData?.user_details?.tier === 'string' ? homeData.user_details.tier.trim() : '';

  const visiblePayModes = useMemo(() => {
    const monthlyOk = homeData?.annual_package_offer_monthly_emi_visible !== false;
    return ALL_PAY_MODES.filter((m) => m.value !== 'emi_monthly' || monthlyOk);
  }, [homeData?.annual_package_offer_monthly_emi_visible]);

  const nextSacredYearStartsLabel = useMemo(() => {
    const ij = homeData?.iris_journey;
    const y = Math.min(12, Math.max(1, Number(ij?.year) || 1));
    if (y >= 12) {
      return `${irisYearLabelNoPeriod(12)} · sacred renewal window starts`;
    }
    return `${irisYearLabelNoPeriod(y + 1)} starts`;
  }, [homeData?.iris_journey]);

  /** Opening lines: Year 2+ mirrors “completed Year n−1 … with Year n …” (see iris_journey labels). */
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
  }, [homeData?.iris_journey, memberFirstName]);

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
          emi_notes: emiNotes,
        },
        { withCredentials: true },
      )
      .catch(() => {})
  }, [homeData?.client_id, desiredStart, paymentMode, emiNotes]);

  useEffect(() => {
    if (!prefsLoaded) return;
    if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current);
    prefsSaveTimer.current = setTimeout(() => {
      persistPrefs();
    }, 700);
    return () => {
      if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current);
    };
  }, [desiredStart, paymentMode, emiNotes, prefsLoaded, persistPrefs]);

  const totalRaw = Number(quote?.total ?? 0);
  const displayTotal = toDisplay(totalRaw);
  const quoteCur = (quote?.currency || baseCurrency || 'inr').toUpperCase();

  /** Basis for splitting the payment schedule: live quote when > 0, else Home Coming catalog (annual purchase / renewal). */
  const scheduleSplitTotal = useMemo(() => {
    if (totalRaw > 0) return totalRaw;
    if (catalogAmountHub != null && Number(catalogAmountHub) > 0) return Number(catalogAmountHub);
    for (const [, v] of catalogAllPositiveEntries) {
      const n = Number(v);
      if (!Number.isNaN(n) && n > 0) return n;
    }
    return 0;
  }, [totalRaw, catalogAmountHub, catalogAllPositiveEntries]);

  const paymentScheduleRows = useMemo(
    () => buildPaymentScheduleRows(paymentMode, scheduleSplitTotal, desiredStart, durationMonths),
    [paymentMode, scheduleSplitTotal, desiredStart, durationMonths],
  );

  /** Hero number under “Quoted total”: catalog renewal/purchase reference when checkout line is ₹0. */
  const displayQuotedHero = totalRaw > 0 ? displayTotal : toDisplay(scheduleSplitTotal);
  const heroIsCatalogRenewalRef = totalRaw <= 0 && scheduleSplitTotal > 0;

  const scheduleTitle = useMemo(() => {
    if (paymentMode === 'full') return 'Payment schedule · pay in full';
    if (paymentMode === 'emi_flexi') return 'Payment schedule · flexi';
    const n = paymentScheduleRows.length;
    return `Payment schedule · ${n} installment${n === 1 ? '' : 's'}`;
  }, [paymentMode, paymentScheduleRows.length]);

  const goCheckout = () => {
    if (pinnedProgram) {
      const tierIdx = pickTierIndexForDashboard(pinnedProgram, true) ?? 0;
      syncProgramLineItem(pinnedProgram, tierIdx, null, { fromAnnualOfferPage: true });
      navigate('/dashboard/combined-checkout');
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

  const showPaymentStatus = Number(fin.total_fee) > 0 || emis.length > 0;

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
            <p className="font-[family-name:'Cinzel',serif] text-[9px] uppercase tracking-[0.24em] text-[rgba(160,80,220,0.52)] mb-1">
              Sacred enrollment
            </p>
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
            <div
              className="mt-6 w-full max-w-2xl rounded-[22px] border border-[rgba(196,168,252,0.45)] bg-gradient-to-br from-[#faf8ff]/96 via-[#fffefd]/93 to-[#f5f0ff]/93 px-4 py-5 sm:px-6 sm:py-6 text-left shadow-[0_12px_48px_rgba(124,58,237,0.12)] backdrop-blur-sm"
              data-testid="home-coming-welcome-banner"
            >
              <div className="flex gap-3 sm:gap-4">
                <Sparkles className="h-9 w-9 shrink-0 text-[#a855f7] opacity-[0.92] mt-0.5 drop-shadow-[0_0_12px_rgba(168,85,247,0.35)]" aria-hidden />
                <div className="min-w-0 flex-1 space-y-4">
                  <p
                    className="font-[family-name:'Playfair_Display',Georgia,serif] text-[17px] sm:text-lg leading-relaxed text-[#2e1067]/92"
                    data-testid="home-coming-welcome-lead"
                  >
                    {irisWelcomeLeadEl}
                  </p>
                  {lap?.start_date || lap?.end_date ? (
                    <div className="rounded-2xl border border-white/80 bg-white/58 px-4 py-3.5 shadow-sm shadow-violet-200/40">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[rgba(100,55,155,0.42)] font-semibold mb-2">
                        Your annual package · on record
                      </p>
                      <p className="text-sm font-semibold text-[#3b0764]" data-testid="last-annual-package-label">
                        {lap.program_label || 'Annual program'}
                      </p>
                      <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-2 text-[13px] text-[rgba(60,35,115,0.88)] tabular-nums">
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.1em] text-[rgba(100,55,155,0.4)] mb-1">Start date</dt>
                          <dd>{lap.start_date ? formatDateDdMonYyyy(lap.start_date) : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.1em] text-[rgba(100,55,155,0.4)] mb-1">End date</dt>
                          <dd>{lap.end_date ? formatDateDdMonYyyy(lap.end_date) : '—'}</dd>
                        </div>
                      </dl>
                    </div>
                  ) : null}
                  <div className="flex gap-3">
                    <TrendingUp className="shrink-0 h-6 w-6 text-[#8b5cf6]/85 mt-0.5" aria-hidden />
                    <div className="space-y-2 text-[13px] leading-relaxed text-[rgba(60,35,115,0.82)]">
                      <p>
                        As your journey unfolds, Sacred pricing can ripen into <strong>higher tiers of value</strong>
                        — catalogue duration tiers deepen with continuity, renewals, and steadfast presence in your package path; preferential honours meet you{' '}
                        <em className="not-italic font-semibold text-[#5b21b6]">automatically</em> along the arc.
                      </p>
                      {userTier ? (
                        <p className="text-[12px] text-[rgba(90,55,155,0.68)]">
                          Sacred Home tier on your profile:&nbsp;
                          <span className="font-semibold italic text-[#5b21b6]">{userTier}</span>
                          {' — '}stay with the unfolding; deepening tiers blossom with devotion to the pathway.
                        </p>
                      ) : (
                        <p className="text-[12px] text-[rgba(90,55,155,0.62)] italic">
                          Stay wholehearted — tier-based Sacred offers widen as your commitment seasons with love.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 max-w-lg text-[13px] sm:text-sm italic leading-relaxed font-[family-name:'Playfair_Display',Georgia,serif] text-[rgba(90,40,135,0.55)]">
              {HEART_QUOTE}
              <Heart className="inline-block ml-1.5 w-3 h-3 text-rose-400/70 align-middle" aria-hidden />
            </p>
            <p className="mt-4 max-w-xl text-[11px] sm:text-[12px] text-[rgba(60,35,115,0.55)] leading-relaxed px-2">
              Choose how you wish to nourish this commitment — anchor a membership start date, choose full pay or EMI, then continue when you are ready. EMI status and proofs live on{' '}
              <Link className="font-semibold text-[#6d28d9] hover:text-[#5b21b6] underline underline-offset-2 decoration-violet-300/70" to="/dashboard/financials">
                Sacred Exchange
              </Link>
              .
            </p>
            <div className="mt-5 flex w-full flex-wrap justify-center gap-2 sm:justify-center">
              <Button
                type="button"
                variant="outline"
                className="h-10 px-4 border-[rgba(160,80,220,0.28)] bg-white/85 hover:bg-violet-50/90 text-slate-800 gap-2 shadow-sm"
                onClick={() => navigate('/dashboard/combined-checkout')}
              >
                <CreditCard size={16} className="text-violet-700 shrink-0" />
                <span className="text-xs font-semibold">Divine Cart</span>
                {cartCount > 0 ? (
                  <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-violet-600 text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                    {cartCount}
                  </span>
                ) : null}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-5 px-5 md:px-8 pb-7 md:pb-9 pt-2">
            {showPaymentStatus ? (
              <div className={glassInset}>
                <div className="flex items-start gap-2 mb-3">
                  <CreditCard size={17} className="text-[#7c3aed] shrink-0 mt-0.5" aria-hidden />
                  <div className="min-w-0 text-left">
                    <h2 className="text-[15px] font-[family-name:'Cinzel',serif] font-semibold text-[#3b0764] tracking-wide">
                      Your sacred exchange · on file
                    </h2>
                    <p className="text-[11px] text-[rgba(60,35,115,0.55)] mt-1 leading-snug">
                      Same heartfelt numbers as Financials — from your Client Garden record.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-3 text-center">
                  {[
                    { label: 'Status', value: fin.status || '—', accent: 'text-[#1e1b4b]' },
                    { label: 'Total', value: `${fin.currency || ''} ${Number(fin.total_fee || 0).toLocaleString()}`, accent: 'text-[#1e1b4b]' },
                    { label: 'Remaining', value: `${fin.currency || ''} ${Number(fin.remaining ?? 0).toLocaleString()}`, accent: fin.remaining > 0 ? 'text-amber-800' : 'text-emerald-800' },
                    { label: 'Next due', value: formatDashboardStatDate(fin.next_due), accent: 'text-amber-900' },
                  ].map((row) => (
                    <div key={row.label} className="rounded-xl border border-white/70 bg-white/55 px-2 py-2.5">
                      <p className="text-[8px] uppercase tracking-[0.14em] text-[rgba(100,55,155,0.45)] font-semibold">{row.label}</p>
                      <p className={cn('text-sm font-semibold mt-1 tabular-nums', row.accent)}>{row.value}</p>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  className="mt-4 w-full sm:w-auto bg-[#7c3aed] hover:bg-[#6d28d9] shadow-md shadow-violet-500/15"
                  onClick={() => navigate('/dashboard/financials')}
                  data-testid="annual-offer-go-pay"
                >
                  <CreditCard size={16} className="mr-2 shrink-0 opacity-95" />
                  Pay next installment or upload proof
                  <ArrowRight size={16} className="ml-2 shrink-0 opacity-90" />
                </Button>
              </div>
            ) : null}

            {catalogBundle ? (
              <div
                className={cn(glassInset, 'text-center sm:text-left')}
                data-testid="home-coming-catalog-total"
              >
                <div className="flex items-start gap-2 mb-2">
                  <ShoppingCart size={18} className="text-[#5D3FD3] shrink-0 mt-0.5" aria-hidden />
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-[family-name:'Cinzel',serif] font-semibold text-[#3b0764] tracking-wide">
                      Total annual program price (Home Coming catalog)
                    </h2>
                    <p className="text-[11px] text-[rgba(60,35,115,0.55)] mt-1 leading-snug">
                      {catalogBundle.package_name || 'Home Coming'}
                      {typeof catalogBundle.duration_months === 'number'
                        ? ` · ${catalogBundle.duration_months}-month bundle`
                        : ''}
                      {' — '}package offer totals from Admin (Sacred Home catalog enrollment uses the same row).
                    </p>
                  </div>
                </div>
                {catalogAmountHub != null && catalogDisplayAmount != null ? (
                  <p className="mt-3">
                    <span className="text-[2rem] sm:text-[2.35rem] font-bold text-[#1a0a3d] tabular-nums tracking-tight">
                      {symbol}
                      {Number(catalogDisplayAmount).toLocaleString()}
                    </span>{' '}
                    <span className="text-lg font-semibold text-[rgba(80,55,145,0.55)]">
                      {(baseCurrency || 'inr').toUpperCase()}
                    </span>
                  </p>
                ) : catalogAllPositiveEntries.length > 0 ? (
                  <div className="mt-3 space-y-1">
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
                  <p className="mt-3 text-sm text-amber-900/90 bg-amber-50/95 border border-amber-200/80 rounded-xl px-3 py-2.5 leading-snug">
                    Your host has not entered the catalog package offer total yet. They set it under{' '}
                    <strong>Admin → Home Coming catalog → Package offer</strong>
                    {' — '}then your total annual price will show here.
                  </p>
                )}
                {catalogOtherCurrencies.length > 0 && catalogAmountHub != null ? (
                  <p className="text-[10px] text-[rgba(60,35,115,0.48)] mt-3 leading-relaxed">
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
                <div className="text-center sm:text-left border-b border-[rgba(160,100,240,0.12)] pb-4 mb-2">
                  <h2 className="font-[family-name:'Playfair_Display',Georgia,serif] text-xl text-[#1a0a3d]/95 font-semibold tracking-tight">
                    {pinnedProgram.title || 'Catalog enrollment'}
                  </h2>
                  <p className="text-[11px] text-[rgba(60,35,115,0.5)] mt-1.5">
                    Bundle reference — aligned with what is pinned on Sacred Home · Upcoming programs
                  </p>
                  {(catalogFrom || catalogTo) && (
                    <p className="text-[11px] mt-4 text-[#6b4420] bg-[rgba(255,251,235,0.85)] border border-[rgba(212,175,55,0.28)] rounded-xl px-3 py-2.5 inline-block max-w-xl">
                      Offer window{catalogFrom ? ` from ${formatDateDdMonYyyy(catalogFrom)}` : ''}
                      {catalogTo ? ` · to ${formatDateDdMonYyyy(catalogTo)}` : ''} — when this catalog bundle may be purchased.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-0 max-w-full">
                    <Label className="text-[11px] flex items-start gap-2 text-[rgba(70,35,125,0.65)] uppercase tracking-[0.12em] font-semibold leading-snug">
                      <Calendar size={12} className="opacity-70 shrink-0 mt-0.5" aria-hidden />
                      <span>
                        <span className="block text-[10px] font-bold tracking-[0.14em] text-[rgba(100,55,155,0.45)]">Next sacred year · start date</span>
                        <span className="block normal-case tracking-normal text-[12px] font-semibold text-[#3b0764] mt-1 max-w-[22rem]">
                          {nextSacredYearStartsLabel}
                        </span>
                      </span>
                    </Label>
                    <Input
                      type="date"
                      className="h-10 mt-1.5 w-[11.75rem] border-[rgba(160,80,220,0.22)] bg-white/75"
                      value={desiredStart}
                      onChange={(e) => setDesiredStart(e.target.value)}
                      data-testid="annual-offer-start-date"
                    />
                  </div>
                  {preferredDom >= 1 && preferredDom <= 28 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 border-violet-200/90 text-violet-900 bg-white/70 hover:bg-violet-50"
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

                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.12em] text-[rgba(70,35,125,0.65)] font-semibold">
                    Payment structure (preference)
                  </Label>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {visiblePayModes.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPaymentMode(m.value)}
                        className={cn(
                          'text-left rounded-2xl border px-3.5 py-3 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide transition-all duration-200 leading-snug',
                          paymentMode === m.value
                            ? 'border-[rgba(124,58,237,0.55)] bg-gradient-to-br from-violet-100/90 to-[rgba(250,245,255,0.85)] shadow-[0_2px_12px_rgba(124,58,237,0.12)] text-[#3730a3]'
                            : 'border-[rgba(160,140,190,0.25)] bg-white/50 hover:bg-white/80 hover:border-violet-200/70 text-[rgba(50,35,95,0.85)]',
                        )}
                        data-testid={`annual-offer-mode-${m.value}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[rgba(60,35,115,0.5)] flex items-start gap-1.5 leading-relaxed mt-2">
                    <Info size={12} className="shrink-0 mt-0.5 text-violet-500" aria-hidden />
                    We softly save your preference for your host. Final timing is lovingly confirmed in Client Garden; the schedule below opens for every choice — fixed installments, pay in full, or Flexi (any amount, any time).
                  </p>
                </div>

                {pinnedProgram && paymentScheduleRows.length > 0 ? (
                  <div
                    className="rounded-2xl border border-[rgba(160,100,240,0.15)] bg-white/40 backdrop-blur-sm overflow-hidden"
                    data-testid="annual-offer-payment-schedule"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(80,55,145,0.55)] px-3 py-2.5 bg-[rgba(250,245,255,0.7)] border-b border-[rgba(160,100,240,0.08)]">
                      {scheduleTitle}
                    </p>
                    <div className="overflow-x-auto max-h-[min(28rem,70vh)] overflow-y-auto">
                      <table className="w-full min-w-[900px] table-fixed border-collapse text-center text-[10px]">
                        <colgroup>
                          <col style={{ width: '6%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '6%' }} />
                          <col style={{ width: '6%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '11%' }} />
                          <col style={{ width: '23%' }} />
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
                            <th className="font-bold uppercase tracking-wide px-0.5 py-2 align-bottom whitespace-nowrap">
                              Late fee
                            </th>
                            <th className="font-bold uppercase tracking-wide px-0.5 py-2 align-bottom whitespace-nowrap">
                              Ch. fee
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
                            const onTimeLate = '—';
                            const onTimeCh = '—';
                            const lateNum = 0;
                            const chNum = 0;
                            const totalAmountShown =
                              hasNumericAmount
                                ? `${symbol}${Number(toDisplay(Number(row.amount) + lateNum + chNum)).toLocaleString()}`
                                : energyExchangeShown;
                            const showRateHint =
                              showLateFeesOnFile && (lateFeePerDay > 0 || channelizationFee > 0);
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
                              goCheckout();
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
                                <td className="px-0.5 py-2.5 align-middle text-[9px] tabular-nums break-words">
                                  {onTimeLate}
                                  {showRateHint && lateFeePerDay > 0 ? (
                                    <span className="mt-0.5 block text-[8px] font-normal text-[rgba(100,55,155,0.45)] normal-case">
                                      if overdue: {symbol}
                                      {Number(toDisplay(lateFeePerDay)).toLocaleString()}/day
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-0.5 py-2.5 align-middle text-[9px] tabular-nums break-words">
                                  {onTimeCh}
                                  {showRateHint && channelizationFee > 0 ? (
                                    <span className="mt-0.5 block text-[8px] font-normal text-[rgba(100,55,155,0.45)] normal-case">
                                      if late: {symbol}
                                      {Number(toDisplay(channelizationFee)).toLocaleString()}
                                    </span>
                                  ) : null}
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
                      </table>
                    </div>
                    {showLateFeesOnFile && (lateFeePerDay > 0 || channelizationFee > 0) ? (
                      <p className="border-t border-[rgba(160,100,240,0.08)] bg-[rgba(250,245,255,0.4)] px-3 py-2 text-[9px] leading-snug text-[rgba(80,55,145,0.58)]">
                        Illustrative rows assume <strong>on-time</strong> pay — no late or channelization charges. Your
                        Client Garden rates apply if a kindness date is missed.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className={cn(glassInset, 'space-y-3')}>
                  <span className="block text-xs font-semibold text-[rgba(55,35,115,0.75)] tracking-wide uppercase text-[10px]">
                    {heroIsCatalogRenewalRef
                      ? 'Annual / renewal reference (catalog bundle)'
                      : 'Quoted total (your tier & hub)'}
                  </span>
                  {quoteLoading ? (
                    <p className="text-sm text-[rgba(60,35,115,0.45)] italic">Receiving your tier&apos;s whispered numbers…</p>
                  ) : (
                    <>
                      <p className="text-center sm:text-left">
                        <span className="text-3xl sm:text-[2rem] font-bold text-[#1a0a3d] tabular-nums tracking-tight drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]" data-testid="annual-offer-quoted-amount">
                          {symbol}
                          {Number(displayQuotedHero || 0).toLocaleString()}{' '}
                          <span className="text-base font-semibold text-[rgba(80,55,145,0.45)]">{quoteCur}</span>
                        </span>
                      </p>
                      {heroIsCatalogRenewalRef ? (
                        <p className="text-[11px] text-[rgba(60,35,115,0.72)] text-center sm:text-left leading-relaxed">
                          This is your <strong>Home Coming annual program</strong> figure for <strong>purchase or renewal</strong> on your pricing hub
                          (same row as the catalog card above). Checking out this pinned program may show ₹0 while your <em>current</em> seat already
                          covers it — the schedule still uses this bundle so you and your host can plan pay-in-full or EMIs for the{' '}
                          <strong>next Sacred Home cycle</strong>.
                        </p>
                      ) : null}
                      {quote?.included_in_annual_package ? (
                        <div className="rounded-xl border border-emerald-300/35 bg-emerald-50/80 px-3.5 py-3 text-left">
                          <p className="text-sm text-emerald-950/95 leading-snug font-medium">
                            {heroIsCatalogRenewalRef ? (
                              <>
                                Today&apos;s line item can read as included for <strong>this</strong> bundle while your annual garden is active.
                                For <strong>renewal or a new annual enrollment</strong>, align with the amount above, your payment-schedule preference,
                                and <Link to="/dashboard/financials" className="underline decoration-emerald-600/50 font-semibold text-emerald-900">
                                  Sacred Exchange
                                </Link>
                                . Family seats stay on{' '}
                                <Link to="/dashboard#sacred-home-programs" className="underline decoration-emerald-600/50 font-semibold text-emerald-900">
                                  Upcoming programs
                                </Link>
                                .
                              </>
                            ) : (
                              <>
                                Your seat rests inside your prepaid annual garden for this bundle. Invite paid seats for family from{' '}
                                <Link to="/dashboard#sacred-home-programs" className="underline decoration-emerald-600/50 font-semibold text-emerald-900">
                                  Upcoming programs
                                </Link>
                                .
                              </>
                            )}
                          </p>
                        </div>
                      ) : !heroIsCatalogRenewalRef ? (
                        <p className="text-[11px] text-[rgba(60,35,115,0.52)] text-center sm:text-left">
                          Mirrors Divine Cart — catalog pricing for this hub &amp; tier.
                        </p>
                      ) : null}
                    </>
                  )}
                </div>

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
                    className="flex-1 h-11 bg-gradient-to-r from-violet-700 to-[#6d28d9] hover:from-violet-800 hover:to-violet-800 shadow-lg shadow-violet-900/20"
                    disabled={!quote || quote.included_in_annual_package || totalRaw <= 0}
                    onClick={goCheckout}
                    data-testid="annual-offer-checkout"
                  >
                    <ShoppingCart size={18} className="mr-2 shrink-0" />
                    Continue to Divine Cart
                  </Button>
                  <Button type="button" variant="outline" className="flex-1 h-11 border-[rgba(160,80,220,0.35)] bg-white/60 hover:bg-white/90" asChild>
                    <Link to="/dashboard#sacred-home-programs">Browse all upcoming programs</Link>
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
