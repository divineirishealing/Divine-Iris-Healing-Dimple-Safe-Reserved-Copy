import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  ArrowRight,
  CreditCard,
  Calendar,
  Clock,
  Info,
  ShoppingCart,
  User,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { cn, formatDateDdMonYyyy, formatDashboardStatDate, nextDateWithDayOfMonth } from '../../lib/utils';
import { useToast } from '../../hooks/use-toast';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';
import { getAuthHeaders } from '../../lib/authHeaders';
import { pickTierIndexForDashboard } from './dashboardUpcomingHelpers';

const API = process.env.REACT_APP_BACKEND_URL;

/** Mirrors backend `_HOME_COMING_INCLUDES` shorts — subtitle for Divine Iris bundle. */
const DIVINE_IRIS_HOME_COMING_PROGRAMS_LABEL =
  'AWRP · MMM · Turbo Release · Meta Downloads';

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
  const { syncProgramLineItem } = useCart();
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
      <div className="flex items-center justify-center py-24" data-testid="annual-package-purchase-loading">
        <Clock className="animate-spin text-[#5D3FD3]" size={28} />
      </div>
    );
  }

  const showPaymentStatus = Number(fin.total_fee) > 0 || emis.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 px-4 py-6 pb-16" data-testid="annual-package-purchase-page">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="flex justify-center">
          <Package className="text-violet-700 opacity-90" size={28} aria-hidden />
        </div>
        <h1
          className="text-xl sm:text-2xl md:text-[1.65rem] font-bold text-gray-900 tracking-[0.14em] uppercase leading-tight px-2"
          style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          data-testid="divine-iris-home-coming-title"
        >
          Divine Iris Home Coming
        </h1>
        <p className="text-sm sm:text-[0.95rem] text-gray-600 font-medium leading-snug px-1" data-testid="divine-iris-home-coming-subtitle">
          {subtitleFourPrograms}
        </p>
        <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
          Choose how you would like to pay, anchor a start date for your membership, then continue to Divine Cart. Live EMI status and proof upload stay on{' '}
          <Link className="text-[#5D3FD3] font-semibold hover:underline" to="/dashboard/financials">
            Sacred Exchange (Financials)
          </Link>
          .
        </p>
      </div>

      {showPaymentStatus ? (
        <Card className="border-violet-200/80 bg-violet-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard size={18} className="text-violet-700" />
              Your payment status (on file)
            </CardTitle>
            <p className="text-[11px] text-gray-600 font-normal leading-snug">
              Amounts and due dates below come from your Client Garden record — same as Sacred Exchange.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                { label: 'Status', value: fin.status || '—', accent: 'text-gray-900' },
                { label: 'Total', value: `${fin.currency || ''} ${Number(fin.total_fee || 0).toLocaleString()}`, accent: 'text-gray-900' },
                { label: 'Remaining', value: `${fin.currency || ''} ${Number(fin.remaining ?? 0).toLocaleString()}`, accent: fin.remaining > 0 ? 'text-amber-700' : 'text-emerald-700' },
                { label: 'Next due', value: formatDashboardStatDate(fin.next_due), accent: 'text-amber-800' },
              ].map((row) => (
                <div key={row.label} className="rounded-xl border bg-white/90 p-3">
                  <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">{row.label}</p>
                  <p className={cn('text-sm font-bold mt-1', row.accent)}>{row.value}</p>
                </div>
              ))}
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto bg-[#5D3FD3] hover:bg-[#4c32b3]"
              onClick={() => navigate('/dashboard/financials')}
              data-testid="annual-offer-go-pay"
            >
              <CreditCard size={16} className="mr-2 shrink-0" />
              Pay next installment or upload proof
              <ArrowRight size={16} className="ml-2 shrink-0 opacity-80" />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!pinnedProgram ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <User className="mx-auto text-gray-300" size={40} />
            <p className="text-gray-700 font-medium">No catalog program is linked for Home Coming yet.</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Your host can pin the annual product under Site Settings → Sacred Home — Home Coming / Annual product, or you can join from{' '}
              <Link to="/dashboard#sacred-home-programs" className="text-violet-700 font-semibold hover:underline">
                Upcoming programs
              </Link>{' '}
              on your overview.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-100 shadow-sm">
          <CardHeader className="pb-2 text-center sm:text-left">
            <CardTitle className="text-base text-gray-800 font-semibold">
              {pinnedProgram.title || 'Catalog enrollment'}
            </CardTitle>
            <p className="text-[11px] text-gray-500 mt-1">Bundle reference — same program as pinned on Sacred Home.</p>
            {(catalogFrom || catalogTo) && (
              <p className="text-[11px] text-amber-900/90 bg-amber-50/90 border border-amber-100 rounded-lg px-3 py-2">
                Package offer window{catalogFrom ? ` · from ${formatDateDdMonYyyy(catalogFrom)}` : ''}
                {catalogTo ? ` · to ${formatDateDdMonYyyy(catalogTo)}` : ''} (when this catalog bundle is available to purchase).
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Calendar size={12} /> Preferred membership start
                </Label>
                <Input
                  type="date"
                  className="h-10 mt-1 w-[11.5rem]"
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
                  className="h-10 border-violet-200 text-violet-900 bg-violet-50/50"
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
              <Label className="text-xs">Payment structure (preference)</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PAY_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMode(m.value)}
                    className={cn(
                      'text-left rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors',
                      paymentMode === m.value
                        ? 'border-violet-400 bg-violet-50 text-violet-950'
                        : 'border-gray-200 bg-white hover:border-violet-200',
                    )}
                    data-testid={`annual-offer-mode-${m.value}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 flex items-start gap-1.5">
                <Info size={12} className="shrink-0 mt-0.5 text-violet-500" />
                We save this preference on your profile for your host. Final EMI timing and invoices are confirmed in Client Garden after enrollment; the table below is an estimate from your selected start date and quoted total.
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-3">
              <span className="block text-xs font-semibold text-gray-700 text-center sm:text-left">
                Quoted total (your tier &amp; hub)
              </span>
              {quoteLoading ? (
                <p className="text-sm text-gray-500">Fetching quote…</p>
              ) : (
                <>
                  <p className="text-center sm:text-left">
                    <span className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight" data-testid="annual-offer-quoted-amount">
                      {symbol}
                      {Number(displayTotal || 0).toLocaleString()}{' '}
                      <span className="text-base font-semibold text-gray-500">{quoteCur}</span>
                    </span>
                  </p>
                  {quote?.included_in_annual_package ? (
                    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-2.5 text-left">
                      <p className="text-sm text-emerald-900 leading-snug">
                        Your seat is covered by your prepaid annual package for this bundle. Add paid seats for family from{' '}
                        <Link to="/dashboard#sacred-home-programs" className="underline font-semibold">
                          Upcoming programs
                        </Link>
                        .
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500 text-center sm:text-left">
                      Amount matches Divine Cart / catalog pricing for this hub and tier.
                    </p>
                  )}
                </>
              )}
            </div>

            {paymentMode !== 'full' && totalRaw > 0 && emiPreview.length > 0 ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-2 bg-slate-50">
                  Illustrative schedule ({emiPreview.length} installments)
                </p>
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                  {emiPreview.map((row) => (
                    <div key={row.n} className="flex justify-between items-center px-3 py-2 text-xs">
                      <span className="text-gray-500 tabular-nums">#{row.n}</span>
                      <span className="text-gray-700">{formatDateDdMonYyyy(row.due)}</span>
                      <span className="font-semibold tabular-nums text-gray-900">
                        {symbol}
                        {Number(row.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <Label className="text-xs">Note for your host (optional)</Label>
              <Input
                value={emiNotes}
                onChange={(e) => setEmiNotes(e.target.value.slice(0, 800))}
                placeholder="e.g. align EMIs with salary date"
                className="h-10 mt-1"
                data-testid="annual-offer-emi-notes"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                className="flex-1 bg-violet-700 hover:bg-violet-800 h-11"
                disabled={!quote || quote.included_in_annual_package || totalRaw <= 0}
                onClick={goCheckout}
                data-testid="annual-offer-checkout"
              >
                <ShoppingCart size={18} className="mr-2 shrink-0" />
                Continue to Divine Cart
              </Button>
              <Button type="button" variant="outline" className="flex-1 h-11" asChild>
                <Link to="/dashboard#sacred-home-programs">Browse all upcoming programs</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
