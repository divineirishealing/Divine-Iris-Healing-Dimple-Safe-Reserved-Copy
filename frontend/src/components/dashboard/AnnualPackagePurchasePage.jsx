import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CreditCard,
  Calendar,
  Clock,
  Info,
  ShoppingCart,
  User,
  Heart,
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

const API = process.env.REACT_APP_BACKEND_URL;

/** Mirrors backend `_HOME_COMING_INCLUDES` shorts — subtitle for Divine Iris bundle. */
const DIVINE_IRIS_HOME_COMING_PROGRAMS_LABEL =
  'AWRP · MMM · Turbo Release · Meta Downloads';

const HEART_QUOTE = 'You are exactly where you need to be — trust the becoming.';

const PAY_MODES = [
  { value: 'full', label: 'Pay in full (checkout now)' },
  { value: 'emi_monthly', label: 'EMI — monthly' },
  { value: 'emi_quarterly', label: 'EMI — quarterly' },
  { value: 'emi_yearly', label: 'EMI — yearly' },
];

function emiInstallmentCount(mode, durationMonths) {
  const d = Math.max(1, Number(durationMonths) || 12);
  if (mode === 'emi_monthly') return d;
  if (mode === 'emi_quarterly') return Math.max(1, Math.ceil(d / 3));
  if (mode === 'emi_yearly') return Math.max(1, Math.ceil(d / 12));
  return 1;
}

function buildEmiPreview(mode, total, startYmd, durationMonths) {
  if (!total || total <= 0 || mode === 'full') return [];
  const n = emiInstallmentCount(mode, durationMonths);
  const each = Math.round((total / n) * 100) / 100;
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
      amount: each,
    });
  }
  return out;
}

/**
 * Dedicated Home Coming / annual bundle page: purchase options, illustrative EMI plan, and link to live payment status on Financials.
 */
export default function AnnualPackagePurchasePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { syncProgramLineItem, itemCount: cartCount } = useCart();
  const { baseCurrency, symbol, toDisplay } = useCurrency();
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
      .get(`${API}/api/student/home`, { withCredentials: true })
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
      ? hc.includes.map((i) => i.short).join(' · ')
      : DIVINE_IRIS_HOME_COMING_PROGRAMS_LABEL;

  useEffect(() => {
    if (!homeData || prefsInitDone.current) return;
    prefsInitDone.current = true;
    const p = homeData.annual_package_offer_prefs;
    if (p && typeof p === 'object') {
      if (p.desired_start_date) setDesiredStart(String(p.desired_start_date).slice(0, 10));
      if (p.payment_mode) setPaymentMode(String(p.payment_mode));
      if (p.emi_notes) setEmiNotes(String(p.emi_notes));
    } else if (preferredDom >= 1 && preferredDom <= 28) {
      const ymd = nextDateWithDayOfMonth(null, preferredDom);
      if (ymd) setDesiredStart(ymd);
    }
    setPrefsLoaded(true);
  }, [homeData, preferredDom]);

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
      .get(`${API}/api/student/dashboard-quote`, {
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
        `${API}/api/student/annual-package-offer-preferences`,
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
  const emiPreview = useMemo(
    () => buildEmiPreview(paymentMode, totalRaw, desiredStart, durationMonths),
    [paymentMode, totalRaw, desiredStart, durationMonths],
  );

  const goCheckout = () => {
    if (!pinnedProgram) return;
    const tierIdx = pickTierIndexForDashboard(pinnedProgram, true) ?? 0;
    syncProgramLineItem(pinnedProgram, tierIdx, null, { fromAnnualOfferPage: true });
    navigate('/dashboard/combined-checkout');
  };

  if (loading || !homeData) {
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
                  <div>
                    <Label className="text-[11px] flex items-center gap-1.5 text-[rgba(70,35,125,0.65)] uppercase tracking-[0.12em] font-semibold">
                      <Calendar size={12} className="opacity-70" aria-hidden /> Preferred membership start
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
                  <Label className="text-[11px] uppercase tracking-[0.12em] text-[rgba(70,35,125,0.65)] font-semibold">Payment structure (preference)</Label>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {PAY_MODES.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPaymentMode(m.value)}
                        className={cn(
                          'text-left rounded-2xl border px-3.5 py-3 text-[12px] font-medium transition-all duration-200',
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
                    We softly save your preference for your host. Final EMI timing is lovingly confirmed in Client Garden; the illustrative table below flows from today&apos;s quoted total.
                  </p>
                </div>

                <div className={cn(glassInset, 'space-y-3')}>
                  <span className="block text-xs font-semibold text-[rgba(55,35,115,0.75)] tracking-wide uppercase text-[10px]">
                    Quoted total (your tier &amp; hub)
                  </span>
                  {quoteLoading ? (
                    <p className="text-sm text-[rgba(60,35,115,0.45)] italic">Receiving your tier&apos;s whispered numbers…</p>
                  ) : (
                    <>
                      <p className="text-center sm:text-left">
                        <span className="text-3xl sm:text-[2rem] font-bold text-[#1a0a3d] tabular-nums tracking-tight drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]" data-testid="annual-offer-quoted-amount">
                          {symbol}
                          {Number(displayTotal || 0).toLocaleString()}{' '}
                          <span className="text-base font-semibold text-[rgba(80,55,145,0.45)]">{quoteCur}</span>
                        </span>
                      </p>
                      {quote?.included_in_annual_package ? (
                        <div className="rounded-xl border border-emerald-300/35 bg-emerald-50/80 px-3.5 py-3 text-left">
                          <p className="text-sm text-emerald-950/95 leading-snug font-medium">
                            Your seat rests inside your prepaid annual garden for this bundle. Invite paid seats for family from{' '}
                            <Link to="/dashboard#sacred-home-programs" className="underline decoration-emerald-600/50 font-semibold text-emerald-900">
                              Upcoming programs
                            </Link>
                            .
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-[rgba(60,35,115,0.52)] text-center sm:text-left">
                          Mirrors Divine Cart — catalog pricing for this hub &amp; tier.
                        </p>
                      )}
                    </>
                  )}
                </div>

                {paymentMode !== 'full' && totalRaw > 0 && emiPreview.length > 0 ? (
                  <div className="rounded-2xl border border-[rgba(160,100,240,0.15)] bg-white/40 backdrop-blur-sm overflow-hidden">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(80,55,145,0.55)] px-3 py-2.5 bg-[rgba(250,245,255,0.7)] border-b border-[rgba(160,100,240,0.08)]">
                      Gentle estimate · {emiPreview.length} installments
                    </p>
                    <div className="max-h-52 overflow-y-auto divide-y divide-[rgba(160,100,240,0.1)]">
                      {emiPreview.map((row) => (
                        <div key={row.n} className="flex justify-between items-center px-3 py-2 text-[11px] text-[rgba(50,35,95,0.88)]">
                          <span className="tabular-nums opacity-60">#{row.n}</span>
                          <span>{formatDateDdMonYyyy(row.due)}</span>
                          <span className="font-semibold tabular-nums">
                            {symbol}
                            {Number(row.amount).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
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
