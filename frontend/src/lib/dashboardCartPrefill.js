/** Map dashboard family + enrollment-prefill "self" into CartContext participant rows. */

import { normalizeCartProgramTier } from '../context/CartContext';

/** Set to `Date.now()` when leaving Divine Cart so Sacred Home can merge cart → seat drafts (cart is in localStorage). */
export const RECONCILE_CART_FROM_CHECKOUT_KEY = 'dih_dash_reconcile_cart';

const COUNTRIES_WITH_PHONE = [
  { code: 'IN', name: 'India', phone: '+91' },
  { code: 'AE', name: 'UAE', phone: '+971' },
  { code: 'US', name: 'United States', phone: '+1' },
  { code: 'GB', name: 'United Kingdom', phone: '+44' },
  { code: 'CA', name: 'Canada', phone: '+1' },
  { code: 'AU', name: 'Australia', phone: '+61' },
  { code: 'SG', name: 'Singapore', phone: '+65' },
  { code: 'DE', name: 'Germany', phone: '+49' },
  { code: 'FR', name: 'France', phone: '+33' },
  { code: 'SA', name: 'Saudi Arabia', phone: '+966' },
  { code: 'QA', name: 'Qatar', phone: '+974' },
  { code: 'PK', name: 'Pakistan', phone: '+92' },
  { code: 'BD', name: 'Bangladesh', phone: '+880' },
  { code: 'LK', name: 'Sri Lanka', phone: '+94' },
  { code: 'MY', name: 'Malaysia', phone: '+60' },
  { code: 'JP', name: 'Japan', phone: '+81' },
  { code: 'ZA', name: 'South Africa', phone: '+27' },
  { code: 'NP', name: 'Nepal', phone: '+977' },
  { code: 'KW', name: 'Kuwait', phone: '+965' },
  { code: 'OM', name: 'Oman', phone: '+968' },
  { code: 'BH', name: 'Bahrain', phone: '+973' },
  { code: 'PH', name: 'Philippines', phone: '+63' },
  { code: 'ID', name: 'Indonesia', phone: '+62' },
  { code: 'TH', name: 'Thailand', phone: '+66' },
  { code: 'KE', name: 'Kenya', phone: '+254' },
  { code: 'NG', name: 'Nigeria', phone: '+234' },
  { code: 'EG', name: 'Egypt', phone: '+20' },
  { code: 'TR', name: 'Turkey', phone: '+90' },
  { code: 'IT', name: 'Italy', phone: '+39' },
  { code: 'ES', name: 'Spain', phone: '+34' },
  { code: 'NL', name: 'Netherlands', phone: '+31' },
  { code: 'NZ', name: 'New Zealand', phone: '+64' },
].sort((a, b) => a.name.localeCompare(b.name));

export function splitPhoneForCart(fullPhone, countries = COUNTRIES_WITH_PHONE) {
  const raw = String(fullPhone || '').replace(/[\s-]/g, '');
  if (!raw) return { phone_code: '', phone: '', whatsapp: '', wa_code: '' };
  const sorted = [...countries].sort((a, b) => (b.phone || '').length - (a.phone || '').length);
  for (const c of sorted) {
    const p = c.phone || '';
    if (p && raw.startsWith(p)) {
      const rest = raw.slice(p.length);
      return { phone_code: p, phone: rest, whatsapp: rest, wa_code: p };
    }
  }
  return { phone_code: '', phone: raw, whatsapp: raw, wa_code: '' };
}

function ageFromDobIso(dob) {
  const ds = String(dob || '').trim().slice(0, 10);
  if (!ds) return '';
  const d = new Date(ds);
  if (Number.isNaN(d.getTime())) return '';
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? String(age) : '';
}

function resolveCountryCode(raw, detectedCountry) {
  const normalized = String(raw || '').trim();
  const u = normalized.toUpperCase();
  if (u.length === 2 && /^[A-Z]{2}$/.test(u)) {
    if (COUNTRIES_WITH_PHONE.some((x) => x.code === u)) return u;
    return u;
  }
  if (u.length >= 2) {
    const prefix2 = u.slice(0, 2);
    if (COUNTRIES_WITH_PHONE.some((x) => x.code === prefix2)) return prefix2;
  }
  const low = normalized.toLowerCase();
  if (low.includes('india')) return 'IN';
  if (low.includes('emirates') || /\buae\b/i.test(normalized) || low.includes('dubai')) return 'AE';
  const d = String(detectedCountry || '').trim().toUpperCase();
  if (d.length === 2 && /^[A-Z]{2}$/.test(d)) return d;
  return 'AE';
}

