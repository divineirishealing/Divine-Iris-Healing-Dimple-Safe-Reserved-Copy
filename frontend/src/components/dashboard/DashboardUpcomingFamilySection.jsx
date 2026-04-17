import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar, Sparkles, Users, Loader2, Plus, Trash2, CreditCard, Clock, AlertTriangle, Lock, Bell, BellOff, Monitor, Wifi } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { useCurrency } from '../../context/CurrencyContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { useCart } from '../../context/CartContext';
import { resolveImageUrl } from '../../lib/imageUtils';
import { formatDateDdMonYyyy } from '../../lib/utils';
import DashboardProgramPaymentModal from './DashboardProgramPaymentModal';
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

/** Tier index for flagship programs: prefer annual tier for annual subscribers, else first tier. */
function pickTierIndexForDashboard(program, preferAnnualTier) {
  const tiers = program?.duration_tiers || [];
  if (!program?.is_flagship || tiers.length === 0) return null;
  if (preferAnnualTier) {
    const idx = tiers.findIndex((t) => {
      const l = (t.label || '').toLowerCase();
      return l.includes('annual') || l.includes('year') || t.duration_unit === 'year';
    });
    if (idx >= 0) return idx;
  }
  return 0;
}

function programStartLabel(p) {
  const d = p.start_date || p.deadline_date;
  if (!d) return 'Dates TBC';
  const iso = String(d).slice(0, 10);
  return formatDateDdMonYyyy(iso) || d;
}

/** MMM / AWRP etc. — already in annual package; member only pays for family add-ons. */
function programIncludedInAnnualPackage(p, configuredIds) {
  const ids = Array.isArray(configuredIds)
    ? configuredIds.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (ids.length > 0) {
    return ids.includes(String(p.id));
  }
  const t = `${p.title || ''} ${p.category || ''}`.toLowerCase();
  return (
    t.includes('money magic') ||
    t.includes('mmm') ||
    t.includes('atomic weight') ||
    t.includes('awrp')
  );
}

function memberSubcaption(rule) {
  const r = rule || 'list';
  if (r === 'promo') return 'after portal promo';
  if (r === 'percent_off') return '% off your seat';
  if (r === 'amount_off') return 'amount off your seat';
  if (r === 'fixed_price') return 'fixed member price';
  if (r === 'included_in_package') return '';
  return 'list / offer unit';
}

function familySubcaption(rule) {
  const r = rule || 'list';
  if (r === 'promo') return 'after portal promo';
  if (r === 'percent_off') return '% off line total';
  if (r === 'amount_off') return 'amount off line total';
  if (r === 'fixed_price') return 'fixed per seat × count';
  if (r === 'mixed') return 'split: household vs extended rules';
  if (r === 'none') return '';
  return 'list / offer';
}

