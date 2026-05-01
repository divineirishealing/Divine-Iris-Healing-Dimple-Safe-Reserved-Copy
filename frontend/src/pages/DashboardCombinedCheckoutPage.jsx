import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { computeIndiaCheckoutBreakdown, parseIndiaSitePercent } from '../lib/indiaClientPricing';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useCart, normalizeCartProgramTier } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { useToast } from '../hooks/use-toast';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Tag,
  CreditCard,
  Lock,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
  Gift,
  ExternalLink,
  ClipboardList,
  Trash2,
} from 'lucide-react';
import {
  sumCrossSellLineDiscount,
  normalizeCartItemTierIndex,
  crossSellSeatDiscountAmount,
} from '../lib/crossSellPricing';
import MotivationalSignupFlash from '../components/MotivationalSignupFlash';
import { ManualPaymentProofBody } from '../components/dashboard/ManualPaymentProofBody';
import { getAuthHeaders } from '../lib/authHeaders';
import { useAuth } from '../context/AuthContext';
import { readUpcomingDashboardSession } from '../lib/dashboardUpcomingSessionStorage';
import {
  buildAnnualDashboardCartParticipants,
  buildGuestBucketByIdFromSelection,
  mergeEnrollableGuestsForPortalCart,
  guestBucketLookupMembersFromHome,
  mergeGlobalSeatDraft,
  effectiveParticipantCountry,
  RECONCILE_CART_FROM_CHECKOUT_KEY,
  effectiveParticipantEmail,
} from '../lib/dashboardCartPrefill';
import { programIncludedInAnnualPackage } from '../components/dashboard/dashboardUpcomingHelpers';
import { formatDateDdMonYyyy } from '../lib/utils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PORTAL_CHECKOUT_PATH = '/dashboard/combined-checkout';

/** One GET /dashboard-quote per cart line: same program can appear twice (e.g. AWRP 1 mo vs 3 mo) with different tiers. */
function annualPortalQuoteMapKey(item) {
  if (!item || item.type !== 'program') return '';
  const pid = String(item.programId ?? '').trim();
  const ti = normalizeCartProgramTier(item, item.tierIndex);
  return `${pid}:${ti}`;
}

/**
 * Build GET /dashboard-quote query from live cart roster. `portalLineMeta.familyIds` / `bookerJoins`
 * can drift after merging carts (e.g. Home Coming EMI line + Sacred Home AWRP); wrong params yield
 * a failed quote or a booker-only quote — checkout then falls back to public tier prices (~₹38,999).
 */
function dashboardQuoteParamsFromCartItem(item) {
  const meta = item?.portalLineMeta || {};
  const parts = item?.participants || [];
  const hasBookerRow = parts.some((p) => String(p.relationship || '').trim() === 'Myself');
  const guestIdsFromRows = parts
    .filter((p) => String(p.relationship || '').trim() !== 'Myself')
    .map((p) => String(p.dashboard_family_member_id || '').trim())
    .filter(Boolean);
  const metaIds = (meta.familyIds || []).map(String).filter(Boolean);

  if (guestIdsFromRows.length === 0 && metaIds.length > 0) {
    return {
      familyIdsCsv: metaIds.join(','),
      bookerJoins: hasBookerRow || meta.bookerJoins !== false,
      orderedGuestIds: metaIds,
    };
  }

  const idSet = new Set(guestIdsFromRows);
  const metaSameSet =
    metaIds.length > 0 &&
    metaIds.length === guestIdsFromRows.length &&
    metaIds.every((id) => idSet.has(id));
  const orderedGuestIds = metaSameSet ? metaIds : guestIdsFromRows;
  return {
    familyIdsCsv: orderedGuestIds.join(','),
    bookerJoins: hasBookerRow,
    orderedGuestIds,
  };
}

function combinedAttendanceLabel(p) {
  if (p.attendance_mode === 'online') return 'Online (Zoom)';
  if (p.attendance_mode === 'in_person') return 'In person';
  return 'Offline / remote';
}

function combinedNotifyLabel(p) {
  /** Attendance column already says "Online (Zoom)" — keep notify as on/off only. */
  return p.notify ? 'On' : 'Off';
}

/** How many roster rows (non-booker) fall in each guest bucket — used when quote line counts are missing. */
function countRosterGuestsInBucket(participants, guestBucketById, bucket) {
  let c = 0;
  for (const p of participants || []) {
    if (String(p.relationship || '').trim() === 'Myself') continue;
    const id = String(p.dashboard_family_member_id || '').trim();
    const fromP = p.portal_guest_bucket;
    const b =
      id && guestBucketById && guestBucketById[id] === 'annual_household'
        ? 'annual_household'
        : id && guestBucketById && guestBucketById[id] === 'immediate'
          ? 'immediate'
          : fromP === 'immediate' || fromP === 'extended' || fromP === 'annual_household'
            ? fromP
            : 'extended';
    if (b === bucket) c += 1;
  }
  return c;
}

/** Base-currency amounts from GET /dashboard-quote; apply `toDisplay` like program card prices. */
function annualPortalSeatUnitBasePrices(quote, participant, guestBucketById, participants = []) {
  if (!quote) return null;
  const rel = String(participant.relationship || '').trim();
  if (rel === 'Myself') {
    if (!quote.include_self) return { offer: 0, list: 0 };
    return {
      offer: Number(quote.self_after_promos ?? 0),
      list: Number(quote.self_unit ?? 0),
    };
  }
  const id = String(participant.dashboard_family_member_id || '').trim();
  const fromP = participant.portal_guest_bucket;
  /** `guestBucketById` from dashboard sync wins over stale `portal_guest_bucket` on the row. */
  const bucket =
    id && guestBucketById && guestBucketById[id] === 'annual_household'
      ? 'annual_household'
      : id && guestBucketById && guestBucketById[id] === 'immediate'
        ? 'immediate'
        : fromP === 'immediate' || fromP === 'extended' || fromP === 'annual_household'
          ? fromP
          : 'extended';
  const roster = participants || [];
  if (bucket === 'annual_household') {
    if (participant.peer_included_in_annual_package) return { offer: 0, list: 0 };
    if (quote.included_in_annual_package) return { offer: 0, list: 0 };
    const nPayable = Number(quote.annual_household_peer_count ?? 0);
    if (nPayable <= 0) return { offer: 0, list: 0 };
    return {
      offer: Number(quote.annual_household_after_promos ?? 0) / nPayable,
      list: Number(quote.annual_household_line_gross ?? 0) / nPayable,
    };
  }
  if (bucket === 'immediate') {
    const nQuote = Number(quote.immediate_family_only_count ?? quote.immediate_family_count ?? 0);
    const nLine = countRosterGuestsInBucket(roster, guestBucketById, 'immediate');
    const n = nQuote > 0 ? nQuote : nLine;
    if (n <= 0) return { offer: 0, list: 0 };
    return {
      offer: Number(quote.immediate_family_only_after_promos ?? quote.immediate_family_after_promos ?? 0) / n,
      list: Number(quote.immediate_family_only_line_gross ?? quote.immediate_family_line_gross ?? 0) / n,
    };
  }
  const nQuote = Number(quote.extended_guest_count || 0);
  const nLine = countRosterGuestsInBucket(roster, guestBucketById, 'extended');
  const n = nQuote > 0 ? nQuote : nLine;
  if (n <= 0) return { offer: 0, list: 0 };
  return {
    offer: Number(quote.extended_guests_after_promos ?? 0) / n,
    list: Number(quote.extended_guest_line_gross ?? 0) / n,
  };
}

function resolvePortalGuestBucket(participant, guestBucketById) {
  if (String(participant.relationship || '').trim() === 'Myself') return 'self';
  const id = String(participant.dashboard_family_member_id || '').trim();
  const fromP = participant.portal_guest_bucket;
  if (id && guestBucketById && guestBucketById[id] === 'annual_household') return 'annual_household';
  if (id && guestBucketById && guestBucketById[id] === 'immediate') return 'immediate';
  if (fromP === 'immediate' || fromP === 'extended' || fromP === 'annual_household') return fromP;
  return 'extended';
}

/**
 * Cart lines often lose or stale `portalLineMeta.guestBucketById` (localStorage, older sync).
 * Quote counts + family id order match GET /dashboard-quote resolution — rebuild buckets when
 * meta is missing or wrongly marks guests as extended while the quote has no extended seats.
 */
