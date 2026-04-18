import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar, Sparkles, Users, Loader2, Plus, Trash2, CreditCard, Clock, AlertTriangle, Lock, Bell, BellOff, Monitor, Wifi } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { useCurrency } from '../../context/CurrencyContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { useCart } from '../../context/CartContext';
import DashboardProgramPaymentModal from './DashboardProgramPaymentModal';
import { pickTierIndexForDashboard, programIncludedInAnnualPackage } from './dashboardUpcomingHelpers';
import {
  buildAnnualDashboardCartParticipants,
  buildGuestBucketByIdFromSelection,
  buildFullPortalRosterCartParticipants,
  buildSelfOnlyCartParticipants,
  mergeGlobalSeatDraft,
} from '../../lib/dashboardCartPrefill';
import {
  UPCOMING_SESSION_V,
  UPCOMING_SESSION_MAX_AGE_MS,
  upcomingSessionStorageKey,
} from '../../lib/dashboardUpcomingSessionStorage';
import { getAuthHeaders } from '../../lib/authHeaders';
import DashboardUpcomingProgramRowItem from './DashboardUpcomingProgramRowItem';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

const API = process.env.REACT_APP_BACKEND_URL;

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
    };
  } catch {
    return null;
  }
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
  if (ids.length === 0) return 'mixed';
  if (gAllOn) return 'email_all';
  if (gAllOff) return 'custom';
  return 'mixed';
}

/** Cap parallel quote / promo requests (matches backend upcoming program list cap). */
const DASHBOARD_UPCOMING_PREFETCH_LIMIT = 100;

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Other'];
const OTHER_RELATIONSHIPS = ['Friend', 'Cousin', 'Relative', 'Uncle / Aunt', 'Grandparent', 'Other'];

