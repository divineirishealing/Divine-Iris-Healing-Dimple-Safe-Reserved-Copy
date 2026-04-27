/**
 * Static copy from divine_iris_constellation.html (sacred dashboard reference).
 * Pair with live data in StudentDashboard / DashboardSacredNav.
 */

export const SANCTUARY_REFERENCE = {
  welcomeKicker: '✦ Iris Path · Your Sacred Sanctuary',
  welcomeLead: 'Welcome home,',
  welcomeAffirmation: 'The light in you grows with every breath',

  navTierZenith: '✦ Iris Zenith — The Illumination · Year 4',

  scheduleEyebrow: 'My Schedule',
  scheduleAnnouncement:
    'Module 5 — Soul Alignment opens April 1st. Prepare your space and set your intention. This is the session many of you have been waiting for. 🌕',
  scheduleEventNote:
    'Full Moon Release Ceremony — 8 PM IST. All AWRP students are invited to join live. Your presence matters.',

  profileGlyph: '✦',
  profileEye: 'I am',
  profileTierZenith: '✦ Iris Zenith — The Illumination · Year 4',
  rowProgram: 'Program',
  rowMemberSince: 'Member since',
  rowStatus: 'Status',
  rowSessionsDone: 'Sessions done',
  rowNextSession: 'Next session',
  rowNextRenewal: 'Next renewal',
  statusActive: 'Active ✓',
  nextSessionTonight: 'Tonight ✦',
  statSessions: 'Sessions',
  statDaysActive: 'Days Active',
  statReleases: 'Releases',
  profileCta: 'Open profile',

  compassGlyph: '◎',
  compassEye: 'Soul Compass',
  innerJourney: 'Inner Journey',
  journeyLabel: 'JOURNEY',
  compassSub: 'Your compass grows with each session and release',
  compassChips: ['Grounded 🌱', 'Expanding ✨', 'Open 🌸'],
  soulLabel: 'Soul',
  bodyLabel: 'Body',

  speaksEye: 'Divine Iris Speaks',
  speaksQuote:
    'Your willingness to show up, even when it feels impossible — that IS the healing. The light you have been searching for was never outside you.',
  speaksAttr: '— Divine Iris · 2 days ago',
  speaksTagAnnouncement: 'Latest announcement',
  speaksAnnouncementBody:
    'Module 5 — Soul Alignment opens April 1st. Prepare your space and set your intention. This is the session many of you have been waiting for. 🌕',
  speaksTagEvent: 'Event · Tonight',
  speaksEventBody:
    'Full Moon Release Ceremony — 8 PM IST. All AWRP students are invited to join live. Your presence matters.',
  speaksNewPill: '3 new messages from Divine Iris',

  intentionsGlyph: '🌱',
  intentionsEye: 'My Intentions',
  intentionsTitle: 'Daily · Weekly · Monthly',
  intentTabDaily: 'Daily',
  intentTabWeekly: 'Weekly',
  intentTabMonthly: 'Monthly',
  intentionsDailyQuote:
    'Today I release what does not serve me and welcome the flow of abundance into every cell of my being.',
  intentionsWeeklyQuote:
    'This week I heal my relationship with worthiness. I open to receiving love, abundance and recognition without guilt.',
  intentionsMonthlyQuote:
    'This month I embody the truth that I am already whole, already enough. I release the search and rest in being.',
  intentionsDailyFocus: 'Healing focus: Anxiety around abundance · Heart area',
  intentionsWeeklyFocus: 'Weekly focus: Root Wounds · Healing depth: Release layer',
  intentionsMonthlyFocus: 'Monthly theme: Soul Alignment · Module 5 journey opens April 1',
  intentionsProgDaily: '3 of 7 days complete this week',
  intentionsProgWeekly: 'Week 3 of 4 · Thursday April 10',
  intentionsProgMonthly: 'Week 2 of 4 · April 2026',

  financialsEye: 'Sacred Exchange',
  financialsDefaultProgram: 'Home Coming',

  diaryLastPrefix: 'Last entry:',
  diaryEmpty: 'Start capturing your inner transformation...',

  transformationsHint: 'Witness the transformations',

  footerQuote: 'You are not healing — you are remembering who you have always been.',
  footerAttribution: '— Divine Iris ✦',
};

/** Intentions tab payloads (matches reference HTML intentData). */
export const INTENTIONS_BY_TAB = {
  d: {
    quote: SANCTUARY_REFERENCE.intentionsDailyQuote,
    focus: SANCTUARY_REFERENCE.intentionsDailyFocus,
    barPct: 42,
    prog: SANCTUARY_REFERENCE.intentionsProgDaily,
  },
  w: {
    quote: SANCTUARY_REFERENCE.intentionsWeeklyQuote,
    focus: SANCTUARY_REFERENCE.intentionsWeeklyFocus,
    barPct: 60,
    prog: SANCTUARY_REFERENCE.intentionsProgWeekly,
  },
  m: {
    quote: SANCTUARY_REFERENCE.intentionsMonthlyQuote,
    focus: SANCTUARY_REFERENCE.intentionsMonthlyFocus,
    barPct: 42,
    prog: SANCTUARY_REFERENCE.intentionsProgMonthly,
  },
};
