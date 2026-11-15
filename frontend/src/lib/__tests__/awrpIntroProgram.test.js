import {
  AWRP_INTRO_PROGRAM_TITLE,
  findAwrpIntroProgram,
  isAwrpIntroProgram,
} from '../awrpIntroProgram';

describe('awrpIntroProgram', () => {
  const intro = { id: 'intro-1', title: AWRP_INTRO_PROGRAM_TITLE };
  const workshop = { id: 'w-1', title: 'Atomic Weight Release Program (AWRP)' };

  it('matches exact intro title', () => {
    expect(isAwrpIntroProgram(intro)).toBe(true);
    expect(isAwrpIntroProgram(workshop)).toBe(false);
  });

  it('finds intro and not workshop', () => {
    expect(findAwrpIntroProgram([workshop, intro])?.id).toBe('intro-1');
  });

  it('does not treat the main AWRP workshop as the intro call', () => {
    expect(isAwrpIntroProgram(workshop)).toBe(false);
  });
});