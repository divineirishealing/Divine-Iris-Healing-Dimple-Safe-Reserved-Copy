/**
 * Date/time/duration presentation aligned with UpcomingProgramsSection (homepage upcoming cards).
 */

const TZ_OFFSETS = {
  GST: 4,
  'GST Dubai': 4,
  UAE: 4,
  Gulf: 4,
  IST: 5.5,
  India: 5.5,
  EST: -5,
  EDT: -4,
  CST: -6,
  CDT: -5,
  MST: -7,
  MDT: -6,
  PST: -8,
  PDT: -7,
  GMT: 0,
  UTC: 0,
  BST: 1,
  CET: 1,
  CEST: 2,
  AEST: 10,
  AEDT: 11,
  JST: 9,
  KST: 9,
  SGT: 8,
  HKT: 8,
  'CST Asia': 8,
  NZST: 12,
  NZDT: 13,
};

const COUNTRY_TZ = {
  IN: { offset: 5.5, abbr: 'IST' },
  AE: { offset: 4, abbr: 'GST' },
  US: { offset: -5, abbr: 'EST' },
  GB: { offset: 0, abbr: 'GMT' },
  CA: { offset: -5, abbr: 'EST' },
  AU: { offset: 10, abbr: 'AEST' },
  SG: { offset: 8, abbr: 'SGT' },
  DE: { offset: 1, abbr: 'CET' },
  SA: { offset: 3, abbr: 'AST' },
  QA: { offset: 3, abbr: 'AST' },
  PK: { offset: 5, abbr: 'PKT' },
  BD: { offset: 6, abbr: 'BST' },
  MY: { offset: 8, abbr: 'MYT' },
  JP: { offset: 9, abbr: 'JST' },
  FR: { offset: 1, abbr: 'CET' },
  LK: { offset: 5.5, abbr: 'IST' },
  ZA: { offset: 2, abbr: 'SAST' },
  NP: { offset: 5.75, abbr: 'NPT' },
  KW: { offset: 3, abbr: 'AST' },
  OM: { offset: 4, abbr: 'GST' },
  BH: { offset: 3, abbr: 'AST' },
  PH: { offset: 8, abbr: 'PHT' },
  ID: { offset: 7, abbr: 'WIB' },
  TH: { offset: 7, abbr: 'ICT' },
  KE: { offset: 3, abbr: 'EAT' },
  NG: { offset: 1, abbr: 'WAT' },
  EG: { offset: 2, abbr: 'EET' },
  TR: { offset: 3, abbr: 'TRT' },
  IT: { offset: 1, abbr: 'CET' },
  ES: { offset: 1, abbr: 'CET' },
  NL: { offset: 1, abbr: 'CET' },
  NZ: { offset: 12, abbr: 'NZST' },
};

function parseTimeStr(str) {
  if (!str) return null;
  let s = str.trim().toUpperCase();
  const match = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2] || '0', 10);
  const ampm = match[3];
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return { hours: h, minutes: m };
}

export function convertTimingToLocal(timing, timeZone, detectedCountry) {
  if (!timing || !timeZone) return { local: '', localTz: '', srcTz: timeZone || '' };

  const tzKey = Object.keys(TZ_OFFSETS).find((k) => timeZone.toUpperCase().includes(k.toUpperCase()));
  if (!tzKey && tzKey !== 0) return { local: '', localTz: '', srcTz: timeZone || '' };
  const srcOffset = TZ_OFFSETS[tzKey];

  const parts = timing.split(/\s*[-–—to]+\s*/i);
  const formatTime = (h, m) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return m > 0 ? `${displayH}:${String(m).padStart(2, '0')} ${period}` : `${displayH} ${period}`;
  };

  const convertToOffset = (parsed, fromOffset, toOffset) => {
    if (!parsed) return null;
    let totalMin = parsed.hours * 60 + parsed.minutes - fromOffset * 60 + toOffset * 60;
    totalMin = ((totalMin % 1440) + 1440) % 1440;
    return { hours: Math.floor(totalMin / 60), minutes: totalMin % 60 };
  };

  let localOffset;
  let localTzAbbr;
  const countryTz = detectedCountry ? COUNTRY_TZ[detectedCountry] : null;
  if (countryTz) {
    localOffset = countryTz.offset;
    localTzAbbr = countryTz.abbr;
  } else {
    localOffset = -new Date().getTimezoneOffset() / 60;
    localTzAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
  }

  const isSameTz = Math.abs(localOffset - srcOffset) < 0.1;

  const localTimes = parts.map((p) => convertToOffset(parseTimeStr(p.trim()), srcOffset, localOffset));
  const localStr = localTimes.filter(Boolean).map((t) => formatTime(t.hours, t.minutes)).join(' - ');

  return {
    local: isSameTz ? '' : localStr,
    localTz: isSameTz ? '' : localTzAbbr || '',
    srcTz: timeZone || '',
  };
}