/** Country for validation / API when a cart row is missing ISO2 (common for booker if profile only has city). */
export function effectiveParticipantCountry(p, bookerCountry, detectedCountry) {
  const c = String(p?.country || '').trim();
  if (c) return c;
  if (String(p?.relationship || '').trim() === 'Myself') {
    const b = String(bookerCountry || '').trim();
    if (b) return b;
  }
  const d = String(detectedCountry || '').trim();
  if (d) return d;
  return 'AE';
}

/** Fill empty fields on `base` from `fill` (for merging immediate family + Annual Family Club rows). */
function mergeGuestRowsPreferBase(base, fill) {
  if (!base) return fill ? { ...fill } : undefined;
  if (!fill) return { ...base };
  const out = { ...base };
  for (const k of Object.keys(fill)) {
    const bv = base[k];
    const fv = fill[k];
    const empty = (v) => v == null || (typeof v === 'string' && !String(v).trim());
    if (empty(bv) && !empty(fv)) out[k] = fv;
  }
  return out;
}

/** Merge rows that share the same primary candidate id so Sacred Home + peer payloads combine (names often live only on peer rows). */
function mergeGuestRowsByPrimaryId(orderedRows) {
  const byPrimary = new Map();
  for (const g of orderedRows) {
    const keys = candidateIdsForGuestRow(g);
    if (!keys.length) continue;
    const primary = keys[0];
    const prev = byPrimary.get(primary);
    if (!prev) {
      byPrimary.set(primary, { ...g });
      continue;
    }
    let merged = mergeGuestRowsPreferBase({ ...prev }, g);
    merged.household_client_link = !!(prev.household_client_link || g.household_client_link);
    merged.annual_member_dashboard = !!(prev.annual_member_dashboard || g.annual_member_dashboard);
    merged.annual_portal_access = !!(prev.annual_portal_access || g.annual_portal_access);
    byPrimary.set(primary, merged);
  }
  return byPrimary;
}

function guestDisplayNameFromRow(g) {
  if (!g) return '';
  const parts = [g.name, g.full_name, g.display_name, g.client_name].map((x) => String(x || '').trim());
  const n = parts.find(Boolean) || '';
  const e = String(g.email || '').trim();
  return n || e || '';
}

/** All id-like keys we store on dashboard / CRM guest rows (same person may appear under different ids). */
function candidateIdsForGuestRow(g) {
  if (!g || typeof g !== 'object') return [];
  const keys = [
    g.id,
    g._id,
    g.client_family_id,
    g.client_id,
    g.linked_client_id,
    g.household_client_id,
    g.dashboard_family_member_id,
  ];
  const out = [];
  for (const x of keys) {
    if (x == null) continue;
    const t = String(x).trim();
    if (t) out.push(t);
  }
  return out;
}

/** Match dashboard family row to cart prefill (ids vary by API shape). */
export function findEnrollableGuestById(enrollableGuests, id) {
  const s = String(id ?? '').trim();
  if (!s) return undefined;
  const matches = (enrollableGuests || []).filter((g) => g && candidateIdsForGuestRow(g).includes(s));
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  return matches.reduce((acc, row) => mergeGuestRowsPreferBase(acc, row));
}

function baseParticipant(program, overrides) {
  const defaultMode = program.session_mode === 'remote' ? 'offline' : 'online';
  return {
    name: '',
    relationship: '',
    age: '',
    gender: '',
    country: '',
    city: '',
    state: '',
    attendance_mode: defaultMode,
    notify: program.session_mode !== 'remote',
    email: '',
    phone: '',
    whatsapp: '',
    phone_code: '',
    wa_code: '',
    is_first_time: false,
    referral_source: '',
    referred_by_email: '',
    referred_by_name: '',
    has_referral: false,
    ...overrides,
  };
}

