/**
 * Admin-configurable visibility for student dashboard overview tiles and sidebar links.
 * Keys omitted or not `false` are treated as visible (backward compatible).
 */
export const DASHBOARD_VISIBILITY_KEYS = {
  // Overview (Sacred Home)
  hero: 'Welcome hero (greeting & stats)',
  upcoming_family: 'Upcoming programs & add family (required for Pay on dashboard home)',
  schedule_card: 'Schedule / calendar card',
  loyalty_points: 'Divine Iris Points',
  profile_card: 'Profile summary card',
  journey_compass: 'Inner journey / compass',
  financials_card: 'Financials card',
  intentions_diary: 'Intentions / diary',
  transformations_card: 'Transformations teaser',
  footer_quote: 'Closing quote on overview',
  // Sidebar (hamburger menu)
  nav_soul_garden: 'Menu: Soul Garden',
  nav_sessions: 'Menu: Schedule & calendar',
  nav_progress: 'Menu: Progress',
  nav_bhaad: 'Menu: Bhaad Portal',
  nav_tribe: 'Menu: Soul Tribe',
  nav_financials: 'Menu: Financials',
  nav_points: 'Menu: Points',
  nav_profile: 'Menu: Profile',
  nav_roadmap: 'Menu: Growth Roadmap',
};

export const DEFAULT_DASHBOARD_VISIBILITY = Object.fromEntries(
  Object.keys(DASHBOARD_VISIBILITY_KEYS).map((k) => [k, true])
);

/** @param {Record<string, any>|undefined} settings - site settings from API */
export function mergeDashboardVisibility(settings) {
  const raw = settings?.dashboard_element_visibility;
  const out = { ...DEFAULT_DASHBOARD_VISIBILITY };
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(DEFAULT_DASHBOARD_VISIBILITY)) {
      if (Object.prototype.hasOwnProperty.call(raw, k) && raw[k] === false) {
        out[k] = false;
      }
    }
  }
  return out;
}
