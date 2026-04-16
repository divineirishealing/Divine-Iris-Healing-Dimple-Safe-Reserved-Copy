/** Default one-line social proof lines — merged with Admin → settings `enrollment_urgency_quotes` when present. */

/** @param {unknown} id */
function pidStr(id) {
  if (id == null || id === '') return '';
  return String(id).trim();
}

export const DEFAULT_SIGNUP_MOTIVATION_QUOTES = [
  { text: 'This journey changed how I show up for myself — I wish I had joined sooner.', name: 'Soul Tribe member' },
  { text: 'I finally felt held in a space where I could truly heal and grow.', name: 'Participant' },
  { text: 'The shifts were gentle but profound — one of the best decisions I made.', name: 'Graduate' },
  { text: 'The guidance and community exceeded what I imagined. So worth it.', name: 'Alumni' },
  { text: 'I came for healing and stayed for the transformation.', name: 'Member' },
  { text: 'Every session left me lighter and more aligned with who I am.', name: 'Participant' },
  { text: 'If you are on the fence — take the step. Your future self will thank you.', name: 'Soul Tribe member' },
];

export function normalizeQuoteEntry(q) {
  if (typeof q === 'string') return { text: q.trim(), name: '', program_id: '' };
  const text = (q?.text || q?.quote || '').trim();
  if (!text) return null;
  return {
    text,
    name: (q?.name || q?.author || '').trim(),
    program_id: pidStr(q?.program_id),
  };
}

/**
 * API quotes first, then defaults (deduped by text).
 * @param {unknown[]} apiQuotes
 * @param {null|{ programId?: string, programIds?: string[], globalOnly?: boolean }} [options]
 *        - programId: enrollment for one program — include quotes with no program_id (global) + matching program_id
 *        - programIds: cart — global + any quote tied to one of these programs
 *        - globalOnly: session enrollment or session-only cart — only quotes with no program_id
 *        - omit options: no filtering (backward compat)
 */
export function mergeSignupMotivationQuotes(apiQuotes, options = null) {
  const fromApi = (apiQuotes || []).map(normalizeQuoteEntry).filter(Boolean);
  let filtered = fromApi;

  if (options?.globalOnly) {
    filtered = fromApi.filter((q) => !pidStr(q.program_id));
  } else if (options?.programIds?.length) {
    const ids = [...new Set(options.programIds.map((x) => pidStr(x)).filter(Boolean))];
    filtered = fromApi.filter((q) => {
      const p = pidStr(q.program_id);
      if (!p) return true;
      return ids.includes(p);
    });
  } else if (options?.programId != null && pidStr(options.programId)) {
    const id = pidStr(options.programId);
    filtered = fromApi.filter((q) => {
      const p = pidStr(q.program_id);
      if (!p) return true;
      return p === id;
    });
  }

  const seen = new Set(filtered.map((x) => x.text.toLowerCase()));
  const merged = [...filtered];
  for (const d of DEFAULT_SIGNUP_MOTIVATION_QUOTES) {
    if (!seen.has(d.text.toLowerCase())) {
      merged.push({ ...d });
      seen.add(d.text.toLowerCase());
    }
  }
  return merged;
}
