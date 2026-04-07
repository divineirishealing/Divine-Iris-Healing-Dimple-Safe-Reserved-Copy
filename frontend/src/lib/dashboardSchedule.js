/** When API schedule_preview is empty (e.g. only past dates), still show rows from full programs[].schedule */
export function rowsFromPrograms(programs) {
  const rows = [];
  for (const p of programs || []) {
    if (typeof p === 'string' || !p?.name) continue;
    (p.schedule || []).forEach((s, si) => {
      const ds = String(s?.date || '').trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
      rows.push({
        program_name: p.name,
        date: ds,
        end_date: String(s?.end_date || '').trim().slice(0, 10),
        time: s?.time || '',
        mode_choice: (s?.mode_choice || '').toLowerCase(),
        session_index: si,
      });
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

/**
 * @param {object} [options]
 * @param {number} [options.maxFallbackRows] — when using programs fallback (no preview), max rows (default 12)
 */
export function buildDashboardScheduleRows(schedulePreview, programs, options = {}) {
  const cap = options.maxFallbackRows ?? 12;
  const prev = schedulePreview || [];
  if (prev.length > 0) return prev;
  return rowsFromPrograms(programs).slice(0, cap);
}

/** Rows that appear in schedule_preview but not on any program.schedule slot (e.g. 1:1). */
export function previewRowsNotInPrograms(schedulePreview, programs) {
  const prev = schedulePreview || [];
  if (prev.length === 0) return [];
  const keys = new Set();
  for (const p of programs || []) {
    if (typeof p === 'string' || !p?.name) continue;
    (p.schedule || []).forEach((s, si) => {
      const ds = String(s?.date || '').trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
      keys.add(`${p.name}|${ds}|${si}`);
    });
  }
  return prev.filter((r) => {
    const ds = String(r?.date || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return false;
    const k = `${r.program_name}|${ds}|${r.session_index ?? ''}`;
    return !keys.has(k);
  });
}
