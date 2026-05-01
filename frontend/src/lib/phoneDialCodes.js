/** E.164 prefixes — longest match first for parsing full international strings. */
export const PHONE_DIAL_PREFIXES_SORTED = [
  '+971',
  '+966',
  '+974',
  '+973',
  '+968',
  '+965',
  '+961',
  '+962',
  '+972',
  '+880',
  '+91',
  '+92',
  '+94',
  '+977',
  '+65',
  '+60',
  '+66',
  '+84',
  '+63',
  '+62',
  '+86',
  '+852',
  '+853',
  '+886',
  '+81',
  '+82',
  '+27',
  '+254',
  '+234',
  '+20',
  '+61',
  '+64',
  '+1',
  '+44',
  '+49',
  '+33',
  '+39',
  '+34',
  '+31',
  '+41',
  '+43',
  '+45',
  '+46',
  '+47',
  '+353',
  '+351',
  '+32',
  '+30',
  '+48',
  '+420',
  '+36',
  '+40',
  '+381',
];

export const PHONE_DIAL_OPTIONS = PHONE_DIAL_PREFIXES_SORTED.map((value) => ({
  value,
  label: value,
}));

/**
 * Split stored phone into dial code + national digits when possible.
 * @param {string} phoneFull - May be E.164, digits only, or legacy national.
 * @param {string} [savedCode] - Known dial code from user record.
 * @returns {{ code: string, national: string }}
 */
export function splitStoredPhone(phoneFull, savedCode) {
  const raw = String(phoneFull || '').trim();
  const sc = String(savedCode || '').trim();
  if (!raw && !sc) return { code: '+91', national: '' };
  if (raw.startsWith('+')) {
    for (const p of PHONE_DIAL_PREFIXES_SORTED) {
      if (raw.startsWith(p)) {
        const rest = raw.slice(p.length).replace(/\D/g, '');
        return { code: p, national: rest };
      }
    }
    const digits = raw.slice(1).replace(/\D/g, '');
    return { code: sc && sc.startsWith('+') ? sc : '+91', national: digits };
  }
  const national = raw.replace(/\D/g, '');
  if (sc && sc.startsWith('+')) return { code: sc, national };
  return { code: '+91', national };
}
