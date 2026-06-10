import React, { useMemo } from 'react';
import { bookableOpenDatesWithSlots } from '../lib/sessionCalendarSlots';

/**
 * Lists each bookable date with its open time slots (unified calendar + per-date overrides).
 */
export default function SessionOpenDatesSlots({
  calendar = {},
  sessionFallback = [],
  monthYmd = null,
  selectedDate = null,
  selectedTimeSlot = null,
  onSelectDate,
  onSelectTimeSlot,
  theme = 'dark',
}) {
  const rows = useMemo(
    () => bookableOpenDatesWithSlots(calendar, sessionFallback, { monthYmd }),
    [calendar, sessionFallback, monthYmd],
  );

  if (!rows.length) return null;

  const isDark = theme === 'dark';

  return (
    <div
      className={`mt-4 rounded-xl border p-3 space-y-2 max-h-48 overflow-y-auto ${
        isDark ? 'border-white/15 bg-black/20' : 'border-purple-100 bg-purple-50/50'
      }`}
      data-testid="open-dates-slots-list"
    >
      <p
        className={`text-[10px] font-medium uppercase tracking-wider ${
          isDark ? 'text-white/50' : 'text-purple-700/80'
        }`}
      >
        Open dates &amp; times
      </p>
      {rows.map((row) => {
        const dateActive = selectedDate === row.date;
        return (
          <div
            key={row.date}
            className={`rounded-lg px-2.5 py-2 ${
              dateActive
                ? isDark
                  ? 'bg-white/10 ring-1 ring-[#D4AF37]/50'
                  : 'bg-white ring-1 ring-purple-300'
                : isDark
                  ? 'hover:bg-white/5'
                  : 'hover:bg-white/80'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectDate?.(row.date)}
              className={`text-left w-full text-[11px] font-semibold mb-1.5 ${
                isDark ? 'text-white/90' : 'text-purple-900'
              }`}
            >
              {row.label}
            </button>
            {row.slots.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {row.slots.map((slot) => {
                  const active = dateActive && selectedTimeSlot === slot;
                  return (
                    <button
                      key={`${row.date}-${slot}`}
                      type="button"
                      onClick={() => {
                        onSelectDate?.(row.date);
                        onSelectTimeSlot?.(slot);
                      }}
                      className={`px-2.5 py-1 rounded-full text-[10px] border transition-all ${
                        active
                          ? isDark
                            ? 'bg-[#D4AF37] text-[#1a1a1a] border-[#D4AF37] font-semibold'
                            : 'bg-purple-600 text-white border-purple-600 font-semibold'
                          : isDark
                            ? 'bg-white/10 text-white/75 border-white/20 hover:bg-white/15'
                            : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
                      }`}
                      data-testid={`open-slot-${row.date}-${slot}`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className={`text-[10px] italic ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                Times not listed — pick the date and we will confirm
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