/** Email for a roster row: for Myself, prefer signed-in / profile booker email; else row email. */
export function effectiveParticipantEmail(participant, bookerEmail) {
  const rel = String(participant?.relationship ?? '').trim();
  const pe = String(participant?.email ?? '').trim();
  const be = String(bookerEmail ?? '').trim();
  if (rel === 'Myself' && be) return be;
  return pe;
}

/**
 * Single-row cart from portal profile (non-annual or fallback).
 * @param {object|null} self — /student/enrollment-prefill → self
 */
export function buildSelfOnlyCartParticipants(self, program, bookerEmail, detectedCountry, attendanceModeOverride) {
  const name = String(self?.name || '').trim();
  const selfMail = String(self?.email ?? '').trim();
  const bookerMail = String(bookerEmail ?? '').trim();
  const email = selfMail || bookerMail;
  if (!name && !email) return null;

  const split = splitPhoneForCart(self?.phone || '', COUNTRIES_WITH_PHONE);
  const country = resolveCountryCode(self?.country, detectedCountry);
  const age = String(self?.age || '').trim() || ageFromDobIso(self?.date_of_birth);
  const city = String(self?.city || '').trim();
  const attendance_mode = attendanceModeOverride === 'offline' ? 'offline'
    : attendanceModeOverride === 'online' ? 'online'
    : program.session_mode === 'remote' ? 'offline' : 'online';
  const notify = attendance_mode === 'online';

  return [
    baseParticipant(program, {
      name: name || email || 'Account holder',
      relationship: 'Myself',
      age: age || '',
      gender: String(self?.gender || '').trim() || 'Prefer not to say',
      country,
      city,
      state: city ? String(self?.state || '').trim() || 'N/A' : 'N/A',
      attendance_mode,
      notify,
      email,
      phone: split.phone,
      phone_code: split.phone_code,
      whatsapp: split.whatsapp,
      wa_code: split.wa_code,
      is_first_time: false,
    }),
  ];
}

/** Merge per-program seat draft (e.g. bookerJoinsProgram) with dashboard-wide attendance / notify / guest form. */
export function mergeGlobalSeatDraft(perProgramDraft, bookerSeatMode, bookerSeatNotify, guestSeatForm) {
  const p = perProgramDraft && typeof perProgramDraft === 'object' ? perProgramDraft : {};
  const hasPerBooker = p.bookerSeatMode !== undefined && p.bookerSeatMode !== null;
  const bm = hasPerBooker
    ? p.bookerSeatMode
    : bookerSeatMode !== undefined && bookerSeatMode !== null
      ? bookerSeatMode
      : p.bookerSeatMode;
  const hasPerNotify = p.bookerSeatNotify !== undefined && p.bookerSeatNotify !== null;
  const bn = hasPerNotify
    ? p.bookerSeatNotify
    : bookerSeatNotify !== undefined && bookerSeatNotify !== null
      ? bookerSeatNotify
      : p.bookerSeatNotify;
  const snapG = guestSeatForm && typeof guestSeatForm === 'object' ? guestSeatForm : {};
  const perG = p.guestSeatForm && typeof p.guestSeatForm === 'object' ? p.guestSeatForm : {};
  const gf = { ...snapG, ...perG };
  return {
    ...p,
    bookerSeatMode: bm === 'offline' ? 'offline' : 'online',
    bookerSeatNotify: bn !== false,
    guestSeatForm: gf,
  };
}

/**
 * Merge Sacred Home guest lists for cart participant rows (names + ids).
 * Same-key annual peers live in `annual_household_peers`, not always in `immediate_family`.
 * Peers are enrollable only when `annual_household_club_ok` (matches backend quote / enrollment-prefill).
 */
export function mergeEnrollableGuestsForPortalCart(home) {
  const im = home?.immediate_family || [];
  const ot = home?.other_guests || [];
  /** Always merge peers for name/id lookup on checkout — Sacred Home may list them even when club_ok is false. */
  const peers = home?.annual_household_peers || [];
  const mergedMap = mergeGuestRowsByPrimaryId([...im, ...ot, ...peers]);
  const out = Array.from(mergedMap.values());
  for (const g of [...im, ...ot]) {
    if (candidateIdsForGuestRow(g).length) continue;
    out.push(g);
  }
  return out;
}

