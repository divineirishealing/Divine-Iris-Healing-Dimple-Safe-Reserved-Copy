/** Default one-line social proof lines — merged with Admin → settings `enrollment_urgency_quotes` when present. */

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
  if (typeof q === 'string') return { text: q.trim(), name: '' };
  const text = (q?.text || q?.quote || '').trim();
  if (!text) return null;
  return { text, name: (q?.name || q?.author || '').trim() };
}

/** API quotes first, then defaults (deduped by text). */
export function mergeSignupMotivationQuotes(apiQuotes) {
  const fromApi = (apiQuotes || []).map(normalizeQuoteEntry).filter(Boolean);
  const seen = new Set(fromApi.map((x) => x.text.toLowerCase()));
  const merged = [...fromApi];
  for (const d of DEFAULT_SIGNUP_MOTIVATION_QUOTES) {
    if (!seen.has(d.text.toLowerCase())) {
      merged.push({ ...d });
      seen.add(d.text.toLowerCase());
    }
  }
  return merged;
}