/** Same basis as EnrollmentPage promo discount: percentage of subtotal or fixed per currency. */
function promoDiscountAmount(promoResult, subtotalRaw, currency) {
  if (!promoResult || subtotalRaw <= 0) return 0;
  if (promoResult.discount_type === 'percentage') {
    return Math.round(subtotalRaw * (Number(promoResult.discount_percentage) || 0) / 100);
  }
  return promoResult[`discount_${currency}`] || promoResult.discount_aed || 0;
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
  const { addItem } = useCart();
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
  const programPortalMap = homeData?.dashboard_program_offers || {};
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

  const defaultPaymentChannel = useMemo(() => {
    const m = paymentMethods;
    const hasStripe = m.includes('stripe');
    const hasOffline = m.some((x) => ['manual', 'gpay', 'bank'].includes(x));
    if (!hasStripe && hasOffline) return 'manual';
    if (hasStripe) return 'stripe';
    return 'manual';
  }, [paymentMethods]);

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
        const params =
          ids.length > 0
            ? { program_id: p.id, currency, family_ids: ids.join(',') }
            : { program_id: p.id, currency, family_count: 0 };
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
  }, [isAnnual, currencyReady, currency, prefetchProgramsKey, familySelectionKey, programsForPrefetch]);

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
    const initGuests = {};
    ids.forEach((id) => {
      initGuests[id] = {
        attendance_mode: saved ? saved.guestMode : 'online',
        notify_enrollment: saved ? saved.guestNotify : false,
      };
    });
    setGuestSeatForm(initGuests);
    setBookerSeatMode(saved ? saved.bookerMode : 'online');
    setBookerSeatNotify(saved ? saved.bookerNotify : true);
    setEnrollmentDefaultsLoaded(!!saved);
    setPersistEnrollmentDefaultsOnContinue(false);
    setSeatModalCtx({
      programId: program.id,
      programTitle: program.title || '',
      includedPkg: !!includedPkg,
      selectedIds: ids,
    });
    setEnrollmentSeatOpen(true);
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

  const confirmEnrollmentSeatsAndPay = async () => {
    if (!seatModalCtx) return;
    const { programId, includedPkg, selectedIds } = seatModalCtx;
    if (!includedPkg && bookerSeatNotify && !String(bookerEmail || '').trim()) {
      toast({
        title: 'Email needed for notifications',
        description: 'Turn off “Email me enrollment details” for your seat, or add an email to your account.',
        variant: 'destructive',
      });
      return;
    }
    for (const id of selectedIds) {
      const row = guestSeatForm[id] || {};
      if (row.notify_enrollment) {
        const m = enrollableGuests.find((g) => String(g.id) === String(id));
        if (!m || !(String(m.email || '').trim())) {
          toast({
            title: 'Email required for notifications',
            description: `Add an email for “${(m?.name || 'this person').trim()}” or turn off notifications for their seat.`,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    if (persistEnrollmentDefaultsOnContinue) {
      const sid = selectedIds.map(String);
      if (sid.length > 0) {
        const modes = new Set(sid.map((id) => (guestSeatForm[id]?.attendance_mode === 'offline' ? 'offline' : 'online')));
        const notifs = new Set(sid.map((id) => !!guestSeatForm[id]?.notify_enrollment));
        if (modes.size > 1 || notifs.size > 1) {
          toast({
            title: 'Match family rows to save defaults',
            description:
              'Use a one-tap preset or the quick options so every selected person has the same attendance and email settings, then try again.',
            variant: 'destructive',
          });
          return;
        }
      }
      saveDashboardEnrollmentDefaults({
        bookerMode: bookerSeatMode === 'offline' ? 'offline' : 'online',
        bookerNotify: !!bookerSeatNotify,
        guestMode:
          sid.length > 0 ? (guestSeatForm[sid[0]]?.attendance_mode === 'offline' ? 'offline' : 'online') : 'online',
        guestNotify: sid.length > 0 ? !!guestSeatForm[sid[0]]?.notify_enrollment : false,
      });
      toast({
        title: 'Defaults saved for all programs',
        description: 'These options will load automatically the next time you enroll from the dashboard on this device.',
      });
    }

    setEnrollmentSeatOpen(false);
    const guest_seat_prefs = selectedIds.map((id) => {
      const row = guestSeatForm[id] || {};
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
      if (!includedPkg) {
        body.booker_attendance_mode = bookerSeatMode === 'offline' ? 'offline' : 'online';
        body.booker_notify = !!bookerSeatNotify;
      }
      const r = await axios.post(`${API}/api/student/dashboard-pay`, body, { withCredentials: true });
      const { enrollment_id, tier_index: tierIdx } = r.data;
      setProgramPaymentModal({
        enrollmentId: enrollment_id,
        programId,
        programTitle: seatModalCtx.programTitle,
        tierIndex: tierIdx != null ? tierIdx : null,
        payChannel: defaultPaymentChannel,
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

  const addProgramToCartAndGo = (p) => {
    const tierIdx = pickTierIndexForDashboard(p, isAnnual);
    const tier = tierIdx == null ? 0 : tierIdx;
    const added = addItem(p, tier);
    if (added) {
      toast({
        title: 'Added to cart',
        description: 'Set online/offline and email options on the cart page, then checkout like the main site.',
      });
    } else {
      toast({
        title: 'Already in cart',
        description: 'Opening your cart — continue checkout there.',
      });
    }
    navigate('/cart');
  };

  return (
    <section className="w-full max-w-5xl mx-auto px-4 mb-4 md:mb-6" data-testid="dashboard-upcoming-family">
      <div className="rounded-[28px] border border-[rgba(160,100,220,0.14)] bg-white/70 backdrop-blur-xl px-5 py-5 md:px-7 md:py-6 shadow-[0_4px_48px_rgba(140,60,220,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center">
            <Calendar size={17} className="text-[#D4AF37]" />
          </div>
          <div>
            <h2 className="font-[family-name:'Cinzel',serif] text-[11px] uppercase tracking-[0.2em] text-[rgba(100,40,160,0.55)]">
              Upcoming programs
            </h2>
            <p className="text-xs text-slate-500">
              Portal-only pricing: your seat, immediate household, and friends &amp; extended can each use{' '}
              <span className="text-slate-700 font-medium">different</span> rules (Admin → Dashboard). Annual members pay below
              after choosing guests; other members add programs to the cart and use the same checkout as the main site.
            </p>
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {upcomingList.map((p) => {
              const tierIdx = pickTierIndexForDashboard(p, isAnnual);
              const hasTiers = p.is_flagship && (p.duration_tiers || []).length > 0;
              const list = hasTiers && tierIdx !== null ? getPrice(p, tierIdx) : getPrice(p);
              const off = hasTiers && tierIdx !== null ? getOfferPrice(p, tierIdx) : getOfferPrice(p);
              const baseForPromo = off > 0 ? off : list;
              const validated = promoForProgramClicks ? promoByProgramId[p.id] : null;
              const disc =
                validated && baseForPromo > 0 ? promoDiscountAmount(validated, baseForPromo, currency) : 0;
              const afterPromo = Math.max(0, baseForPromo - disc);
              const showSpecialPromo =
                Boolean(promoForProgramClicks && validated && disc > 0 && !promoPricesLoading);
              const aq = annualQuotes[p.id];
              const includedPkg =
                aq?.included_in_annual_package ??
                programIncludedInAnnualPackage(p, annualIncludedIds);
              const selIds = selectedFamilyByProgram[p.id] || [];
              const selCount = selIds.length;
              const canPay = Boolean(aq && aq.total > 0 && (!includedPkg || selCount >= 1));
              const cardMedia = (
                <>
                  <div className="h-24 bg-slate-100 overflow-hidden">
                    <img
                      src={resolveImageUrl(p.image)}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      onError={(e) => {
                        e.target.src =
                          'https://images.unsplash.com/photo-1545389336-cf090694435e?w=400&h=200&fit=crop';
                      }}
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-[9px] text-[#D4AF37] uppercase tracking-wider mb-0.5">{p.category || 'Program'}</p>
                    <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">{p.title}</p>
                    {(() => {
                      const row = programPortalMap[p.id];
                      const hasMap =
                        row &&
                        ((row.annual && Object.keys(row.annual).length > 0) ||
                          (row.family && Object.keys(row.family).length > 0) ||
                          (row.extended && Object.keys(row.extended).length > 0));
                      return hasMap || annualQuotes[p.id]?.program_portal_pricing_override ? (
                        <p className="text-[9px] text-indigo-800/90 mt-1 font-medium leading-snug">
                          Program-specific portal pricing
                        </p>
                      ) : null;
                    })()}
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                      <Calendar size={10} /> {programStartLabel(p)}
                    </p>
                    {!isAnnual && (list > 0 || off > 0) && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                        {showSpecialPromo ? (
                          <p className="text-[11px] text-slate-800">
                            <span className="font-semibold text-[#b8860b]">{symbol}{afterPromo.toLocaleString()}</span>
                            <span className="text-slate-400 line-through ml-1.5 text-[10px]">{symbol}{baseForPromo.toLocaleString()}</span>
                            <span className="block text-[9px] text-violet-700/90 mt-0.5">
                              With {promoForProgramClicks} (on offer price)
                            </span>
                            {off > 0 && list > off && (
                              <span className="block text-[9px] text-slate-400 mt-0.5">List {symbol}{list.toLocaleString()}</span>
                            )}
                          </p>
                        ) : off > 0 ? (
                          <p className="text-[11px] text-slate-800">
                            <span className="font-semibold text-[#b8860b]">{symbol}{off.toLocaleString()}</span>
                            {list > 0 && off < list && (
                              <span className="text-slate-400 line-through ml-1.5 text-[10px]">{symbol}{list.toLocaleString()}</span>
                            )}
                            <span className="block text-[9px] text-slate-400 mt-0.5">Offer price</span>
                          </p>
                        ) : list > 0 ? (
                          <p className="text-[11px] text-slate-800 font-medium">{symbol}{list.toLocaleString()}</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </>
              );
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200/90 bg-white/90 overflow-hidden hover:border-[#D4AF37]/40 hover:shadow-md transition-all flex flex-col"
                  data-testid={`dashboard-upcoming-${p.id}`}
                >
                  {isAnnual ? (
                    <div className="text-left w-full group">{cardMedia}</div>
                  ) : (
                                       <div
                      className="text-left w-full group cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={`Add ${p.title || 'program'} to cart`}
                      onClick={() => addProgramToCartAndGo(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          addProgramToCartAndGo(p);
                        }
                      }}
                    >
                      {cardMedia}
                    </div>
                  )}
                  <div className="px-3 pb-2 pt-0">
                    <button
                      type="button"
                      className="text-[10px] text-violet-700 hover:text-violet-900 font-medium underline-offset-2 hover:underline text-left w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/program/${p.id}`);
                      }}
                      data-testid={`dashboard-know-more-${p.id}`}
                    >
                      Know more about this program
                    </button>
                  </div>

                  {isAnnual && (
                    <div className="px-3 pb-3 pt-0 border-t border-slate-100 bg-gradient-to-b from-amber-50/40 to-transparent">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#b8860b] mt-2 mb-1">
                        Annual member checkout
                      </p>
                      {includedPkg && (
                        <p className="text-[10px] text-slate-600 leading-snug mb-2">
                          This program is included in your annual package for you. Choose family members to join below
                          (immediate family or friends &amp; extended) — you only pay for their seats.
                        </p>
                      )}
                      {aq ? (
                        <div className="space-y-1 text-[11px] text-slate-700">
                          {!includedPkg && (
                            <div className="flex justify-between gap-2">
                              <span className="leading-snug">
                                You
                                {memberSubcaption(aq.member_pricing_rule) ? (
                                  <>
                                    {' '}
                                    <span className="text-slate-500">— {memberSubcaption(aq.member_pricing_rule)}</span>
                                  </>
                                ) : null}
                              </span>
                              <span className="font-medium tabular-nums">
                                {symbol}
                                {Number(aq.self_after_promos || 0).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {(includedPkg ? selCount > 0 : selCount > 0) && (
                            <>
                              {(aq.immediate_family_count || 0) > 0 && (
                                <div className="flex justify-between gap-2 text-slate-600">
                                  <span className="leading-snug">
                                    Immediate family ({aq.immediate_family_count})
                                    {familySubcaption(aq.immediate_family_pricing_rule) ? (
                                      <>
                                        {' '}
                                        <span className="text-slate-500">
                                          — {familySubcaption(aq.immediate_family_pricing_rule)}
                                        </span>
                                      </>
                                    ) : null}
                                  </span>
                                  <span className="font-medium tabular-nums">
                                    {symbol}
                                    {Number(aq.immediate_family_after_promos || 0).toLocaleString()}
                                  </span>
                                </div>
                              )}
                              {(aq.extended_guest_count || 0) > 0 && (
                                <div className="flex justify-between gap-2 text-slate-600">
                                  <span className="leading-snug">
                                    Friends &amp; extended ({aq.extended_guest_count})
                                    {familySubcaption(aq.extended_guest_pricing_rule) ? (
                                      <>
                                        {' '}
                                        <span className="text-slate-500">
                                          — {familySubcaption(aq.extended_guest_pricing_rule)}
                                        </span>
                                      </>
                                    ) : null}
                                  </span>
                                  <span className="font-medium tabular-nums">
                                    {symbol}
                                    {Number(aq.extended_guests_after_promos || 0).toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex justify-between gap-2 pt-1 border-t border-amber-100/80 font-semibold text-slate-900">
                            <span>Total</span>
                            <span className="text-[#b8860b] tabular-nums">
                              {symbol}
                              {Number(aq.total || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 py-1">Loading pricing…</p>
                      )}

                      <div className="mt-2 space-y-1.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                          Family members to join
                        </p>
                        {enrollableGuests.length === 0 ? (
                          <p className="text-[10px] text-slate-400">
                            Add people under Immediate family or Friends &amp; extended below, then save each list.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-36 overflow-y-auto pr-0.5">
                            {selectableFamilyMemberIds.length > 0 ? (
                              <label className="flex items-center gap-2 text-[10px] font-semibold text-slate-700 cursor-pointer select-none pb-0.5 border-b border-slate-100/90">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300"
                                  checked={
                                    selectableFamilyMemberIds.length > 0 &&
                                    selectableFamilyMemberIds.every((id) => selIds.includes(id))
                                  }
                                  ref={(el) => {
                                    if (!el) return;
                                    const some = selectableFamilyMemberIds.some((id) => selIds.includes(id));
                                    const all =
                                      selectableFamilyMemberIds.length > 0 &&
                                      selectableFamilyMemberIds.every((id) => selIds.includes(id));
                                    el.indeterminate = some && !all;
                                  }}
                                  onChange={() => toggleSelectAllFamilyForProgram(p.id)}
                                />
                                <span>
                                  Add all ({selectableFamilyMemberIds.length} with saved profile
                                  {selectableFamilyMemberIds.length !== 1 ? 's' : ''})
                                </span>
                              </label>
                            ) : null}
                            {members.length > 0 && (
                              <div>
                                <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
                                  Immediate family
                                </p>
                                <ul className="space-y-1">
                                  {members.map((m, gidx) => {
                                    const mid = m.id || `imm-${gidx}-${m.name}-${m.email}`;
                                    return (
                                      <li key={mid}>
                                        <label className="flex items-center gap-2 text-[11px] text-slate-800 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            className="rounded border-slate-300"
                                            disabled={!m.id}
                                            checked={!!m.id && selIds.includes(String(m.id))}
                                            onChange={() => m.id && toggleFamilyMember(p.id, String(m.id))}
                                          />
                                          <span>
                                            {m.name || '—'}
                                            {m.relationship ? (
                                              <span className="text-slate-400"> ({m.relationship})</span>
                                            ) : null}
                                          </span>
                                        </label>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                            {otherMembers.length > 0 && (
                              <div>
                                <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
                                  Friends &amp; extended
                                </p>
                                <ul className="space-y-1">
                                  {otherMembers.map((m, gidx) => {
                                    const mid = m.id || `ext-${gidx}-${m.name}-${m.email}`;
                                    return (
                                      <li key={mid}>
                                        <label className="flex items-center gap-2 text-[11px] text-slate-800 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            className="rounded border-slate-300"
                                            disabled={!m.id}
                                            checked={!!m.id && selIds.includes(String(m.id))}
                                            onChange={() => m.id && toggleFamilyMember(p.id, String(m.id))}
                                          />
                                          <span>
                                            {m.name || '—'}
                                            {m.relationship ? (
                                              <span className="text-slate-400"> ({m.relationship})</span>
                                            ) : null}
                                          </span>
                                        </label>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                        {includedPkg && selCount === 0 && (
                          <p className="text-[9px] text-amber-800 bg-amber-50/80 rounded px-2 py-1">
                            Select who you are paying for — your own seat is already covered.
                          </p>
                        )}
                      </div>

                      <p className="mt-2 text-[9px] text-slate-500 leading-snug">
                        Payment method (Stripe vs UPI / bank + proof) matches your membership tags — choose in the next
                        step, same as the main site.
                      </p>

                      <button
                        type="button"
                        disabled={!canPay || payingProgramId === p.id}
                        title={
                          !canPay
                            ? includedPkg && selCount < 1
                              ? 'This program is included for you — select family members to join or wait for pricing to load.'
                              : !aq
                                ? 'Loading pricing…'
                                : (aq.total || 0) <= 0
                                  ? 'No amount due for this selection.'
                                  : ''
                            : undefined
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          openEnrollmentSeatModal(p, includedPkg, selIds);
                        }}
                        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#D4AF37] text-white text-[11px] font-semibold py-2 px-3 hover:bg-[#b8962e] disabled:opacity-50 disabled:pointer-events-none"
                        data-testid={`dashboard-pay-${p.id}`}
                      >
                        {payingProgramId === p.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CreditCard size={14} />
                        )}
                        Continue to enrollment &amp; payment
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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
            setPersistEnrollmentDefaultsOnContinue(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900">Enrollment for this program</DialogTitle>
            <DialogDescription className="text-[11px] text-slate-600 leading-relaxed">
              Set attendance and enrollment notification email for this checkout — including the WhatsApp group link when
              applicable. Combine the options below, or save your choices as the default for every program on this device.
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

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="text-xs h-9"
              onClick={() => {
                setEnrollmentSeatOpen(false);
                setSeatModalCtx(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="text-xs h-9 bg-[#D4AF37] hover:bg-[#b8962e] text-white"
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
          initialPayChannel={programPaymentModal.payChannel}
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