/** Members used to resolve household_client_link for bucket map (immediate + same-key peers only). */
export function guestBucketLookupMembersFromHome(home) {
  const im = home?.immediate_family || [];
  const peers = home?.annual_household_peers || [];
  const mergedMap = mergeGuestRowsByPrimaryId([...im, ...peers]);
  return Array.from(mergedMap.values());
}

/** Map selected guest ids → annual_household | immediate | extended (aligned with /dashboard-quote). */
export function buildGuestBucketByIdFromSelection(selIds, immediateFamilyMembers) {
  const byId = new Map();
  for (const m of immediateFamilyMembers || []) {
    if (!m) continue;
    for (const k of candidateIdsForGuestRow(m)) {
      if (!byId.has(k)) byId.set(k, m);
    }
  }
  const out = {};
  for (const raw of selIds || []) {
    const id = String(raw ?? '').trim();
    if (!id) continue;
    const m = byId.get(id);
    const isAfcRow =
      m &&
      (m.household_client_link ||
        String(m.relationship || '').trim().toLowerCase() === 'household');
    if (isAfcRow) {
      out[id] = 'annual_household';
    } else if (m) {
      out[id] = 'immediate';
    } else {
      out[id] = 'extended';
    }
  }
  return out;
}

/**
 * Annual dashboard: booker row (if paying for self) + selected family/guest rows with seat draft prefs.
 */
export function buildAnnualDashboardCartParticipants({
  program,
  includedPkg,
  selectedMemberIds,
  seatDraft,
  enrollableGuests,
  self,
  bookerEmail,
  detectedCountry,
  immediateFamilyMembers,
  /** Program id/title on annual package list (site settings) — for peer “included in package” seats when payer is not annual. */
  programInAnnualPackageList = false,
}) {
  const participants = [];
  const guestForm = seatDraft?.guestSeatForm || {};
  const bookerMode = seatDraft?.bookerSeatMode === 'offline' ? 'offline' : 'online';
  const bookerNotify = seatDraft?.bookerSeatNotify !== false;
  const bookerJoins = includedPkg ? false : seatDraft?.bookerJoinsProgram !== false;

  const pushBookerRow = () => {
    const name = String(self?.name || '').trim();
    const selfMail = String(self?.email ?? '').trim();
    const bookerMail = String(bookerEmail ?? '').trim();
    const email = selfMail || bookerMail;
    if (!name && !email) return;
    const split = splitPhoneForCart(self?.phone || '', COUNTRIES_WITH_PHONE);
    const country = resolveCountryCode(self?.country, detectedCountry);
    const age = String(self?.age || '').trim() || ageFromDobIso(self?.date_of_birth);
    const city = String(self?.city || '').trim();
    const notify = bookerNotify || bookerMode === 'online';
    participants.push(
      baseParticipant(program, {
        name: name || email || 'Account holder',
        relationship: 'Myself',
        age: age || '',
        gender: String(self?.gender || '').trim() || 'Prefer not to say',
        country,
        city,
        state: city ? String(self?.state || '').trim() || 'N/A' : 'N/A',
        attendance_mode: bookerMode,
        notify,
        email,
        phone: split.phone,
        phone_code: split.phone_code,
        whatsapp: split.whatsapp,
        wa_code: split.wa_code,
        is_first_time: false,
      }),
    );
  };

  if (bookerJoins) {
    pushBookerRow();
  }

  const guestBucketById = buildGuestBucketByIdFromSelection(selectedMemberIds, immediateFamilyMembers);
  const guestLookupPool = [...(enrollableGuests || []), ...(immediateFamilyMembers || [])];

  const ids = (selectedMemberIds || []).map((x) => String(x));
  for (const id of ids) {
    const member = findEnrollableGuestById(guestLookupPool, id);
    const row = guestForm[id] || guestForm[String(id)] || {};
    const attendance_mode = row.attendance_mode === 'offline' ? 'offline' : 'online';
    const notifyEnrollment = !!row.notify_enrollment;
    const notify = notifyEnrollment || attendance_mode === 'online';
    const split = splitPhoneForCart((member && member.phone) || '', COUNTRIES_WITH_PHONE);
    const country = resolveCountryCode(member && member.country, detectedCountry);
    const age =
      (member && (String(member.age || '').trim() || ageFromDobIso(member.date_of_birth))) || '';
    const city = member ? String(member.city || '').trim() : '';
    const rawName = member ? guestDisplayNameFromRow(member) : '';
    const rawEmail = member ? String(member.email || '').trim() : '';
    const displayName = rawName || rawEmail || `Guest (${id.length > 10 ? `…${id.slice(-6)}` : id})`;
    const relationship = member
      ? String(member.relationship || 'Other').trim() || 'Other'
      : 'Other';
    const idStr = String(id);
    const portalGuestBucket = guestBucketById[idStr] || 'extended';
    const peerAnnualPortal =
      member?.annual_portal_access != null
        ? !!member.annual_portal_access
        : !!member?.annual_member_dashboard;
    const isAfcMember =
      !!member &&
      (!!member.household_client_link ||
        String(member.relationship || '').trim().toLowerCase() === 'household');
    const peerIncludedInAnnualPackage =
      !!programInAnnualPackageList && isAfcMember && peerAnnualPortal;
    participants.push(
      baseParticipant(program, {
        name: displayName,
        relationship,
        age: age || '',
        gender: 'Prefer not to say',
        country,
        city,
        state: city ? 'N/A' : 'N/A',
        attendance_mode,
        notify,
        email: rawEmail,
        phone: split.phone,
        phone_code: split.phone_code,
        whatsapp: split.whatsapp,
        wa_code: split.wa_code,
        is_first_time: false,
        portal_guest_bucket: portalGuestBucket,
        dashboard_family_member_id: idStr,
        peer_included_in_annual_package: peerIncludedInAnnualPackage,
      })
    );
  }

  return participants.length > 0 ? participants : null;
}