export function parseProgramDate(d) {
  if (!d) return null;
  const cleaned = String(d)
    .replace(/(\d+)(st|nd|rd|th)/gi, '$1')
    .replace(',', '');
  const dt = new Date(cleaned);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function formatUpcomingCardDate(d) {
  const dt = parseProgramDate(d);
  if (!dt) return d || '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Gold duration pill on card image — same rules as UpcomingProgramsSection. */
export function durationPillDisplay(isAnnualTier, durationStr) {
  if (!durationStr) return '';
  if (isAnnualTier) return 'Annual';
  const L = String(durationStr).toLowerCase();
  if (L.includes('annual') || /\b12\s*months?\b/.test(L) || /\b1\s*year\b/.test(L)) return 'Annual';
  return durationStr;
}

function isAnnualTierRow(t) {
  return (
    !!t &&
    (String(t.label || '')
      .toLowerCase()
      .includes('annual') ||
      String(t.label || '')
        .toLowerCase()
        .includes('year') ||
      t.duration_unit === 'year')
  );
}

/**
 * Badge rows matching homepage upcoming card (image overlay pills): starts, ends, time, duration.
 * @param {object} program
 * @param {number|null} tierIndex — flagship tier index, or null
 * @param {string} [detectedCountry] — ISO country for local time conversion
 * @returns {{ type: 'calendar' | 'clock' | 'duration', text: string }[]}
 */
export function buildHomepageStyleDatetimeBadges(program, tierIndex, detectedCountry) {
  if (!program) return [];
  const tiers = program.duration_tiers || [];
  const hasTiers = program.is_flagship && tiers.length > 0;
  const activeTier = hasTiers && tierIndex != null && tiers[tierIndex] != null ? tiers[tierIndex] : null;

  const displayStartDate = activeTier?.start_date || program.start_date;
  const displayEndDate = activeTier?.end_date || program.end_date;

  const autoDuration = (() => {
    if (activeTier?.duration) return activeTier.duration;
    const s = parseProgramDate(displayStartDate);
    const e = parseProgramDate(displayEndDate);
    if (s && e) {
      const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 0) return `${diffDays} Days`;
    }
    return program.duration || '';
  })();

  const tierForDuration = activeTier;
  const durationOnImage = durationPillDisplay(tierForDuration ? isAnnualTierRow(tierForDuration) : false, autoDuration);

  const timingConverted = convertTimingToLocal(program.timing, program.time_zone, detectedCountry);

  const rows = [];
  if (displayStartDate && program.show_start_date_on_card !== false) {
    rows.push({ type: 'calendar', text: `Starts: ${formatUpcomingCardDate(displayStartDate)}` });
  }
  if (displayEndDate && program.show_end_date_on_card !== false) {
    rows.push({ type: 'calendar', text: `Ends: ${formatUpcomingCardDate(displayEndDate)}` });
  }
  if (program.timing && program.show_timing_on_card !== false) {
    const timeLine = timingConverted.local
      ? `${timingConverted.local} ${timingConverted.localTz}`
      : `${program.timing} ${timingConverted.srcTz}`;
    rows.push({ type: 'clock', text: timeLine });
  }
  if (durationOnImage && program.show_duration_on_card !== false) {
    rows.push({ type: 'duration', text: durationOnImage });
  }
  return rows;
}
