import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar, Sparkles, Users, Loader2, Plus, Trash2, CreditCard, Clock, AlertTriangle, Lock } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { useCurrency } from '../../context/CurrencyContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { resolveImageUrl } from '../../lib/imageUtils';
import { formatDateDdMonYyyy } from '../../lib/utils';
import DashboardProgramPaymentModal from './DashboardProgramPaymentModal';

const API = process.env.REACT_APP_BACKEND_URL;

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
      <table className="w-full min-w-[1180px] text-left border-collapse" data-testid={tableTestId}>
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
            <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap w-[5.5rem]">
              Mode
            </th>
            <th
              className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap w-[3.25rem] text-center"
              title="Email enrollment details after payment"
            >
              Notify
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
                  placeholder={m.notify_enrollment ? 'Required if notifying' : 'Optional'}
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
              <td className="px-2 py-1.5 align-middle">
                <select
                  value={m.attendance_mode === 'offline' ? 'offline' : 'online'}
                  onChange={(e) => updateRow(idx, 'attendance_mode', e.target.value)}
                  disabled={readOnly}
                  className="w-full max-w-[5.5rem] text-[11px] border border-slate-200 rounded px-1 py-1 bg-white disabled:opacity-60 disabled:bg-slate-50"
                  aria-label="Online or offline"
                >
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </td>
              <td className="px-2 py-1.5 align-middle text-center">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 w-3.5 h-3.5"
                  checked={!!m.notify_enrollment}
                  onChange={(e) => updateRow(idx, 'notify_enrollment', e.target.checked)}
                  disabled={readOnly}
                  title="Send enrollment details to this email after payment is confirmed"
                  aria-label="Notify by email when enrolled"
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

