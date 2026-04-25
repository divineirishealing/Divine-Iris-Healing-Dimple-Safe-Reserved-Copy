import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Sparkles,
  Users,
  Loader2,
  Plus,
  Trash2,
  CreditCard,
  Clock,
  AlertTriangle,
  Lock,
  Bell,
  BellOff,
  Monitor,
  Wifi,
  Send,
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { useCart, normalizeCartProgramTier } from '../../context/CartContext';
import {
  pickTierIndexForDashboard,
  programIncludedInAnnualPackage,
  programTierIsYearLong,
  nonYearLongTierIndices,
  mergeDashboardQuoteResponses,
  resolveEffectiveGuestTierForQuote,
  defaultTierForNewGuestSelection,
} from './dashboardUpcomingHelpers';
import {
  buildAnnualDashboardCartParticipants,
  buildGuestBucketByIdFromSelection,
  buildFullPortalRosterCartParticipants,
  buildSelfOnlyCartParticipants,
  mergeGlobalSeatDraft,
  reconcileSeatDraftsFromPortalCart,
  RECONCILE_CART_FROM_CHECKOUT_KEY,
} from '../../lib/dashboardCartPrefill';
import {
  UPCOMING_SESSION_V,
  UPCOMING_SESSION_MAX_AGE_MS,
  upcomingSessionStorageKey,
} from '../../lib/dashboardUpcomingSessionStorage';
import { getAuthHeaders } from '../../lib/authHeaders';
import DashboardUpcomingProgramRowItem from './DashboardUpcomingProgramRowItem';
import { CrossSellBanner } from '../UpcomingProgramsSection';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

const API = process.env.REACT_APP_BACKEND_URL;

const UPCOMING_IRIS_PETALS = 8;

/** Decorative animated iris for the “Upcoming programs” heading (furl / unfurl bloom). */
function UpcomingProgramsIrisBloom() {
  return (
    <div
      className="relative mx-auto h-12 w-12 shrink-0 md:h-[3.25rem] md:w-[3.25rem]"
      aria-hidden
    >
      <div className="absolute inset-0 flex animate-iris-flower-sway items-center justify-center">
        {Array.from({ length: UPCOMING_IRIS_PETALS }).map((_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 -ml-[5px] -mt-6 h-6 w-[10px] md:-ml-[6px] md:-mt-8 md:h-8 md:w-3"
            style={{
              transform: `rotate(${(360 / UPCOMING_IRIS_PETALS) * i}deg)`,
              transformOrigin: '50% 100%',
            }}
          >
            <div
              className="h-full w-full origin-bottom rounded-full bg-gradient-to-t from-[#5b21b6] via-[#8b5cf6] to-[#e9d5ff] shadow-[0_0_8px_rgba(139,92,246,0.4)] animate-iris-petal-furl"
              style={{ animationDelay: `${i * 0.14}s` }}
            />
          </div>
        ))}
        <div className="absolute left-1/2 top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#fde68a] via-[#f59e0b] to-[#b45309] shadow-[0_1px_4px_rgba(217,119,6,0.4)] ring-1 ring-white/90 animate-pulse md:h-3 md:w-3" />
      </div>
    </div>
  );
}

/** Persisted enrollment seat + email defaults (applies every time this modal opens on this browser). */
const DASHBOARD_ENROLLMENT_DEFAULTS_KEY = 'divine_iris_dashboard_enrollment_defaults_v2';

function loadDashboardEnrollmentDefaults() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DASHBOARD_ENROLLMENT_DEFAULTS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || o.v !== 2) return null;
    return {
      bookerMode: o.bookerMode === 'offline' ? 'offline' : 'online',
      bookerNotify: !!o.bookerNotify,
      guestMode: o.guestMode === 'offline' ? 'offline' : 'online',
      guestNotify: !!o.guestNotify,
      /** When set, per–family-member rows for Custom / mixed layouts (id → seat prefs). */
      guestSeatDefaultsById:
        o.guestSeatDefaultsById && typeof o.guestSeatDefaultsById === 'object'
          ? o.guestSeatDefaultsById
          : null,
    };
  } catch {
    return null;
  }
}

/** Seed one guest row from saved browser defaults (per-id map when present, else uniform guestMode/guestNotify). */
function seatDefaultsForGuestId(saved, id) {
  if (!saved) {
    return { attendance_mode: 'online', notify_enrollment: false };
  }
  const sid = String(id);
  const byId = saved.guestSeatDefaultsById && saved.guestSeatDefaultsById[sid];
  if (byId && typeof byId === 'object') {
    return {
      attendance_mode: byId.attendance_mode === 'offline' ? 'offline' : 'online',
      notify_enrollment: !!byId.notify_enrollment,
    };
  }
  return {
    attendance_mode: saved.guestMode === 'offline' ? 'offline' : 'online',
    notify_enrollment: !!saved.guestNotify,
  };
}

function saveDashboardEnrollmentDefaults(payload) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DASHBOARD_ENROLLMENT_DEFAULTS_KEY, JSON.stringify({ v: 2, ...payload }));
}

function clearDashboardEnrollmentDefaults() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(DASHBOARD_ENROLLMENT_DEFAULTS_KEY);
}

function createEmptySeatDraft() {
  return {
    bookerJoinsProgram: true,
  };
}

/** Restore seat drafts from session without dropping attendance / notify (must match what we persist). */
function sanitizeSeatDraftFromSession(v) {
  if (!v || typeof v !== 'object') return null;
  const row = { bookerJoinsProgram: v.bookerJoinsProgram !== false };
  if (typeof v.familyPaidTierIndex === 'number') row.familyPaidTierIndex = v.familyPaidTierIndex;
  if (v.memberTierById && typeof v.memberTierById === 'object') {
    const mt = {};
    Object.entries(v.memberTierById).forEach(([id, ti]) => {
      if (typeof ti === 'number' && ti >= 0) mt[String(id)] = ti;
    });
    if (Object.keys(mt).length) row.memberTierById = mt;
  }
  if (v.bookerSeatMode === 'offline' || v.bookerSeatMode === 'online') {
    row.bookerSeatMode = v.bookerSeatMode;
  }
  if (v.bookerSeatNotify !== undefined && v.bookerSeatNotify !== null) {
    row.bookerSeatNotify = !!v.bookerSeatNotify;
  }
  if (v.guestSeatForm && typeof v.guestSeatForm === 'object') {
    const gf = {};
    Object.entries(v.guestSeatForm).forEach(([gid, g]) => {
      if (!g || typeof g !== 'object') return;
      const id = String(gid);
      const am = g.attendance_mode === 'offline' ? 'offline' : 'online';
      gf[id] = {
        attendance_mode: am,
        notify_enrollment: !!g.notify_enrollment,
      };
    });
    if (Object.keys(gf).length) row.guestSeatForm = gf;
  }
  return row;
}

/** Matches modal state to a bulk attendance preset (for radio / checkbox group). */
function deriveAttendanceQuickPreset(ctx, guestForm, bookerMode) {
  if (!ctx) return 'custom';
  const { includedPkg, selectedIds } = ctx;
  const ids = (selectedIds || []).map(String);
  const allGuestsOnline = ids.length === 0 || ids.every((id) => guestForm[id]?.attendance_mode !== 'offline');
  const allGuestsOffline = ids.length > 0 && ids.every((id) => guestForm[id]?.attendance_mode === 'offline');
  const bOn = bookerMode !== 'offline';
  const bOff = bookerMode === 'offline';
  if (!includedPkg) {
    if (ids.length === 0) {
      if (bOn) return 'all_online';
      if (bOff) return 'all_offline';
      return 'custom';
    }
    if (bOn && allGuestsOnline) return 'all_online';
    if (bOff && allGuestsOffline) return 'all_offline';
    if (bOn && allGuestsOffline) return 'except_me';
  } else {
    if (allGuestsOnline) return 'all_online';
    if (allGuestsOffline && ids.length > 0) return 'all_offline';
  }
  return 'custom';
}

/** Matches modal notify state to bulk email preset: email_all | email_me_only | custom | mixed */
function deriveNotifyQuickPreset(ctx, guestForm, bookerNotify) {
  if (!ctx) return 'mixed';
  const { includedPkg, selectedIds } = ctx;
  const ids = (selectedIds || []).map(String);
  const gOn = (id) => !!guestForm[id]?.notify_enrollment;
  const gAllOn = ids.length === 0 || ids.every((id) => gOn(id));
  const gAllOff = ids.length === 0 || ids.every((id) => !gOn(id));
  const bOn = !!bookerNotify;
  const bOff = !bookerNotify;

  if (!includedPkg) {
    if (ids.length === 0) {
      if (bOff) return 'custom';
      if (bOn) return 'email_all';
      return 'mixed';
    }
    if (bOn && gAllOn) return 'email_all';
    if (bOn && gAllOff) return 'email_me_only';
    if (bOff && gAllOff) return 'custom';
    return 'mixed';
  }
  if (ids.length === 0) {
    if (bOn) return 'email_me_only';
    return 'custom';
  }
  if (gAllOn) return 'email_all';
  if (gAllOff) {
    if (bOn) return 'email_me_only';
    return 'custom';
  }
  return 'mixed';
}

/** Cap parallel quote / promo requests (matches backend upcoming program list cap). */
const DASHBOARD_UPCOMING_PREFETCH_LIMIT = 100;

/** Immediate family — household relations for enrollments. */
const RELATIONSHIPS = [
  'Mother',
  'Father',
  'Sister',
  'Brother',
  'Husband',
  'Wife',
  'Son',
  'Daughter',
  'Household',
  'Other',
];
const LEGACY_IMMEDIATE_REL = {
  Guardian: 'Mother',
  Dependent: 'Son',
  'Extended family': 'Brother',
  Parent: 'Mother',
  Child: 'Son',
  Sibling: 'Brother',
  Spouse: 'Other',
  Partner: 'Other',
  Grandmother: 'Other',
  Grandfather: 'Other',
};

const OTHER_RELATIONSHIPS = [
  'Friend',
  'Cousin',
  'Uncle',
  'Aunt',
  'Grandparent',
  'Relative',
  'Colleague',
  'Other',
];
const LEGACY_OTHER_REL = {
  Connection: 'Friend',
  Community: 'Relative',
  'Uncle / Aunt': 'Uncle',
};