/** Blank row matching CartPage / CartContext shape (pad when roster shorter than existing slots). */
export function emptyCartParticipantSlot(programLike) {
  const mode = programLike.session_mode ?? programLike.sessionMode;
  const defaultMode = mode === 'remote' ? 'offline' : 'online';
  return {
    name: '',
    relationship: 'Myself',
    age: '',
    gender: '',
    country: '',
    city: '',
    state: '',
    attendance_mode: defaultMode,
    notify: mode !== 'remote',
    email: '',
    phone: '',
    whatsapp: '',
    phone_code: '',
    wa_code: '',
    is_first_time: true,
    referral_source: '',
    referred_by_email: '',
    referred_by_name: '',
    has_referral: false,
  };
}

/**
 * Logged-in cart recovery: self + every saved immediate/other guest from enrollment-prefill API.
 * Uses each member's saved attendance_mode / notify when present.
 */
export function buildFullPortalRosterCartParticipants(programLike, pre, bookerEmail, detectedCountry) {
  const prog = {
    ...programLike,
    session_mode: programLike.session_mode ?? programLike.sessionMode,
  };
  const selfRows = buildSelfOnlyCartParticipants(pre?.self, prog, bookerEmail, detectedCountry);
  const rows = selfRows ? [...selfRows] : [];
  const bookerEm = String(bookerEmail || pre?.self?.email || '').trim().toLowerCase();
  const fam = [...(pre?.immediate_family || []), ...(pre?.other_guests || [])];
  for (const m of fam) {
    if (!String(m.name || '').trim()) continue;
    const memEm = String(m.email || '').trim().toLowerCase();
    if (bookerEm && memEm && memEm === bookerEm) continue;
    const split = splitPhoneForCart(m.phone || '', COUNTRIES_WITH_PHONE);
    const country = resolveCountryCode(m.country, detectedCountry);
    const age = String(m.age || '').trim() || ageFromDobIso(m.date_of_birth);
    const city = String(m.city || '').trim();
    const attendance_mode = m.attendance_mode === 'offline' ? 'offline' : 'online';
    const notify = attendance_mode === 'online' || !!m.notify_enrollment;
    rows.push(
      baseParticipant(prog, {
        name: String(m.name || '').trim(),
        relationship: String(m.relationship || 'Other').trim() || 'Other',
        age: age || '',
        gender: 'Prefer not to say',
        country,
        city,
        state: city ? 'N/A' : 'N/A',
        attendance_mode,
        notify,
        email: String(m.email || '').trim(),
        phone: split.phone,
        phone_code: split.phone_code,
        whatsapp: split.whatsapp,
        wa_code: split.wa_code,
        is_first_time: false,
      })
    );
  }
  return rows.length > 0 ? rows : null;
}

