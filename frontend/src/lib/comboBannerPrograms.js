/** Programs listed on combo banner — matches admin combo rule program_ids. */
export function programsForComboBanner(catalog, comboRules) {
  const pool = Array.isArray(catalog) ? catalog : [];
  const rules = Array.isArray(comboRules) ? comboRules : [];
  const allowed = new Set();
  rules.forEach((r) => {
    (r.program_ids || []).forEach((id) => {
      if (id != null && String(id).trim()) allowed.add(String(id));
    });
  });
  if (allowed.size === 0) return pool;
  return pool.filter((p) => allowed.has(String(p.id)));
}