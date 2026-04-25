/** Session snapshot written by Upcoming programs (dashboard) for seat picks + drafts. */

export const UPCOMING_SESSION_V = 1;
export const UPCOMING_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function upcomingSessionStorageKey(bookerEmail) {
  const s = String(bookerEmail || 'anon')
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/gi, '_');
  return `dih_dash_upcoming_v${UPCOMING_SESSION_V}_${s.slice(0, 120)}`;
}

/** @returns {{ selectedFamilyByProgram: object, seatDraftsByProgram: object, dashboardTierByProgram?: object, bookerSeatMode?: string, bookerSeatNotify?: boolean, guestSeatForm?: object } | null} */
export function readUpcomingDashboardSession(bookerEmail) {
  if (typeof sessionStorage === 'undefined') return null;
  const em = String(bookerEmail || '').trim();
  if (!em) return null;
  try {
    const raw = sessionStorage.getItem(upcomingSessionStorageKey(em));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== UPCOMING_SESSION_V) return null;
    if (Date.now() - (data.savedAt || 0) > UPCOMING_SESSION_MAX_AGE_MS) return null;
    return {
      selectedFamilyByProgram: data.selectedFamilyByProgram && typeof data.selectedFamilyByProgram === 'object'
        ? data.selectedFamilyByProgram
        : {},
      seatDraftsByProgram:
        data.seatDraftsByProgram && typeof data.seatDraftsByProgram === 'object' ? data.seatDraftsByProgram : {},
      dashboardTierByProgram:
        data.dashboardTierByProgram && typeof data.dashboardTierByProgram === 'object'
          ? data.dashboardTierByProgram
          : undefined,
      bookerSeatMode: data.bookerSeatMode,
      bookerSeatNotify: data.bookerSeatNotify,
      guestSeatForm: data.guestSeatForm && typeof data.guestSeatForm === 'object' ? data.guestSeatForm : undefined,
    };
  } catch {
    return null;
  }
}
