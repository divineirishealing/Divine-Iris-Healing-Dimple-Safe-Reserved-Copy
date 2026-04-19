import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { computeIndiaCheckoutBreakdown, parseIndiaSitePercent } from '../lib/indiaClientPricing';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../context/CartContext';
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
} from 'lucide-react';
import MotivationalSignupFlash from '../components/MotivationalSignupFlash';
import { ManualPaymentProofBody } from '../components/dashboard/ManualPaymentProofBody';
import { getAuthHeaders } from '../lib/authHeaders';
import { useAuth } from '../context/AuthContext';
import { readUpcomingDashboardSession } from '../lib/dashboardUpcomingSessionStorage';
import {
  buildAnnualDashboardCartParticipants,
  buildGuestBucketByIdFromSelection,
  mergeGlobalSeatDraft,
} from '../lib/dashboardCartPrefill';
import { programIncludedInAnnualPackage } from '../components/dashboard/dashboardUpcomingHelpers';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PORTAL_CHECKOUT_PATH = '/dashboard/combined-checkout';

function combinedAttendanceLabel(p) {
  if (p.attendance_mode === 'online') return 'Online (Zoom)';
  if (p.attendance_mode === 'in_person') return 'In person';
  return 'Offline / remote';
}

function combinedNotifyLabel(p) {
  if (p.attendance_mode === 'online') return 'On (Zoom)';
  return p.notify ? 'On' : 'Off';
}

/** Base-currency amounts from GET /dashboard-quote; apply `toDisplay` like program card prices. */
function annualPortalSeatUnitBasePrices(quote, participant, guestBucketById) {
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
  const bucket =
    fromP === 'immediate' || fromP === 'extended'
      ? fromP
      : id && guestBucketById && guestBucketById[id] === 'immediate'
        ? 'immediate'
        : 'extended';
  if (bucket === 'immediate') {
    const n = Number(quote.immediate_family_count || 0);
    if (n <= 0) return { offer: 0, list: 0 };
    return {
      offer: Number(quote.immediate_family_after_promos ?? 0) / n,
      list: Number(quote.immediate_family_line_gross ?? 0) / n,
    };
  }
  const n = Number(quote.extended_guest_count || 0);
  if (n <= 0) return { offer: 0, list: 0 };
  return {
    offer: Number(quote.extended_guests_after_promos ?? 0) / n,
    list: Number(quote.extended_guest_line_gross ?? 0) / n,
  };
}