/**
 * Merge Divine Cart portal lines (localStorage) into Sacred Home `seatDraftsByProgram`.
 * Cart rows carry canonical tierIndex + participant attendance after “Update Divine Cart”.
 */
function cartParticipantToDraftAttendance(p) {
  const am = p?.attendance_mode;
  if (am === 'offline' || am === 'in_person') return 'offline';
  return 'online';
}

export function reconcileSeatDraftsFromPortalCart(prevByPid, upcomingPrograms, cartItems) {
  const upcomingIds = new Set((upcomingPrograms || []).map((p) => String(p?.id)));
  const linesByPid = new Map();
  for (const item of cartItems || []) {
    if (item.type !== 'program') continue;
    const pid = String(item.programId);
    if (!upcomingIds.has(pid)) continue;
    if (!linesByPid.has(pid)) linesByPid.set(pid, []);
    linesByPid.get(pid).push(item);
  }
  if (linesByPid.size === 0) {
    return {
      drafts: prevByPid,
      globalBooker: null,
      updated: false,
      dashboardTierByProgramPatch: null,
    };
  }

  const next = { ...prevByPid };
  let sawBooker = false;
  let globalBookerMode = 'online';
  let globalBookerNotify = true;
  /** Card duration picker (`dashboardTierByProgram`) — from cart lines that include Myself (annual guest-only lines have no Myself). */
  const dashboardTierByProgramPatch = {};

  for (const [pid, lines] of linesByPid) {
    const cur =
      next[pid] && typeof next[pid] === 'object' ? { ...next[pid] } : { bookerJoinsProgram: true };
    const memberTierById = { ...(cur.memberTierById || {}) };
    const guestSeatForm = { ...(cur.guestSeatForm || {}) };
    let bookerSeatMode = cur.bookerSeatMode;
    let bookerSeatNotify = cur.bookerSeatNotify;
    const bookerJoinsProgram = lines.every((item) => item.portalLineMeta?.bookerJoins !== false);

    for (const item of lines) {
      const tier = normalizeCartProgramTier(item, item.tierIndex);
      for (const p of item.participants || []) {
        const rel = String(p.relationship || '').trim();
        if (rel === 'Myself') {
          sawBooker = true;
          dashboardTierByProgramPatch[pid] = tier;
          const bm = cartParticipantToDraftAttendance(p);
          globalBookerMode = bm;
          bookerSeatMode = bm;
          globalBookerNotify = p.notify !== false;
          bookerSeatNotify = globalBookerNotify;
        } else {
          const gid = String(p.dashboard_family_member_id || '').trim();
          if (!gid) continue;
          memberTierById[gid] = tier;
          guestSeatForm[gid] = {
            attendance_mode: cartParticipantToDraftAttendance(p),
            notify_enrollment: !!p.notify,
          };
        }
      }
    }

    next[pid] = {
      ...cur,
      bookerJoinsProgram,
      memberTierById: Object.keys(memberTierById).length ? memberTierById : undefined,
      guestSeatForm: Object.keys(guestSeatForm).length ? guestSeatForm : undefined,
      ...(bookerSeatMode !== undefined ? { bookerSeatMode } : {}),
      ...(bookerSeatNotify !== undefined ? { bookerSeatNotify } : {}),
    };
  }

  return {
    drafts: next,
    globalBooker: sawBooker ? { mode: globalBookerMode, notify: globalBookerNotify } : null,
    updated: true,
    dashboardTierByProgramPatch:
      Object.keys(dashboardTierByProgramPatch).length > 0 ? dashboardTierByProgramPatch : null,
  };
}