function GuestMemberTable({
  members,
  setMembers,
  relationships,
  relationshipFallback,
  wrapTestId,
  tableTestId,
  readOnly = false,
}) {
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
      <table className="w-full min-w-[920px] text-left border-collapse" data-testid={tableTestId}>
        <thead>
          <tr className="bg-slate-100/95 border-b border-slate-200">
            <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap min-w-[7rem]">
              Name
            </th>
            <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap w-[6.5rem]">
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
            <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap w-[3.5rem]">
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
          {members.map((m, idx) => (
            <tr
              key={m.id || `row-${idx}`}
              className="border-b border-slate-100 last:border-0 hover:bg-violet-50/30 transition-colors"
            >
              <td className="px-2 py-1.5 align-middle">
                <input
                  value={m.name}
                  onChange={(e) => updateRow(idx, 'name', e.target.value)}
                  disabled={readOnly}
                  className="w-full min-w-[6rem] text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="Full name"
                />
              </td>
              <td className="px-2 py-1.5 align-middle">
                <select
                  value={m.relationship || relationshipFallback}
                  onChange={(e) => updateRow(idx, 'relationship', e.target.value)}
                  disabled={readOnly}
                  className="w-full max-w-[6.5rem] text-[11px] border border-slate-200 rounded px-1 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
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
                  disabled={readOnly}
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
                  disabled={readOnly}
                  className="w-full max-w-[3.5rem] text-[11px] border border-slate-200 rounded px-1 py-1 bg-white tabular-nums disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="—"
                />
              </td>
              <td className="px-2 py-1.5 align-middle">
                <input
                  value={m.city || ''}
                  onChange={(e) => updateRow(idx, 'city', e.target.value)}
                  disabled={readOnly}
                  className="w-full min-w-[4rem] text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="City"
                />
              </td>
              <td className="px-2 py-1.5 align-middle">
                <input
                  value={m.country || ''}
                  onChange={(e) => updateRow(idx, 'country', e.target.value.toUpperCase().slice(0, 4))}
                  disabled={readOnly}
                  className="w-full max-w-[3.5rem] text-[11px] border border-slate-200 rounded px-1 py-1 bg-white uppercase disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="IN"
                  title="ISO country code (e.g. IN, AE, US)"
                />
              </td>
              <td className="px-2 py-1.5 align-middle">
                <input
                  value={m.email || ''}
                  onChange={(e) => updateRow(idx, 'email', e.target.value)}
                  disabled={readOnly}
                  className="w-full min-w-[7rem] text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="Optional"
                />
              </td>
              <td className="px-2 py-1.5 align-middle">
                <input
                  value={m.phone || ''}
                  onChange={(e) => updateRow(idx, 'phone', e.target.value)}
                  disabled={readOnly}
                  className="w-full min-w-[5.5rem] text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="Optional"
                />
              </td>
              <td className="px-1 py-1.5 align-middle text-center">
                {!readOnly ? (
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
          ))}
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
  const { syncProgramLineItem, itemCount } = useCart();
  const { toast } = useToast();
  const { settings: siteSettings } = useSiteSettings();
  const annualIncludedIds = siteSettings?.annual_package_included_program_ids;
   const {
    getPrice,
    getOfferPrice,
    symbol,
    currency,
    ready: currencyReady,
    displayCurrency,
    isPrimary,
    displayRate,
    country: detectedCountry,
  } = useCurrency();
  const [saving, setSaving] = useState(false);
  const [promoByProgramId, setPromoByProgramId] = useState({});
  const [promoPricesLoading, setPromoPricesLoading] = useState(false);
  const [selectedFamilyByProgram, setSelectedFamilyByProgram] = useState({});
  const [annualQuotes, setAnnualQuotes] = useState({});
  const [payingProgramId, setPayingProgramId] = useState(null);
  const [programPaymentModal, setProgramPaymentModal] = useState(null);
  const [enrollmentSeatOpen, setEnrollmentSeatOpen] = useState(false);
  const [seatModalCtx, setSeatModalCtx] = useState(null);
  const [bookerSeatMode, setBookerSeatMode] = useState('online');
  const [bookerSeatNotify, setBookerSeatNotify] = useState(true);
  const [guestSeatForm, setGuestSeatForm] = useState({});
  const [enrollmentDefaultsLoaded, setEnrollmentDefaultsLoaded] = useState(false);
  const [persistEnrollmentDefaultsOnContinue, setPersistEnrollmentDefaultsOnContinue] = useState(false);
  /** Program chosen for the shared “Per-person attendance” modal (one place for all cards). */
  const [perPersonProgramId, setPerPersonProgramId] = useState(null);
  const [seatDraftsByProgram, setSeatDraftsByProgram] = useState({});
  const seatDraftsRef = useRef({});
  const enrollmentPrefillCacheRef = useRef(null);

  useEffect(() => {
    seatDraftsRef.current = seatDraftsByProgram;
  }, [seatDraftsByProgram]);

  const attendanceQuickPresetLive = useMemo(
    () => deriveAttendanceQuickPreset(seatModalCtx, guestSeatForm, bookerSeatMode),
    [seatModalCtx, guestSeatForm, bookerSeatMode]
  );

  const notifyQuickPresetLive = useMemo(
    () => deriveNotifyQuickPreset(seatModalCtx, guestSeatForm, bookerSeatNotify),
    [seatModalCtx, guestSeatForm, bookerSeatNotify]
  );

  const upcomingList = homeData?.upcoming_programs || [];
  const programsForPrefetch = useMemo(
    () => upcomingList.slice(0, DASHBOARD_UPCOMING_PREFETCH_LIMIT),
    [upcomingList]
  );
  const paymentMethods = homeData?.payment_methods || ['stripe'];
  const offers = homeData?.dashboard_offers || {};
  const annualOffer = offers.annual || {};
  const familyOffer = offers.family || {};
  const extendedOffer = offers.extended || {};
  const isAnnual = homeData?.is_annual_subscriber;
  const immediateFamilyLocked = !!homeData?.immediate_family_locked;
  const immediateFamilyEditApproved = !!homeData?.immediate_family_editing_approved;
  const immediateFamilyReadOnly = immediateFamilyLocked && !immediateFamilyEditApproved;
  const initialMembers = useMemo(() => homeData?.immediate_family || [], [homeData?.immediate_family]);
  const initialOtherMembers = useMemo(() => homeData?.other_guests || [], [homeData?.other_guests]);

  const [members, setMembers] = useState(() => initialMembers);
  React.useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  const [otherMembers, setOtherMembers] = useState(() => initialOtherMembers);
  React.useEffect(() => {
    setOtherMembers(initialOtherMembers);
  }, [initialOtherMembers]);

  const enrollableGuests = useMemo(() => [...members, ...otherMembers], [members, otherMembers]);

  const enrollableGuestIdsKey = useMemo(
    () =>
      enrollableGuests
        .filter((m) => m.id)
        .map((m) => String(m.id))
        .sort()
        .join(','),
    [enrollableGuests]
  );

  /** Guest ids selected on any upcoming program — attendance/notify prefs are shared across all programs. */
  const selectedGuestIdsUnionKey = useMemo(() => {
    const s = new Set();
    for (const prog of programsForPrefetch) {
      (selectedFamilyByProgram[prog.id] || []).forEach((id) => s.add(String(id)));
    }
    return [...s].sort().join(',');
  }, [programsForPrefetch, selectedFamilyByProgram]);

  const familyRowCount = members.length + otherMembers.length;

  const restoredUpcomingRef = useRef(false);

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

  useEffect(() => {
    if (!isAnnual || upcomingList.length === 0) return;
    setPerPersonProgramId((prev) => {
      const exists = prev != null && upcomingList.some((p) => String(p.id) === String(prev));
      if (exists) return prev;
      const pick = nearestUpcomingProgram?.id ?? upcomingList[0]?.id;
      return pick != null ? pick : null;
    });
  }, [isAnnual, upcomingList, nearestUpcomingProgram]);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined' || !bookerEmail) return;
    const save = () => {
      try {
        sessionStorage.setItem(
          upcomingSessionStorageKey(bookerEmail),
          JSON.stringify({
            v: UPCOMING_SESSION_V,
            savedAt: Date.now(),
            selectedFamilyByProgram,
            seatDraftsByProgram,
            programPaymentModal,
            enrollmentSeatOpen,
            seatModalCtx,
            bookerSeatMode,
            bookerSeatNotify,
            guestSeatForm,
            persistEnrollmentDefaultsOnContinue,
            enrollmentDefaultsLoaded,
          })
        );
      } catch (_) {
        /* ignore quota / private mode */
      }
    };
    const id = requestAnimationFrame(save);
    return () => {
      cancelAnimationFrame(id);
      save();
    };
  }, [
    bookerEmail,
    selectedFamilyByProgram,
    seatDraftsByProgram,
    programPaymentModal,
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
      return;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      restoredUpcomingRef.current = true;
      return;
    }
    if (!data || data.v !== UPCOMING_SESSION_V) {
      restoredUpcomingRef.current = true;
      return;
    }
    if (Date.now() - (data.savedAt || 0) > UPCOMING_SESSION_MAX_AGE_MS) {
      restoredUpcomingRef.current = true;
      return;
    }

    const programs = homeData?.upcoming_programs || [];
    const programIds = new Set(programs.map((p) => String(p.id)));
    let pay = data.programPaymentModal || null;
    let seatOpen = !!data.enrollmentSeatOpen;
    let seatCtx = data.seatModalCtx || null;

    if (pay && !programIds.has(String(pay.programId))) pay = null;
    if (seatCtx && !programIds.has(String(seatCtx.programId))) {
      seatCtx = null;
      seatOpen = false;
    }
    if (pay) seatOpen = false;

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
        if (!v || typeof v !== 'object') return;
        slim[k] = { bookerJoinsProgram: v.bookerJoinsProgram !== false };
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
    if (pay) {
      setProgramPaymentModal(pay);
    } else if (seatOpen && seatCtx) {
      setSeatModalCtx(seatCtx);
      setEnrollmentSeatOpen(true);
    }
  }, [bookerEmail, homeData, enrollableGuestIdsKey, familyRowCount]);

  const addRow = () => {
    if (members.length >= 12) return;
    setMembers((m) => [
      ...m,
      {
        id: '',
        name: '',
        relationship: 'Spouse',
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

  const saveFamily = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/student/family`,
        {
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
      toast({ title: 'Family saved', description: 'Your immediate family list has been updated.' });
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

  const saveOtherGuests = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/student/other-guests`,
        {
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
      toast({
        title: 'Guest list saved',
        description: 'Your friends & extended list has been updated.',
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

  const promoForProgramClicks = useMemo(() => {
    const a = (annualOffer.promo_code || '').trim();
    const f = (familyOffer.promo_code || '').trim();
    const x = (extendedOffer.promo_code || '').trim();
    if (isAnnual) return annualOffer.enabled && a ? a : '';
    if (familyOffer.enabled && f) return f;
    if (extendedOffer.enabled && x) return x;
    return '';
  }, [isAnnual, annualOffer, familyOffer, extendedOffer]);

  const prefetchProgramsKey = useMemo(
    () => programsForPrefetch.map((p) => p.id).join(','),
    [programsForPrefetch]
  );

  const familySelectionKey = useMemo(() => {
    return programsForPrefetch
      .map((p) => `${p.id}=${(selectedFamilyByProgram[p.id] || []).slice().sort().join(':')}`)
      .join('|');
  }, [programsForPrefetch, selectedFamilyByProgram]);

  useEffect(() => {
    if (!isAnnual || !currencyReady) {
      setAnnualQuotes({});
      return;
    }
    const programs = programsForPrefetch;
    if (programs.length === 0) {
      setAnnualQuotes({});
      return;
    }
    let cancelled = false;
    Promise.all(
      programs.map((p) => {
        const ids = selectedFamilyByProgram[p.id] || [];
        const draft = seatDraftsByProgram[p.id];
        const includedInPkg = programIncludedInAnnualPackage(p, annualIncludedIds);
        const bookerJoins = includedInPkg ? false : draft?.bookerJoinsProgram !== false;
        const params =
          ids.length > 0
            ? { program_id: p.id, currency, family_ids: ids.join(','), booker_joins: bookerJoins }
            : { program_id: p.id, currency, family_count: 0, booker_joins: bookerJoins };
        return axios
          .get(`${API}/api/student/dashboard-quote`, {
            params,
            withCredentials: true,
          })
          .then((r) => ({ id: p.id, data: r.data }))
          .catch(() => ({ id: p.id, data: null }));
      })
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
  }, [isAnnual, currencyReady, currency, prefetchProgramsKey, familySelectionKey, programsForPrefetch, seatDraftsByProgram]);

  useEffect(() => {
    if (!isAnnual) return;
    setGuestSeatForm((prev) => {
      const ids = selectedGuestIdsUnionKey ? selectedGuestIdsUnionKey.split(',').filter(Boolean) : [];
      const saved = loadDashboardEnrollmentDefaults();
      const next = { ...prev };
      let changed = false;
      ids.forEach((id) => {
        if (!next[id]) {
          next[id] = {
            attendance_mode: saved && saved.guestMode === 'offline' ? 'offline' : 'online',
            notify_enrollment: !!(saved && saved.guestNotify),
          };
          changed = true;
        }
      });
      Object.keys(next).forEach((id) => {
        if (!ids.includes(id)) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [isAnnual, selectedGuestIdsUnionKey]);

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
            currency,
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
  }, [promoForProgramClicks, currencyReady, currency, prefetchProgramsKey, programsForPrefetch]);

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

  const toggleSelectAllFamilyForProgram = (programId) => {
    if (selectableFamilyMemberIds.length === 0) return;
    setSelectedFamilyByProgram((prev) => {
      const cur = prev[programId] || [];
      const curSet = new Set(cur.map(String));
      const allOn = selectableFamilyMemberIds.every((id) => curSet.has(id));
      if (allOn) {
        return { ...prev, [programId]: [] };
      }
      return { ...prev, [programId]: [...selectableFamilyMemberIds] };
    });
  };

  const openEnrollmentSeatModal = (program, includedPkg, selectedIds) => {
    const ids = (selectedIds || []).map((x) => String(x));
    const saved = loadDashboardEnrollmentDefaults();
    setGuestSeatForm((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (!next[id]) {
          next[id] = {
            attendance_mode: saved && saved.guestMode === 'offline' ? 'offline' : 'online',
            notify_enrollment: !!(saved && saved.guestNotify),
          };
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

  const openPerPersonSeatModalForSelection = () => {
    const prog = upcomingList.find((x) => String(x.id) === String(perPersonProgramId));
    if (!prog) {
      toast({ title: 'Pick a program', description: 'Choose which program to edit seats for.', variant: 'destructive' });
      return;
    }
    const includedForSeat =
      programIncludedInAnnualPackage(prog, annualIncludedIds) || !!annualQuotes[prog.id]?.included_in_annual_package;
    const sel = selectedFamilyByProgram[prog.id] || [];
    openEnrollmentSeatModal(prog, includedForSeat, sel);
  };

  const updateGuestSeatField = (memberId, field, value) => {
    const id = String(memberId);
    setGuestSeatForm((prev) => ({
      ...prev,
      [id]: {
        attendance_mode: 'online',
        notify_enrollment: false,
        ...prev[id],
        [field]: value,
      },
    }));
  };

  /** Bulk attendance presets; notify checkboxes are left unchanged. */
  const applyBulkSeatModes = (preset) => {
    if (!seatModalCtx) return;
    const { includedPkg, selectedIds } = seatModalCtx;
    const ids = (selectedIds || []).map((x) => String(x));

    const patchGuests = (mode) => {
      setGuestSeatForm((prev) => {
        const next = { ...prev };
        ids.forEach((idStr) => {
          next[idStr] = {
            attendance_mode: 'online',
            notify_enrollment: false,
            ...prev[idStr],
            attendance_mode: mode,
          };
        });
        return next;
      });
    };

    if (preset === 'all_online') {
      if (!includedPkg) setBookerSeatMode('online');
      patchGuests('online');
    } else if (preset === 'all_offline') {
      if (!includedPkg) setBookerSeatMode('offline');
      patchGuests('offline');
    } else if (preset === 'guests_offline_booker_online') {
      if (!includedPkg) setBookerSeatMode('online');
      patchGuests('offline');
    }
  };

  /** Bulk email-enrollment toggles: all_on | me_only (booker yes, guests no) | all_off */
  const applyBulkNotify = (preset) => {
    if (!seatModalCtx) return;
    const { includedPkg, selectedIds } = seatModalCtx;
    const ids = (selectedIds || []).map((x) => String(x));
    if (!includedPkg) {
      setBookerSeatNotify(preset !== 'all_off');
    }
    const guestNotify = preset === 'all_on';
    setGuestSeatForm((prev) => {
      const next = { ...prev };
      ids.forEach((idStr) => {
        next[idStr] = {
          attendance_mode: 'online',
          notify_enrollment: false,
          ...prev[idStr],
          notify_enrollment: guestNotify,
        };
      });
      return next;
    });
  };

  const patchSeatDraft = (programId, partial) => {
    if (partial.bookerSeatMode !== undefined) {
      setBookerSeatMode(partial.bookerSeatMode === 'offline' ? 'offline' : 'online');
    }
    if (partial.bookerSeatNotify !== undefined) {
      setBookerSeatNotify(!!partial.bookerSeatNotify);
    }
    if (partial.guestSeatForm !== undefined) {
      setGuestSeatForm(partial.guestSeatForm);
    }
    if (partial.enrollmentDefaultsLoaded !== undefined) {
      setEnrollmentDefaultsLoaded(!!partial.enrollmentDefaultsLoaded);
    }
    if (partial.persistEnrollmentDefaultsOnContinue !== undefined) {
      setPersistEnrollmentDefaultsOnContinue(!!partial.persistEnrollmentDefaultsOnContinue);
    }
    if (partial.bookerJoinsProgram !== undefined) {
      setSeatDraftsByProgram((prev) => ({
        ...prev,
        [programId]: {
          ...(prev[programId] || createEmptySeatDraft()),
          bookerJoinsProgram: partial.bookerJoinsProgram,
        },
      }));
    }
  };

  const applyBulkSeatModesDraft = (programId, preset) => {
    const prog = programsForPrefetch.find((x) => x.id === programId);
    if (!prog) return;
    const includedPkg =
      programIncludedInAnnualPackage(prog, annualIncludedIds) || !!annualQuotes[programId]?.included_in_annual_package;
    const ids = (selectedFamilyByProgram[programId] || []).map(String);
    const patchGuests = (mode) => {
      setGuestSeatForm((prev) => {
        const next = { ...prev };
        ids.forEach((idStr) => {
          next[idStr] = {
            attendance_mode: 'online',
            notify_enrollment: false,
            ...prev[idStr],
            attendance_mode: mode,
          };
        });
        return next;
      });
    };
    if (preset === 'all_online') {
      if (!includedPkg) setBookerSeatMode('online');
      patchGuests('online');
    } else if (preset === 'all_offline') {
      if (!includedPkg) setBookerSeatMode('offline');
      patchGuests('offline');
    } else if (preset === 'guests_offline_booker_online') {
      if (!includedPkg) setBookerSeatMode('online');
      patchGuests('offline');
    }
  };

  const applyBulkNotifyDraft = (programId, preset) => {
    const prog = programsForPrefetch.find((x) => x.id === programId);
    if (!prog) return;
    const includedPkg =
      programIncludedInAnnualPackage(prog, annualIncludedIds) || !!annualQuotes[programId]?.included_in_annual_package;
    const ids = (selectedFamilyByProgram[programId] || []).map(String);
    if (!includedPkg) {
      setBookerSeatNotify(preset !== 'all_off');
    }
    const guestNotify = preset === 'all_on';
    setGuestSeatForm((prev) => {
      const next = { ...prev };
      ids.forEach((idStr) => {
        next[idStr] = {
          attendance_mode: 'online',
          notify_enrollment: false,
          ...prev[idStr],
          notify_enrollment: guestNotify,
        };
      });
      return next;
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
   * Writes dashboard enrollment defaults to localStorage. When guests are selected, they must share one
   * attendance mode and one notify flag so a single default row can apply to future enrollments.
   */
  const persistEnrollmentSeatDefaultsToBrowser = (selectedIds, bookerModeIn, bookerNotifyIn, guestFormIn) => {
    const sid = selectedIds.map(String);
    if (sid.length > 0) {
      const modes = new Set(sid.map((id) => (guestFormIn[id]?.attendance_mode === 'offline' ? 'offline' : 'online')));
      const notifs = new Set(sid.map((id) => !!guestFormIn[id]?.notify_enrollment));
      if (modes.size > 1 || notifs.size > 1) {
        toast({
          title: 'Match family rows to save defaults',
          description:
            'Use a one-tap preset or the quick options so every selected person has the same attendance and email settings, then try again.',
          variant: 'destructive',
        });
        return false;
      }
    }
    saveDashboardEnrollmentDefaults({
      bookerMode: bookerModeIn === 'offline' ? 'offline' : 'online',
      bookerNotify: !!bookerNotifyIn,
      guestMode:
        sid.length > 0 ? (guestFormIn[sid[0]]?.attendance_mode === 'offline' ? 'offline' : 'online') : 'online',
      guestNotify: sid.length > 0 ? !!guestFormIn[sid[0]]?.notify_enrollment : false,
    });
    setEnrollmentDefaultsLoaded(true);
    toast({
      title: 'Defaults saved for all programs',
      description: 'These options will load automatically the next time you enroll from the dashboard on this device.',
    });
    return true;
  };

  const saveEnrollmentDefaultsAndCloseModal = () => {
    if (!seatModalCtx) return;
    const included = !!seatModalCtx.includedPkg;
    const selectedIds = seatModalCtx.selectedIds || [];
    if (!validateEnrollmentSeatContacts(included, selectedIds, guestSeatForm, bookerSeatNotify)) return;
    if (!persistEnrollmentSeatDefaultsToBrowser(selectedIds, bookerSeatMode, bookerSeatNotify, guestSeatForm)) return;
    setEnrollmentSeatOpen(false);
    setSeatModalCtx(null);
  };

  const executeEnrollmentPay = async ({
    programId,
    programTitle,
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

    setEnrollmentSeatOpen(false);
    const guest_seat_prefs = selectedIds.map((id) => {
      const row = guestFormIn[id] || {};
      return {
        family_member_id: id,
        attendance_mode: row.attendance_mode === 'offline' ? 'offline' : 'online',
        notify_enrollment: !!row.notify_enrollment,
      };
    });

    setPayingProgramId(programId);
    try {
      const body = {
        program_id: programId,
        family_member_ids: selectedIds,
        currency,
        origin_url: typeof window !== 'undefined' ? window.location.origin : '',
        guest_seat_prefs,
      };
      if (!included) {
        body.booker_attendance_mode = bookerModeIn === 'offline' ? 'offline' : 'online';
        body.booker_notify = !!bookerNotifyIn;
      }
      const r = await axios.post(`${API}/api/student/dashboard-pay`, body, { withCredentials: true });
      const { enrollment_id, tier_index: tierIdx } = r.data;
      setProgramPaymentModal({
        enrollmentId: enrollment_id,
        programId,
        programTitle,
        tierIndex: tierIdx != null ? tierIdx : null,
      });
      setSeatModalCtx(null);
    } catch (e) {
      toast({
        title: 'Could not start payment',
        description: e.response?.data?.detail || 'Try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setPayingProgramId(null);
    }
  };

  const confirmEnrollmentSeatsAndPay = async () => {
    if (!seatModalCtx) return;
    await executeEnrollmentPay({
      programId: seatModalCtx.programId,
      programTitle: seatModalCtx.programTitle,
      includedPkg: seatModalCtx.includedPkg,
      selectedIds: seatModalCtx.selectedIds,
      bookerSeatMode,
      bookerSeatNotify,
      guestSeatForm,
      persistEnrollmentDefaultsOnContinue,
    });
  };

  const continueAnnualEnrollmentPay = async (program, includedPkg, selectedIds) => {
    await executeEnrollmentPay({
      programId: program.id,
      programTitle: program.title || '',
      includedPkg,
      selectedIds,
      bookerSeatMode,
      bookerSeatNotify,
      guestSeatForm,
      persistEnrollmentDefaultsOnContinue,
    });
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

  const addProgramToCartAndGo = async (p, tierOverride = null) => {
    const tierIdx = tierOverride != null ? tierOverride : pickTierIndexForDashboard(p, isAnnual);
    const tier = tierIdx == null ? 0 : tierIdx;
    let participants = null;
    try {
      const pre = await loadEnrollmentPrefill();
      if (isAnnual) {
        const includedForSeat =
          programIncludedInAnnualPackage(p, annualIncludedIds) || !!annualQuotes[p.id]?.included_in_annual_package;
        if (includedForSeat) {
          toast({
            title: 'Use payment on this program',
            description:
              'Programs included in your annual package are not added to combined DIVINE CART. Use Add to Divine Cart on that program’s card to pay for guest seats only.',
          });
          return;
        }
        const sel = selectedFamilyByProgram[p.id] || [];
        const perDraft = seatDraftsRef.current[p.id];
        const draft = mergeGlobalSeatDraft(perDraft, bookerSeatMode, bookerSeatNotify, guestSeatForm);
        participants = buildAnnualDashboardCartParticipants({
          program: p,
          includedPkg: false,
          selectedMemberIds: sel,
          seatDraft: draft,
          enrollableGuests,
          self: pre.self,
          bookerEmail,
          detectedCountry,
          immediateFamilyMembers: members,
        });
      } else {
        participants =
          buildFullPortalRosterCartParticipants(p, pre, bookerEmail, detectedCountry) ||
          buildSelfOnlyCartParticipants(pre.self, p, bookerEmail, detectedCountry);
      }
    } catch {
      /* syncProgramLineItem will add a blank row if build failed */
    }
    if (
      isAnnual &&
      (programIncludedInAnnualPackage(p, annualIncludedIds) || !!annualQuotes[p.id]?.included_in_annual_package)
    ) {
      return;
    }
    const includedForSeat =
      programIncludedInAnnualPackage(p, annualIncludedIds) || !!annualQuotes[p.id]?.included_in_annual_package;
    const sel = selectedFamilyByProgram[p.id] || [];
    const draft = seatDraftsRef.current[p.id];
    const guestBucketById = buildGuestBucketByIdFromSelection(sel, members);
    syncProgramLineItem(p, tier, participants, {
      familyIds: sel.map(String),
      bookerJoins: draft?.bookerJoinsProgram !== false,
      annualIncluded: !!includedForSeat,
      portalQuoteTotal: annualQuotes[p.id]?.total != null ? Number(annualQuotes[p.id].total) : null,
      guestBucketById,
    });
    toast({
      title: 'Order updated',
      description: participants?.length
        ? 'DIVINE CART now matches your dashboard seats for this program.'
        : 'Add details on the dashboard, then open DIVINE CART.',
    });
    navigate('/dashboard/combined-checkout');
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 mb-4 md:mb-6" data-testid="dashboard-upcoming-family">
      <div className="rounded-[28px] border border-[rgba(160,100,220,0.14)] bg-white/70 backdrop-blur-xl px-5 py-5 md:px-7 md:py-6 shadow-[0_4px_48px_rgba(140,60,220,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center shrink-0">
              <Calendar size={17} className="text-[#D4AF37]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-[family-name:'Cinzel',serif] text-[11px] uppercase tracking-[0.2em] text-[rgba(100,40,160,0.55)]">
                Upcoming programs
              </h2>
              <p className="text-xs text-slate-500">
                Portal-only pricing: your seat, immediate household, and friends &amp; extended can each use{' '}
                <span className="text-slate-700 font-medium">different</span> rules (Admin → Dashboard).{' '}
                {isAnnual ? (
                  <>
                    <strong className="text-slate-700 font-medium">DIVINE CART</strong> is only for programs{' '}
                    <span className="text-slate-700 font-medium">not</span> already in your annual package — use{' '}
                    <strong className="text-slate-700 font-medium">Add to Divine Cart</strong> on those. For package-included
                    programs, use <strong className="text-slate-700 font-medium">Add to Divine Cart</strong> on each card for
                    guest seats only. On add-on programs you can choose whether you enroll yourself under Attendance &amp;
                    notification.
                  </>
                ) : (
                  <>
                    Use <strong className="text-slate-700 font-medium">Add to Divine Cart</strong> on each program (or the
                    sidebar link) to open checkout, review every seat, and pay.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 justify-end">
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
                programIncludedInAnnualPackage(p, annualIncludedIds) ||
                !!annualQuotes[p.id]?.included_in_annual_package;
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
                  isAnnual={isAnnual}
                  bookerEmail={bookerEmail}
                  detectedCountry={detectedCountry}
                  symbol={symbol}
                  currency={currency}
                  getPrice={getPrice}
                  getOfferPrice={getOfferPrice}
                  promoForProgramClicks={promoForProgramClicks}
                  promoByProgramId={promoByProgramId}
                  promoPricesLoading={promoPricesLoading}
                  aq={annualQuotes[p.id]}
                  annualIncludedIds={annualIncludedIds}
                  members={members}
                  otherMembers={otherMembers}
                  enrollableGuests={enrollableGuests}
                  selectableFamilyMemberIds={selectableFamilyMemberIds}
                  selectedFamilyByProgram={selectedFamilyByProgram}
                  toggleFamilyMember={toggleFamilyMember}
                  toggleSelectAllFamilyForProgram={toggleSelectAllFamilyForProgram}
                  addProgramToCartAndGo={addProgramToCartAndGo}
                  openEnrollmentSeatModal={openEnrollmentSeatModal}
                  payingProgramId={payingProgramId}
                  annualSeatUi={
                    isAnnual
                      ? {
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
                          onContinuePay: () => continueAnnualEnrollmentPay(p, includedForSeat, sel),
                        }
                      : null
                  }
                />
              );
            })}
            {isAnnual ? (
              <div
                className="rounded-xl border border-slate-200/90 bg-white px-3 py-3 sm:px-4 shadow-sm"
                data-testid="dashboard-enrollment-defaults-global"
              >
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                  Enrollment defaults &amp; per-person seating
                </p>
                <p className="text-[10px] text-slate-600 leading-snug mb-3">
                  These apply to <strong className="text-slate-800">all</strong> upcoming programs — set once here instead of
                  on every card. Open a program, adjust attendance and email options, then use <strong className="text-slate-800">Save defaults &amp; close</strong> in the dialog (no payment required) or continue to payment with the checkbox on.
                </p>
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-x-5 sm:gap-y-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-[10px] text-slate-800">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 scale-90 shrink-0"
                      checked={persistEnrollmentDefaultsOnContinue}
                      onChange={(e) => setPersistEnrollmentDefaultsOnContinue(e.target.checked)}
                    />
                    <span className="font-medium">Save as my default for every program (this browser)</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-800">
                    <span className="text-slate-600 shrink-0">Per-person attendance &amp; email for</span>
                    <select
                      className="border border-slate-200 rounded-lg px-2 py-1 text-[10px] bg-white max-w-[14rem] sm:max-w-[18rem] truncate"
                      value={perPersonProgramId != null ? String(perPersonProgramId) : ''}
                      onChange={(e) => setPerPersonProgramId(e.target.value || null)}
                    >
                      {upcomingList.map((prog) => (
                        <option key={prog.id} value={String(prog.id)}>
                          {prog.title || prog.id}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[10px] border-violet-200 text-violet-900 hover:bg-violet-50"
                      onClick={openPerPersonSeatModalForSelection}
                    >
                      Open…
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="border-t border-slate-200/80 pt-4 mt-2">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-violet-700" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Immediate family</h3>
              <p className="text-[11px] text-slate-500">
                Add household members for family enrollments (max 12). Use <strong className="text-slate-700 font-medium">country</strong>{' '}
                (e.g. IN, AE) and contact fields. Online / offline and enrollment email notifications are chosen when you
                enroll or pay for a program, not on this list.
              </p>
            </div>
          </div>

          {immediateFamilyReadOnly ? (
            <div
              className="mb-3 flex gap-2 rounded-xl border border-amber-200/90 bg-amber-50/80 px-3 py-2.5 text-[11px] text-amber-950"
              data-testid="immediate-family-locked-notice"
            >
              <Lock size={14} className="shrink-0 mt-0.5 text-amber-700" />
              <p>
                This list is <span className="font-semibold">locked</span> after your first save with names on file. To
                change it, ask your admin to allow edits in Client Garden, then refresh this page.
              </p>
            </div>
          ) : null}
          {immediateFamilyLocked && immediateFamilyEditApproved ? (
            <div className="mb-3 flex gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-3 py-2.5 text-[11px] text-emerald-950">
              <Lock size={14} className="shrink-0 mt-0.5 text-emerald-700" />
              <p>
                An admin has <span className="font-semibold">approved edits</span> to your immediate family list. Update
                and save when you are done.
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
              disabled={immediateFamilyReadOnly || members.length >= 12}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5D3FD3] border border-violet-200 rounded-full px-3 py-1.5 hover:bg-violet-50 disabled:opacity-40"
            >
              <Plus size={14} /> Add family member
            </button>
            <button
              type="button"
              onClick={saveFamily}
              disabled={saving || immediateFamilyReadOnly}
              className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-4 py-1.5 bg-[#D4AF37] text-white hover:bg-[#b8962e] disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save family list
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200/80 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-indigo-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Friends &amp; extended</h3>
              <p className="text-[11px] text-slate-500">
                Friends, cousins, relatives, uncles/aunts, grandparents, and similar (max 12). Same contact fields as
                immediate family; session mode and enrollment emails are set at checkout time.
              </p>
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
              onClick={saveOtherGuests}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-4 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save friends &amp; extended
            </button>
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
              Set attendance and enrollment notification email for this checkout — including the WhatsApp group link when
              applicable. Use <strong className="text-slate-800">Save defaults &amp; close</strong> to store choices in this
              browser without paying, or <strong className="text-slate-800">Continue to payment</strong> with the checkbox
              below to save defaults when you pay.
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2.5 space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Attendance (pick one)</p>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 shrink-0"
                        checked={attendanceQuickPresetLive === 'all_online'}
                        onChange={(e) => {
                          if (e.target.checked) applyBulkSeatModes('all_online');
                        }}
                      />
                      All online
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 shrink-0"
                        checked={attendanceQuickPresetLive === 'all_offline'}
                        onChange={(e) => {
                          if (e.target.checked) applyBulkSeatModes('all_offline');
                        }}
                      />
                      All offline
                    </label>
                    {!seatModalCtx.includedPkg ? (
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 shrink-0"
                          checked={attendanceQuickPresetLive === 'except_me'}
                          onChange={(e) => {
                            if (e.target.checked) applyBulkSeatModes('guests_offline_booker_online');
                          }}
                        />
                        All offline except Myself
                      </label>
                    ) : (
                      <p className="text-[9px] text-slate-500">
                        “All offline except Myself” is available when your own seat is part of this payment.
                      </p>
                    )}
                  </div>
                  {attendanceQuickPresetLive === 'custom' ? (
                    <p className="text-[9px] text-amber-800/90">
                      Mixed modes — adjust rows below or pick an option above.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 leading-snug">
                    Enrollment Notification Email (for WhatsApp Group Link)
                  </p>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 shrink-0"
                        checked={notifyQuickPresetLive === 'email_all'}
                        onChange={(e) => {
                          if (e.target.checked) applyBulkNotify('all_on');
                        }}
                      />
                      Email all
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 shrink-0"
                        checked={notifyQuickPresetLive === 'email_me_only'}
                        onChange={(e) => {
                          if (e.target.checked) applyBulkNotify('me_only');
                        }}
                      />
                      Email Me Only
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-800">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 shrink-0"
                        checked={notifyQuickPresetLive === 'custom'}
                        onChange={(e) => {
                          if (e.target.checked) applyBulkNotify('all_off');
                        }}
                      />
                      Custom
                    </label>
                  </div>
                  {notifyQuickPresetLive === 'mixed' ? (
                    <p className="text-[9px] text-amber-800/90">
                      Mixed notification choices — adjust rows below or pick an option above.
                    </p>
                  ) : null}
                </div>
              </div>

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
                      When you continue to payment, we store them in this browser. Next time you open enrollment, fields
                      fill automatically. Selected family rows must all match (use a preset) to save.
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
                        name="dash-booker-mode"
                        checked={bookerSeatMode === 'online'}
                        onChange={() => setBookerSeatMode('online')}
                      />
                      <Wifi size={12} className="text-slate-500" />
                      Online
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="dash-booker-mode"
                        checked={bookerSeatMode === 'offline'}
                        onChange={() => setBookerSeatMode('offline')}
                      />
                      <Monitor size={12} className="text-slate-500" />
                      Offline
                    </label>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-slate-300"
                      checked={bookerSeatNotify}
                      onChange={(e) => setBookerSeatNotify(e.target.checked)}
                    />
                    <span>
                      <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                        {bookerSeatNotify ? <Bell size={12} className="text-slate-500" /> : <BellOff size={12} className="text-slate-400" />}
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
                      const row = guestSeatForm[id] || { attendance_mode: 'online', notify_enrollment: false };
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
              className="text-xs h-9 w-full sm:w-auto order-3 bg-[#D4AF37] hover:bg-[#b8962e] text-white"
              onClick={confirmEnrollmentSeatsAndPay}
            >
              Continue to payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {programPaymentModal && (
        <DashboardProgramPaymentModal
          open={!!programPaymentModal}
          onClose={() => setProgramPaymentModal(null)}
          onSuccess={() => onRefresh?.()}
          enrollmentId={programPaymentModal.enrollmentId}
          programId={programPaymentModal.programId}
          programTitle={programPaymentModal.programTitle}
          tierIndex={programPaymentModal.tierIndex}
          paymentMethods={paymentMethods}
          indiaReference={homeData?.india_payment_reference}
          preferredIndiaGpayId={homeData?.preferred_india_gpay_id || ''}
          preferredIndiaBankId={homeData?.preferred_india_bank_id || ''}
          bankAccounts={homeData?.bank_accounts || []}
          currency={currency}
          displayCurrency={displayCurrency}
          displayRate={displayRate}
          isPrimary={isPrimary}
        />
      )}
    </section>
  );
}
