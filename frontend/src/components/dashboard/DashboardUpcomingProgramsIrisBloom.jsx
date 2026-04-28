import React from 'react';

const IRIS_PETALS = 8;

/**
 * Decorative animated iris for “Upcoming programs” and Home Coming headings (furl / unfurl bloom).
 */
export default function DashboardUpcomingProgramsIrisBloom() {
  return (
    <div
      className="relative mx-auto h-12 w-12 shrink-0 md:h-[3.25rem] md:w-[3.25rem]"
      aria-hidden
    >
      <div className="absolute inset-0 flex animate-iris-flower-sway items-center justify-center">
        {Array.from({ length: IRIS_PETALS }).map((_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 -ml-[5px] -mt-6 h-6 w-[10px] md:-ml-[6px] md:-mt-8 md:h-8 md:w-3"
            style={{
              transform: `rotate(${(360 / IRIS_PETALS) * i}deg)`,
              transformOrigin: '50% 100%',
            }}
          >
            <div
              className="h-full w-full origin-bottom rounded-full bg-gradient-to-t from-[#5b21b6] via-[#8b5cf6] to-[#e9d5ff] shadow-[0_0_8px_rgba(139,92,246,0.4)] animate-iris-petal-furl"
              style={{ animationDelay: `${i * 0.14}s` }}
            />
          </div>
        ))}
        <div className="absolute left-1/2 top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#fde68a] via-[#f59e0b] to-[#b45309] shadow-[0_1px_4px_rgba(217,119,6,0.4)] ring-1 ring-white/90 animate-pulse md:h-3 md:w-3" />
      </div>
    </div>
  );
}
