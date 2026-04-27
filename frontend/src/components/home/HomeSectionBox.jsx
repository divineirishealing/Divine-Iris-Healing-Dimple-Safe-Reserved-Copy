import React from 'react';
import { cn } from '../../lib/utils';

const EYEBROW_LIGHT = {
  teal: 'text-teal-800',
  violet: 'text-violet-800',
  gold: 'text-[#8b6914]',
  slate: 'text-slate-600',
};

/**
 * Framed “card” wrapper for homepage sections (matches Sacred Home overview boxes).
 */
export default function HomeSectionBox({
  eyebrow,
  variant = 'teal',
  isDark = false,
  children,
  className,
  contentClassName,
  boxClassName,
  ...rest
}) {
  const eyebrowTone = isDark ? 'text-amber-100/90' : EYEBROW_LIGHT[variant] || EYEBROW_LIGHT.teal;

  return (
    <div className={cn('w-full', className)} {...rest}>
      <div
        className={cn(
          'rounded-[22px] overflow-hidden',
          isDark
            ? 'border border-white/25 shadow-[0_8px_40px_rgba(20,15,40,0.35)] bg-black/5'
            : 'border border-teal-200/70 bg-white/90 backdrop-blur-xl shadow-[0_4px_32px_rgba(20,120,140,0.07)]',
          boxClassName,
        )}
      >
        {eyebrow ? (
          <p
            className={cn(
              'text-center text-[10px] font-semibold tracking-wide px-4 pt-6 sm:pt-8 mb-1',
              eyebrowTone,
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <div className={cn(eyebrow ? 'pb-1' : 'pt-4 sm:pt-6', contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