function reconcileGuestBuckets(base, quote, participants, familyIds) {
  const map = { ...(base || {}) };
  if (!quote) return map;

  const guestRows = (participants || []).filter((p) => String(p.relationship || '').trim() !== 'Myself');
  const idsInOrder = [];
  const seen = new Set();
  for (const p of guestRows) {
    const id = String(p.dashboard_family_member_id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    idsInOrder.push(id);
  }
  if (!idsInOrder.length) return map;

  const ahSel = Number(quote.annual_household_peer_selected_count ?? quote.annual_household_peer_count ?? 0);
  const immSel = Number(quote.immediate_family_only_selected_count ?? quote.immediate_family_only_count ?? 0);
  const extSel = Number(quote.extended_guest_count || 0);
  if (ahSel + immSel + extSel !== idsInOrder.length) return map;

  const missing = idsInOrder.some((id) => !map[id]);
  const wrongExtended = extSel === 0 && idsInOrder.some((id) => map[id] === 'extended');
  if (!missing && !wrongExtended) return map;

  const order = (familyIds || []).map(String).filter(Boolean);
  const orderedIds = order.length
    ? [...new Set([...order.filter((id) => idsInOrder.includes(id)), ...idsInOrder])]
    : [...idsInOrder];

  let idx = 0;
  for (let i = 0; i < ahSel && idx < orderedIds.length; i++) {
    map[orderedIds[idx++]] = 'annual_household';
  }
  for (let i = 0; i < immSel && idx < orderedIds.length; i++) {
    map[orderedIds[idx++]] = 'immediate';
  }
  for (let i = 0; i < extSel && idx < orderedIds.length; i++) {
    map[orderedIds[idx++]] = 'extended';
  }
  return map;
}

function effectiveGuestBucketById(item, lineQuote) {
  const meta = item.portalLineMeta || {};
  const { orderedGuestIds } = dashboardQuoteParamsFromCartItem(item);
  const familyIdsForReconcile = orderedGuestIds.length > 0 ? orderedGuestIds : meta.familyIds || [];
  return reconcileGuestBuckets(meta.guestBucketById, lineQuote, item.participants || [], familyIdsForReconcile);
}

const PAYMENT_METHOD_BADGES = {
  stripe: { label: 'Stripe', className: 'bg-violet-100/90 text-violet-900 border-violet-200/80' },
  gpay: { label: 'GPay / UPI', className: 'bg-emerald-100/90 text-emerald-900 border-emerald-200/80' },
  bank: { label: 'Bank transfer', className: 'bg-slate-100/90 text-slate-800 border-slate-200/80' },
  /** Proof upload for cash at bank — India tag cash_deposit */
  cash_deposit: { label: 'Cash deposit', className: 'bg-amber-100/90 text-amber-950 border-amber-200/80' },
};

/** Client Garden / intake — human labels for the cart header (replaces technical subscription keys when set). */
const PREFERRED_PAYMENT_BADGES = {
  stripe: { label: 'Stripe', className: 'bg-violet-100/90 text-violet-900 border-violet-200/80' },
  gpay_upi: { label: 'GPay / UPI', className: 'bg-emerald-100/90 text-emerald-900 border-emerald-200/80' },
  bank_transfer: { label: 'Bank transfer', className: 'bg-slate-100/90 text-slate-800 border-slate-200/80' },
  cash_deposit: { label: 'Cash deposit', className: 'bg-amber-100/90 text-amber-950 border-amber-200/80' },
};

/** Pills matching the manual proof form paths (UPI vs bank transfer). */
function IndiaPaymentPathTags({ className = '' }) {
  return (
    <div
      className={`flex flex-wrap gap-1.5 ${className}`}
      data-testid="dashboard-india-path-tags"
    >
      <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-50/95 text-emerald-900 border-emerald-200/90">
        GPay / UPI
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-slate-100/95 text-slate-800 border-slate-200/90">
        Bank transfer
      </span>
    </div>
  );
}

/**
 * Client Garden tag (`india_payment_method`) → subscriber payment keys used on /student/home.
 * When set (not "any"), only these should show in the cart pills.
 */
function paymentMethodKeysFromIndiaTag(tagRaw) {
  const t = String(tagRaw || '').trim().toLowerCase();
  if (!t || t === 'any') return null;
  if (t === 'stripe') return ['stripe'];
  if (t === 'gpay_upi' || t === 'gpay' || t === 'upi') return ['gpay', 'manual'];
  if (t === 'bank_transfer' || t === 'bank') return ['bank', 'manual'];
  if (t === 'cash_deposit' || t === 'cash') return ['manual'];
  return null;
}

function displayMethodsForTag(homeMethods, indiaPaymentTag) {
  const fromHome = Array.isArray(homeMethods) && homeMethods.length
    ? homeMethods.map((x) => String(x).toLowerCase().trim())
    : ['stripe'];
  const canonical = paymentMethodKeysFromIndiaTag(indiaPaymentTag);
  if (!canonical) return { list: fromHome, tagged: false };
  const inter = canonical.filter((k) => fromHome.includes(k));
  const list = inter.length > 0 ? inter : canonical;
  return { list, tagged: true };
}

/**
 * Replace redundant `manual` with human rails: UPI path → gpay only; bank path → bank only;
 * lone manual → GPay/UPI, Bank transfer, or Cash deposit from Client Garden india_payment_method tag.
 */
function normalizeCartPaymentDisplay(list, indiaPaymentTag) {
  const low = (Array.isArray(list) && list.length ? [...list] : ['stripe']).map((x) =>
    String(x).toLowerCase().trim(),
  );
  const tag = String(indiaPaymentTag || '').trim().toLowerCase();
  const set = new Set(low);
  if (set.has('gpay') && set.has('manual')) set.delete('manual');
  if (set.has('bank') && set.has('manual')) set.delete('manual');
  if (set.size === 1 && set.has('manual')) {
    set.delete('manual');
    if (tag === 'bank_transfer' || tag === 'bank') set.add('bank');
    else if (tag === 'cash_deposit' || tag === 'cash') set.add('cash_deposit');
    else set.add('gpay');
  }
  return [...set];
}

function PaymentMethodTags({ methods, tagged, preferredPaymentMethod, indiaPaymentMethodTag }) {
  const prefRaw = String(preferredPaymentMethod || '').trim().toLowerCase();
  const prefKey = prefRaw === 'gpay' || prefRaw === 'upi' ? 'gpay_upi' : prefRaw;
  if (prefKey && PREFERRED_PAYMENT_BADGES[prefKey]) {
    const def = PREFERRED_PAYMENT_BADGES[prefKey];
    return (
      <div className="flex flex-wrap gap-2" data-testid="dashboard-combined-payment-tags">
        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 w-full">
          Your preferred payment method
        </span>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${def.className}`}>
          {def.label}
        </span>
      </div>
    );
  }

  const list = normalizeCartPaymentDisplay(methods, indiaPaymentMethodTag);
  const heading =
    !tagged
      ? 'Your enabled methods'
      : list.length > 1
        ? 'Your tagged payment methods'
        : 'Your tagged payment method';
  return (
    <div className="flex flex-wrap gap-2" data-testid="dashboard-combined-payment-tags">
      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 w-full">{heading}</span>
      {list.map((key, idx) => {
        const raw = String(key || '').toLowerCase().trim();
        const def = PAYMENT_METHOD_BADGES[raw] || {
          label: raw || '—',
          className: 'bg-white/80 text-slate-700 border-slate-200',
        };
        return (
          <span
            key={`${raw}-${idx}`}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${def.className}`}
          >
            {def.label}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Portal Divine Cart (combined checkout): same enrollment + Stripe / India / manual flows as main-site checkout,
 * Logged-in portal flow skips email OTP; uses membership payment_methods from /api/student/home.
 */
export default function DashboardCombinedCheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { items, clearCart, syncProgramLineItem, removeItem, updateItemParticipants } = useCart();
  const {
    country: detectedCountry,
    symbol,
    baseCurrency,
    displayCurrency,
    isPrimary,
    toDisplay,
  } = useCurrency();
  const { toast } = useToast();
  const currency = baseCurrency;

  const eidParam = searchParams.get('eid');
  const autoPayFlag = searchParams.get('autoPay');
  const [enrollmentId, setEnrollmentId] = useState(eidParam);
  const [promoCode, setPromoCode] = useState(() => searchParams.get('promo') || '');
  const [promoResult, setPromoResult] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({
    disclaimer: '',
    disclaimer_enabled: true,
    disclaimer_style: {},
    india_enabled: false,
    manual_form_enabled: true,
    india_exly_link: '',
    india_alt_discount_percent: undefined,
    india_gst_percent: undefined,
    india_platform_charge_percent: undefined,
  });
  /** null | 'manual' | 'exly' — keep India flows on this dashboard page (no public site routes). */
  const [portalPayMode, setPortalPayMode] = useState(null);
  const userClosedPortalPayRef = useRef(false);
  const [checkoutPromoVisible, setCheckoutPromoVisible] = useState(true);
  const [urgencyQuotes, setUrgencyQuotes] = useState([]);
  const [pointsSummary, setPointsSummary] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState(['stripe']);
  const [enrollmentSubmitLoading, setEnrollmentSubmitLoading] = useState(false);
  const autoPayEnrollKickedRef = useRef(false);
  const autoPayCheckoutKickedRef = useRef(false);
  const [portalSelf, setPortalSelf] = useState(null);
  /** Client Garden India fields — same basis as India payment page / manual proof. */
  const [clientIndiaPricing, setClientIndiaPricing] = useState(null);
  /** From Client Garden — drives Divine Cart payment pills when set (Stripe, GPay/UPI, bank, cash). */
  const [clientPreferredPaymentMethod, setClientPreferredPaymentMethod] = useState('');
  const [annualPortalSubtotal, setAnnualPortalSubtotal] = useState(null);
  const [annualQuotesByProgram, setAnnualQuotesByProgram] = useState({});
  const [crossSellRules, setCrossSellRules] = useState([]);
  /** Matches Sacred Home / GET student home — drives roster labels (Linked household vs Annual Family Club). */
  const [bookerAnnualPortalAccess, setBookerAnnualPortalAccess] = useState(false);
  const promoFromUrlApplied = useRef(false);
  /** When true, skip the "empty cart → back to dashboard" redirect (e.g. after pay redirect or intentional clear + orders). */
  const suppressEmptyCartRedirectRef = useRef(false);
  /** Bumps when returning to the tab on checkout so we re-read Sacred Home sessionStorage and realign the cart roster. */
  const [dashSessionNonce, setDashSessionNonce] = useState(0);
  useEffect(() => {
    if (location.pathname !== PORTAL_CHECKOUT_PATH) return undefined;
    const onVis = () => {
      if (document.visibilityState === 'visible') setDashSessionNonce((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      try {
        sessionStorage.setItem(RECONCILE_CART_FROM_CHECKOUT_KEY, String(Date.now()));
      } catch (_) {
        /* ignore */
      }
    };
  }, []);

  const sacredHomeSessionKey = useMemo(() => {
    const email = (user?.email || '').trim();
    if (!email) return '';
    const snap = readUpcomingDashboardSession(email);
    if (!snap) return 'none';
    try {
      return JSON.stringify({
        sel: snap.selectedFamilyByProgram,
        drafts: snap.seatDraftsByProgram,
        dt: snap.dashboardTierByProgram,
        bm: snap.bookerSeatMode,
        bn: snap.bookerSeatNotify,
        gf: snap.guestSeatForm,
      });
    } catch {
      return 'err';
    }
  }, [user?.email, location.key, dashSessionNonce]);

  useEffect(() => {
    if (eidParam && eidParam !== enrollmentId) setEnrollmentId(eidParam);
  }, [eidParam, enrollmentId]);

  /** Enrollment already paid or proof submitted: local cart is stale — clear and go to order history. */
  useEffect(() => {
    const eid = (enrollmentId || '').trim();
    if (!eid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/enrollment/${eid}`);
        if (cancelled) return;
        const st = String(res.data?.status || '').toLowerCase();
        if (st === 'completed' || st === 'india_payment_proof_submitted') {
          suppressEmptyCartRedirectRef.current = true;
          clearCart();
          setEnrollmentId(null);
          userClosedPortalPayRef.current = false;
          setPortalPayMode(null);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('eid');
            return next;
          }, { replace: true });
          toast({
            title: st === 'completed' ? 'This order is complete' : 'Proof already submitted',
            description:
              st === 'completed'
                ? 'Your Divine Cart was cleared. Open Order history to see the receipt and status.'
                : 'Your Divine Cart was cleared. Order history shows Pending approval until an admin approves.',
          });
          navigate('/dashboard/orders', { replace: true });
        }
      } catch {
        /* 404 or network */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enrollmentId, clearCart, navigate, setSearchParams, toast]);

  const {
    bookerName,
    bookerEmail,
    bookerCountry,
    bookerPhoneForPatch,
    bookerPhoneDisplay,
  } = useMemo(() => {
    const seat = items[0]?.participants?.[0] || {};
    const email = (user?.email || portalSelf?.email || '').trim();
    const name = (
      portalSelf?.name ||
      user?.name ||
      user?.full_name ||
      seat.name ||
      ''
    ).trim();
    const country = (
      portalSelf?.country ||
      seat.country ||
      detectedCountry ||
      'AE'
    ).trim() || 'AE';
    const rawProfilePhone = (portalSelf?.phone || '').trim().replace(/\s+/g, '');
    let patchPhone = '';
    let displayPhone = '';
    if (rawProfilePhone) {
      patchPhone = rawProfilePhone;
      displayPhone = rawProfilePhone;
    } else {
      const cc = String(seat.phone_code || '').trim();
      const loc = String(seat.phone || '').trim();
      if (loc) {
        patchPhone = `${cc}${loc}`;
        displayPhone = patchPhone;
      }
    }
    return {
      bookerName: name,
      bookerEmail: email,
      bookerCountry: country,
      bookerPhoneForPatch: patchPhone || null,
      bookerPhoneDisplay: displayPhone,
    };
  }, [user, portalSelf, items, detectedCountry]);

  useEffect(() => {
    if (!(user?.email || '').trim()) return;
    let cancelled = false;
    const headers = getAuthHeaders();
    Promise.all([
      axios.get(`${API}/student/home`, { withCredentials: true, headers }),
      axios.get(`${API}/student/enrollment-prefill`, { withCredentials: true, headers }),
    ])
      .then(([homeRes, prefillRes]) => {
        if (cancelled) return;
        const h = homeRes.data || {};
        const pm = h.payment_methods;
        if (Array.isArray(pm) && pm.length) setPaymentMethods(pm);
        setPortalSelf(prefillRes.data?.self || null);
        setClientIndiaPricing(h.client_india_pricing || null);
        setClientPreferredPaymentMethod(String(h.preferred_payment_method || '').trim());
        const ap =
          h.annual_portal_access != null
            ? !!h.annual_portal_access
            : !!(h.annual_member_dashboard || h.subscription_annual_package_signals);
        setBookerAnnualPortalAccess(ap);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  useEffect(() => {
    if (items.length > 0) return;
    if (suppressEmptyCartRedirectRef.current) {
      suppressEmptyCartRedirectRef.current = false;
      return;
    }
    toast({ title: 'Nothing to review', description: 'Add programs from your dashboard, then return here.' });
    navigate('/dashboard');
  }, [items.length, navigate, toast]);

  const portalCartLineKey = useMemo(
    () =>
      items
        .filter((i) => i.type === 'program')
        .map((i) => `${i.programId}:${i.tierIndex}`)
        .sort()
        .join('|'),
    [items],
  );

  const annualQuoteDeps = useMemo(
    () =>
      items
        .filter((i) => i.type === 'program')
        .map((i) => {
          const { orderedGuestIds, bookerJoins } = dashboardQuoteParamsFromCartItem(i);
          const ids = orderedGuestIds.slice().sort().join(':');
          const bj = bookerJoins ? '1' : '0';
          const ti = typeof i.tierIndex === 'number' ? String(i.tierIndex) : 'x';
          return `${i.programId}|${ti}|${ids}|${bj}`;
        })
        .sort()
        .join('||'),
    [items],
  );

  /** Align cart roster with Sacred Home session (who is selected + attendance), same logic for annual and non-annual. */
  useEffect(() => {
    const email = (user?.email || '').trim();
    if (!email || !portalCartLineKey || location.pathname !== PORTAL_CHECKOUT_PATH) return;
    if (enrollmentId || eidParam) return;
    if (autoPayFlag === '1' || autoPayFlag === 'stripe') return;

    let cancelled = false;
    (async () => {
      try {
        const [homeRes, preRes, settingsRes] = await Promise.all([
          axios.get(`${API}/student/home`, { withCredentials: true, headers: getAuthHeaders() }),
          axios.get(`${API}/student/enrollment-prefill`, { withCredentials: true, headers: getAuthHeaders() }),
          axios.get(`${API}/settings`),
        ]);
        if (cancelled) return;
        const home = homeRes.data || {};
        const pre = preRes.data || {};
        const self = pre.self;
        const isAnnualSubscriberHome = !!home.is_annual_subscriber;
        const annualIncludedIds = Array.isArray(settingsRes.data?.annual_package_included_program_ids)
          ? settingsRes.data.annual_package_included_program_ids
          : [];
        const upcoming = home.upcoming_programs || [];
        const annualAccess =
          home.annual_portal_access != null
            ? !!home.annual_portal_access
            : !!(home.annual_member_dashboard || home.subscription_annual_package_signals);
        setBookerAnnualPortalAccess(annualAccess);
        const enrollableGuests = mergeEnrollableGuestsForPortalCart(home);
        const bucketLookupMembers = guestBucketLookupMembersFromHome(home);
        const snap = readUpcomingDashboardSession(email);
        const selectedMap = snap?.selectedFamilyByProgram || {};
        const drafts = snap?.seatDraftsByProgram || {};

        for (const line of [...items]) {
          if (line.type !== 'program') continue;
          /** Home Coming / annual-offer quick pay: roster sync would see “included package, no guests selected” and remove the line. */
          if (line.portalLineMeta?.fromAnnualOfferPage) continue;
          const program = upcoming.find((p) => String(p.id) === String(line.programId));
          if (!program) continue;

          const sameProgramLines = items.filter(
            (i) => i.type === 'program' && String(i.programId) === String(line.programId),
          );
          const distinctTiers = new Set(
            sameProgramLines.map((i) => String(normalizeCartProgramTier(program, i.tierIndex))),
          );
          if (distinctTiers.size > 1) {
            continue;
          }

          const pillarAnnual = programIncludedInAnnualPackage(program, annualIncludedIds, true);
          const includedForSeat =
            (annualAccess || isAnnualSubscriberHome) && pillarAnnual;
          const sel = selectedMap[program.id] || selectedMap[String(program.id)] || [];
          const perDraft = drafts[program.id] || drafts[String(program.id)];
          const draft = mergeGlobalSeatDraft(
            perDraft,
            snap?.bookerSeatMode,
            snap?.bookerSeatNotify,
            snap?.guestSeatForm,
          );
          const participants = buildAnnualDashboardCartParticipants({
            program,
            includedPkg: !!includedForSeat,
            selectedMemberIds: sel,
            seatDraft: draft,
            enrollableGuests,
            self,
            bookerEmail: email,
            detectedCountry,
            immediateFamilyMembers: bucketLookupMembers,
            programInAnnualPackageList:
              annualAccess || isAnnualSubscriberHome
                ? pillarAnnual
                : programIncludedInAnnualPackage(program, annualIncludedIds, false),
          });
          if (participants && participants.length > 0) {
            const guestBucketById = buildGuestBucketByIdFromSelection(sel, bucketLookupMembers);
            syncProgramLineItem(program, line.tierIndex, participants, {
              familyIds: sel.map(String),
              bookerJoins: includedForSeat ? false : draft?.bookerJoinsProgram !== false,
              annualIncluded: !!includedForSeat,
              portalQuoteTotal: null,
              guestBucketById,
            });
          } else {
            removeItem(line.id);
          }
        }
      } catch {
        /* keep existing cart */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    user?.email,
    portalCartLineKey,
    sacredHomeSessionKey,
    location.pathname,
    enrollmentId,
    eidParam,
    autoPayFlag,
    detectedCountry,
    syncProgramLineItem,
    removeItem,
  ]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/settings`)
      .then((r) => {
        if (cancelled) return;
        const s = r.data;
        setPaymentSettings((prev) => ({
          ...prev,
          disclaimer: s.payment_disclaimer || '',
          disclaimer_enabled: s.payment_disclaimer_enabled !== false,
          disclaimer_style: s.payment_disclaimer_style || {},
          india_enabled: s.india_payment_enabled || false,
          manual_form_enabled: s.manual_form_enabled !== false,
          india_exly_link: (s.india_exly_link || '').trim(),
          india_alt_discount_percent: parseIndiaSitePercent(s, 'india_alt_discount_percent', 9),
          india_gst_percent: parseIndiaSitePercent(s, 'india_gst_percent', 18),
          india_platform_charge_percent: parseIndiaSitePercent(s, 'india_platform_charge_percent', 3),
        }));
        setUrgencyQuotes(s.enrollment_urgency_quotes || []);
        setCheckoutPromoVisible(s.checkout_promo_code_visible !== false);
      })
      .catch(() => {
        if (!cancelled) setCheckoutPromoVisible(true);
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/discounts/settings`)
      .then((r) => {
        if (cancelled) return;
        const raw = r.data?.cross_sell_rules;
        if (r.data?.enable_cross_sell && Array.isArray(raw) && raw.length) {
          setCrossSellRules(raw.filter((rule) => rule.enabled !== false));
        } else {
          setCrossSellRules([]);
        }
      })
      .catch(() => {
        if (!cancelled) setCrossSellRules([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const getItemPrice = (item) => {
    const tiers = item.durationTiers || [];
    const hasTiers = item.isFlagship && tiers.length > 0;
    const tier = hasTiers ? tiers[item.tierIndex] : null;
    const key = `price_${currency}`;
    const base = tier ? tier[key] || 0 : item[key] || 0;
    return toDisplay(base);
  };

  const getItemOfferPrice = (item) => {
    const tiers = item.durationTiers || [];
    const hasTiers = item.isFlagship && tiers.length > 0;
    const tier = hasTiers ? tiers[item.tierIndex] : null;
    let base = 0;
    if (tier) base = tier[`offer_price_${currency}`] || tier[`offer_${currency}`] || 0;
    else if (currency === 'aed') base = item.offer_price_aed || 0;
    else if (currency === 'inr') base = item.offer_price_inr || 0;
    else if (currency === 'usd') base = item.offer_price_usd || 0;
    return toDisplay(base);
  };

  /** When the portal quote is unavailable, match public site: tier offer if set, else list. Quotes include dashboard overlays only for Annual access. */
  const getEffectivePrice = (item) => {
    const offer = getItemOfferPrice(item);
    const list = getItemPrice(item);
    return offer > 0 ? offer : list;
  };

  /** Flagship cart line: human-readable tier for roster (distinguishes multiple lines for same program). */
  const cartItemTierLabel = (item) => {
    if (!item?.isFlagship) return '';
    const tiers = item.durationTiers || [];
    if (!tiers.length) return '';
    const fromItem = String(item.tierLabel || '').trim();
    if (fromItem) return fromItem;
    const idx =
      typeof item.tierIndex === 'number' && item.tierIndex >= 0 && item.tierIndex < tiers.length
        ? item.tierIndex
        : 0;
    const lab = tiers[idx]?.label;
    return lab ? String(lab).trim() : '';
  };

  useEffect(() => {
    if (!annualQuoteDeps) {
      setAnnualPortalSubtotal(null);
      setAnnualQuotesByProgram({});
      return;
    }
    const email = (user?.email || '').trim();
    if (!email) {
      setAnnualPortalSubtotal(null);
      setAnnualQuotesByProgram({});
      return;
    }
    let cancelled = false;
    const headers = getAuthHeaders();
    const programItems = items.filter((i) => i.type === 'program');
    if (!programItems.length) {
      setAnnualPortalSubtotal(null);
      setAnnualQuotesByProgram({});
      return;
    }
    Promise.all(
      programItems.map((i) => {
        const { familyIdsCsv, bookerJoins } = dashboardQuoteParamsFromCartItem(i);
        const quoteParams = {
          program_id: i.programId,
          currency,
          ...(familyIdsCsv ? { family_ids: familyIdsCsv } : { family_count: 0 }),
          booker_joins: bookerJoins,
        };
        if (i.isFlagship && (i.durationTiers || []).length > 0) {
          quoteParams.tier_index = normalizeCartProgramTier(i, i.tierIndex);
        }
        const mapKey = annualPortalQuoteMapKey(i);
        return axios
          .get(`${API}/student/dashboard-quote`, {
            params: quoteParams,
            withCredentials: true,
            headers,
          })
          .then((r) => ({ mapKey, data: r.data, total: Number(r.data?.total) }))
          .catch(() => ({ mapKey, data: null, total: null }));
      }),
    ).then((results) => {
      if (cancelled) return;
      const map = {};
      const totals = [];
      for (const row of results) {
        if (row.mapKey) map[row.mapKey] = row.data;
        totals.push(row.total);
      }
      setAnnualQuotesByProgram(map);
      if (totals.some((t) => t == null || Number.isNaN(t))) {
        setAnnualPortalSubtotal(null);
        return;
      }
      setAnnualPortalSubtotal(Math.round(totals.reduce((a, t) => a + t, 0) * 100) / 100);
    });
    return () => {
      cancelled = true;
    };
  }, [annualQuoteDeps, currency, user?.email]);

  const naiveSubtotal = items.reduce((sum, item) => sum + getEffectivePrice(item) * item.participants.length, 0);

  const programCartLines = useMemo(() => items.filter((i) => i.type === 'program'), [items]);
  const numPrograms = programCartLines.length;

  /** Same as CartPage: bundle discounts from rules + cart lines (API /discounts/calculate tier matching can miss). */
  const cartLinesNormalizedForCrossSell = useMemo(
    () =>
      programCartLines.map((i) => ({
        programId: i.programId,
        tierIndex: normalizeCartItemTierIndex(i),
      })),
    [programCartLines],
  );

  /**
   * Sum roster seat payables from portal quotes, with cross-sell embedded per seat (matches “At a glance” column).
   * When this is non-null, do not subtract bundle again in effectiveCrossSellDiscount.
   */
  const cartSubtotalFromRoster = useMemo(() => {
    let sum = 0;
    let allQuoted = true;
    for (const item of items) {
      const lineQuote = annualQuotesByProgram[annualPortalQuoteMapKey(item)];
      if (!lineQuote) {
        allQuoted = false;
        continue;
      }
      const guestBucketById = effectiveGuestBucketById(item, lineQuote);
      const participants = item.participants || [];
      const meta = item.portalLineMeta || {};
      for (const p of participants) {
        const selfIncluded =
          meta.annualIncluded && String(p.relationship || '').trim() === 'Myself';
        if (selfIncluded) continue;
        const portalBase = annualPortalSeatUnitBasePrices(lineQuote, p, guestBucketById, participants);
        if (!portalBase) {
          allQuoted = false;
          continue;
        }
        const unitOfferRaw = toDisplay(portalBase.offer);
        const unitListRaw = toDisplay(portalBase.list);
        const baseline = unitOfferRaw > 0 ? unitOfferRaw : unitListRaw;
        const xs =
          crossSellRules?.length && baseline > 0
            ? crossSellSeatDiscountAmount(
                crossSellRules,
                item,
                p,
                cartLinesNormalizedForCrossSell,
                programCartLines,
                unitOfferRaw,
                unitListRaw,
              )
            : 0;
        sum += Math.max(0, baseline - xs);
      }
    }
    if (!allQuoted || items.length === 0) return null;
    return Math.round(sum * 100) / 100;
  }, [
    items,
    annualQuotesByProgram,
    toDisplay,
    crossSellRules,
    programCartLines,
    cartLinesNormalizedForCrossSell,
  ]);

  const subtotal =
    cartSubtotalFromRoster != null
      ? cartSubtotalFromRoster
      : annualPortalSubtotal != null
        ? annualPortalSubtotal
        : naiveSubtotal;
  const totalParticipants = items.reduce((sum, i) => sum + i.participants.length, 0);
  /** Default true until /api/settings resolves; false only when admin explicitly hides the field. */
  const showCheckoutPromo = checkoutPromoVisible !== false;
  const portalRosterSubtotalActive = cartSubtotalFromRoster != null;

  const { clientCrossSellTotal, clientCrossSellRows } = useMemo(() => {
    if (!crossSellRules.length || !programCartLines.length) {
      return { clientCrossSellTotal: 0, clientCrossSellRows: [] };
    }
    const offerListForParticipant = (item, p) => {
      const meta = item.portalLineMeta || {};
      const selfIncluded =
        meta.annualIncluded && String(p.relationship || '').trim() === 'Myself';
      if (selfIncluded) return { offer: 0, list: 0 };
      const lineQuote = annualQuotesByProgram[annualPortalQuoteMapKey(item)] || null;
      const guestBucketById = lineQuote ? effectiveGuestBucketById(item, lineQuote) : meta.guestBucketById || {};
      const portalBase = lineQuote
        ? annualPortalSeatUnitBasePrices(lineQuote, p, guestBucketById, item.participants || [])
        : null;
      const fallbackOffer = getItemOfferPrice(item);
      const unitOfferRaw = portalBase
        ? toDisplay(portalBase.offer)
        : fallbackOffer > 0
          ? fallbackOffer
          : getItemPrice(item);
      const unitListRaw = portalBase ? toDisplay(portalBase.list) : getItemPrice(item);
      return { offer: unitOfferRaw, list: unitListRaw };
    };
    let total = 0;
    const rows = [];
    for (const item of programCartLines) {
      const summ = sumCrossSellLineDiscount(
        crossSellRules,
        item,
        cartLinesNormalizedForCrossSell,
        programCartLines,
        offerListForParticipant,
      );
      if (summ.total > 0) {
        total += summ.total;
        rows.push({ label: summ.label, amount: summ.total, title: item.programTitle });
      }
    }
    return { clientCrossSellTotal: Math.round(total * 100) / 100, clientCrossSellRows: rows };
  }, [crossSellRules, programCartLines, cartLinesNormalizedForCrossSell, annualQuotesByProgram, currency, toDisplay]);

  /** Sum of list vs offer unit prices per paying seat (matches roster columns) for “list – offer” savings line. */
  const seatListOfferRollup = useMemo(() => {
    let listTotal = 0;
    let offerTotal = 0;
    for (const item of items) {
      for (const p of item.participants || []) {
        const meta = item.portalLineMeta || {};
        const selfIncluded =
          meta.annualIncluded && String(p.relationship || '').trim() === 'Myself';
        if (selfIncluded) continue;
        const lineQuote = annualQuotesByProgram[annualPortalQuoteMapKey(item)] || null;
        const guestBucketById = lineQuote ? effectiveGuestBucketById(item, lineQuote) : meta.guestBucketById || {};
        const portalBase = lineQuote
          ? annualPortalSeatUnitBasePrices(lineQuote, p, guestBucketById, item.participants || [])
          : null;
        const fallbackOffer = getItemOfferPrice(item);
        const unitOfferRaw = portalBase
          ? toDisplay(portalBase.offer)
          : fallbackOffer > 0
            ? fallbackOffer
            : getItemPrice(item);
        const unitListRaw = portalBase
          ? toDisplay(portalBase.list)
          : getItemPrice(item);
        const baseline = unitOfferRaw > 0 ? unitOfferRaw : unitListRaw;
        const listPart =
          unitOfferRaw > 0 && unitListRaw > unitOfferRaw ? unitListRaw : baseline;
        const xs =
          crossSellRules?.length && baseline > 0
            ? crossSellSeatDiscountAmount(
                crossSellRules,
                item,
                p,
                cartLinesNormalizedForCrossSell,
                programCartLines,
                unitOfferRaw,
                unitListRaw,
              )
            : 0;
        listTotal += listPart;
        offerTotal += Math.max(0, baseline - xs);
      }
    }
    return {
      listTotal: Math.round(listTotal * 100) / 100,
      offerTotal: Math.round(offerTotal * 100) / 100,
    };
  }, [
    items,
    annualQuotesByProgram,
    currency,
    toDisplay,
    crossSellRules,
    programCartLines,
    cartLinesNormalizedForCrossSell,
  ]);

  /** List − offer on roster seats; shown as its own discount row and included in “Total discounts”. */
  const portalListOfferSavings = useMemo(() => {
    const raw = seatListOfferRollup.listTotal - seatListOfferRollup.offerTotal;
    return raw > 0 ? Math.round(raw * 100) / 100 : 0;
  }, [seatListOfferRollup.listTotal, seatListOfferRollup.offerTotal]);

  const cartProgramIdsForUrgency = useMemo(
    () =>
      [...new Set(items.filter((i) => i.type !== 'session').map((i) => String(i.programId).trim()).filter(Boolean))],
    [items],
  );

  const [autoDiscounts, setAutoDiscounts] = useState({
    group_discount: 0,
    combo_discount: 0,
    loyalty_discount: 0,
    cross_sell_discount: 0,
    cross_sell_details: [],
    total_discount: 0,
  });

  useEffect(() => {
    if (subtotal <= 0) return;
    const fetchDiscounts = async () => {
      try {
        const res = await axios.post(`${API}/discounts/calculate`, {
          num_programs: numPrograms,
          num_participants: totalParticipants,
          subtotal,
          email: bookerEmail,
          currency,
          program_ids: programCartLines.map((i) => i.programId),
          cart_items: programCartLines.map((i) => ({
            program_id: i.programId,
            tier_index:
              i.tierIndex != null && i.tierIndex !== ''
                ? i.tierIndex
                : i.isFlagship && (i.durationTiers || []).length
                  ? 0
                  : 0,
          })),
        });
        setAutoDiscounts(res.data);
      } catch {
        setAutoDiscounts({
          group_discount: 0,
          combo_discount: 0,
          loyalty_discount: 0,
          cross_sell_discount: 0,
          cross_sell_details: [],
          total_discount: 0,
        });
      }
    };
    fetchDiscounts();
  }, [subtotal, totalParticipants, numPrograms, bookerEmail, currency, items, programCartLines]);

  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await axios.post(`${API}/promotions/validate`, {
        code: promoCode.trim(),
        program_id: items[0]?.programId,
        currency,
        cart_items: items
          .filter((i) => i.programId)
          .map((i) => ({
            program_id: i.programId,
            tier_index: i.tierIndex ?? 0,
            participants_count: Math.max(1, i.participants?.length || 1),
          })),
        participant_count: totalParticipants,
      });
      setPromoResult(res.data);
      toast({ title: res.data.message });
    } catch {
      setPromoResult(null);
      toast({ title: 'Invalid Code', variant: 'destructive' });
    } finally {
      setPromoLoading(false);
    }
  };

  const discount = (() => {
    if (!promoResult) return 0;
    if (promoResult.discount_type === 'percentage') {
      const raw = (subtotal * (promoResult.discount_percentage || 0)) / 100;
      return Math.round(raw * 100) / 100;
    }
    return promoResult[`discount_${currency}`] || promoResult.discount_aed || 0;
  })();
  /**
   * Cross-sell: use the larger of client (portal unit prices + rules) and API (DB tier prices).
   * API-only missed bundles when tier/quote paths differ; client-only drifted from Stripe — checkout sends client_declared_payable.
   */
  const apiCrossSellDiscount = Number(autoDiscounts.cross_sell_discount) || 0;
  const clientXs = Math.round((clientCrossSellTotal || 0) * 100) / 100;
  const effectiveCrossSellDiscount = portalRosterSubtotalActive
    ? 0
    : Math.max(clientXs, apiCrossSellDiscount);
  const stackAutoDiscount =
    (autoDiscounts.group_discount || 0) +
    (autoDiscounts.combo_discount || 0) +
    (autoDiscounts.loyalty_discount || 0);
  const totalAutoDiscount = stackAutoDiscount + effectiveCrossSellDiscount;
  const totalDiscountAmount = totalAutoDiscount + discount;
  const total = Math.max(0, subtotal - discount - effectiveCrossSellDiscount - stackAutoDiscount);

  /** Home Coming pay-from-schedule: catalog/renewal amount while roster still shows annual-included ₹0. */
  const homeComingQuotedRenewalTotal = useMemo(() => {
    let max = 0;
    for (const i of items) {
      const raw = i.portalLineMeta?.homeComingQuotedTotal;
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw || ''), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return max;
  }, [items]);

  const homeComingQuotedDisplay =
    homeComingQuotedRenewalTotal > 0
      ? Math.round(toDisplay(homeComingQuotedRenewalTotal) * 100) / 100
      : 0;

  /** True when paying a Home Coming catalog / EMI slice (`homeComingQuotedTotal`), not line-item tier totals. */
  const hasHomeComingCatalogPay = items.some(
    (i) => i.portalLineMeta?.fromAnnualOfferPage && homeComingQuotedDisplay > 0,
  );

  /**
   * Home Coming page already bakes CRM courtesy % into the quoted installment / catalog total — do not
   * run Client Garden India discount again on checkout (would double-apply).
   */
  const clientIndiaPricingForCheckout = useMemo(() => {
    if (!hasHomeComingCatalogPay) return clientIndiaPricing;
    if (!clientIndiaPricing) return null;
    return {
      ...clientIndiaPricing,
      india_discount_percent: 0,
      india_discount_member_bands: null,
    };
  }, [clientIndiaPricing, hasHomeComingCatalogPay]);

  /**
   * Home Coming: roster subtotal omits the prepaid seat (`annualIncluded`), so `total` excludes that program.
   * Add the quoted installment (or full-pay slice) explicitly — do not Math.max with dashboard-quote bundle totals.
   */
  const totalForPayment = hasHomeComingCatalogPay
    ? Math.max(0, Math.round((total + homeComingQuotedDisplay) * 100) / 100)
    : Math.max(0, total);

  /** Home Coming package page: EMI vs full — show schedule hint on checkout. */
  const homeComingAnnualOfferPlan = useMemo(() => {
    for (const i of items) {
      const m = i.portalLineMeta;
      if (
        m?.fromAnnualOfferPage &&
        m?.annualOfferPaymentMode &&
        m.annualOfferPaymentMode !== 'full' &&
        m.annualOfferPaymentMode !== 'emi_flexi'
      ) {
        const payNRaw = m.homeComingPayInstallmentN;
        const payInstallmentN =
          typeof payNRaw === 'number' && !Number.isNaN(payNRaw) && payNRaw >= 1
            ? Math.floor(payNRaw)
            : 1;
        const preview = Array.isArray(m.annualOfferSchedulePreview) ? m.annualOfferSchedulePreview : [];
        const instRow =
          preview.find((r) => Number(r?.n) === payInstallmentN) ?? preview[payInstallmentN - 1] ?? null;
        const dueRaw = instRow?.due != null ? String(instRow.due).slice(0, 10) : '';
        const currentEmiDueLabel = dueRaw ? formatDateDdMonYyyy(dueRaw) || dueRaw : null;
        let currentEmiMonthYear = null;
        if (currentEmiDueLabel) {
          const parts = currentEmiDueLabel.split('-');
          if (parts.length === 3) currentEmiMonthYear = `${parts[1]} ${parts[2]}`;
        }
        return {
          mode: m.annualOfferPaymentMode,
          preview,
          payInstallmentN,
          currentEmiDueLabel,
          currentEmiMonthYear,
        };
      }
    }
    return null;
  }, [items]);

  const showHomeComingOfferBackLink = useMemo(
    () => items.some((i) => i.portalLineMeta?.fromAnnualOfferPage),
    [items],
  );

  const crossSellDisplayRows = useMemo(() => {
    if (portalRosterSubtotalActive) return [];
    if (clientXs >= apiCrossSellDiscount && clientCrossSellRows.length > 0) {
      return clientCrossSellRows.filter((r) => Number(r.amount) > 0);
    }
    const det = autoDiscounts.cross_sell_details;
    if (Array.isArray(det) && det.length > 0) {
      return det
        .map((d) => ({
          label: d.rule || d.code || 'Bundle',
          amount: Number(d.amount) || 0,
          title: '',
        }))
        .filter((r) => r.amount > 0);
    }
    return clientCrossSellRows.filter((r) => Number(r.amount) > 0);
  }, [
    apiCrossSellDiscount,
    autoDiscounts.cross_sell_details,
    clientCrossSellRows,
    clientXs,
    portalRosterSubtotalActive,
  ]);

  /** INR: same stack as India payment page (Client Garden + Payment Settings) on net after cart promos. */
  const indiaBreakdown = useMemo(() => {
    if (String(currency).toLowerCase() !== 'inr') return null;
    return computeIndiaCheckoutBreakdown(totalForPayment, clientIndiaPricingForCheckout, {
      india_alt_discount_percent: paymentSettings.india_alt_discount_percent,
      india_gst_percent: paymentSettings.india_gst_percent,
      india_platform_charge_percent: paymentSettings.india_platform_charge_percent,
    }, totalParticipants);
  }, [
    currency,
    totalForPayment,
    totalParticipants,
    clientIndiaPricingForCheckout,
    paymentSettings.india_alt_discount_percent,
    paymentSettings.india_gst_percent,
    paymentSettings.india_platform_charge_percent,
  ]);

  /** Dashboard Access group bands / flat India % — must show in main cart lines (not only in India settlement box). */
  const indiaClientDiscountAmt =
    indiaBreakdown && Number(indiaBreakdown.discountAmt) > 0
      ? Math.round(Number(indiaBreakdown.discountAmt))
      : 0;
  const totalDiscountIncludingIndia =
    totalDiscountAmount + indiaClientDiscountAmt + portalListOfferSavings;

  const indiaPaymentTag = clientIndiaPricing?.india_payment_method;

  const { list: paymentMethodsForDisplay, tagged: paymentMethodsTagged } = useMemo(
    () => displayMethodsForTag(paymentMethods, indiaPaymentTag),
    [paymentMethods, indiaPaymentTag],
  );

  const pmLower = useMemo(
    () => paymentMethodsForDisplay.map((x) => String(x).toLowerCase()),
    [paymentMethodsForDisplay],
  );
  const hasStripe = pmLower.includes('stripe');
  const memberExlyTagged = pmLower.includes('exly');
  /** Subscriber has India-tagged methods from admin (UPI / bank / manual) — show proof paths even when IP ≠ IN. */
  const memberIndiaTagged =
    pmLower.includes('gpay') || pmLower.includes('bank') || pmLower.includes('manual');
  /**
   * India GST + platform apply only for manual / Exly rails. Stripe card checkout uses the taxable
   * base (after India Client Garden discount) with no extra 18% / platform line items.
   */
  const showIndiaInrSettlement =
    !!indiaBreakdown &&
    (!hasStripe || portalPayMode === 'manual' || portalPayMode === 'exly');

  const payableTotal = indiaBreakdown
    ? showIndiaInrSettlement
      ? indiaBreakdown.roundedTotal
      : Math.round(indiaBreakdown.taxableBase)
    : totalForPayment;
  const bookerIndia = String(bookerCountry || '').trim().toUpperCase() === 'IN';
  const siteIndiaAlternatePayments =
    !!paymentSettings.india_enabled && (detectedCountry === 'IN' || bookerIndia);
  const showIndiaAlternatePaymentsBlock =
    payableTotal > 0 && (memberIndiaTagged || memberExlyTagged || siteIndiaAlternatePayments);
  const allowManualProof =
    paymentSettings.manual_form_enabled !== false &&
    memberIndiaTagged &&
    showIndiaAlternatePaymentsBlock;
  const allowExlyCheckout =
    memberExlyTagged && showIndiaAlternatePaymentsBlock && !!paymentSettings.india_exly_link;

  useEffect(() => {
    userClosedPortalPayRef.current = false;
    setPortalPayMode(null);
  }, [enrollmentId]);

  /** One non-Stripe path: open immediately after CONTINUE TO PAYMENT (until user backs out once). */
  useEffect(() => {
    if (!enrollmentId || payableTotal <= 0 || hasStripe) return;
    if (portalPayMode != null) return;
    if (userClosedPortalPayRef.current) return;
    if (allowManualProof && !allowExlyCheckout) setPortalPayMode('manual');
    else if (allowExlyCheckout && !allowManualProof) setPortalPayMode('exly');
  }, [
    enrollmentId,
    payableTotal,
    hasStripe,
    allowManualProof,
    allowExlyCheckout,
    portalPayMode,
  ]);

  useEffect(() => {
    if (promoFromUrlApplied.current || items.length === 0) return;
    const code = searchParams.get('promo');
    if (!code?.trim()) return;
    promoFromUrlApplied.current = true;
    axios
      .post(`${API}/promotions/validate`, {
        code: code.trim(),
        program_id: items[0]?.programId,
        currency,
        cart_items: items
          .filter((i) => i.programId)
          .map((i) => ({
            program_id: i.programId,
            tier_index: i.tierIndex ?? 0,
            participants_count: Math.max(1, i.participants?.length || 1),
          })),
        participant_count: totalParticipants,
      })
      .then((r) => {
        setPromoResult(r.data);
        setPromoCode(code.trim().toUpperCase());
      })
      .catch(() => {});
  }, [items.length, items, currency, searchParams, totalParticipants]);

  useEffect(() => {
    if (!enrollmentId || payableTotal <= 0) {
      setPointsSummary(null);
      return;
    }
    const cartProgramIds = items.map((i) => i.programId).filter(Boolean).join(',');
    const first = items[0];
    axios
      .get(`${API}/enrollment/${enrollmentId}/points-summary`, {
        params: {
          basket_subtotal: payableTotal,
          currency,
          item_type: first?.type === 'session' ? 'session' : 'program',
          item_id: first?.programId || '',
          cart_program_ids: cartProgramIds,
        },
      })
      .then((r) => {
        setPointsSummary(r.data);
        setPointsToRedeem(0);
      })
      .catch(() => setPointsSummary(null));
  }, [enrollmentId, payableTotal, currency, items]);

  const pointsCashEstimate = (() => {
    if (!pointsSummary?.enabled || !pointsToRedeem || payableTotal <= 0) return 0;
    const per = Number(pointsSummary.fiat_per_point) || 0;
    const pct = Number(pointsSummary.max_basket_pct) || 20;
    const maxCash = payableTotal * (pct / 100);
    const bal = Number(pointsSummary.balance) || 0;
    const maxByOrder = per > 0 ? Math.floor(maxCash / per) : 0;
    const cap =
      pointsSummary.max_points_usable != null
        ? Math.min(bal, pointsSummary.max_points_usable)
        : Math.min(bal, maxByOrder);
    const pts = Math.min(Math.max(0, parseInt(String(pointsToRedeem), 10) || 0), cap);
    const cash = Math.min(pts * per, maxCash, payableTotal);
    return Math.round(cash * 100) / 100;
  })();

  const displayCheckoutTotal =
    pointsSummary?.enabled && payableTotal > 0
      ? Math.max(0, Math.round((payableTotal - pointsCashEstimate) * 100) / 100)
      : payableTotal;

  const validateAndProceed = useCallback(() => {
    for (const item of items) {
      for (let i = 0; i < item.participants.length; i++) {
        const p = item.participants[i];
        if (!p.name.trim()) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs a name`,
            variant: 'destructive',
          });
          return false;
        }
        if (!p.relationship) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs relationship`,
            variant: 'destructive',
          });
          return false;
        }
        if (!p.gender) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs gender`,
            variant: 'destructive',
          });
          return false;
        }
        const countryEff = effectiveParticipantCountry(p, bookerCountry, detectedCountry);
        if (!countryEff) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs country`,
            variant: 'destructive',
          });
          return false;
        }
        if (!p.city || !p.city.trim()) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs city`,
            variant: 'destructive',
          });
          return false;
        }
        if (!p.state || !p.state.trim()) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs state`,
            variant: 'destructive',
          });
          return false;
        }
        if (p.notify || p.attendance_mode === 'online') {
          const emailEff = effectiveParticipantEmail(p, bookerEmail);
          if (!emailEff || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEff)) {
            toast({
              title: `${item.programTitle}: Participant ${i + 1} needs a valid email`,
              variant: 'destructive',
            });
            return false;
          }
        }
      }
    }
    return true;
  }, [items, toast, bookerCountry, detectedCountry, bookerEmail]);

  const startTrustedEnrollment = async () => {
    if (!validateAndProceed()) return;
    if (!bookerEmail) {
      toast({ title: 'Booker email is required', variant: 'destructive' });
      return;
    }
    setEnrollmentSubmitLoading(true);
    try {
      const allParticipants = items.flatMap((item) =>
        item.participants.map((p) => {
          const refName = p.has_referral
            ? p.referred_by_name || ''
            : p.referral_source === 'Friend / Family'
              ? p.referred_by_name || ''
              : '';
          const refEmailRaw = (p.referred_by_email || '').trim().toLowerCase();
          const refEmail =
            (p.has_referral || p.referral_source === 'Friend / Family') && refEmailRaw ? refEmailRaw : null;
          const ageNum = parseInt(String(p.age), 10);
          return {
            name: p.name,
            relationship: p.relationship,
            age: Number.isFinite(ageNum) ? ageNum : 0,
            gender: p.gender,
            country: effectiveParticipantCountry(p, bookerCountry, detectedCountry),
            city: p.city,
            state: p.state,
            attendance_mode: p.attendance_mode,
            notify: p.notify,
            email: effectiveParticipantEmail(p, bookerEmail) || null,
            phone: (p.phone || '').trim()
              ? `${p.phone_code || ''}${String(p.phone).trim()}`
              : null,
            whatsapp: p.whatsapp ? `${p.wa_code || ''}${p.whatsapp}` : null,
            program_id: item.programId,
            program_title: item.programTitle,
            is_first_time: p.is_first_time || false,
            referral_source: p.referral_source || '',
            referred_by_name: refName,
            referred_by_email: refEmail,
          };
        }),
      );

      const leadItem = items[0];
      const programLines = items.filter((i) => i.type === 'program');
      const enrollRes = await axios.post(
        `${API}/student/combined-enrollment-start`,
        {
          booker_name: bookerName,
          booker_email: bookerEmail,
          booker_country: bookerCountry,
          item_type: leadItem?.type === 'session' ? 'session' : 'program',
          item_id: leadItem?.programId || '',
          item_title: leadItem?.programTitle || '',
          participants: allParticipants,
          ...(programLines.length > 0
            ? {
                portal_cart_currency: currency,
                portal_cart_lines: programLines.map((i) => {
                  const { orderedGuestIds, bookerJoins } = dashboardQuoteParamsFromCartItem(i);
                  return {
                    program_id: String(i.programId),
                    tier_index: i.tierIndex ?? 0,
                    family_member_ids: orderedGuestIds.map(String),
                    booker_joins: bookerJoins,
                  };
                }),
              }
            : {}),
        },
        { withCredentials: true, headers: getAuthHeaders() },
      );
      const eid = enrollRes.data.enrollment_id;
      setEnrollmentId(eid);
      if (bookerPhoneForPatch) {
        await axios
          .patch(`${API}/enrollment/${eid}/update-phone`, { phone: bookerPhoneForPatch })
          .catch(() => {});
      }
      toast({ title: enrollRes.data.message || 'Ready for payment' });
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('eid', eid);
          if (promoResult?.code) next.set('promo', promoResult.code);
          else if (promoCode) next.set('promo', promoCode);
          return next;
        },
        { replace: true },
      );
    } catch (err) {
      const ap = searchParams.get('autoPay');
      if (ap === '1' || ap === 'stripe') {
        autoPayEnrollKickedRef.current = false;
        setSearchParams((prev) => {
          const n = new URLSearchParams(prev);
          n.delete('autoPay');
          return n;
        }, { replace: true });
      }
      toast({
        title: 'Error',
        description: err.response?.data?.detail || 'Failed',
        variant: 'destructive',
      });
    } finally {
      setEnrollmentSubmitLoading(false);
    }
  };

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const firstItem = items[0];
      const res = await axios.post(`${API}/enrollment/${enrollmentId}/checkout`, {
        enrollment_id: enrollmentId,
        item_type: firstItem.type === 'session' ? 'session' : 'program',
        item_id: firstItem.programId,
        currency,
        display_currency: displayCurrency,
        display_rate: isPrimary ? 1 : undefined,
        origin_url: window.location.origin,
        promo_code: promoResult?.code || null,
        tier_index:
          firstItem.type === 'session' ? firstItem.tierIndex ?? null : normalizeCartItemTierIndex(firstItem),
        points_to_redeem:
          pointsSummary?.enabled ? Math.max(0, parseInt(String(pointsToRedeem), 10) || 0) : 0,
        cart_items: items.map((i) => ({
          program_id: i.programId,
          tier_index: normalizeCartItemTierIndex(i),
          participants_count: i.participants.length,
        })),
        portal_checkout_cancel: true,
        browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        browser_languages: navigator.languages ? [...navigator.languages] : [navigator.language],
        client_declared_payable: displayCheckoutTotal,
      });
      if (res.data.url === '__FREE_SUCCESS__') {
        suppressEmptyCartRedirectRef.current = true;
        clearCart();
        navigate(`/payment/success?session_id=${res.data.session_id}`);
      } else {
        window.location.href = res.data.url;
      }
    } catch (err) {
      const ap = searchParams.get('autoPay');
      if (ap === '1' || ap === 'stripe') {
        autoPayCheckoutKickedRef.current = false;
        setSearchParams((prev) => {
          const n = new URLSearchParams(prev);
          n.delete('autoPay');
          return n;
        }, { replace: true });
      }
      toast({
        title: 'Payment Error',
        description: err.response?.data?.detail || 'Try again',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  const validateAndProceedRef = useRef(validateAndProceed);
  validateAndProceedRef.current = validateAndProceed;
  const startTrustedEnrollmentRef = useRef(startTrustedEnrollment);
  startTrustedEnrollmentRef.current = startTrustedEnrollment;
  const handleCheckoutRef = useRef(handleCheckout);
  handleCheckoutRef.current = handleCheckout;

  useEffect(() => {
    if (autoPayFlag !== '1' && autoPayFlag !== 'stripe') {
      autoPayEnrollKickedRef.current = false;
      autoPayCheckoutKickedRef.current = false;
    }
  }, [autoPayFlag]);

  /** Home Coming schedule “Pay · Stripe” — create enrollment if needed and redirect to Stripe Checkout. */
  useEffect(() => {
    if (autoPayFlag !== '1' && autoPayFlag !== 'stripe') return;
    if (items.length === 0) return;
    const eid = String(enrollmentId || eidParam || '').trim();
    if (eid) return;
    if (autoPayEnrollKickedRef.current || enrollmentSubmitLoading) return;
    autoPayEnrollKickedRef.current = true;
    if (!validateAndProceedRef.current()) {
      autoPayEnrollKickedRef.current = false;
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev);
        n.delete('autoPay');
        return n;
      }, { replace: true });
      toast({
        title: 'Complete your seat details',
        description: 'Fill every required field on the Divine Cart, then use Pay again from Sacred Home.',
        variant: 'destructive',
      });
      return;
    }
    void startTrustedEnrollmentRef.current();
  }, [autoPayFlag, items.length, enrollmentId, eidParam, enrollmentSubmitLoading, setSearchParams, toast]);

  useEffect(() => {
    if (autoPayFlag !== '1' && autoPayFlag !== 'stripe') return;
    if (items.length === 0) return;
    const eid = String(enrollmentId || '').trim();
    if (!eid) return;
    if (!hasStripe) {
      if (!autoPayCheckoutKickedRef.current) {
        autoPayCheckoutKickedRef.current = true;
        setSearchParams((prev) => {
          const n = new URLSearchParams(prev);
          n.delete('autoPay');
          return n;
        }, { replace: true });
        toast({
          title: 'Open Sacred Exchange',
          description: 'India payments (UPI / bank) are completed on Payments & EMIs.',
        });
        navigate('/dashboard/financials');
      }
      return;
    }
    if (autoPayCheckoutKickedRef.current || processing) return;
    autoPayCheckoutKickedRef.current = true;
    void handleCheckoutRef.current();
  }, [autoPayFlag, items.length, enrollmentId, hasStripe, processing, navigate, setSearchParams, toast]);

  const portalReturnQs = useMemo(() => {
    const q = new URLSearchParams();
    if (enrollmentId) q.set('eid', enrollmentId);
    if (promoResult?.code) q.set('promo', promoResult.code);
    else if (promoCode) q.set('promo', promoCode);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [enrollmentId, promoResult?.code, promoCode]);

  const rosterRows = useMemo(
    () =>
      items.flatMap((item) =>
        (item.participants || []).map((p, idx) => ({
          item,
          p,
          idx,
          key: `${item.id}-${idx}`,
        })),
      ),
    [items],
  );

  const rosterParticipantCount = rosterRows.length;

  const removeRosterSeat = useCallback(
    (item, participantIndex) => {
      const list = item.participants || [];
      if (participantIndex < 0 || participantIndex >= list.length) return;
      if (list.length <= 1) {
        removeItem(item.id);
        toast({
          title: 'Removed from cart',
          description: `${item.programTitle || 'Program'} was removed from your order.`,
        });
        return;
      }
      updateItemParticipants(
        item.id,
        list.filter((_, i) => i !== participantIndex),
      );
      toast({
        title: 'Seat removed',
        description: `Removed one seat from ${item.programTitle || 'this program'}.`,
      });
    },
    [removeItem, updateItemParticipants, toast],
  );

  if (items.length === 0) return null;

  return (
    <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 md:py-10">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white drop-shadow-sm" data-testid="dashboard-combined-title">
            DIVINE CART
          </h1>
          <p className="text-sm text-violet-100/90 mt-1.5 max-w-xl leading-relaxed">
            One row per seat. Change guests on the dashboard, then refresh this page if needed.
          </p>
          <p className="text-xs text-violet-200/90 mt-2 max-w-xl leading-snug">
            <strong className="font-semibold text-white">Already paid or approved?</strong> Open{' '}
            <span className="text-white font-medium">Order history</span> in the sidebar (or the button above). This page
            keeps your seat list until checkout finishes. Leaving Stripe without paying does not clear your cart; it clears
            when payment completes or after you submit proof and we detect a completed enrollment.
          </p>
          <div className="mt-3 rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-2.5">
            <PaymentMethodTags
              methods={paymentMethodsForDisplay}
              tagged={paymentMethodsTagged}
              preferredPaymentMethod={clientPreferredPaymentMethod}
              indiaPaymentMethodTag={indiaPaymentTag}
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0 justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-white/30 bg-white/10 text-white hover:bg-white/20"
            onClick={() => {
              if (!window.confirm('Clear all items from your Divine Cart on this device?')) return;
              clearCart();
            }}
          >
            Clear cart
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-white/30 bg-white/10 text-white hover:bg-white/20"
            onClick={() => navigate('/dashboard/orders')}
          >
            <ClipboardList size={16} className="mr-1" /> My order history
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-white/30 bg-white/10 text-white hover:bg-white/20"
            onClick={() => navigate('/dashboard')}
          >
            <ChevronLeft size={16} className="mr-1" /> Back to dashboard
          </Button>
        </div>
      </div>

      <div className="bg-white/95 backdrop-blur rounded-xl border border-[rgba(212,175,55,0.35)] shadow-lg p-4 sm:p-5 mb-6 w-full">
        {showHomeComingOfferBackLink && !homeComingAnnualOfferPlan ? (
          <div
            className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-violet-200 bg-violet-50/95 px-3 py-2.5 text-sm text-violet-950"
            data-testid="home-coming-fullpay-back-banner"
          >
            <p className="text-[12px] font-medium leading-snug">
              Returning to Sacred Home? You can adjust your start date or installment choice on the same page.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-violet-300 bg-white/90 text-violet-950 hover:bg-violet-100/80 h-8 text-[11px]"
              onClick={() => navigate('/dashboard/home-coming-package')}
              data-testid="home-coming-fullpay-back"
            >
              <ChevronLeft size={14} className="mr-0.5" /> Back to Home Coming
            </Button>
          </div>
        ) : null}
        {homeComingAnnualOfferPlan ? (
          <div
            className="mb-4 rounded-lg border border-violet-200 bg-violet-50/95 px-3 py-2.5 text-sm text-violet-950"
            data-testid="home-coming-emi-checkout-banner"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <p className="font-semibold text-[13px]">Home Coming · Installment plan</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-violet-300 bg-white/90 text-violet-950 hover:bg-violet-100/80 h-8 text-[11px]"
                onClick={() => navigate('/dashboard/home-coming-package')}
                data-testid="home-coming-emi-back"
              >
                <ChevronLeft size={14} className="mr-0.5" /> Back to Home Coming
              </Button>
            </div>
            <p className="text-[11px] mt-1 text-violet-900/90 leading-relaxed">
              You chose <strong>EMI</strong> on the Home Coming page. This screen is for{' '}
              <strong>today&apos;s payment</strong>
              {homeComingAnnualOfferPlan.currentEmiMonthYear ? (
                <>
                  {' '}
                  — calendar month <strong>{homeComingAnnualOfferPlan.currentEmiMonthYear}</strong>
                </>
              ) : null}
              {' '}
              (installment {homeComingAnnualOfferPlan.payInstallmentN}
              {homeComingAnnualOfferPlan.preview.length > 0
                ? ` of ${homeComingAnnualOfferPlan.preview.length}`
                : ''}
              {homeComingAnnualOfferPlan.currentEmiDueLabel
                ? `, due ${homeComingAnnualOfferPlan.currentEmiDueLabel}`
                : ''}
              ). Later installments are recorded on Sacred Exchange with your host.
            </p>
            {homeComingAnnualOfferPlan.preview.length > 0 ? (
              <ul className="mt-2 text-[10px] tabular-nums text-violet-900/85 space-y-0.5 max-h-28 overflow-y-auto border-t border-violet-100/80 pt-2">
                {homeComingAnnualOfferPlan.preview.slice(0, 12).map((r, idx) => (
                  <li key={`${r.n}-${idx}`}>
                    <span className="font-semibold">{r.n}.</span>{' '}
                    {r.due
                      ? formatDateDdMonYyyy(String(r.due).slice(0, 10)) || String(r.due).slice(0, 10)
                      : '—'}
                    {r.amount != null && !Number.isNaN(Number(r.amount))
                      ? ` · ${Number(r.amount).toLocaleString()}`
                      : ''}
                  </li>
                ))}
                {homeComingAnnualOfferPlan.preview.length > 12 ? (
                  <li className="text-violet-700/80 italic">… full schedule on Sacred Exchange</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#D4AF37] mb-3">
          At a glance — who is enrolling
        </p>
        <p className="text-xs text-gray-600 mb-3 leading-relaxed" data-testid="dashboard-combined-roster-count">
          <strong className="text-gray-800">{rosterParticipantCount}</strong> seat{rosterParticipantCount !== 1 ? 's' : ''}{' '}
          · <strong className="text-gray-800">{items.length}</strong> program{items.length !== 1 ? 's' : ''}.
        </p>
        <div className="space-y-0 divide-y divide-gray-100" data-testid="dashboard-combined-roster-table">
          {rosterRows.map((row, n) => {
            const { item, p, idx, key } = row;
            const name = String(p.name || '').trim() || '—';
            const role = String(p.relationship || '').trim() || '—';
            const notify = combinedNotifyLabel(p);
            const meta = item.portalLineMeta;
            const selfIncluded =
              meta?.annualIncluded && String(p.relationship || '').trim() === 'Myself';
            const homeComingSelfPayRaw = meta?.homeComingQuotedTotal;
            const homeComingSelfPayNum =
              typeof homeComingSelfPayRaw === 'number'
                ? homeComingSelfPayRaw
                : parseFloat(String(homeComingSelfPayRaw ?? ''), 10);
            const homeComingSelfPayDisplay =
              selfIncluded &&
              meta?.fromAnnualOfferPage &&
              !Number.isNaN(homeComingSelfPayNum) &&
              homeComingSelfPayNum > 0
                ? Math.round(toDisplay(homeComingSelfPayNum) * 100) / 100
                : 0;
            const homeComingSelfPayDisplayOk = homeComingSelfPayDisplay > 0;
            const lineQuote = annualQuotesByProgram[annualPortalQuoteMapKey(item)] || null;
            const guestBucketById = lineQuote ? effectiveGuestBucketById(item, lineQuote) : meta?.guestBucketById || {};
            const guestBucket = resolvePortalGuestBucket(p, guestBucketById);
            const portalBase =
              lineQuote && !selfIncluded
                ? annualPortalSeatUnitBasePrices(lineQuote, p, guestBucketById, item.participants || [])
                : null;
            const unitOfferRaw = selfIncluded
              ? 0
              : portalBase
                ? toDisplay(portalBase.offer)
                : getItemOfferPrice(item);
            const unitListRaw = selfIncluded
              ? 0
              : portalBase
                ? toDisplay(portalBase.list)
                : getItemPrice(item);
            const ahIncludedPeer =
              !selfIncluded &&
              guestBucket === 'annual_household' &&
              (!!lineQuote?.included_in_annual_package || !!p.peer_included_in_annual_package);
            const rosterBaseline =
              selfIncluded || ahIncludedPeer
                ? 0
                : unitOfferRaw > 0
                  ? unitOfferRaw
                  : unitListRaw;
            const xsDisc =
              !selfIncluded &&
              !ahIncludedPeer &&
              crossSellRules?.length &&
              rosterBaseline > 0
                ? crossSellSeatDiscountAmount(
                    crossSellRules,
                    item,
                    p,
                    cartLinesNormalizedForCrossSell,
                    programCartLines,
                    unitOfferRaw,
                    unitListRaw,
                  )
                : 0;
            const displayPayable =
              selfIncluded || ahIncludedPeer ? 0 : Math.max(0, rosterBaseline - xsDisc);
            const bucketRoleHint =
              guestBucket === 'annual_household'
                ? bookerAnnualPortalAccess
                  ? 'Annual Family Club'
                  : 'Linked household'
                : guestBucket === 'immediate'
                  ? 'Immediate family'
                  : guestBucket === 'extended'
                    ? 'Friends & extended'
                    : null;
            const rosterTierLabel = cartItemTierLabel(item);
            return (
              <div
                key={key}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 py-3.5 text-xs sm:text-sm text-gray-900 leading-snug"
              >
                <div className="sm:col-span-1 flex flex-row sm:flex-col items-center sm:items-start gap-2 text-gray-500">
                  <span className="tabular-nums font-medium shrink-0">{n + 1}</span>
                  <button
                    type="button"
                    className="p-1 rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                    aria-label={`Remove ${name} from ${item.programTitle}`}
                    data-testid={`dashboard-checkout-remove-seat-${key}`}
                    onClick={() => removeRosterSeat(item, idx)}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                <div className="sm:col-span-3 min-w-0 break-words">
                  <span className="text-gray-500 text-[11px] uppercase tracking-wide sm:hidden">Program · </span>
                  <span className="font-medium text-gray-900">{item.programTitle}</span>
                  {rosterTierLabel ? (
                    <span className="block text-[10px] sm:text-[11px] text-gray-500 mt-0.5 font-medium leading-snug">
                      {rosterTierLabel}
                    </span>
                  ) : null}
                </div>
                <div className="sm:col-span-2 min-w-0 break-words">
                  <span className="text-gray-500 text-[11px] uppercase tracking-wide sm:hidden">Name · </span>
                  {name}
                </div>
                <div className="sm:col-span-2 min-w-0 break-words text-gray-700">
                  <span className="text-gray-500 text-[11px] uppercase tracking-wide sm:hidden">Role · </span>
                  <span>{role}</span>
                  {bucketRoleHint ? (
                    <span className="block text-[10px] text-violet-800/90 mt-0.5 leading-snug">{bucketRoleHint}</span>
                  ) : null}
                </div>
                <div className="sm:col-span-2 min-w-0 break-words text-gray-700">
                  <span className="text-gray-500 text-[11px] uppercase tracking-wide sm:hidden">Attendance · </span>
                  {combinedAttendanceLabel(p)}
                </div>
                <div className="sm:col-span-1 min-w-0 break-words text-gray-700">
                  <span className="text-gray-500 text-[11px] uppercase tracking-wide sm:hidden">Notify · </span>
                  {notify}
                </div>
                <div className="sm:col-span-1 min-w-0 text-right tabular-nums">
                  <span className="text-gray-500 text-[11px] uppercase tracking-wide sm:hidden">Seat · </span>
                  {selfIncluded ? (
                    homeComingSelfPayDisplayOk ? (
                      <span className="text-[#D4AF37] font-semibold text-xs sm:text-sm">
                        {symbol} {homeComingSelfPayDisplay.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-semibold text-xs sm:text-sm">Package</span>
                    )
                  ) : ahIncludedPeer ? (
                    <span className="text-emerald-700 font-semibold text-xs sm:text-sm leading-snug text-right block">
                      Included in annual package
                    </span>
                  ) : displayPayable > 0 ? (
                    <span className="inline-flex flex-col sm:flex-row sm:items-end sm:gap-1 sm:justify-end">
                      <span className="text-[#D4AF37] font-semibold">
                        {symbol} {displayPayable.toLocaleString()}
                      </span>
                      {unitListRaw > displayPayable ? (
                        <span className="line-through text-gray-400 text-xs font-normal">
                          {symbol} {unitListRaw.toLocaleString()}
                        </span>
                      ) : null}
                    </span>
                  ) : unitListRaw > 0 ? (
                    <span className="inline-flex flex-col sm:flex-row sm:items-end sm:gap-1 sm:justify-end">
                      <span className="text-[#D4AF37] font-semibold">
                        {symbol} {displayPayable.toLocaleString()}
                      </span>
                      <span className="line-through text-gray-400 text-xs font-normal">
                        {symbol} {unitListRaw.toLocaleString()}
                      </span>
                    </span>
                  ) : (
                    <span className="font-semibold text-gray-900">
                      {symbol} {unitListRaw.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {items.some((it) => (it.participants || []).length === 0) ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 leading-relaxed">
            A line item has no participant rows. Remove it from your order or re-add the program from your dashboard.
          </p>
        ) : null}
        <div className="border-t border-gray-200 mt-4 pt-4 space-y-1.5">
          {portalListOfferSavings > 0 ? (
            <>
              <div className="flex justify-between text-sm text-gray-700">
                <span>Program prices (list)</span>
                <span className="tabular-nums">
                  {symbol} {seatListOfferRollup.listTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm text-green-700">
                <span>Program offer savings</span>
                <span className="tabular-nums">
                  -{symbol} {portalListOfferSavings.toLocaleString()}
                </span>
              </div>
            </>
          ) : null}
          <div className="flex justify-between text-sm font-medium text-gray-900">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {symbol} {subtotal.toLocaleString()}
            </span>
          </div>
          {autoDiscounts.group_discount > 0 && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Group ({totalParticipants} people)</span>
              <span className="tabular-nums">
                -{symbol} {autoDiscounts.group_discount.toLocaleString()}
              </span>
            </div>
          )}
          {autoDiscounts.combo_discount > 0 && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Combo ({numPrograms} programs)</span>
              <span className="tabular-nums">
                -{symbol} {autoDiscounts.combo_discount.toLocaleString()}
              </span>
            </div>
          )}
          {autoDiscounts.loyalty_discount > 0 && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Loyalty</span>
              <span className="tabular-nums">
                -{symbol} {autoDiscounts.loyalty_discount.toLocaleString()}
              </span>
            </div>
          )}
          {crossSellDisplayRows.map((row, i) => (
            <div
              key={`xs-${i}-${row.label}-${row.amount}`}
              className="flex justify-between text-sm text-green-700"
              data-testid={`dashboard-checkout-cross-sell-${i}`}
            >
              <span className="flex items-center gap-1 min-w-0">
                <Gift size={14} className="shrink-0 text-green-700" />
                <span className="truncate">
                  {row.title ? `${row.label || 'Bundle'} (${row.title})` : row.label || 'Bundle'}
                </span>
              </span>
              <span className="tabular-nums shrink-0">
                -{symbol} {row.amount.toLocaleString()}
              </span>
            </div>
          ))}
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Promo ({promoResult?.code})</span>
              <span className="tabular-nums">
                -{symbol} {discount.toLocaleString()}
              </span>
            </div>
          )}
          {indiaClientDiscountAmt > 0 && indiaBreakdown ? (
            <div className="flex justify-between text-sm text-green-700">
              <span>
                {indiaBreakdown.discountKind === 'amount'
                  ? `${indiaBreakdown.discountLabel} (₹${indiaClientDiscountAmt.toLocaleString()} off)`
                  : `${indiaBreakdown.discountLabel} (${Number(
                      indiaBreakdown.discountNominalPercent != null
                        ? indiaBreakdown.discountNominalPercent
                        : indiaBreakdown.discountPct,
                    )
                      .toFixed(1)
                      .replace(/\.0$/, '')}%)`}
              </span>
              <span className="tabular-nums">
                -{symbol} {indiaClientDiscountAmt.toLocaleString()}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between text-sm font-semibold text-green-800 border-t border-dashed border-green-200/80 pt-2 mt-2">
            <span>Total discounts (sum of lines above)</span>
            <span className="tabular-nums">
              {totalDiscountIncludingIndia > 0
                ? `-${symbol} ${totalDiscountIncludingIndia.toLocaleString()}`
                : `${symbol} 0`}
            </span>
          </div>
          {showIndiaInrSettlement &&
          indiaBreakdown &&
          (Math.round(indiaBreakdown.gstAmount) > 0 || Math.round(indiaBreakdown.platformAmount) > 0) ? (
            <>
              <div className="flex justify-between text-sm text-gray-700 mt-2 pt-2 border-t border-gray-100">
                <span>Net (before tax &amp; fees)</span>
                <span className="tabular-nums">
                  {symbol} {Math.round(indiaBreakdown.taxableBase).toLocaleString()}
                </span>
              </div>
              {indiaBreakdown.gstPct > 0 && Math.round(indiaBreakdown.gstAmount) > 0 ? (
                <div className="flex justify-between text-sm text-gray-700" data-testid="divine-cart-gst-line">
                  <span>
                    {indiaBreakdown.taxLabel} ({indiaBreakdown.gstPct}%)
                  </span>
                  <span className="tabular-nums">
                    {symbol} {Math.round(indiaBreakdown.gstAmount).toLocaleString()}
                  </span>
                </div>
              ) : null}
              {indiaBreakdown.platformPct > 0 && Math.round(indiaBreakdown.platformAmount) > 0 ? (
                <div
                  className="flex justify-between text-sm text-gray-700"
                  data-testid="divine-cart-platform-line"
                >
                  <span>Platform ({indiaBreakdown.platformPct}%)</span>
                  <span className="tabular-nums">
                    {symbol} {Math.round(indiaBreakdown.platformAmount).toLocaleString()}
                  </span>
                </div>
              ) : null}
            </>
          ) : null}
          {showIndiaInrSettlement ? (
            <p
              className="text-[10px] text-amber-900/90 bg-amber-50/60 border border-amber-200/70 rounded-lg px-2.5 py-2 mt-2 leading-snug"
              data-testid="divine-cart-india-settlement"
            >
              Manual / UPI proof uses the same totals as Stripe — GST and platform (if any) are included in the amount
              above.
            </p>
          ) : null}
          <div className="flex justify-between items-start gap-3 font-bold text-lg sm:text-xl border-t border-gray-200 pt-3 mt-2">
            <span>Total</span>
            <span className="text-[#D4AF37] tabular-nums text-right">
              {displayCheckoutTotal <= 0 ? (
                <span className="flex flex-col items-end gap-0.5">
                  <span>No payment due</span>
                  <span className="text-[10px] font-normal text-gray-500 max-w-[14rem] leading-snug">
                    Duration / tier is shown on each program row above.
                  </span>
                </span>
              ) : (
                `${symbol} ${displayCheckoutTotal.toLocaleString()}`
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="w-full">
          <div className="bg-white/95 backdrop-blur rounded-xl border border-white/40 shadow-lg p-6 sm:p-7">
            {(showCheckoutPromo || promoResult) && (
              <div className="mb-4 pb-4 border-b border-gray-100">
                {showCheckoutPromo ? (
                  <>
                    <label className="text-sm font-medium text-gray-800 mb-1.5 block flex items-center gap-2">
                      <Tag size={14} className="text-[#D4AF37]" /> Promo code
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        placeholder="Enter code"
                        className="text-sm flex-1"
                        disabled={!!promoResult}
                      />
                      {promoResult ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPromoResult(null);
                            setPromoCode('');
                          }}
                          className="text-xs"
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={validatePromo}
                          disabled={promoLoading || !promoCode.trim()}
                          className="bg-[#D4AF37] hover:bg-[#b8962e] text-white text-xs"
                        >
                          {promoLoading ? <Loader2 className="animate-spin" size={14} /> : 'Apply'}
                        </Button>
                      )}
                    </div>
                  </>
                ) : null}
                {promoResult && (
                  <div
                    className={`mt-2 bg-green-50 border border-green-200 rounded p-2 flex items-center gap-1 ${
                      showCheckoutPromo ? '' : 'mt-0'
                    }`}
                  >
                    <Check size={12} className="text-green-600" />
                    <span className="text-xs text-green-700">{promoResult.message}</span>
                  </div>
                )}
              </div>
            )}

            {!enrollmentId ? (
              <div className="w-full space-y-4" data-testid="dashboard-combined-verify">
                <p className="text-center text-lg sm:text-xl md:text-2xl font-bold text-gray-900 leading-snug px-1">
                  Review the list above, then continue.
                </p>
                <Button
                  onClick={startTrustedEnrollment}
                  disabled={enrollmentSubmitLoading}
                  className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-4 rounded-xl shadow-sm flex flex-row items-center justify-center gap-2 min-h-[3.25rem] font-bold uppercase tracking-wide text-base sm:text-lg"
                >
                  {enrollmentSubmitLoading ? (
                    <Loader2 className="animate-spin" size={22} />
                  ) : (
                    <>
                      <ChevronRight size={22} className="shrink-0" aria-hidden />
                      CONTINUE TO PAYMENT
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div data-testid="dashboard-combined-pay">
                {payableTotal <= 0 ? (
                  <>
                    <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <ShieldCheck size={16} className="text-green-600" /> Confirm registration
                    </h2>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <p className="text-sm font-semibold text-green-700 mb-1">No payment required</p>
                      <p className="text-xs text-green-600">Complete registration for all items below.</p>
                    </div>
                  </>
                ) : (
                  <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-green-600" /> Confirm &amp; pay
                  </h2>
                )}

                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-xs text-gray-600 space-y-1">
                  <p>
                    <strong>Booked by:</strong> {bookerName}
                  </p>
                  <p>
                    <strong>Email:</strong> {bookerEmail}{' '}
                    <span className="text-slate-500 font-medium">(portal account)</span>
                  </p>
                  {bookerPhoneDisplay ? (
                    <p>
                      <strong>Phone:</strong> {bookerPhoneDisplay}
                    </p>
                  ) : null}
                </div>

                {payableTotal > 0 && !hasStripe && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-950 leading-snug">
                    {showIndiaAlternatePaymentsBlock ? (
                      <p>
                        <strong>Stripe is off</strong> for your account. Use the Exly or <strong>manual proof</strong> option below
                        {memberIndiaTagged ? ' (aligned with your GPay / bank tags).' : '.'}
                      </p>
                    ) : (
                      <p>
                        <strong>Stripe is off</strong> for your account. Ask your admin to enable a payment method (e.g. tag GPay/UPI
                        on your membership) or turn on India checkout in site settings.
                      </p>
                    )}
                  </div>
                )}

                {pointsSummary?.enabled && payableTotal > 0 && pointsSummary.redeem_blocked && (
                  <div className="border border-amber-200 rounded-lg p-3 mb-4 bg-amber-50/60">
                    <p className="text-[10px] text-amber-900 flex items-center gap-1.5">
                      <Gift size={14} className="text-amber-700 shrink-0" />
                      {pointsSummary.redeem_blocked_reason || 'Points cannot be applied to this checkout.'}
                    </p>
                  </div>
                )}
                {pointsSummary?.enabled && payableTotal > 0 && (pointsSummary.max_points_usable || 0) > 0 && (
                  <div className="border border-amber-200 rounded-lg p-3 mb-4 bg-amber-50/40">
                    <p className="text-xs font-semibold text-gray-900 mb-0.5 flex items-center gap-1.5">
                      <Gift size={14} className="text-amber-600" /> Use points
                    </p>
                    <input
                      type="range"
                      min={0}
                      max={pointsSummary.max_points_usable || 0}
                      value={Math.min(pointsToRedeem, pointsSummary.max_points_usable || 0)}
                      onChange={(e) => setPointsToRedeem(parseInt(e.target.value, 10) || 0)}
                      className="w-full h-2 accent-amber-600"
                    />
                    <div className="flex justify-between text-[10px] text-gray-700 mt-1">
                      <span>{Math.min(pointsToRedeem, pointsSummary.max_points_usable || 0)} pts</span>
                      <span className="text-amber-800">
                        -{symbol}
                        {pointsCashEstimate.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {payableTotal > 0 && enrollmentId && portalPayMode === 'manual' && (
                  <div className="mb-4" data-testid="dashboard-combined-manual-embed">
                    <ManualPaymentProofBody
                      enrollmentId={enrollmentId}
                      variant="embed"
                      embedCartPayableInr={
                        String(currency).toLowerCase() === 'inr' ? displayCheckoutTotal : null
                      }
                      onBack={() => {
                        userClosedPortalPayRef.current = true;
                        setPortalPayMode(null);
                      }}
                      onSubmitted={() => {
                        suppressEmptyCartRedirectRef.current = true;
                        clearCart();
                        toast({
                          title: 'Proof submitted',
                          description:
                            'Your cart is cleared. Order history shows Pending approval until an admin confirms payment; then it becomes Complete.',
                        });
                        navigate('/dashboard/orders');
                      }}
                    />
                  </div>
                )}

                {payableTotal > 0 && enrollmentId && portalPayMode === 'exly' && (
                  <div
                    className="mb-4 rounded-xl border border-purple-200 bg-purple-50/70 p-4 space-y-3"
                    data-testid="dashboard-combined-exly-embed"
                  >
                    <p className="text-sm font-semibold text-gray-900">Pay with Exly</p>
                    <p className="text-[11px] text-gray-600 leading-snug">
                      Complete payment on Exly in a new tab. When finished, you can return to your dashboard — or use manual proof if
                      your admin asked for a receipt upload.
                    </p>
                    <a
                      href={paymentSettings.india_exly_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-[#5D3FD3] hover:bg-[#4c32b3] text-white text-sm font-semibold py-3 px-4"
                    >
                      Open Exly checkout <ExternalLink size={16} />
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => {
                        userClosedPortalPayRef.current = true;
                        setPortalPayMode(null);
                      }}
                    >
                      <ChevronLeft size={16} className="mr-2" /> Back to checkout
                    </Button>
                  </div>
                )}

                {showIndiaAlternatePaymentsBlock &&
                  portalPayMode == null &&
                  (allowExlyCheckout || allowManualProof) && (
                    <div className="mb-4" data-testid="dashboard-combined-india">
                      <div className="relative my-3">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-white px-3 text-[10px] text-gray-400 uppercase">
                            {allowExlyCheckout && allowManualProof
                              ? 'Choose how to pay'
                              : allowExlyCheckout
                                ? 'Your payment option'
                                : 'Your payment option'}
                          </span>
                        </div>
                      </div>
                      {allowExlyCheckout && (
                        <button
                          type="button"
                          onClick={() => setPortalPayMode('exly')}
                          className="flex items-center justify-between w-full border rounded-lg p-4 hover:border-purple-400 hover:bg-purple-50/50 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                              <CreditCard size={14} className="text-purple-600" />
                            </div>
                            <div className="min-w-0 text-left">
                              <span className="text-sm font-medium text-gray-900 group-hover:text-purple-600">
                                Exly / bank transfer
                              </span>
                              <p className="text-[10px] text-gray-500">GPay, cards, NEFT via Exly checkout</p>
                              <IndiaPaymentPathTags className="mt-1.5" />
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-gray-400 group-hover:text-purple-600 shrink-0" />
                        </button>
                      )}
                      {allowManualProof && (
                        <button
                          type="button"
                          onClick={() => setPortalPayMode('manual')}
                          className={`flex items-center justify-between w-full border rounded-lg p-4 hover:border-teal-400 hover:bg-teal-50/50 transition-all group ${
                            allowExlyCheckout ? 'mt-2' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                              <FileText size={14} className="text-teal-600" />
                            </div>
                            <div className="min-w-0 text-left">
                              <span className="text-sm font-medium text-gray-900 group-hover:text-teal-600">
                                Manual payment · proof upload
                              </span>
                              <p className="text-[10px] text-teal-600 font-medium">
                                Same form as manual proof — stay on this page
                              </p>
                              <IndiaPaymentPathTags className="mt-1.5" />
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-gray-400 group-hover:text-teal-600 shrink-0" />
                        </button>
                      )}
                    </div>
                  )}

                <div className="flex flex-col gap-3 mt-4 w-full">
                  {(payableTotal <= 0 || hasStripe) && !(payableTotal > 0 && portalPayMode === 'manual') && (
                  <Button
                    data-testid="dashboard-combined-stripe-pay"
                    onClick={handleCheckout}
                    disabled={
                      processing ||
                      (payableTotal > 0 && !enrollmentId) ||
                      (payableTotal > 0 && !hasStripe)
                    }
                    className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-4 text-base font-semibold rounded-xl disabled:opacity-50 shadow-sm"
                    title={
                      payableTotal > 0 && !hasStripe
                        ? 'Stripe is not enabled on your account — use the option above, or contact support.'
                        : undefined
                    }
                  >
                    {processing ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={18} />{' '}
                        {displayCheckoutTotal <= 0 ? 'Registering…' : 'Redirecting…'}
                      </>
                    ) : displayCheckoutTotal <= 0 ? (
                      <>
                        <Check size={18} className="mr-2" /> Complete registration
                      </>
                    ) : (
                      <>
                        <Lock size={18} className="mr-2" /> Pay {symbol} {displayCheckoutTotal.toLocaleString()} (Stripe)
                      </>
                    )}
                  </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                    className="w-full rounded-xl py-3 text-sm border-gray-300"
                  >
                    <ChevronLeft size={16} className="mr-2" /> Back to dashboard
                  </Button>
                </div>

                {payableTotal > 0 && paymentSettings.disclaimer_enabled && paymentSettings.disclaimer && (
                  <div
                    className="mt-3 rounded-xl p-4 border-2 shadow-sm"
                    style={{
                      backgroundColor: paymentSettings.disclaimer_style?.bg_color || '#fef2f2',
                      borderColor: paymentSettings.disclaimer_style?.border_color || '#f87171',
                    }}
                  >
                    <p
                      style={{
                        fontSize: paymentSettings.disclaimer_style?.font_size || '14px',
                        fontWeight: paymentSettings.disclaimer_style?.font_weight || '600',
                        color: paymentSettings.disclaimer_style?.font_color || '#991b1b',
                        lineHeight: '1.5',
                      }}
                    >
                      {paymentSettings.disclaimer.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return (
                            <strong key={i} style={{ fontWeight: 800 }}>
                              {part.slice(2, -2)}
                            </strong>
                          );
                        }
                        return part;
                      })}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-full">
          <MotivationalSignupFlash
            quotes={urgencyQuotes}
            programIds={cartProgramIdsForUrgency.length ? cartProgramIdsForUrgency : undefined}
            globalOnly={cartProgramIdsForUrgency.length === 0}
            variant="centeredLarge"
          />
        </div>
      </div>
    </div>
  );
}