const PAYMENT_METHOD_BADGES = {
  stripe: { label: 'Stripe · card', className: 'bg-violet-100/90 text-violet-900 border-violet-200/80' },
  gpay: { label: 'GPay / UPI', className: 'bg-emerald-100/90 text-emerald-900 border-emerald-200/80' },
  bank: { label: 'Bank transfer', className: 'bg-slate-100/90 text-slate-800 border-slate-200/80' },
  manual: { label: 'Manual · proof upload', className: 'bg-amber-100/90 text-amber-950 border-amber-200/80' },
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

function PaymentMethodTags({ methods }) {
  const list = Array.isArray(methods) && methods.length > 0 ? methods : ['stripe'];
  return (
    <div className="flex flex-wrap gap-2" data-testid="dashboard-combined-payment-tags">
      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 w-full">Your enabled methods</span>
      {list.map((key) => {
        const raw = String(key || '').toLowerCase().trim();
        const def = PAYMENT_METHOD_BADGES[raw] || {
          label: raw || '—',
          className: 'bg-white/80 text-slate-700 border-slate-200',
        };
        return (
          <span
            key={raw}
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
  const { items, clearCart, syncProgramLineItem, removeItem } = useCart();
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
  const [checkoutPromoVisible, setCheckoutPromoVisible] = useState(null);
  const [urgencyQuotes, setUrgencyQuotes] = useState([]);
  const [pointsSummary, setPointsSummary] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState(['stripe']);
  const [enrollmentSubmitLoading, setEnrollmentSubmitLoading] = useState(false);
  const [portalSelf, setPortalSelf] = useState(null);
  /** Client Garden India fields — same basis as India payment page / manual proof. */
  const [clientIndiaPricing, setClientIndiaPricing] = useState(null);
  const [subscriberIsAnnual, setSubscriberIsAnnual] = useState(false);
  const [annualPortalSubtotal, setAnnualPortalSubtotal] = useState(null);
  const [annualQuotesByProgram, setAnnualQuotesByProgram] = useState({});
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

  const sacredHomeSessionKey = useMemo(() => {
    const email = (user?.email || '').trim();
    if (!email) return '';
    const snap = readUpcomingDashboardSession(email);
    if (!snap) return 'none';
    try {
      return JSON.stringify({
        sel: snap.selectedFamilyByProgram,
        drafts: snap.seatDraftsByProgram,
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
        const pm = homeRes.data?.payment_methods;
        if (Array.isArray(pm) && pm.length) setPaymentMethods(pm);
        setSubscriberIsAnnual(!!homeRes.data?.is_annual_subscriber);
        setPortalSelf(prefillRes.data?.self || null);
        setClientIndiaPricing(homeRes.data?.client_india_pricing || null);
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
          const m = i.portalLineMeta || {};
          const ids = (m.familyIds || []).map(String).filter(Boolean).slice().sort().join(':');
          const bj = m.bookerJoins !== false ? '1' : '0';
          return `${i.programId}|${ids}|${bj}`;
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
        const annualIncludedIds = Array.isArray(settingsRes.data?.annual_package_included_program_ids)
          ? settingsRes.data.annual_package_included_program_ids
          : [];
        const upcoming = home.upcoming_programs || [];
        const isAnnual = !!home.is_annual_subscriber;
        const immediateFamily = home.immediate_family || [];
        const enrollableGuests = [...immediateFamily, ...(home.other_guests || [])];
        const snap = readUpcomingDashboardSession(email);
        const selectedMap = snap?.selectedFamilyByProgram || {};
        const drafts = snap?.seatDraftsByProgram || {};

        for (const line of [...items]) {
          if (line.type !== 'program') continue;
          const program = upcoming.find((p) => String(p.id) === String(line.programId));
          if (!program) continue;

          const includedForSeat = isAnnual && programIncludedInAnnualPackage(program, annualIncludedIds);
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
            immediateFamilyMembers: immediateFamily,
          });
          if (participants && participants.length > 0) {
            const guestBucketById = buildGuestBucketByIdFromSelection(sel, immediateFamily);
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

  const getEffectivePrice = (item) => {
    const offer = getItemOfferPrice(item);
    return offer > 0 ? offer : getItemPrice(item);
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
        const meta = i.portalLineMeta || {};
        const ids = (meta.familyIds || []).map(String).filter(Boolean).join(',');
        const bj = meta.bookerJoins !== false;
        const pid = String(i.programId);
        return axios
          .get(`${API}/student/dashboard-quote`, {
            params: {
              program_id: i.programId,
              currency,
              ...(ids ? { family_ids: ids } : { family_count: 0 }),
              booker_joins: bj,
            },
            withCredentials: true,
            headers,
          })
          .then((r) => ({ programId: pid, data: r.data, total: Number(r.data?.total) }))
          .catch(() => ({ programId: pid, data: null, total: null }));
      }),
    ).then((results) => {
      if (cancelled) return;
      const map = {};
      const totals = [];
      for (const row of results) {
        map[row.programId] = row.data;
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
  const subtotal = annualPortalSubtotal != null ? annualPortalSubtotal : naiveSubtotal;
  const totalParticipants = items.reduce((sum, i) => sum + i.participants.length, 0);
  const numPrograms = items.length;

  /** Sum of list vs offer unit prices per paying seat (matches roster columns) for “list – offer” savings line. */
  const seatListOfferRollup = useMemo(() => {
    let listTotal = 0;
    let offerTotal = 0;
    for (const item of items) {
      for (const p of item.participants || []) {
        const meta = item.portalLineMeta || {};
        const selfIncluded =
          subscriberIsAnnual && meta.annualIncluded && String(p.relationship || '').trim() === 'Myself';
        if (selfIncluded) continue;
        const lineQuote = annualQuotesByProgram[String(item.programId)] || null;
        const guestBucketById = meta.guestBucketById || {};
        const portalBase = lineQuote ? annualPortalSeatUnitBasePrices(lineQuote, p, guestBucketById) : null;
        const unitOfferRaw = portalBase
          ? toDisplay(portalBase.offer)
          : getItemOfferPrice(item);
        const unitListRaw = portalBase
          ? toDisplay(portalBase.list)
          : getItemPrice(item);
        const payable = unitOfferRaw > 0 ? unitOfferRaw : unitListRaw;
        const listPart =
          unitOfferRaw > 0 && unitListRaw > unitOfferRaw ? unitListRaw : payable;
        listTotal += listPart;
        offerTotal += payable;
      }
    }
    return {
      listTotal: Math.round(listTotal * 100) / 100,
      offerTotal: Math.round(offerTotal * 100) / 100,
    };
  }, [items, subscriberIsAnnual, annualQuotesByProgram, currency, toDisplay]);

  const cartProgramIdsForUrgency = useMemo(
    () =>
      [...new Set(items.filter((i) => i.type !== 'session').map((i) => String(i.programId).trim()).filter(Boolean))],
    [items],
  );

  const [autoDiscounts, setAutoDiscounts] = useState({
    group_discount: 0,
    combo_discount: 0,
    loyalty_discount: 0,
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
          program_ids: items.map((i) => i.programId),
          cart_items: items.map((i) => ({ program_id: i.programId, tier_index: i.tierIndex })),
        });
        setAutoDiscounts(res.data);
      } catch {
        setAutoDiscounts({
          group_discount: 0,
          combo_discount: 0,
          loyalty_discount: 0,
          total_discount: 0,
        });
      }
    };
    const timer = setTimeout(fetchDiscounts, 300);
    return () => clearTimeout(timer);
  }, [subtotal, totalParticipants, numPrograms, bookerEmail, currency, items]);

  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await axios.post(`${API}/promotions/validate`, {
        code: promoCode.trim(),
        program_id: items[0]?.programId,
        currency,
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
    if (promoResult.discount_type === 'percentage')
      return Math.round(subtotal * promoResult.discount_percentage / 100);
    return promoResult[`discount_${currency}`] || promoResult.discount_aed || 0;
  })();
  const totalAutoDiscount =
    (autoDiscounts.group_discount || 0) +
    (autoDiscounts.combo_discount || 0) +
    (autoDiscounts.loyalty_discount || 0);
  const totalDiscountAmount = totalAutoDiscount + discount;
  const total = Math.max(0, subtotal - discount - totalAutoDiscount);

  /** INR: same stack as India payment page (Client Garden + Payment Settings) on net after cart promos. */
  const indiaBreakdown = useMemo(() => {
    if (String(currency).toLowerCase() !== 'inr') return null;
    return computeIndiaCheckoutBreakdown(total, clientIndiaPricing, {
      india_alt_discount_percent: paymentSettings.india_alt_discount_percent,
      india_gst_percent: paymentSettings.india_gst_percent,
      india_platform_charge_percent: paymentSettings.india_platform_charge_percent,
    });
  }, [
    currency,
    total,
    clientIndiaPricing,
    paymentSettings.india_alt_discount_percent,
    paymentSettings.india_gst_percent,
    paymentSettings.india_platform_charge_percent,
  ]);

  const payableTotal = indiaBreakdown ? indiaBreakdown.roundedTotal : total;

  const pmLower = useMemo(
    () => paymentMethods.map((x) => String(x).toLowerCase()),
    [paymentMethods],
  );
  const hasStripe = pmLower.includes('stripe');
  const memberExlyTagged = pmLower.includes('exly');
  /** Subscriber has India-tagged methods from admin (UPI / bank / manual) — show proof paths even when IP ≠ IN. */
  const memberIndiaTagged =
    pmLower.includes('gpay') || pmLower.includes('bank') || pmLower.includes('manual');
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
    if (promoFromUrlApplied.current || checkoutPromoVisible !== true || items.length === 0) return;
    const code = searchParams.get('promo');
    if (!code?.trim()) return;
    promoFromUrlApplied.current = true;
    axios
      .post(`${API}/promotions/validate`, {
        code: code.trim(),
        program_id: items[0]?.programId,
        currency,
      })
      .then((r) => {
        setPromoResult(r.data);
        setPromoCode(code.trim().toUpperCase());
      })
      .catch(() => {});
  }, [checkoutPromoVisible, items.length, items, currency, searchParams]);

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
        if (!p.country) {
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
          if (!p.email || !p.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
            toast({
              title: `${item.programTitle}: Participant ${i + 1} needs a valid email`,
              variant: 'destructive',
            });
            return false;
          }
          if (!p.phone || !p.phone.trim()) {
            toast({
              title: `${item.programTitle}: Participant ${i + 1} needs a phone number`,
              variant: 'destructive',
            });
            return false;
          }
        }
      }
    }
    return true;
  }, [items, toast]);

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
            country: p.country,
            city: p.city,
            state: p.state,
            attendance_mode: p.attendance_mode,
            notify: p.notify,
            email: p.email || null,
            phone: p.notify && p.phone ? `${p.phone_code || ''}${p.phone}` : null,
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
                portal_cart_lines: programLines.map((i) => ({
                  program_id: String(i.programId),
                  tier_index: i.tierIndex ?? 0,
                  family_member_ids: (i.portalLineMeta?.familyIds || []).map(String),
                  booker_joins: i.portalLineMeta?.bookerJoins !== false,
                })),
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
      const next = new URLSearchParams();
      next.set('eid', eid);
      if (promoResult?.code) next.set('promo', promoResult.code);
      else if (promoCode) next.set('promo', promoCode);
      setSearchParams(next, { replace: true });
    } catch (err) {
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
        tier_index: firstItem.tierIndex,
        points_to_redeem:
          pointsSummary?.enabled ? Math.max(0, parseInt(String(pointsToRedeem), 10) || 0) : 0,
        cart_items: items.map((i) => ({
          program_id: i.programId,
          tier_index: i.tierIndex,
          participants_count: i.participants.length,
        })),
        browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        browser_languages: navigator.languages ? [...navigator.languages] : [navigator.language],
      });
      suppressEmptyCartRedirectRef.current = true;
      clearCart();
      if (res.data.url === '__FREE_SUCCESS__') {
        navigate(`/payment/success?session_id=${res.data.session_id}`);
      } else {
        window.location.href = res.data.url;
      }
    } catch (err) {
      toast({
        title: 'Payment Error',
        description: err.response?.data?.detail || 'Try again',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

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
            keeps your seat list until checkout finishes; it clears when payment is complete or after you submit proof and
            we detect a completed enrollment.
          </p>
          <div className="mt-3 rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-2.5">
            <PaymentMethodTags methods={paymentMethods} />
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
              subscriberIsAnnual && meta?.annualIncluded && String(p.relationship || '').trim() === 'Myself';
            const lineQuote = annualQuotesByProgram[String(item.programId)] || null;
            const guestBucketById = meta?.guestBucketById || {};
            const portalBase =
              subscriberIsAnnual && lineQuote && !selfIncluded
                ? annualPortalSeatUnitBasePrices(lineQuote, p, guestBucketById)
                : null;
            const unitOffer = selfIncluded
              ? 0
              : portalBase
                ? toDisplay(portalBase.offer)
                : getItemOfferPrice(item);
            const unitList = selfIncluded
              ? 0
              : portalBase
                ? toDisplay(portalBase.list)
                : getItemPrice(item);
            return (
              <div
                key={key}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 py-3.5 text-xs sm:text-sm text-gray-900 leading-snug"
              >
                <div className="sm:col-span-1 text-gray-500 tabular-nums font-medium">{n + 1}</div>
                <div className="sm:col-span-3 min-w-0 break-words">
                  <span className="text-gray-500 text-[11px] uppercase tracking-wide sm:hidden">Program · </span>
                  <span className="font-medium text-gray-900">{item.programTitle}</span>
                </div>
                <div className="sm:col-span-2 min-w-0 break-words">
                  <span className="text-gray-500 text-[11px] uppercase tracking-wide sm:hidden">Name · </span>
                  {name}
                </div>
                <div className="sm:col-span-2 min-w-0 break-words text-gray-700">
                  <span className="text-gray-500 text-[11px] uppercase tracking-wide sm:hidden">Role · </span>
                  {role}
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
                    <span className="text-emerald-700 font-semibold text-xs sm:text-sm">Package</span>
                  ) : unitOffer > 0 ? (
                    <span className="inline-flex flex-col sm:flex-row sm:items-end sm:gap-1 sm:justify-end">
                      <span className="text-[#D4AF37] font-semibold">
                        {symbol} {unitOffer.toLocaleString()}
                      </span>
                      {unitList > unitOffer ? (
                        <span className="line-through text-gray-400 text-xs font-normal">
                          {symbol} {unitList.toLocaleString()}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="font-semibold text-gray-900">
                      {symbol} {unitList.toLocaleString()}
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
          {seatListOfferRollup.listTotal > seatListOfferRollup.offerTotal ? (
            <div className="text-center mb-4 pb-3 border-b border-gray-100">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em] text-gray-500 mb-2">
                Program prices — list → offer
              </p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tabular-nums leading-tight">
                <span className="line-through decoration-2 text-gray-400">
                  {symbol}
                  {seatListOfferRollup.listTotal.toLocaleString()}
                </span>
                <span className="mx-2 sm:mx-3 text-gray-300 font-light">–</span>
                <span className="text-[#D4AF37]">
                  {symbol}
                  {seatListOfferRollup.offerTotal.toLocaleString()}
                </span>
              </p>
              <p className="text-sm sm:text-base font-semibold text-green-700 mt-2 tabular-nums">
                Save {symbol}
                {(seatListOfferRollup.listTotal - seatListOfferRollup.offerTotal).toLocaleString()} on listed prices
              </p>
            </div>
          ) : null}
          <div className="flex justify-between text-sm text-gray-700">
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
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Promo ({promoResult?.code})</span>
              <span className="tabular-nums">
                -{symbol} {discount.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold text-green-800 border-t border-dashed border-green-200/80 pt-2 mt-2">
            <span>Total discount</span>
            <span className="tabular-nums">
              {totalDiscountAmount > 0 ? `-${symbol} ${totalDiscountAmount.toLocaleString()}` : `${symbol} 0`}
            </span>
          </div>
          {indiaBreakdown ? (
            <div
              className="space-y-1 border border-amber-200/80 bg-amber-50/50 rounded-lg px-3 py-2.5 mt-2"
              data-testid="divine-cart-india-settlement"
            >
              <p className="text-[9px] font-bold uppercase tracking-wide text-amber-900/90 mb-0.5">
                India (INR) — matches Client Garden &amp; payment settings
              </p>
              <div className="flex justify-between text-sm text-amber-950">
                <span>
                  {indiaBreakdown.discountLabel} ({indiaBreakdown.discountPct}%)
                </span>
                <span className="tabular-nums">
                  -{symbol} {Math.round(indiaBreakdown.discountAmt).toLocaleString()}
                </span>
              </div>
              {indiaBreakdown.gstPct > 0 ? (
                <div className="flex justify-between text-sm text-amber-950">
                  <span>
                    {indiaBreakdown.taxLabel} ({indiaBreakdown.gstPct}%)
                  </span>
                  <span className="tabular-nums">{symbol} {Math.round(indiaBreakdown.gstAmount).toLocaleString()}</span>
                </div>
              ) : null}
              {indiaBreakdown.platformPct > 0 ? (
                <div className="flex justify-between text-sm text-amber-950">
                  <span>Platform ({indiaBreakdown.platformPct}%)</span>
                  <span className="tabular-nums">
                    {symbol} {Math.round(indiaBreakdown.platformAmount).toLocaleString()}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-between font-bold text-lg sm:text-xl border-t border-gray-200 pt-3 mt-2">
            <span>Total</span>
            <span className="text-[#D4AF37] tabular-nums">
              {displayCheckoutTotal <= 0 ? 'FREE' : `${symbol} ${displayCheckoutTotal.toLocaleString()}`}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="w-full">
          <div className="bg-white/95 backdrop-blur rounded-xl border border-white/40 shadow-lg p-6 sm:p-7">
            {checkoutPromoVisible && (
              <div className="mb-4 pb-4 border-b border-gray-100">
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
                {promoResult && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded p-2 flex items-center gap-1">
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