/** Direct enrollment from dashboard (member pricing + profile prefill; skips public program page). */
function buildDashboardEnrollHref(p, { tierIdx, promoCode }) {
  const q = new URLSearchParams();
  q.set('source', 'dashboard');
  if (tierIdx !== null && tierIdx !== undefined) q.set('tier', String(tierIdx));
  if (promoCode && String(promoCode).trim()) q.set('promo', String(promoCode).trim());
  return `/enroll/program/${p.id}?${q.toString()}`;
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

export default function DashboardUpcomingFamilySection({ homeData, onRefresh }) {
  const navigate = useNavigate();
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
  const [payChannel, setPayChannel] = useState('stripe');
  const [programPaymentModal, setProgramPaymentModal] = useState(null);

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
        attendance_mode: 'online',
        country: '',
        notify_enrollment: false,
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
        attendance_mode: 'online',
        country: '',
        notify_enrollment: false,
      },
    ]);
  };

  const saveFamily = async () => {
    for (const m of members) {
      if ((m.name || '').trim() && m.notify_enrollment && !(m.email || '').trim()) {
        toast({
          title: 'Email required for notifications',
          description: `Add an email for “${(m.name || '').trim()}” or turn off Notify.`,
          variant: 'destructive',
        });
        return;
      }
    }
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
            attendance_mode: m.attendance_mode === 'offline' ? 'offline' : 'online',
            country: (m.country || '').trim(),
            notify_enrollment: !!m.notify_enrollment,
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
    for (const m of otherMembers) {
      if ((m.name || '').trim() && m.notify_enrollment && !(m.email || '').trim()) {
        toast({
          title: 'Email required for notifications',
          description: `Add an email for “${(m.name || '').trim()}” or turn off Notify.`,
          variant: 'destructive',
        });
        return;
      }
    }
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
            attendance_mode: m.attendance_mode === 'offline' ? 'offline' : 'online',
            country: (m.country || '').trim(),
            notify_enrollment: !!m.notify_enrollment,
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

  const hasOfflinePaymentOption = paymentMethods.some((x) =>
    ['manual', 'gpay', 'bank'].includes(x)
  );

  React.useEffect(() => {
    const m = homeData?.payment_methods || ['stripe'];
    const hasStripe = m.includes('stripe');
    const hasOffline = m.some((x) => ['manual', 'gpay', 'bank'].includes(x));
    // No Stripe on file → must use UPI / bank & proof (radios may be hidden).
    if (!hasStripe && hasOffline) {
      setPayChannel('manual');
      return;
    }
    if (m.length === 1 && ['manual', 'gpay', 'bank'].includes(m[0])) setPayChannel('manual');
    if (m.length === 1 && m[0] === 'stripe') setPayChannel('stripe');
  }, [homeData?.payment_methods]);

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

  const startDashboardPayment = async (programId) => {
    const ids = selectedFamilyByProgram[programId] || [];
    setPayingProgramId(programId);
    try {
      const r = await axios.post(
        `${API}/api/student/dashboard-pay`,
        {
          program_id: programId,
          family_member_ids: ids,
          currency,
          origin_url: typeof window !== 'undefined' ? window.location.origin : '',
        },
        { withCredentials: true }
      );
      const { enrollment_id, tier_index: tierIdx } = r.data;
      const prog = upcomingList.find((p) => p.id === programId);
      setProgramPaymentModal({
        enrollmentId: enrollment_id,
        programId,
        programTitle: prog?.title || '',
        tierIndex: tierIdx != null ? tierIdx : null,
        payChannel,
      });
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
              <span className="text-slate-700 font-medium">different</span> rules (Admin → Dashboard). Enroll from your saved lists below.
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
              const href = buildDashboardEnrollHref(p, { tierIdx, promoCode: promoForProgramClicks });
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
                      aria-label={`Enroll in ${p.title || 'program'}`}
                      onClick={() => navigate(href)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(href);
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
                          This program is included in your annual package for you. Select guests below (immediate family
                          or friends &amp; extended) to pay for their enrollment only.
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
                          Guests to enroll
                        </p>
                        {enrollableGuests.length === 0 ? (
                          <p className="text-[10px] text-slate-400">
                            Add people under Immediate family or Friends &amp; extended below, then save each list.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-36 overflow-y-auto pr-0.5">
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

                      {hasOfflinePaymentOption && (
                        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-700">
                          {paymentMethods.includes('stripe') ? (
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`pay-${p.id}`}
                                checked={payChannel === 'stripe'}
                                onChange={() => setPayChannel('stripe')}
                              />
                              Card (Stripe)
                            </label>
                          ) : (
                            <span className="text-slate-600">Payment: UPI / bank (per your membership)</span>
                          )}
                          {paymentMethods.includes('stripe') && (
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`pay-${p.id}`}
                                checked={payChannel === 'manual'}
                                onChange={() => setPayChannel('manual')}
                              />
                              {paymentMethods.includes('gpay') || paymentMethods.includes('bank')
                                ? 'UPI, bank & proof'
                                : 'Bank / manual'}
                            </label>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!canPay || payingProgramId === p.id}
                        title={
                          !canPay
                            ? includedPkg && selCount < 1
                              ? 'This program is included for you — select guests to pay for their seats, or wait for pricing to load.'
                              : !aq
                                ? 'Loading pricing…'
                                : (aq.total || 0) <= 0
                                  ? 'No amount due for this selection.'
                                  : ''
                            : undefined
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          startDashboardPayment(p.id);
                        }}
                        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#D4AF37] text-white text-[11px] font-semibold py-2 px-3 hover:bg-[#b8962e] disabled:opacity-50 disabled:pointer-events-none"
                        data-testid={`dashboard-pay-${p.id}`}
                      >
                        {payingProgramId === p.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CreditCard size={14} />
                        )}
                        {payChannel === 'manual' && hasOfflinePaymentOption
                          ? 'Proceed to payment (UPI / bank + proof)'
                          : 'Proceed to payment (Stripe)'}
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
                Add household members for family enrollments (max 12). Set <strong className="text-slate-700 font-medium">Online / Offline</strong>,{' '}
                <strong className="text-slate-700 font-medium">country</strong> (e.g. IN, AE), and optionally{' '}
                <strong className="text-slate-700 font-medium">Notify</strong> — when on, they get enrollment details by email after payment is confirmed (email required).
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
                Friends, cousins, relatives, uncles/aunts, grandparents, and similar (max 12). Same fields as immediate family — use{' '}
                <strong className="text-slate-700 font-medium">Notify</strong> to email them enrollment details after payment.
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
