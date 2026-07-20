import {
  resolveProgramDurationDisplay,
  countWeekendDaysInRange,
} from '../programDurationDisplay';
import { durationPillDisplay } from '../upcomingHomepagePresentation';

describe('resolveProgramDurationDisplay', () => {
  const pastLifeKarma = {
    start_date: '2026-07-31',
    end_date: '2026-08-16',
    duration: '',
  };

  it('prefers session_days over calendar span (Jul 31–Aug 16 = 17 calendar days)', () => {
    expect(
      resolveProgramDurationDisplay({
        program: { ...pastLifeKarma, session_days: 7 },
      }),
    ).toBe('7 Days');
  });

  it('shows weekend tag when session_days + weekends_only', () => {
    expect(
      resolveProgramDurationDisplay({
        program: { ...pastLifeKarma, session_days: 7, weekends_only: true },
      }),
    ).toBe('7 Days · Weekends Only');
  });

  it('falls back to calendar span when session_days unset', () => {
    expect(resolveProgramDurationDisplay({ program: pastLifeKarma })).toBe('17 Days');
  });

  it('uses explicit duration when session_days unset', () => {
    expect(
      resolveProgramDurationDisplay({
        program: { ...pastLifeKarma, duration: '7 Days' },
      }),
    ).toBe('7 Days');
  });
});

describe('countWeekendDaysInRange', () => {
  it('counts Sat/Sun only between Jul 31 and Aug 16 2026', () => {
    expect(countWeekendDaysInRange('2026-07-31', '2026-08-16')).toBe(6);
  });
});

describe('durationPillDisplay', () => {
  it('compacts weekends-only copy for card badge', () => {
    expect(durationPillDisplay(false, '7 Days · Weekends Only')).toBe('7 Days (Wknds)');
  });
});