function GuestMemberTable({
  members,
  setMembers,
  relationships,
  relationshipFallback,
  legacyRelationshipMap = {},
  wrapTestId,
  tableTestId,
  readOnly = false,
  hideRemove = false,
}) {
  const coalesceRelationship = (raw) => {
    const r = (raw || '').trim();
    if (relationships.includes(r)) return r;
    const mapped = legacyRelationshipMap[r];
    if (mapped && relationships.includes(mapped)) return mapped;
    return relationshipFallback;
  };
  const updateRow = (idx, field, value) => {
    setMembers((m) => {
      const next = [...m];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };
  const removeRow = (idx) => {
    setMembers((m) => m.filter((_, i) => i !== idx));
  };

  return (
    <div
      className="overflow-x-auto rounded-lg border border-slate-200/90 bg-white shadow-sm"
      data-testid={wrapTestId}
    >
      <table className="w-full min-w-[980px] text-left border-collapse" data-testid={tableTestId}>
        <thead>
          <tr className="bg-slate-100/95 border-b border-slate-200">
            <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap min-w-[7rem]">
              Name
            </th>
            <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap min-w-[7.5rem]">
              Relation
            </th>
            <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap w-[8.5rem]">
              Date of birth
            </th>
            <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap w-[3.5rem]">
              Age
            </th>
            <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap min-w-[5rem]">
              City
            </th>
            <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap min-w-[7.5rem]">
              Country
            </th>
            <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap min-w-[8rem]">
              Email
            </th>
            <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap min-w-[6.5rem]">
              Phone
            </th>
            <th className="px-1 py-2 w-10" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {members.map((m, idx) => {
            const rowReadOnly = readOnly;
            return (
            <tr
              key={m.id || `row-${idx}`}
              className="border-b border-slate-100 last:border-0 hover:bg-violet-50/30 transition-colors"
            >
              <td className="px-2 py-1.5 align-middle">
                <input
                  value={m.name}
                  onChange={(e) => updateRow(idx, 'name', e.target.value)}
                  disabled={rowReadOnly}
                  className="w-full min-w-[6rem] text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="Full name"
                />
              </td>
              <td className="px-2 py-1.5 align-middle">
                <select
                  value={coalesceRelationship(m.relationship)}
                  onChange={(e) => updateRow(idx, 'relationship', e.target.value)}
                  disabled={rowReadOnly}
                  className="w-full min-w-[7rem] max-w-[10rem] text-[11px] border border-slate-200 rounded px-1 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
                >
                  {relationships.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-2 py-1.5 align-middle">
                <input
                  type="date"
                  value={(m.date_of_birth || '').slice(0, 10)}
                  disabled={rowReadOnly}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMembers((prev) => {
                      const next = [...prev];
                      const cur = { ...next[idx], date_of_birth: v };
                      if (v) {
                        const d = new Date(`${v}T12:00:00`);
                        if (!Number.isNaN(d.getTime())) {
                          const today = new Date();
                          let age = today.getFullYear() - d.getFullYear();
                          const mdiff = today.getMonth() - d.getMonth();
                          if (mdiff < 0 || (mdiff === 0 && today.getDate() < d.getDate())) age -= 1;
                          cur.age = String(Math.max(0, age));
                        }
                      }
                      next[idx] = cur;
                      return next;
                    });
                  }}
                  className="w-full text-[11px] border border-slate-200 rounded px-1 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
                />
              </td>
              <td className="px-2 py-1.5 align-middle">
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={m.age || ''}
                  onChange={(e) => updateRow(idx, 'age', e.target.value)}
                  disabled={rowReadOnly}
                  className="w-full max-w-[3.5rem] text-[11px] border border-slate-200 rounded px-1 py-1 bg-white tabular-nums disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="—"
                />
              </td>
              <td className="px-2 py-1.5 align-middle">
                <input
                  value={m.city || ''}
                  onChange={(e) => updateRow(idx, 'city', e.target.value)}
                  disabled={rowReadOnly}
                  className="w-full min-w-[4rem] text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="City"
                />
              </td>
              <td className="px-2 py-1.5 align-middle">
                <input
                  value={m.country || ''}
                  onChange={(e) => updateRow(idx, 'country', e.target.value.slice(0, 120))}
                  disabled={rowReadOnly}
                  className="w-full min-w-[6.5rem] text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="e.g. India"
                  title="Full country name"
                />
              </td>
              <td className="px-2 py-1.5 align-middle">
                <input
                  value={m.email || ''}
                  onChange={(e) => updateRow(idx, 'email', e.target.value)}
                  disabled={rowReadOnly}
                  className="w-full min-w-[7rem] text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="Optional"
                />
              </td>
              <td className="px-2 py-1.5 align-middle">
                <input
                  value={m.phone || ''}
                  onChange={(e) => updateRow(idx, 'phone', e.target.value)}
                  disabled={rowReadOnly}
                  className="w-full min-w-[5.5rem] text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="Optional"
                />
              </td>
              <td className="px-1 py-1.5 align-middle text-center">
                {!rowReadOnly && !hideRemove ? (
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 inline-flex"
                    aria-label="Remove row"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getDeadlineTimeLeft(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { expired: true };
  return {
    expired: false,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

/** Matches public upcoming cards: countdown to nearest deadline/start in the list. */
function DashboardEnrollmentCountdown({ deadline, programTitle }) {
  const [timeLeft, setTimeLeft] = useState(() => getDeadlineTimeLeft(deadline));
  useEffect(() => {
    if (!deadline) return undefined;
    const tick = () => setTimeLeft(getDeadlineTimeLeft(deadline));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline || !timeLeft) return null;
  if (timeLeft.expired) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600/90">
        <AlertTriangle size={12} className="shrink-0" />
        Registration closed{programTitle ? ` · ${programTitle}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-800 min-w-0">
      <Clock size={12} className="text-[#b8860b] shrink-0 animate-pulse" />
      <span className="tabular-nums tracking-tight">
        {timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}
        {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:
        {String(timeLeft.seconds).padStart(2, '0')}
      </span>
      <span className="text-slate-500 font-normal truncate max-w-[11rem]">left · {programTitle || 'Next intake'}</span>
    </span>
  );
}

export default function DashboardUpcomingFamilySection({ homeData, onRefresh, bookerEmail = '' }) {
  const navigate = useNavigate();
  const { syncProgramLineItem, removeItem, items: cartItems, itemCount } = useCart();
  const { toast } = useToast();
  const { settings: siteSettings } = useSiteSettings();
  const { user } = useAuth();
  const annualIncludedIds = siteSettings?.annual_package_included_program_ids;
  const {
    getPrice,
    getOfferPrice,
    symbol,
    currency,
    baseCurrency,
    ready: currencyReady,
    displayCurrency,
    isPrimary,
    displayRate,
    country: detectedCountry,
  } = useCurrency();

  /**
   * INR portal hub for quotes + Divine Cart — mirrors EnrollmentPage `showIndiaHubPricing` so Sacred Home
   * does not show USD when detect/cache lags but the booker still qualifies (whitelist, IN override, hub inr).
   * Server GET /dashboard-quote still runs assert_claimed_hub_matches_stripe; rules stay aligned with /currency/detect.
   */
  const showIndiaHubPricingForPortal = useMemo(() => {
    if (baseCurrency === 'inr') return true;
    const em = (bookerEmail || user?.email || '').toLowerCase().trim();
    if (em) {
      const rows = Array.isArray(siteSettings?.pricing_hub_email_overrides)
        ? siteSettings.pricing_hub_email_overrides
        : [];
      for (const row of rows) {
        if (String(row.email || '').toLowerCase().trim() !== em) continue;
        const h = String(row.hub || '').toLowerCase().trim();
        if (h === 'inr') return true;
      }
    }
    if ((user?.pricing_country_override || '').toUpperCase() === 'IN') return true;
    const wl = (siteSettings?.inr_whitelist_emails || [])
      .map((e) => String(e).toLowerCase().trim())
      .filter(Boolean);
    if (em && wl.includes(em)) return true;
    return false;
  }, [
    baseCurrency,
    siteSettings?.pricing_hub_email_overrides,
    siteSettings?.inr_whitelist_emails,
    user?.pricing_country_override,
    user?.email,
    bookerEmail,
  ]);

  const portalQuoteCurrency = currencyReady ? (showIndiaHubPricingForPortal ? 'inr' : currency) : 'aed';

  const portalQuoteSymbol = portalQuoteCurrency === 'inr' ? '₹' : symbol;

  const rawInrProgramPrice = useCallback((item, tierIndex = null) => {
    if (!item) return 0;
    const tiers = item.duration_tiers || [];
    const hasTiers = item.is_flagship && tiers.length > 0;
    const tier = hasTiers && tierIndex !== null ? tiers[tierIndex] : null;
    const key = 'price_inr';
    return tier ? tier[key] || 0 : item[key] || 0;
  }, []);

  const rawInrProgramOffer = useCallback((item, tierIndex = null) => {
    if (!item) return 0;
    const tiers = item.duration_tiers || [];
    const hasTiers = item.is_flagship && tiers.length > 0;
    const tier = hasTiers && tierIndex !== null ? tiers[tierIndex] : null;
    if (tier) return tier.offer_price_inr || tier.offer_inr || 0;
    return item.offer_price_inr || 0;
  }, []);

  const displayGetPrice = portalQuoteCurrency === 'inr' ? rawInrProgramPrice : getPrice;
  const displayGetOfferPrice = portalQuoteCurrency === 'inr' ? rawInrProgramOffer : getOfferPrice;
  const [saving, setSaving] = useState(false);
  const [promoByProgramId, setPromoByProgramId] = useState({});
  const [promoPricesLoading, setPromoPricesLoading] = useState(false);
  const [selectedFamilyByProgram, setSelectedFamilyByProgram] = useState({});
  const [annualQuotes, setAnnualQuotes] = useState({});
  /** Per-program flagship tier (1 mo / 3 mo / annual) for portal quotes + cart line. */
  const [dashboardTierByProgram, setDashboardTierByProgram] = useState({});
  const [enrollmentSeatOpen, setEnrollmentSeatOpen] = useState(false);
  const [syncingEnrollmentToCheckout, setSyncingEnrollmentToCheckout] = useState(false);
  const [seatModalCtx, setSeatModalCtx] = useState(null);
  const [bookerSeatMode, setBookerSeatMode] = useState('online');
  const [bookerSeatNotify, setBookerSeatNotify] = useState(true);
  const [guestSeatForm, setGuestSeatForm] = useState({});
  const [enrollmentDefaultsLoaded, setEnrollmentDefaultsLoaded] = useState(false);
  const [persistEnrollmentDefaultsOnContinue, setPersistEnrollmentDefaultsOnContinue] = useState(false);
  const [seatDraftsByProgram, setSeatDraftsByProgram] = useState({});
  const seatDraftsRef = useRef({});
  /** Latest Sacred Home snapshot for synchronous / unmount flush (rAF + no unmount save dropped tier & attendance). */
  const upcomingSessionPersistRef = useRef(null);
  const enrollmentPrefillCacheRef = useRef(null);
  const [enrollmentSelf, setEnrollmentSelf] = useState(null);
  const [crossSellRules, setCrossSellRules] = useState([]);
  const [catalogProgramsForCrossSell, setCatalogProgramsForCrossSell] = useState([]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/api/discounts/settings`)
      .then((r) => {
        if (cancelled) return;
        if (r.data?.enable_cross_sell && Array.isArray(r.data.cross_sell_rules) && r.data.cross_sell_rules.length > 0) {
          setCrossSellRules(r.data.cross_sell_rules.filter((rule) => rule.enabled !== false));
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

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/api/programs?visible_only=true`)
      .then((r) => {
        if (cancelled) return;
        setCatalogProgramsForCrossSell(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {
        if (!cancelled) setCatalogProgramsForCrossSell([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    seatDraftsRef.current = seatDraftsByProgram;
  }, [seatDraftsByProgram]);

  /** Enrollment modal presets use this program’s draft merged with globals (fallback for new programs). */
  const attendanceQuickPresetLive = useMemo(() => {
    if (!seatModalCtx?.programId) return 'custom';
    const m = mergeGlobalSeatDraft(
      seatDraftsByProgram[seatModalCtx.programId] || {},
      bookerSeatMode,
      bookerSeatNotify,
      guestSeatForm,
    );
    return deriveAttendanceQuickPreset(seatModalCtx, m.guestSeatForm || {}, m.bookerSeatMode || 'online');
  }, [seatModalCtx, seatDraftsByProgram, bookerSeatMode, bookerSeatNotify, guestSeatForm]);

  const notifyQuickPresetLive = useMemo(() => {
    if (!seatModalCtx?.programId) return 'custom';
    const m = mergeGlobalSeatDraft(
      seatDraftsByProgram[seatModalCtx.programId] || {},
      bookerSeatMode,
      bookerSeatNotify,
      guestSeatForm,
    );
    return deriveNotifyQuickPreset(seatModalCtx, m.guestSeatForm || {}, m.bookerSeatNotify !== false);
  }, [seatModalCtx, seatDraftsByProgram, bookerSeatMode, bookerSeatNotify, guestSeatForm]);

  /** Single merged view for the open enrollment modal (this program + global fallbacks). */
  const modalSeatMerged = useMemo(() => {
    if (!seatModalCtx?.programId) return null;
    return mergeGlobalSeatDraft(
      seatDraftsByProgram[seatModalCtx.programId] || {},
      bookerSeatMode,
      bookerSeatNotify,
      guestSeatForm,
    );
  }, [seatModalCtx?.programId, seatDraftsByProgram, bookerSeatMode, bookerSeatNotify, guestSeatForm]);

  const upcomingList = homeData?.upcoming_programs || [];
  const programsForPrefetch = useMemo(
    () => upcomingList.slice(0, DASHBOARD_UPCOMING_PREFETCH_LIMIT),
    [upcomingList]
  );
  const offers = homeData?.dashboard_offers || {};
  const annualOffer = offers.annual || {};
  const familyOffer = offers.family || {};
  const extendedOffer = offers.extended || {};
  /** Subscription / schedule heuristics (year-long tier, modal paths). */
  const isAnnualSubscriber = homeData?.is_annual_subscriber;
  /**
   * Effective annual portal pricing (CRM Annual or subscription-shaped package). Matches backend
   * `annual_portal_access` on GET /student/home.
   */
  const annualPortalAccess =
    homeData?.annual_portal_access != null
      ? !!homeData.annual_portal_access
      : !!(homeData?.annual_member_dashboard || homeData?.subscription_annual_package_signals);
  const immediateFamilyLocked = !!homeData?.immediate_family_locked;
  const immediateFamilyEditApproved = homeData?.immediate_family_editing_approved !== false;
  const familyApproved = !!homeData?.family_approved;
  const familyPendingReview = !!homeData?.family_pending_review;
  // Permanently frozen once approved; otherwise locked until admin temporarily re-opens
  const immediateFamilyReadOnly = familyApproved || (immediateFamilyLocked && !immediateFamilyEditApproved);
  const initialMembers = useMemo(() => homeData?.immediate_family || [], [homeData?.immediate_family]);
  const initialOtherMembers = useMemo(() => homeData?.other_guests || [], [homeData?.other_guests]);
  const annualHouseholdPeers = useMemo(() => homeData?.annual_household_peers || [], [homeData?.annual_household_peers]);
  const annualHouseholdClubOk = !!homeData?.annual_household_club_ok;
  const hasHouseholdKey = !!homeData?.has_household_key;
  /** Only this login may add linked same-key clients as paid seats (checkout / enrollment). */
  const isPrimaryHouseholdContact = !!homeData?.is_primary_household_contact;

  /** Editable copy of Annual Family Club rows (primary contact updates peer Client Garden profiles). */
  const [annualPeersDraft, setAnnualPeersDraft] = useState(() =>
    (annualHouseholdPeers || []).map((row) => ({ ...row })),
  );
  useEffect(() => {
    setAnnualPeersDraft((annualHouseholdPeers || []).map((row) => ({ ...row })));
  }, [annualHouseholdPeers]);

  /**
   * Sacred Home lists all same-key Annual peers for visibility; enrollment/cart only allows them once
   * the household is fully clubbed (matches backend for_payment / quote resolution).
   */
  const enrollableAnnualHouseholdPeers = useMemo(
    () => (annualHouseholdClubOk ? annualPeersDraft : []),
    [annualHouseholdClubOk, annualPeersDraft],
  );

  const [members, setMembers] = useState(() => initialMembers);
  React.useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  const manualImmediateFamilyCount = useMemo(() => members.length, [members]);

  const [otherMembers, setOtherMembers] = useState(() => initialOtherMembers);
  React.useEffect(() => {
    setOtherMembers(initialOtherMembers);
  }, [initialOtherMembers]);

  const enrollableGuests = useMemo(() => {
    const base = [...members, ...otherMembers];
    if (isPrimaryHouseholdContact) return [...base, ...enrollableAnnualHouseholdPeers];
    return base;
  }, [members, otherMembers, isPrimaryHouseholdContact, enrollableAnnualHouseholdPeers]);

  /** Merge duplicate ids so household-peer flags win — matches Divine Cart / dashboard-quote buckets. */
  const bucketLookupMembers = useMemo(() => {
    const byId = new Map();
    for (const m of enrollableGuests) {
      if (!m?.id) continue;
      const id = String(m.id);
      const prev = byId.get(id);
      byId.set(id, prev ? { ...prev, ...m } : m);
    }
    return Array.from(byId.values());
  }, [enrollableGuests]);

  const enrollableGuestIdsKey = useMemo(
    () =>
      enrollableGuests
        .filter((m) => m.id)
        .map((m) => String(m.id))
        .sort()
        .join(','),
    [enrollableGuests]
  );

  const annualHouseholdPeerIdsKey = useMemo(
    () =>
      annualPeersDraft
        .filter((m) => m.id)
        .map((m) => String(m.id))
        .sort()
        .join(','),
    [annualPeersDraft]
  );

  const familyRowCount = members.length + otherMembers.length + annualPeersDraft.length;

  const restoredUpcomingRef = useRef(false);
  /** False until Sacred Home session is read from sessionStorage — avoids autosave wiping tiers/attendance with empty initial state. */
  const [upcomingSessionHydrated, setUpcomingSessionHydrated] = useState(false);

  useEffect(() => {
    restoredUpcomingRef.current = false;
    setUpcomingSessionHydrated(false);
  }, [bookerEmail]);

  const nearestUpcomingProgram = useMemo(() => {
    const list = upcomingList
      .filter((p) => p && (p.deadline_date || p.start_date))
      .sort((a, b) =>
        String(a.deadline_date || a.start_date || '').localeCompare(String(b.deadline_date || b.start_date || ''))
      );
    return list[0] || null;
  }, [upcomingList]);
  const countdownDeadline = nearestUpcomingProgram
    ? nearestUpcomingProgram.deadline_date || nearestUpcomingProgram.start_date
    : null;
  const exclusiveSiteOffer = siteSettings?.exclusive_offer || {};
  const exclusiveOfferLine =
    exclusiveSiteOffer.enabled && String(exclusiveSiteOffer.text || '').trim()
      ? String(exclusiveSiteOffer.text).trim()
      : '';
  const showOfferCountdownStrip = Boolean(exclusiveOfferLine || countdownDeadline);

  if (bookerEmail && upcomingSessionHydrated) {
    upcomingSessionPersistRef.current = {
      selectedFamilyByProgram,
      seatDraftsByProgram,
      enrollmentSeatOpen,
      seatModalCtx,
      bookerSeatMode,
      bookerSeatNotify,
      guestSeatForm,
      persistEnrollmentDefaultsOnContinue,
      enrollmentDefaultsLoaded,
    };
  }

  useEffect(() => {
    if (typeof sessionStorage === 'undefined' || !bookerEmail) return;
    if (!upcomingSessionHydrated) return;
    const flush = () => {
      try {
        const p = upcomingSessionPersistRef.current;
        if (!p) return;
        sessionStorage.setItem(
          upcomingSessionStorageKey(bookerEmail),
          JSON.stringify({
            v: UPCOMING_SESSION_V,
            savedAt: Date.now(),
            ...p,
          })
        );
      } catch (_) {
        /* ignore quota / private mode */
      }
    };
    flush();
    const onPageHide = () => flush();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      flush();
    };
  }, [
    bookerEmail,
    upcomingSessionHydrated,
    selectedFamilyByProgram,
    seatDraftsByProgram,
    enrollmentSeatOpen,
    seatModalCtx,
    bookerSeatMode,
    bookerSeatNotify,
    guestSeatForm,
    persistEnrollmentDefaultsOnContinue,
    enrollmentDefaultsLoaded,
  ]);

  useEffect(() => {
    if (!bookerEmail || !homeData || restoredUpcomingRef.current) return;

    let raw = null;
    try {
      raw = sessionStorage.getItem(upcomingSessionStorageKey(bookerEmail));
    } catch (_) {
      restoredUpcomingRef.current = true;
      setUpcomingSessionHydrated(true);
      return;
    }
    if (!raw) {
      restoredUpcomingRef.current = true;
      const savedDefaults = loadDashboardEnrollmentDefaults();
      if (savedDefaults) {
        setBookerSeatMode(savedDefaults.bookerMode === 'offline' ? 'offline' : 'online');
        setBookerSeatNotify(savedDefaults.bookerNotify !== false);
        setEnrollmentDefaultsLoaded(true);
      }
      setUpcomingSessionHydrated(true);
      return;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      restoredUpcomingRef.current = true;
      setUpcomingSessionHydrated(true);
      return;
    }
    if (!data || data.v !== UPCOMING_SESSION_V) {
      restoredUpcomingRef.current = true;
      setUpcomingSessionHydrated(true);
      return;
    }
    if (Date.now() - (data.savedAt || 0) > UPCOMING_SESSION_MAX_AGE_MS) {
      restoredUpcomingRef.current = true;
      setUpcomingSessionHydrated(true);
      return;
    }

    const programs = homeData?.upcoming_programs || [];
    const programIds = new Set(programs.map((p) => String(p.id)));
    let seatOpen = !!data.enrollmentSeatOpen;
    let seatCtx = data.seatModalCtx || null;

    if (seatCtx && !programIds.has(String(seatCtx.programId))) {
      seatCtx = null;
      seatOpen = false;
    }

    const guestIdSet = new Set(
      enrollableGuestIdsKey ? enrollableGuestIdsKey.split(',').filter(Boolean) : []
    );
    const seatMemberIds = seatCtx && seatOpen ? (seatCtx.selectedIds || []).map(String).filter(Boolean) : [];
    if (seatMemberIds.length > 0 && guestIdSet.size === 0) {
      if (familyRowCount === 0) return;
      seatCtx = null;
      seatOpen = false;
    } else if (seatCtx && seatOpen && seatMemberIds.length > 0) {
      const invalid = seatMemberIds.some((id) => !guestIdSet.has(id));
      if (invalid) {
        seatCtx = null;
        seatOpen = false;
      }
    }

    restoredUpcomingRef.current = true;

    const sel = {};
    Object.entries(data.selectedFamilyByProgram || {}).forEach(([k, v]) => {
      if (programIds.has(String(k))) sel[k] = v;
    });
    if (Object.keys(sel).length > 0) setSelectedFamilyByProgram(sel);
    if (data.seatDraftsByProgram && typeof data.seatDraftsByProgram === 'object') {
      const slim = {};
      Object.entries(data.seatDraftsByProgram).forEach(([k, v]) => {
        const row = sanitizeSeatDraftFromSession(v);
        if (row) slim[k] = row;
      });
      setSeatDraftsByProgram(slim);
    }
    if (data.bookerSeatMode !== undefined) {
      setBookerSeatMode(data.bookerSeatMode === 'offline' ? 'offline' : 'online');
    }
    if (data.bookerSeatNotify !== undefined) {
      setBookerSeatNotify(!!data.bookerSeatNotify);
    }
    if (data.guestSeatForm && typeof data.guestSeatForm === 'object') {
      setGuestSeatForm(data.guestSeatForm);
    }
    if (data.persistEnrollmentDefaultsOnContinue !== undefined) {
      setPersistEnrollmentDefaultsOnContinue(!!data.persistEnrollmentDefaultsOnContinue);
    }
    if (data.enrollmentDefaultsLoaded !== undefined) {
      setEnrollmentDefaultsLoaded(!!data.enrollmentDefaultsLoaded);
    }
    if (seatOpen && seatCtx) {
      setSeatModalCtx(seatCtx);
      setEnrollmentSeatOpen(true);
    }
    setUpcomingSessionHydrated(true);
  }, [bookerEmail, homeData, enrollableGuestIdsKey, familyRowCount]);

  /** After Divine Cart, localStorage cart is canonical for tier + attendance; merge into Sacred Home drafts once when returning. */
  useEffect(() => {
    if (!upcomingSessionHydrated || !bookerEmail) return;
    try {
      const raw = sessionStorage.getItem(RECONCILE_CART_FROM_CHECKOUT_KEY);
      if (raw == null || raw === '') return;
      const ts = Number(raw);
      if (!Number.isFinite(ts) || Date.now() - ts > 5 * 60 * 1000) {
        sessionStorage.removeItem(RECONCILE_CART_FROM_CHECKOUT_KEY);
        return;
      }
      sessionStorage.removeItem(RECONCILE_CART_FROM_CHECKOUT_KEY);
    } catch {
      return;
    }

    const { drafts, globalBooker, updated } = reconcileSeatDraftsFromPortalCart(
      seatDraftsByProgram,
      upcomingList,
      cartItems,
    );
    if (updated) {
      setSeatDraftsByProgram(drafts);
      setGuestSeatForm((prev) => {
        const merged = { ...prev };
        for (const d of Object.values(drafts)) {
          const gf = d?.guestSeatForm;
          if (!gf || typeof gf !== 'object') continue;
          for (const [gid, row] of Object.entries(gf)) {
            merged[gid] = { ...(merged[gid] || {}), ...row };
          }
        }
        return merged;
      });
    }
    if (globalBooker?.mode) {
      setBookerSeatMode(globalBooker.mode);
    }
    if (globalBooker && globalBooker.notify !== undefined) {
      setBookerSeatNotify(!!globalBooker.notify);
    }
  }, [
    upcomingSessionHydrated,
    bookerEmail,
    upcomingList,
    cartItems,
    seatDraftsByProgram,
  ]);

  const addRow = () => {
    if (manualImmediateFamilyCount >= 12) return;
    setMembers((m) => [
      ...m,
      {
        id: '',
        name: '',
        relationship: 'Other',
        email: '',
        phone: '',
        date_of_birth: '',
        city: '',
        age: '',
        country: '',
      },
    ]);
  };

  const addOtherRow = () => {
    if (otherMembers.length >= 12) return;
    setOtherMembers((m) => [
      ...m,
      {
        id: '',
        name: '',
        relationship: 'Friend',
        email: '',
        phone: '',
        date_of_birth: '',
        city: '',
        age: '',
        country: '',
      },
    ]);
  };

  const saveFamily = async (submitForReview) => {
    const named = members.filter((m) => (m.name || '').trim());
    if (submitForReview && named.length === 0) {
      toast({
        title: 'Add at least one family member',
        description: 'Enter a name, then send for admin review.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/student/family`,
        {
          submit_for_review: !!submitForReview,
          members: members.map((m) => ({
              id: m.id || undefined,
              name: m.name,
              relationship: m.relationship,
              email: m.email,
              phone: m.phone,
              date_of_birth: m.date_of_birth || '',
              city: m.city || '',
              age: m.age || '',
              country: (m.country || '').trim(),
            })),
        },
        { withCredentials: true }
      );
      toast(
        submitForReview
          ? {
              title: 'Sent for admin review',
              description: 'An admin will confirm your immediate family list — you will be notified when it is set.',
            }
          : {
              title: 'Family list saved',
              description: 'Your changes are saved. Use Send for admin review when you are ready for confirmation.',
            },
      );
      enrollmentPrefillCacheRef.current = null;
      onRefresh?.();
    } catch (err) {
      toast({
        title: 'Could not save',
        description: err.response?.data?.detail || err.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveOtherGuests = async (submitForReview) => {
    const named = otherMembers.filter((m) => (m.name || '').trim());
    if (submitForReview && named.length === 0) {
      toast({
        title: 'Add at least one guest',
        description: 'Enter a name, then send for admin review.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/student/other-guests`,
        {
          submit_for_review: !!submitForReview,
          members: otherMembers.map((m) => ({
            id: m.id || undefined,
            name: m.name,
            relationship: m.relationship,
            email: m.email,
            phone: m.phone,
            date_of_birth: m.date_of_birth || '',
            city: m.city || '',
            age: m.age || '',
            country: (m.country || '').trim(),
          })),
        },
        { withCredentials: true }
      );
      toast(
        submitForReview
          ? {
              title: 'Sent for admin review',
              description: 'An admin will confirm your friends & extended list — you will be notified when it is set.',
            }
          : {
              title: 'Guest list saved',
              description: 'Your friends & extended list has been updated.',
            },
      );
      enrollmentPrefillCacheRef.current = null;
      onRefresh?.();
    } catch (err) {
      toast({
        title: 'Could not save',
        description: err.response?.data?.detail || err.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveHouseholdPeers = async () => {
    if (!isPrimaryHouseholdContact || !hasHouseholdKey) return;
    const rows = annualPeersDraft.filter((m) => (m.id || '').toString().trim());
    if (rows.length === 0) return;
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/student/household-peers`,
        {
          members: rows.map((m) => ({
            id: String(m.id).trim(),
            name: m.name,
            email: m.email,
            phone: m.phone,
            date_of_birth: m.date_of_birth || '',
            city: m.city || '',
            country: (m.country || '').trim(),
          })),
        },
        { withCredentials: true, headers: { ...getAuthHeaders() } },
      );
      toast({
        title: 'Annual Family Club saved',
        description: 'Linked accounts were updated. You can continue to checkout when city and country are complete for each person.',
      });
      enrollmentPrefillCacheRef.current = null;
      onRefresh?.();
    } catch (err) {
      toast({
        title: 'Could not save',
        description: err.response?.data?.detail || err.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  /** Website upcoming cards do not auto-apply dashboard family/extended promos — only Annual+Dashboard uses portal promo codes. */
  const promoForProgramClicks = useMemo(() => {
    if (!annualPortalAccess) return '';
    const a = (annualOffer.promo_code || '').trim();
    return annualOffer.enabled && a ? a : '';
  }, [annualPortalAccess, annualOffer]);

  const prefetchProgramsKey = useMemo(
    () => programsForPrefetch.map((p) => p.id).join(','),
    [programsForPrefetch]
  );

  const familySelectionKey = useMemo(() => {
    return programsForPrefetch
      .map((p) => `${p.id}=${(selectedFamilyByProgram[p.id] || []).slice().sort().join(':')}`)
      .join('|');
  }, [programsForPrefetch, selectedFamilyByProgram]);

  const getDashboardTier = useCallback(
    (p) => {
      const tiers = p.duration_tiers || [];
      if (!p.is_flagship || tiers.length === 0) return 0;
      const saved = dashboardTierByProgram[p.id];
      if (typeof saved === 'number' && saved >= 0 && saved < tiers.length) return saved;
      // Prefer annual tier when effective annual portal access (CRM or subscription-shaped package)
      return pickTierIndexForDashboard(p, !!annualPortalAccess) ?? 0;
    },
    [dashboardTierByProgram, annualPortalAccess]
  );

  /** Cross-sell buy-tier must follow dashboard tier controls, not a stale cart line until the next sync. */
  const resolveCartCrossSellTier = useCallback(
    (programId) => {
      const prog = programsForPrefetch.find((x) => String(x.id) === String(programId));
      if (!prog) return null;
      return getDashboardTier(prog);
    },
    [programsForPrefetch, getDashboardTier]
  );

  const dashboardTierKey = useMemo(
    () => programsForPrefetch.map((p) => `${p.id}:${getDashboardTier(p)}`).join('|'),
    [programsForPrefetch, getDashboardTier]
  );

  useEffect(() => {
    if (!currencyReady) {
      setAnnualQuotes({});
      return;
    }
    if (!annualPortalAccess) {
      setAnnualQuotes({});
      return;
    }
    const programs = programsForPrefetch;
    if (programs.length === 0) {
      setAnnualQuotes({});
      return;
    }
    let cancelled = false;

    const guestTierGroups = (p, idList, draft, uiTier, needsFamilyPaidTier) => {
      const m = new Map();
      for (const gid of idList) {
        const t = resolveEffectiveGuestTierForQuote(p, gid, {
          memberTierById: draft?.memberTierById,
          familyPaidTierIndex: draft?.familyPaidTierIndex,
          uiTier,
          needsFamilyPaidTier,
        });
        if (!m.has(t)) m.set(t, []);
        m.get(t).push(gid);
      }
      return m;
    };

    Promise.all(
      programs.map((p) =>
        (async () => {
          const ids = (selectedFamilyByProgram[p.id] || []).map(String);
          const draft = seatDraftsByProgram[p.id];
          const includedInPkg =
            annualPortalAccess && (programIncludedInAnnualPackage(p, annualIncludedIds) || false);
          const bookerJoins = includedInPkg ? false : draft?.bookerJoinsProgram !== false;
          const uiTier = getDashboardTier(p);
          const paidTierOptions = nonYearLongTierIndices(p);
          const needsFamilyPaidTier =
            includedInPkg &&
            programTierIsYearLong(p, uiTier) &&
            ids.length > 0 &&
            paidTierOptions.length > 0;

          if (ids.length > 0 && needsFamilyPaidTier) {
            for (const gid of ids) {
              const t = resolveEffectiveGuestTierForQuote(p, gid, {
                memberTierById: draft?.memberTierById,
                familyPaidTierIndex: draft?.familyPaidTierIndex,
                uiTier,
                needsFamilyPaidTier,
              });
              if (programTierIsYearLong(p, t)) {
                return {
                  id: p.id,
                  data: { _awaitingFamilyPaidTier: true, program_id: p.id },
                };
              }
            }
          }

          const flagship = p.is_flagship && (p.duration_tiers || []).length > 0;
          const groups = guestTierGroups(p, ids, draft, uiTier, needsFamilyPaidTier);

          const quotePart = async (tierIdx, familyIdsList, bj) => {
            const params = {
              program_id: p.id,
              currency: portalQuoteCurrency,
              booker_joins: bj,
            };
            if (familyIdsList && familyIdsList.length > 0) {
              params.family_ids = familyIdsList.join(',');
            } else {
              params.family_count = 0;
            }
            if (flagship) params.tier_index = tierIdx;
            try {
              const r = await axios.get(`${API}/api/student/dashboard-quote`, {
                params,
                withCredentials: true,
              });
              return { tierIndex: tierIdx, data: r.data };
            } catch {
              return { tierIndex: tierIdx, data: null };
            }
          };

          let parts;
          if (!bookerJoins) {
            if (ids.length === 0) {
              parts = [await quotePart(uiTier, [], false)];
            } else if (groups.size === 1) {
              const [t, gids] = [...groups.entries()][0];
              parts = [await quotePart(t, gids, false)];
            } else {
              parts = await Promise.all(
                [...groups.entries()].map(([t, gids]) => quotePart(t, gids, false)),
              );
            }
          } else if (ids.length === 0) {
            parts = [await quotePart(uiTier, [], true)];
          } else if (groups.size === 1) {
            const [onlyT, gids] = [...groups.entries()][0];
            if (onlyT === uiTier) {
              parts = [await quotePart(uiTier, gids, true)];
            } else {
              const selfP = await quotePart(uiTier, [], true);
              const gP = await quotePart(onlyT, gids, false);
              parts = [selfP, gP];
            }
          } else {
            const selfP = await quotePart(uiTier, [], true);
            const guestPs = await Promise.all(
              [...groups.entries()].map(([t, gids]) => quotePart(t, gids, false)),
            );
            parts = [selfP, ...guestPs];
          }

          if (parts.some((x) => !x.data)) {
            return { id: p.id, data: null };
          }
          const merged = mergeDashboardQuoteResponses(p, parts);
          return { id: p.id, data: merged };
        })()
      )
    ).then((rows) => {
      if (cancelled) return;
      const next = {};
      rows.forEach(({ id, data }) => {
        next[id] = data;
      });
      setAnnualQuotes(next);
    });
    return () => {
      cancelled = true;
    };
  }, [
    annualPortalAccess,
    currencyReady,
    portalQuoteCurrency,
    prefetchProgramsKey,
    familySelectionKey,
    dashboardTierKey,
    programsForPrefetch,
    seatDraftsByProgram,
    getDashboardTier,
    annualIncludedIds,
  ]);

  /** Clear guest paid-duration choice when no family/guests are selected for that program. */
  useEffect(() => {
    setSeatDraftsByProgram((prev) => {
      let next = prev;
      let any = false;
      for (const prog of programsForPrefetch) {
        const pid = prog.id;
        if ((selectedFamilyByProgram[pid] || []).length > 0) continue;
        const d = next[pid];
        if (d && (d.familyPaidTierIndex != null || d.memberTierById)) {
          if (next === prev) next = { ...prev };
          const cur = { ...d };
          delete cur.familyPaidTierIndex;
          delete cur.memberTierById;
          next[pid] = cur;
          any = true;
        }
      }
      return any ? next : prev;
    });
  }, [programsForPrefetch, familySelectionKey]);

  /** Seed per-guest tier defaults when members are newly checked (mixed durations). */
  useEffect(() => {
    setSeatDraftsByProgram((prev) => {
      let next = prev;
      let any = false;
      for (const prog of programsForPrefetch) {
        const pid = prog.id;
        const sel = (selectedFamilyByProgram[pid] || []).map(String);
        const tiers = prog.duration_tiers || [];
        let uiT = dashboardTierByProgram[pid];
        if (typeof uiT !== 'number' || uiT < 0 || uiT >= tiers.length) {
          uiT = pickTierIndexForDashboard(prog, !!annualPortalAccess) ?? 0;
        }
        const includedInPkg =
          annualPortalAccess && (programIncludedInAnnualPackage(prog, annualIncludedIds) || false);
        const needsFam =
          includedInPkg &&
          programTierIsYearLong(prog, uiT) &&
          sel.length > 0 &&
          nonYearLongTierIndices(prog).length > 0;
        const curDraft = { ...(next[pid] || createEmptySeatDraft()) };
        const map = { ...(curDraft.memberTierById || {}) };
        let ch = false;
        for (const id of sel) {
          if (map[id] === undefined) {
            map[id] = defaultTierForNewGuestSelection(prog, uiT, curDraft.familyPaidTierIndex, needsFam);
            ch = true;
          }
        }
        Object.keys(map).forEach((k) => {
          if (!sel.includes(k)) {
            delete map[k];
            ch = true;
          }
        });
        if (ch) {
          if (next === prev) next = { ...prev };
          next[pid] = {
            ...curDraft,
            memberTierById: Object.keys(map).length ? map : undefined,
          };
          any = true;
        }
      }
      return any ? next : prev;
    });
  }, [
    programsForPrefetch,
    familySelectionKey,
    dashboardTierByProgram,
    annualPortalAccess,
    annualIncludedIds,
  ]);

  /** Per-program guest seat rows: each upcoming card keeps its own attendance/notify for selected members. */
  useEffect(() => {
    const saved = loadDashboardEnrollmentDefaults();
    setSeatDraftsByProgram((prev) => {
      let next = prev;
      let any = false;
      for (const prog of programsForPrefetch) {
        const pid = prog.id;
        const sel = (selectedFamilyByProgram[pid] || []).map(String);
        const curDraft = { ...(next[pid] || createEmptySeatDraft()) };
        const gf = { ...(curDraft.guestSeatForm || {}) };
        let ch = false;
        sel.forEach((idStr) => {
          if (!gf[idStr]) {
            gf[idStr] = seatDefaultsForGuestId(saved, idStr);
            ch = true;
          }
        });
        Object.keys(gf).forEach((id) => {
          if (!sel.includes(id)) {
            delete gf[id];
            ch = true;
          }
        });
        if (ch) {
          if (next === prev) next = { ...prev };
          next[pid] = { ...curDraft, guestSeatForm: gf };
          any = true;
        }
      }
      return any ? next : prev;
    });
  }, [programsForPrefetch, selectedFamilyByProgram]);

  useEffect(() => {
    const code = promoForProgramClicks;
    const programs = programsForPrefetch;
    if (!code || !currencyReady || programs.length === 0) {
      setPromoByProgramId({});
      setPromoPricesLoading(false);
      return;
    }
    let cancelled = false;
    setPromoPricesLoading(true);
    Promise.all(
      programs.map((p) =>
        axios
          .post(`${API}/api/promotions/validate`, {
            code,
            program_id: p.id,
            currency: portalQuoteCurrency,
          })
          .then((r) => ({ id: p.id, data: r.data }))
          .catch(() => ({ id: p.id, data: null }))
      )
    ).then((rows) => {
      if (cancelled) return;
      const next = {};
      rows.forEach(({ id, data }) => {
        next[id] = data;
      });
      setPromoByProgramId(next);
      setPromoPricesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [promoForProgramClicks, currencyReady, portalQuoteCurrency, prefetchProgramsKey, programsForPrefetch]);

  const toggleFamilyMember = (programId, memberId) => {
    const mid = String(memberId || '');
    if (!mid) return;
    setSelectedFamilyByProgram((prev) => {
      const cur = new Set(prev[programId] || []);
      if (cur.has(mid)) cur.delete(mid);
      else cur.add(mid);
      return { ...prev, [programId]: [...cur] };
    });
  };

  const selectableFamilyMemberIds = useMemo(
    () => enrollableGuests.filter((m) => m.id).map((m) => String(m.id)),
    [enrollableGuests]
  );

  const toggleSelectAllFamilyForProgram = (programId, memberIds) => {
    const ids =
      memberIds && memberIds.length > 0 ? memberIds : selectableFamilyMemberIds;
    if (ids.length === 0) return;
    setSelectedFamilyByProgram((prev) => {
      const cur = prev[programId] || [];
      const curSet = new Set(cur.map(String));
      const allOn = ids.every((id) => curSet.has(id));
      if (allOn) {
        return { ...prev, [programId]: [] };
      }
      return { ...prev, [programId]: [...ids] };
    });
  };

  /** Included-package programs: same-key household peers are not separate enrollments — drop from selection. */
  useEffect(() => {
    if (!annualPortalAccess || !annualHouseholdPeerIdsKey) return;
    const peerIds = new Set(annualHouseholdPeerIdsKey.split(',').filter(Boolean));
    if (peerIds.size === 0) return;
    setSelectedFamilyByProgram((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const prog of programsForPrefetch) {
        const included =
          programIncludedInAnnualPackage(prog, annualIncludedIds) ||
          annualQuotes[prog.id]?.included_in_annual_package === true;
        if (!included) continue;
        const cur = next[prog.id] || [];
        const filtered = cur.filter((id) => !peerIds.has(String(id)));
        if (filtered.length !== cur.length) {
          next[prog.id] = filtered;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [
    annualPortalAccess,
    annualHouseholdPeerIdsKey,
    programsForPrefetch,
    annualIncludedIds,
    annualQuotes,
  ]);

  const openEnrollmentSeatModal = (program, includedPkg, selectedIds) => {
    const ids = (selectedIds || []).map((x) => String(x));
    const saved = loadDashboardEnrollmentDefaults();
    setGuestSeatForm((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (!next[id]) {
          next[id] = seatDefaultsForGuestId(saved, id);
        }
      });
      return next;
    });
    setSeatModalCtx({
      programId: program.id,
      programTitle: program.title || '',
      includedPkg: !!includedPkg,
      selectedIds: ids,
    });
    setEnrollmentSeatOpen(true);
  };

  const updateGuestSeatField = (memberId, field, value) => {
    if (!seatModalCtx?.programId) return;
    const pid = seatModalCtx.programId;
    const id = String(memberId);
    setSeatDraftsByProgram((prev) => {
      const draft = { ...(prev[pid] || createEmptySeatDraft()) };
      const gf = { ...(draft.guestSeatForm || {}) };
      const baseGlobal = guestSeatForm[id] || {};
      const base = {
        attendance_mode: 'online',
        notify_enrollment: false,
        ...baseGlobal,
        ...gf[id],
        [field]: value,
      };
      gf[id] = base;
      return { ...prev, [pid]: { ...draft, guestSeatForm: gf } };
    });
  };

  /** Bulk attendance presets for the enrollment modal — only the open program’s draft changes. */
  const applyBulkSeatModes = (preset) => {
    if (!seatModalCtx?.programId) return;
    const pid = seatModalCtx.programId;
    const { includedPkg, selectedIds } = seatModalCtx;
    const ids = (selectedIds || []).map((x) => String(x));
    setSeatDraftsByProgram((prev) => {
      const draft = { ...(prev[pid] || createEmptySeatDraft()) };
      const gf = { ...(draft.guestSeatForm || {}) };
      const patchGuests = (mode) => {
        ids.forEach((idStr) => {
          gf[idStr] = {
            attendance_mode: 'online',
            notify_enrollment: false,
            ...gf[idStr],
            attendance_mode: mode,
          };
        });
      };
      if (preset === 'all_online') {
        if (!includedPkg) draft.bookerSeatMode = 'online';
        patchGuests('online');
      } else if (preset === 'all_offline') {
        if (!includedPkg) draft.bookerSeatMode = 'offline';
        patchGuests('offline');
      } else if (preset === 'guests_offline_booker_online') {
        if (!includedPkg) draft.bookerSeatMode = 'online';
        patchGuests('offline');
      }
      draft.guestSeatForm = gf;
      return { ...prev, [pid]: draft };
    });
  };

  /** Bulk email enrollment toggles for the enrollment modal — per program draft only. */
  const applyBulkNotify = (preset) => {
    if (!seatModalCtx?.programId) return;
    const pid = seatModalCtx.programId;
    const { selectedIds } = seatModalCtx;
    const ids = (selectedIds || []).map((x) => String(x));
    setSeatDraftsByProgram((prev) => {
      const draft = { ...(prev[pid] || createEmptySeatDraft()) };
      draft.bookerSeatNotify = preset !== 'all_off';
      const guestNotify = preset === 'all_on';
      const gf = { ...(draft.guestSeatForm || {}) };
      ids.forEach((idStr) => {
        gf[idStr] = {
          attendance_mode: 'online',
          notify_enrollment: false,
          ...gf[idStr],
          notify_enrollment: guestNotify,
        };
      });
      draft.guestSeatForm = gf;
      return { ...prev, [pid]: draft };
    });
  };

  const patchSeatDraft = (programId, partial) => {
    const touchesDraft =
      partial.bookerSeatMode !== undefined ||
      partial.bookerSeatNotify !== undefined ||
      partial.guestSeatForm !== undefined ||
      partial.bookerJoinsProgram !== undefined ||
      partial.familyPaidTierIndex !== undefined ||
      partial.memberTierById !== undefined;
    if (touchesDraft) {
      setSeatDraftsByProgram((prev) => {
        const cur = { ...(prev[programId] || createEmptySeatDraft()) };
        if (partial.bookerJoinsProgram !== undefined) cur.bookerJoinsProgram = partial.bookerJoinsProgram;
        if (partial.bookerSeatMode !== undefined) {
          cur.bookerSeatMode = partial.bookerSeatMode === 'offline' ? 'offline' : 'online';
        }
        if (partial.bookerSeatNotify !== undefined) cur.bookerSeatNotify = !!partial.bookerSeatNotify;
        if (partial.guestSeatForm !== undefined) cur.guestSeatForm = partial.guestSeatForm;
        if (partial.familyPaidTierIndex !== undefined) {
          if (partial.familyPaidTierIndex === null) {
            delete cur.familyPaidTierIndex;
          } else {
            cur.familyPaidTierIndex = partial.familyPaidTierIndex;
          }
        }
        if (partial.memberTierById !== undefined) {
          if (partial.memberTierById === null) {
            delete cur.memberTierById;
          } else {
            const next = { ...(cur.memberTierById || {}) };
            Object.entries(partial.memberTierById).forEach(([k, v]) => {
              const id = String(k);
              if (v === null || v === undefined) {
                delete next[id];
              } else {
                const n = Number(v);
                if (!Number.isNaN(n)) next[id] = n;
              }
            });
            if (Object.keys(next).length) cur.memberTierById = next;
            else delete cur.memberTierById;
          }
        }
        return { ...prev, [programId]: cur };
      });
    }
    if (partial.enrollmentDefaultsLoaded !== undefined) {
      setEnrollmentDefaultsLoaded(!!partial.enrollmentDefaultsLoaded);
    }
    if (partial.persistEnrollmentDefaultsOnContinue !== undefined) {
      setPersistEnrollmentDefaultsOnContinue(!!partial.persistEnrollmentDefaultsOnContinue);
    }
  };

  const applyBulkSeatModesDraft = (programId, preset) => {
    const prog = programsForPrefetch.find((x) => String(x.id) === String(programId));
    if (!prog) return;
    const includedPkg =
      annualPortalAccess &&
      (programIncludedInAnnualPackage(prog, annualIncludedIds) || !!annualQuotes[programId]?.included_in_annual_package);
    const ids = (selectedFamilyByProgram[programId] || []).map(String);
    setSeatDraftsByProgram((prev) => {
      const draft = { ...(prev[programId] || createEmptySeatDraft()) };
      const gf = { ...(draft.guestSeatForm || {}) };
      const patchGuests = (mode) => {
        ids.forEach((idStr) => {
          gf[idStr] = {
            attendance_mode: 'online',
            notify_enrollment: false,
            ...gf[idStr],
            attendance_mode: mode,
          };
        });
      };
      if (preset === 'all_online') {
        if (!includedPkg) draft.bookerSeatMode = 'online';
        patchGuests('online');
      } else if (preset === 'all_offline') {
        if (!includedPkg) draft.bookerSeatMode = 'offline';
        patchGuests('offline');
      } else if (preset === 'guests_offline_booker_online') {
        if (!includedPkg) draft.bookerSeatMode = 'online';
        patchGuests('offline');
      }
      draft.guestSeatForm = gf;
      return { ...prev, [programId]: draft };
    });
  };

  const applyBulkNotifyDraft = (programId, preset) => {
    const ids = (selectedFamilyByProgram[programId] || []).map(String);
    setSeatDraftsByProgram((prev) => {
      const draft = { ...(prev[programId] || createEmptySeatDraft()) };
      draft.bookerSeatNotify = preset !== 'all_off';
      const guestNotify = preset === 'all_on';
      const gf = { ...(draft.guestSeatForm || {}) };
      ids.forEach((idStr) => {
        gf[idStr] = {
          attendance_mode: 'online',
          notify_enrollment: false,
          ...gf[idStr],
          notify_enrollment: guestNotify,
        };
      });
      draft.guestSeatForm = gf;
      return { ...prev, [programId]: draft };
    });
  };

  /** Email / guest validation before payment or before saving browser defaults. */
  const validateEnrollmentSeatContacts = (included, selectedIds, guestFormIn, bookerNotifyIn) => {
    if (!included && bookerNotifyIn && !String(bookerEmail || '').trim()) {
      toast({
        title: 'Email needed for notifications',
        description: 'Turn off “Email me enrollment details” for your seat, or add an email to your account.',
        variant: 'destructive',
      });
      return false;
    }
    for (const id of selectedIds) {
      const row = guestFormIn[id] || {};
      if (row.notify_enrollment) {
        const m = enrollableGuests.find((g) => String(g.id) === String(id));
        if (!m || !(String(m.email || '').trim())) {
          toast({
            title: 'Email required for notifications',
            description: `Add an email for “${(m?.name || 'this person').trim()}” or turn off notifications for their seat.`,
            variant: 'destructive',
          });
          return false;
        }
      }
    }
    return true;
  };

  /**
   * Writes dashboard enrollment defaults to localStorage. Stores booker prefs plus either uniform guest
   * prefs or a per–member map so Custom (mixed) rows can be saved and restored.
   */
  const persistEnrollmentSeatDefaultsToBrowser = (selectedIds, bookerModeIn, bookerNotifyIn, guestFormIn) => {
    const sid = selectedIds.map(String);
    const guestSeatDefaultsById = {};
    sid.forEach((id) => {
      const row = guestFormIn[id] || {};
      guestSeatDefaultsById[id] = {
        attendance_mode: row.attendance_mode === 'offline' ? 'offline' : 'online',
        notify_enrollment: !!row.notify_enrollment,
      };
    });
    const first = sid.length > 0 ? guestSeatDefaultsById[sid[0]] : null;
    saveDashboardEnrollmentDefaults({
      bookerMode: bookerModeIn === 'offline' ? 'offline' : 'online',
      bookerNotify: !!bookerNotifyIn,
      guestMode: first ? first.attendance_mode : 'online',
      guestNotify: first ? first.notify_enrollment : false,
      guestSeatDefaultsById: sid.length > 0 ? guestSeatDefaultsById : {},
    });
    setEnrollmentDefaultsLoaded(true);
    toast({
      title: 'Defaults saved for this browser',
      description: 'These options seed new enrollments on this device. Each program card still keeps its own attendance until you change it.',
    });
    return true;
  };

  const saveEnrollmentDefaultsAndCloseModal = () => {
    if (!seatModalCtx?.programId) return;
    const included = !!seatModalCtx.includedPkg;
    const selectedIds = seatModalCtx.selectedIds || [];
    const merged = mergeGlobalSeatDraft(
      seatDraftsByProgram[seatModalCtx.programId] || {},
      bookerSeatMode,
      bookerSeatNotify,
      guestSeatForm,
    );
    if (!validateEnrollmentSeatContacts(included, selectedIds, merged.guestSeatForm || {}, merged.bookerSeatNotify !== false)) {
      return;
    }
    if (
      !persistEnrollmentSeatDefaultsToBrowser(
        selectedIds,
        merged.bookerSeatMode,
        merged.bookerSeatNotify,
        merged.guestSeatForm || {},
      )
    ) {
      return;
    }
    setEnrollmentSeatOpen(false);
    setSeatModalCtx(null);
  };

  const syncEnrollmentModalProgramToDivineCart = async ({
    programId,
    includedPkg,
    selectedIds,
    bookerSeatMode: bookerModeIn,
    bookerSeatNotify: bookerNotifyIn,
    guestSeatForm: guestFormIn,
    persistEnrollmentDefaultsOnContinue: persistDefaults,
  }) => {
    const included = !!includedPkg;
    if (!validateEnrollmentSeatContacts(included, selectedIds, guestFormIn, bookerNotifyIn)) return;

    if (persistDefaults && !persistEnrollmentSeatDefaultsToBrowser(selectedIds, bookerModeIn, bookerNotifyIn, guestFormIn)) {
      return;
    }

    const program = upcomingList.find((x) => String(x.id) === String(programId));
    if (!program) {
      toast({
        title: 'Program not found',
        description: 'Refresh the dashboard and try again.',
        variant: 'destructive',
      });
      return;
    }

    const tierIdx = getDashboardTier(program);
    const perDraft = seatDraftsRef.current[programId] || seatDraftsByProgram[programId];
    const draft = mergeGlobalSeatDraft(perDraft, bookerModeIn, bookerNotifyIn, guestFormIn);

    let participants = null;
    try {
      const pre = await loadEnrollmentPrefill();
      if (isAnnualSubscriber) {
        participants = buildAnnualDashboardCartParticipants({
          program,
          includedPkg: included,
          selectedMemberIds: selectedIds,
          seatDraft: draft,
          enrollableGuests,
          self: pre.self,
          bookerEmail,
          detectedCountry,
          immediateFamilyMembers: bucketLookupMembers,
          programInAnnualPackageList: programIncludedInAnnualPackage(program, annualIncludedIds),
        });
      } else {
        // Non-annual: respect selectedIds + attendance modes from modal (draft already merged)
        const nonAnnualBookerJoins = draft?.bookerJoinsProgram !== false;
        const nonAnnualBookerMode = draft?.bookerSeatMode === 'offline' ? 'offline' : 'online';
        participants =
          buildAnnualDashboardCartParticipants({
            program,
            includedPkg: false,
            selectedMemberIds: selectedIds,
            seatDraft: draft,
            enrollableGuests,
            self: pre.self,
            bookerEmail,
            detectedCountry,
            immediateFamilyMembers: bucketLookupMembers,
            programInAnnualPackageList: programIncludedInAnnualPackage(program, annualIncludedIds),
          }) || (nonAnnualBookerJoins
            ? buildSelfOnlyCartParticipants(pre.self, program, bookerEmail, detectedCountry, nonAnnualBookerMode)
            : null);
      }
    } catch {
      /* syncProgramLineItem still updates line meta */
    }

    const normalizedTier = normalizeCartProgramTier(program, tierIdx);
    const existingLine = cartItems.find(
      (i) =>
        i.type === 'program' &&
        String(i.programId) === String(program.id) &&
        normalizeCartProgramTier(i, i.tierIndex) === normalizedTier,
    );

    setEnrollmentSeatOpen(false);
    setSeatModalCtx(null);

    if (!participants?.length) {
      if (existingLine) {
        removeItem(existingLine.id);
        toast({
          title: 'Removed from Divine Cart',
          description: `${program.title || 'Program'} had no seats selected.`,
        });
      } else {
        toast({
          title: 'No seats to add',
          description: 'Check “I am enrolling myself” or select family guests, then try again.',
          variant: 'destructive',
        });
      }
      return;
    }

    const guestBucketById = buildGuestBucketByIdFromSelection(selectedIds, bucketLookupMembers);
    syncProgramLineItem(program, tierIdx, participants, {
      familyIds: selectedIds.map(String),
      bookerJoins: included ? false : draft?.bookerJoinsProgram !== false,
      annualIncluded: !!included,
      portalQuoteTotal: annualQuotes[programId]?.total != null ? Number(annualQuotes[programId].total) : null,
      guestBucketById,
    });

    toast({
      title: 'Order updated',
      description: `${program.title || 'Program'} is in your order. Click DIVINE CART in the sidebar when you are ready to review and pay.`,
    });
  };

  const confirmEnrollmentSeatsAndPay = async () => {
    if (!seatModalCtx) return;
    setSyncingEnrollmentToCheckout(true);
    try {
      await syncEnrollmentModalProgramToDivineCart({
        programId: seatModalCtx.programId,
        includedPkg: seatModalCtx.includedPkg,
        selectedIds: seatModalCtx.selectedIds,
        bookerSeatMode,
        bookerSeatNotify,
        guestSeatForm,
        persistEnrollmentDefaultsOnContinue,
      });
    } finally {
      setSyncingEnrollmentToCheckout(false);
    }
  };

  const loadEnrollmentPrefill = useCallback(async () => {
    if (enrollmentPrefillCacheRef.current) return enrollmentPrefillCacheRef.current;
    const r = await axios.get(`${API}/api/student/enrollment-prefill`, {
      withCredentials: true,
      headers: getAuthHeaders(),
    });
    enrollmentPrefillCacheRef.current = r.data || {};
    return enrollmentPrefillCacheRef.current;
  }, []);

  // Pre-warm enrollment prefill on mount so cards can auto-sync stale cart data
  useEffect(() => {
    loadEnrollmentPrefill()
      .then((pre) => setEnrollmentSelf(pre?.self || null))
      .catch(() => {});
  }, [loadEnrollmentPrefill]);

  return (
    <section className="w-full max-w-[68rem] mx-auto pl-4 pr-6 sm:pr-8 md:pr-10 lg:pr-12 mb-4 md:mb-6" data-testid="dashboard-upcoming-family">
      <div className="rounded-[28px] border border-[rgba(160,100,220,0.14)] bg-white/70 backdrop-blur-xl px-5 py-5 md:px-7 md:py-6 shadow-[0_4px_48px_rgba(140,60,220,0.08)]">
        <div className="mb-4 md:mb-5 flex flex-col items-center text-center">
          <UpcomingProgramsIrisBloom />
          <h2 className="font-[family-name:'Cinzel',serif] mt-2 px-2 text-lg font-bold tracking-tight text-[#3b0764] drop-shadow-sm md:text-2xl lg:text-3xl">
            Upcoming programs
          </h2>
          <div className="mt-3 flex w-full flex-wrap justify-center gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4 border-violet-200 bg-white/90 hover:bg-violet-50 text-slate-800 gap-2"
              onClick={() => navigate('/dashboard/combined-checkout')}
              disabled={itemCount === 0}
              data-testid="dashboard-open-combined-checkout"
            >
              <CreditCard size={16} className="text-violet-700" />
              <span className="text-xs font-semibold">DIVINE CART</span>
              {itemCount > 0 ? (
                <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-violet-600 text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                  {itemCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

        {!annualPortalAccess ? (
          <p
            className="mb-4 text-center text-[11px] text-slate-600 leading-relaxed px-1"
            data-testid="dashboard-website-pricing-note"
          >
            Pricing matches the homepage Upcoming Programs cards: published list/offer for your tier and currency (no
            member portal quote or auto-applied dashboard promo codes). Cart bundles and Divine Cart discounts still
            apply at checkout like on the public site.
          </p>
        ) : null}

        {annualPortalAccess && homeData?.awrp_batch?.id ? (
          <div
            className="mb-4 rounded-xl border border-teal-200/90 bg-gradient-to-r from-teal-50/90 via-white/60 to-emerald-50/50 px-3 py-2.5 text-center sm:text-left"
            data-testid="dashboard-awrp-cohort-banner"
          >
            <p className="text-[11px] font-semibold text-teal-950 leading-snug">
              Your cohort pricing applies here:{' '}
              <span className="font-bold">
                {homeData.awrp_batch.label || homeData.awrp_batch.id}
              </span>
              {homeData.awrp_batch.label &&
              homeData.awrp_batch.id &&
              String(homeData.awrp_batch.label) !== String(homeData.awrp_batch.id) ? (
                <span className="font-normal text-teal-800/90"> ({homeData.awrp_batch.id})</span>
              ) : null}
            </p>
            {homeData.awrp_batch.notes ? (
              <p className="text-[10px] text-teal-900/85 mt-1.5 leading-relaxed">{homeData.awrp_batch.notes}</p>
            ) : null}
          </div>
        ) : null}

        {crossSellRules.length > 0 && catalogProgramsForCrossSell.length > 0 ? (
          <div className="mb-4 [&>div]:mt-0">
            <CrossSellBanner rules={crossSellRules} programs={catalogProgramsForCrossSell} />
          </div>
        ) : null}

        {showOfferCountdownStrip && (
          <div
            className="mb-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-x-4 rounded-xl border border-[rgba(212,175,55,0.28)] bg-gradient-to-r from-amber-50/75 via-white/55 to-violet-50/45 px-3 py-2.5"
            data-testid="dashboard-offer-countdown-strip"
          >
            {exclusiveOfferLine ? (
              <div className="inline-flex items-start gap-1.5 text-[11px] font-semibold text-[#6b5420] leading-snug min-w-0">
                <Sparkles size={14} className="text-[#b8860b] shrink-0 mt-0.5" />
                <span>{exclusiveOfferLine}</span>
              </div>
            ) : null}
            {exclusiveOfferLine && countdownDeadline ? (
              <span className="hidden sm:block w-px h-4 bg-[rgba(212,175,55,0.35)] shrink-0" aria-hidden />
            ) : null}
            {countdownDeadline ? (
              <DashboardEnrollmentCountdown
                deadline={countdownDeadline}
                programTitle={nearestUpcomingProgram?.title}
              />
            ) : null}
          </div>
        )}

        {upcomingList.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-2">No upcoming programs listed yet — check back soon.</p>
        ) : (
          <div className="space-y-5 mb-4 max-w-full">
            {upcomingList.map((p) => {
              const sel = selectedFamilyByProgram[p.id] || [];
              const includedForSeat =
                annualPortalAccess &&
                (programIncludedInAnnualPackage(p, annualIncludedIds) ||
                  !!annualQuotes[p.id]?.included_in_annual_package);
              const seatCtxMini = { includedPkg: includedForSeat, selectedIds: sel };
              const draftRow = mergeGlobalSeatDraft(
                seatDraftsByProgram[p.id],
                bookerSeatMode,
                bookerSeatNotify,
                guestSeatForm,
              );
              const attendanceQuick = deriveAttendanceQuickPreset(
                seatCtxMini,
                draftRow.guestSeatForm || {},
                draftRow.bookerSeatMode || 'online',
              );
              const notifyQuick = deriveNotifyQuickPreset(
                seatCtxMini,
                draftRow.guestSeatForm || {},
                draftRow.bookerSeatNotify !== false,
              );
              return (
                <DashboardUpcomingProgramRowItem
                  key={p.id}
                  program={p}
                  isAnnual={isAnnualSubscriber}
                  annualDashboardAccess={annualPortalAccess}
                  bookerEmail={bookerEmail}
                  detectedCountry={detectedCountry}
                  symbol={annualPortalAccess ? portalQuoteSymbol : symbol}
                  currency={annualPortalAccess ? portalQuoteCurrency : currency}
                  getPrice={annualPortalAccess ? displayGetPrice : getPrice}
                  getOfferPrice={annualPortalAccess ? displayGetOfferPrice : getOfferPrice}
                  promoForProgramClicks={promoForProgramClicks}
                  promoByProgramId={promoByProgramId}
                  promoPricesLoading={promoPricesLoading}
                  aq={annualQuotes[p.id]}
                  annualIncludedIds={annualIncludedIds}
                  members={members}
                  otherMembers={otherMembers}
                  annualHouseholdPeers={annualPeersDraft}
                  enrollableGuests={enrollableGuests}
                  selectedFamilyByProgram={selectedFamilyByProgram}
                  toggleFamilyMember={toggleFamilyMember}
                  toggleSelectAllFamilyForProgram={toggleSelectAllFamilyForProgram}
                  openEnrollmentSeatModal={openEnrollmentSeatModal}
                  dashboardTierIndex={getDashboardTier(p)}
                  memberTierById={draftRow.memberTierById}
                  familyPaidTierIndex={draftRow.familyPaidTierIndex}
                  onFamilyPaidTierChange={(tierIdx) => patchSeatDraft(p.id, { familyPaidTierIndex: tierIdx })}
                  onDashboardTierChange={(programId, tierIndex) => {
                    setDashboardTierByProgram((prev) => ({ ...prev, [programId]: tierIndex }));
                    const prog = programsForPrefetch.find((x) => String(x.id) === String(programId));
                    if (!prog) return;
                    patchSeatDraft(programId, { memberTierById: null });
                    if (!programTierIsYearLong(prog, tierIndex)) {
                      patchSeatDraft(programId, { familyPaidTierIndex: null });
                      return;
                    }
                    const guestCount = (selectedFamilyByProgram[programId] || []).length;
                    if (guestCount > 0) {
                      patchSeatDraft(programId, { familyPaidTierIndex: null });
                    }
                  }}
                  onMemberTierChange={(memberId, tierIdx) =>
                    patchSeatDraft(p.id, { memberTierById: { [String(memberId)]: tierIdx } })
                  }
                  enrollmentSelf={enrollmentSelf}
                  crossSellRules={crossSellRules}
                  resolveCartCrossSellTier={resolveCartCrossSellTier}
                  annualSeatUi={{
                    draft: draftRow,
                    attendanceQuickPreset: attendanceQuick,
                    notifyQuickPreset: notifyQuick,
                    bookerDisplayName: homeData?.user_details?.full_name || 'Account holder',
                    onPatchDraft: patchSeatDraft,
                    onApplyAttendanceDraft: applyBulkSeatModesDraft,
                    onApplyNotifyDraft: applyBulkNotifyDraft,
                    onClearSavedDefaults: () => {
                      clearDashboardEnrollmentDefaults();
                      patchSeatDraft(p.id, { enrollmentDefaultsLoaded: false });
                      toast({
                        title: 'Saved defaults cleared',
                        description: 'New enrollments will start from standard options until you save again.',
                      });
                    },
                    persistEnrollmentDefaultsOnContinue,
                    onPersistEnrollmentDefaultsChange: setPersistEnrollmentDefaultsOnContinue,
                    onOpenPerPersonSeatModal: () => openEnrollmentSeatModal(p, includedForSeat, sel),
                  }}
                />
              );
            })}
          </div>
        )}

        <div className="border-t border-slate-200/80 pt-4 mt-2">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-violet-700" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Immediate family</h3>
            </div>
          </div>

          {familyApproved ? (
            <div
              className="mb-3 flex gap-2 rounded-xl border border-green-200/90 bg-green-50/80 px-3 py-2.5 text-[11px] text-green-900"
              data-testid="immediate-family-locked-notice"
            >
              <Lock size={14} className="shrink-0 mt-0.5 text-green-600" />
              <p>
                Your family list has been <span className="font-semibold">reviewed and confirmed</span>. Please reach out if you need to make a change.
              </p>
            </div>
          ) : familyPendingReview ? (
            <div
              className="mb-3 flex gap-2 rounded-xl border border-amber-200/90 bg-amber-50/80 px-3 py-2.5 text-[11px] text-amber-950"
              data-testid="immediate-family-locked-notice"
            >
              <Lock size={14} className="shrink-0 mt-0.5 text-amber-700" />
              <p>
                Your family list has been <span className="font-semibold">submitted for review</span>. An admin will confirm it
                shortly — you will be notified when it is set (admin will confirm).
              </p>
            </div>
          ) : immediateFamilyReadOnly ? (
            <div
              className="mb-3 flex gap-2 rounded-xl border border-amber-200/90 bg-amber-50/80 px-3 py-2.5 text-[11px] text-amber-950"
              data-testid="immediate-family-locked-notice"
            >
              <Lock size={14} className="shrink-0 mt-0.5 text-amber-700" />
              <p>
                This list is <span className="font-semibold">locked</span>. To change it, please contact support.
              </p>
            </div>
          ) : null}
          {immediateFamilyLocked && immediateFamilyEditApproved && !familyApproved ? (
            <div className="mb-3 flex gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-3 py-2.5 text-[11px] text-emerald-950">
              <Lock size={14} className="shrink-0 mt-0.5 text-emerald-700" />
              <p>
                Edits have been <span className="font-semibold">temporarily allowed</span> for your family list. Update and save when you are done.
              </p>
            </div>
          ) : null}

          <div className="mb-3">
            {members.length === 0 && (
              <p className="text-xs text-slate-400 italic mb-2">
                No household rows yet — use &quot;Add family member&quot; below.
              </p>
            )}
            {members.length > 0 && (
              <GuestMemberTable
                members={members}
                setMembers={setMembers}
                relationships={RELATIONSHIPS}
                relationshipFallback="Other"
                legacyRelationshipMap={LEGACY_IMMEDIATE_REL}
                wrapTestId="immediate-family-table-wrap"
                tableTestId="immediate-family-table"
                readOnly={immediateFamilyReadOnly}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addRow}
              disabled={immediateFamilyReadOnly || manualImmediateFamilyCount >= 12}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5D3FD3] border border-violet-200 rounded-full px-3 py-1.5 hover:bg-violet-50 disabled:opacity-40"
            >
              <Plus size={14} /> Add family member
            </button>
            <button
              type="button"
              onClick={() => saveFamily(false)}
              disabled={saving || immediateFamilyReadOnly}
              className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-4 py-1.5 bg-[#D4AF37] text-white hover:bg-[#b8962e] disabled:opacity-60"
              data-testid="save-immediate-family-draft"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save family list
            </button>
            <button
              type="button"
              onClick={() => saveFamily(true)}
              disabled={saving || immediateFamilyReadOnly}
              className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-4 py-1.5 border-2 border-[#7c3aed] bg-violet-50 text-violet-900 hover:bg-violet-100 disabled:opacity-60"
              data-testid="send-immediate-family-review"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send for admin review
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200/80 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-violet-700" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Annual Family Club</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-3xl">
                Not the same as the lists above. Anyone on your household key who already has Annual dashboard
                access in Client Garden is listed here. Linked group checkout at annual portal pricing unlocks
                once every person on the key has that access; until then, you can still see who is already on
                Annual.
              </p>
            </div>
          </div>
          {hasHouseholdKey && !annualHouseholdClubOk ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950">
              Not every member on this household key has Annual dashboard access yet — linked group checkout
              unlocks when all do.
            </div>
          ) : null}
          {isPrimaryHouseholdContact && annualPeersDraft.length > 0 ? (
            <div className="mb-3 flex gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-3 py-2.5 text-[11px] text-emerald-950">
              <Lock size={14} className="shrink-0 mt-0.5 text-emerald-700" />
              <p>
                As <span className="font-semibold">primary household contact</span>, you can complete city, country, and
                other details for each linked Annual account here. Save before paying so every participant passes
                checkout validation.
              </p>
            </div>
          ) : null}
          {annualPeersDraft.length > 0 ? (
            <div className="mb-3">
              <GuestMemberTable
                members={annualPeersDraft}
                setMembers={isPrimaryHouseholdContact ? setAnnualPeersDraft : () => {}}
                relationships={RELATIONSHIPS}
                relationshipFallback="Household"
                legacyRelationshipMap={LEGACY_IMMEDIATE_REL}
                wrapTestId="annual-household-peers-wrap"
                tableTestId="annual-household-peers-table"
                readOnly={!isPrimaryHouseholdContact}
                hideRemove
              />
            </div>
          ) : null}
          {isPrimaryHouseholdContact && annualPeersDraft.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={saveHouseholdPeers}
                disabled={saving || !hasHouseholdKey}
                className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-4 py-1.5 bg-[#D4AF37] text-white hover:bg-[#b8962e] disabled:opacity-60"
                data-testid="save-annual-household-peers"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Annual Family Club
              </button>
            </div>
          ) : null}
          {annualHouseholdClubOk && isPrimaryHouseholdContact && annualPeersDraft.length === 0 ? (
            <p className="text-xs text-slate-400 italic mb-2">No other accounts share your household key.</p>
          ) : null}
        </div>

        <div className="border-t border-slate-200/80 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-indigo-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Friends &amp; extended</h3>
            </div>
          </div>

          <div className="mb-3">
            {otherMembers.length === 0 && (
              <p className="text-xs text-slate-400 italic mb-2">
                No guests in this list yet — use &quot;Add guest&quot; below.
              </p>
            )}
            {otherMembers.length > 0 && (
              <GuestMemberTable
                members={otherMembers}
                setMembers={setOtherMembers}
                relationships={OTHER_RELATIONSHIPS}
                relationshipFallback="Friend"
                legacyRelationshipMap={LEGACY_OTHER_REL}
                wrapTestId="other-guests-table-wrap"
                tableTestId="other-guests-table"
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addOtherRow}
              disabled={otherMembers.length >= 12}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5D3FD3] border border-violet-200 rounded-full px-3 py-1.5 hover:bg-violet-50 disabled:opacity-40"
            >
              <Plus size={14} /> Add guest
            </button>
            <button
              type="button"
              onClick={() => saveOtherGuests(false)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-4 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              data-testid="save-other-guests-draft"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save friends &amp; extended
            </button>
            {/*
              Later: restore “Send for admin review” for this list — call saveOtherGuests(true); API already supports submit_for_review on PUT /api/student/other-guests.
            */}
          </div>
        </div>
      </div>

      <Dialog
        open={enrollmentSeatOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEnrollmentSeatOpen(false);
            setSeatModalCtx(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900">Enrollment for this program</DialogTitle>
            <DialogDescription className="text-[11px] text-slate-600 leading-relaxed">
              Set attendance and enrollment notification email for your order — including the WhatsApp group link when
              applicable. Use <strong className="text-slate-800">Save defaults &amp; close</strong> to store choices in this
              browser, or <strong className="text-slate-800">Add to order</strong> with the checkbox below to save defaults when
              you update the cart. Open <strong className="text-slate-800">DIVINE CART</strong> in the sidebar when you are ready to review and pay.
            </DialogDescription>
          </DialogHeader>

          {seatModalCtx && (
            <div className="space-y-4 text-[11px]">
              {enrollmentDefaultsLoaded ? (
                <p className="text-[10px] text-violet-800 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1.5">
                  Loaded your <strong>saved defaults</strong> for this browser. Adjust below or clear them with the link
                  under the checkbox.
                </p>
              ) : null}

              {seatModalCtx.includedPkg && seatModalCtx.selectedIds.length === 0 ? (
                <p className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1.5 leading-snug">
                  <strong>Package-included program:</strong> select who is joining on the program card under &quot;Family to
                  join&quot; first. Then presets and per-person rows here apply to those guests.
                </p>
              ) : null}

              {!(seatModalCtx.includedPkg && seatModalCtx.selectedIds.length === 0) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                  <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2.5 space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Attendance (pick one)</p>
                    {!seatModalCtx.includedPkg && seatModalCtx.selectedIds.length === 0 ? (
                      <div className="space-y-1.5" role="radiogroup" aria-label="Your attendance">
                        <p className="text-[9px] text-slate-600 leading-snug mb-1">
                          No family guests in this enrollment yet — these apply to <strong>your</strong> seat only.
                        </p>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                          <input
                            type="radio"
                            name={`dash-att-booker-${seatModalCtx.programId}`}
                            className="shrink-0 border-slate-300 text-violet-700"
                            checked={(modalSeatMerged?.bookerSeatMode || 'online') !== 'offline'}
                            onChange={() => applyBulkSeatModes('all_online')}
                          />
                          Online (Zoom)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                          <input
                            type="radio"
                            name={`dash-att-booker-${seatModalCtx.programId}`}
                            className="shrink-0 border-slate-300 text-violet-700"
                            checked={(modalSeatMerged?.bookerSeatMode || 'online') === 'offline'}
                            onChange={() => applyBulkSeatModes('all_offline')}
                          />
                          Offline / remote
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-1.5" role="radiogroup" aria-label="Attendance preset">
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                          <input
                            type="radio"
                            name={`dash-att-${seatModalCtx.programId}`}
                            className="shrink-0 border-slate-300 text-violet-700"
                            checked={attendanceQuickPresetLive === 'all_online'}
                            onChange={() => applyBulkSeatModes('all_online')}
                          />
                          All online
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                          <input
                            type="radio"
                            name={`dash-att-${seatModalCtx.programId}`}
                            className="shrink-0 border-slate-300 text-violet-700"
                            checked={attendanceQuickPresetLive === 'all_offline'}
                            onChange={() => applyBulkSeatModes('all_offline')}
                          />
                          All offline
                        </label>
                        {!seatModalCtx.includedPkg && seatModalCtx.selectedIds.length > 0 ? (
                          <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                            <input
                              type="radio"
                              name={`dash-att-${seatModalCtx.programId}`}
                              className="shrink-0 border-slate-300 text-violet-700"
                              checked={attendanceQuickPresetLive === 'except_me'}
                              onChange={() => applyBulkSeatModes('guests_offline_booker_online')}
                            />
                            All offline except Myself
                          </label>
                        ) : seatModalCtx.includedPkg ? (
                          <p className="text-[9px] text-slate-500">
                            “All offline except Myself” applies when your own seat is in the payment (add-on programs).
                          </p>
                        ) : null}
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                          <input
                            type="radio"
                            name={`dash-att-${seatModalCtx.programId}`}
                            className="shrink-0 border-slate-300 text-violet-700"
                            checked={attendanceQuickPresetLive === 'custom'}
                            onChange={() => {
                              /* Mixed / per-row modes — keep draft; selection reflects deriveAttendanceQuickPreset */
                            }}
                          />
                          Custom
                        </label>
                        {attendanceQuickPresetLive === 'custom' ? (
                          <p className="text-[9px] text-amber-800/90 pl-6 -mt-1">
                            Mixed modes — adjust rows below or pick an option above.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 leading-snug">
                      Enrollment Notification Email (for WhatsApp Group Link)
                    </p>
                    {!seatModalCtx.includedPkg && seatModalCtx.selectedIds.length === 0 ? (
                      <div className="space-y-1.5" role="radiogroup" aria-label="Enrollment email to you">
                        <p className="text-[9px] text-slate-600 leading-snug mb-1">
                          Guest emails apply after you select family on the program card.
                        </p>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                          <input
                            type="radio"
                            name={`dash-ntf-booker-${seatModalCtx.programId}`}
                            className="shrink-0 border-slate-300 text-violet-700"
                            checked={modalSeatMerged?.bookerSeatNotify !== false}
                            onChange={() => applyBulkNotify('me_only')}
                          />
                          Email me enrollment details
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                          <input
                            type="radio"
                            name={`dash-ntf-booker-${seatModalCtx.programId}`}
                            className="shrink-0 border-slate-300 text-violet-700"
                            checked={modalSeatMerged?.bookerSeatNotify === false}
                            onChange={() => applyBulkNotify('all_off')}
                          />
                          No enrollment emails
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-1.5" role="radiogroup" aria-label="Enrollment email preset">
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                          <input
                            type="radio"
                            name={`dash-ntf-${seatModalCtx.programId}`}
                            className="shrink-0 border-slate-300 text-violet-700"
                            checked={notifyQuickPresetLive === 'email_all'}
                            onChange={() => applyBulkNotify('all_on')}
                          />
                          Email all
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                          <input
                            type="radio"
                            name={`dash-ntf-${seatModalCtx.programId}`}
                            className="shrink-0 border-slate-300 text-violet-700"
                            checked={notifyQuickPresetLive === 'email_me_only'}
                            onChange={() => applyBulkNotify('me_only')}
                          />
                          Email Me Only
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                          <input
                            type="radio"
                            name={`dash-ntf-${seatModalCtx.programId}`}
                            className="shrink-0 border-slate-300 text-violet-700"
                            checked={
                              notifyQuickPresetLive === 'custom' || notifyQuickPresetLive === 'mixed'
                            }
                            onChange={() => applyBulkNotify('all_off')}
                          />
                          Custom
                        </label>
                        {notifyQuickPresetLive === 'mixed' ? (
                          <p className="text-[9px] text-amber-800/90">
                            Mixed notification choices — adjust rows below or pick an option above.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 space-y-2">
                <label className="flex items-start gap-2 cursor-pointer text-[11px] text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-300"
                    checked={persistEnrollmentDefaultsOnContinue}
                    onChange={(e) => setPersistEnrollmentDefaultsOnContinue(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Save these choices as my default for every program</span>
                    <span className="block text-[9px] text-slate-500 mt-0.5 leading-snug">
                      When you add to order, we store them in this browser. Next time you open enrollment, fields fill
                      automatically — including Custom (mixed) per-person attendance and email when you save.
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  className="text-[10px] text-violet-700 hover:text-violet-900 underline underline-offset-2"
                  onClick={() => {
                    clearDashboardEnrollmentDefaults();
                    setEnrollmentDefaultsLoaded(false);
                    toast({
                      title: 'Saved defaults cleared',
                      description: 'New enrollments will start from standard options until you save again.',
                    });
                  }}
                >
                  Clear saved defaults on this device
                </button>
              </div>

              {!seatModalCtx.includedPkg && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Users size={14} className="text-violet-600" />
                    Your seat
                  </p>
                  <p className="text-slate-600">{homeData?.user_details?.full_name || 'Account holder'}</p>
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="text-slate-500 shrink-0">Mode</span>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`dash-booker-mode-${seatModalCtx.programId}`}
                        checked={(modalSeatMerged?.bookerSeatMode || 'online') !== 'offline'}
                        onChange={() => patchSeatDraft(seatModalCtx.programId, { bookerSeatMode: 'online' })}
                      />
                      <Wifi size={12} className="text-slate-500" />
                      Online
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`dash-booker-mode-${seatModalCtx.programId}`}
                        checked={(modalSeatMerged?.bookerSeatMode || 'online') === 'offline'}
                        onChange={() => patchSeatDraft(seatModalCtx.programId, { bookerSeatMode: 'offline' })}
                      />
                      <Monitor size={12} className="text-slate-500" />
                      Offline
                    </label>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-slate-300"
                      checked={modalSeatMerged?.bookerSeatNotify !== false}
                      onChange={(e) => patchSeatDraft(seatModalCtx.programId, { bookerSeatNotify: e.target.checked })}
                    />
                    <span>
                      <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                        {modalSeatMerged?.bookerSeatNotify !== false ? (
                          <Bell size={12} className="text-slate-500" />
                        ) : (
                          <BellOff size={12} className="text-slate-400" />
                        )}
                        Email me enrollment details
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        Requires an email on your login account if enabled.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {seatModalCtx.selectedIds.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-800 text-[11px]">Family members in this enrollment</p>
                  <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                    {seatModalCtx.selectedIds.map((id) => {
                      const m = enrollableGuests.find((g) => String(g.id) === String(id));
                      const row =
                        (modalSeatMerged?.guestSeatForm || {})[id] ||
                        guestSeatForm[id] ||
                        ({ attendance_mode: 'online', notify_enrollment: false });
                      return (
                        <div key={id} className="rounded-lg border border-slate-200 p-2.5 space-y-2 bg-white">
                          <p className="font-medium text-slate-900">
                            {m?.name || 'Member'}
                            {m?.relationship ? (
                              <span className="text-slate-400 font-normal"> ({m.relationship})</span>
                            ) : null}
                          </p>
                          <div className="flex flex-wrap gap-3 items-center">
                            <span className="text-slate-500 shrink-0">Mode</span>
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`guest-mode-${id}`}
                                checked={row.attendance_mode !== 'offline'}
                                onChange={() => updateGuestSeatField(id, 'attendance_mode', 'online')}
                              />
                              <Wifi size={12} className="text-slate-500" />
                              Online
                            </label>
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`guest-mode-${id}`}
                                checked={row.attendance_mode === 'offline'}
                                onChange={() => updateGuestSeatField(id, 'attendance_mode', 'offline')}
                              />
                              <Monitor size={12} className="text-slate-500" />
                              Offline
                            </label>
                          </div>
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-slate-300"
                              checked={!!row.notify_enrollment}
                              onChange={(e) => updateGuestSeatField(id, 'notify_enrollment', e.target.checked)}
                            />
                            <span>
                              <span className="font-medium text-slate-800">Email enrollment details to this person</span>
                              <span className="block text-[10px] text-slate-500 mt-0.5">
                                Requires an email in their saved list row above.
                              </span>
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 flex-col sm:flex-row sm:justify-end sm:items-center">
            <Button
              type="button"
              variant="outline"
              className="text-xs h-9 w-full sm:w-auto order-2 sm:order-1"
              onClick={() => {
                setEnrollmentSeatOpen(false);
                setSeatModalCtx(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="text-xs h-9 w-full sm:w-auto order-1 sm:order-2 border border-violet-200 bg-violet-50 text-violet-950 hover:bg-violet-100"
              onClick={saveEnrollmentDefaultsAndCloseModal}
              data-testid="dashboard-save-enrollment-defaults"
            >
              Save defaults &amp; close
            </Button>
            <Button
              type="button"
              className="text-xs h-9 w-full sm:w-auto order-3 bg-[#D4AF37] hover:bg-[#b8962e] text-white gap-2"
              onClick={confirmEnrollmentSeatsAndPay}
              disabled={syncingEnrollmentToCheckout}
            >
              {syncingEnrollmentToCheckout ? <Loader2 size={14} className="animate-spin shrink-0" /> : null}
              Add to order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </section>
  );
}
