/**
 * Totals for dated schedule slots (YYYY-MM-DD) across enrolled programs.
 * Matches calendar table rules: only slots with a valid date string; optional visibility filter.
 */
export function summarizeDatedProgramProgress(programs, options = {}) {
  const onlyVisible = options.onlyVisible !== false;
  let sessionsDated = 0;
  let sessionsAvailed = 0;
  let programsWithDated = 0;
  let programsAllAvailed = 0;

  for (const p of programs || []) {
    if (typeof p === 'string' || !p?.name) continue;
    if (onlyVisible && p.visible === false) continue;
    const sched = p.schedule || [];
    const datedSlots = sched.filter((s) => {
      const ds = String(s?.date || '').trim().slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(ds);
    });
    if (datedSlots.length === 0) continue;
    programsWithDated += 1;
    sessionsDated += datedSlots.length;
    const done = datedSlots.filter((s) => s.completed).length;
    sessionsAvailed += done;
    if (done === datedSlots.length) programsAllAvailed += 1;
  }

  return {
    sessionsDated,
    sessionsAvailed,
    sessionsYetToAvail: sessionsDated - sessionsAvailed,
    programsWithDated,
    programsAllAvailed,
    programsWithSessionsLeft: programsWithDated - programsAllAvailed,
  };
}

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
