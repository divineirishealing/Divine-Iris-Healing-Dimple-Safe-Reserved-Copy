import {
  AWRP_INTRO_PROGRAM_TITLE,
  findAwrpIntroProgram,
  isAwrpIntroProgram,
  showInWebsiteProgramsSection,
} from '../awrpIntroProgram';
import { programPublicPath } from '../programRoutes';
import { indiaProgramRazorpayPath, indiaProgramRazorpayCheckoutPath } from '../indiaProgramLanding';

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

  it('shows intro in programs section only when flagship is on', () => {
    expect(showInWebsiteProgramsSection({ ...intro, is_flagship: false })).toBe(false);
    expect(showInWebsiteProgramsSection({ ...intro, is_flagship: true })).toBe(true);
    expect(showInWebsiteProgramsSection(workshop)).toBe(false);
  });

  it('routes intro to awrp-intro-call landing', () => {
    expect(programPublicPath(intro)).toBe('/awrp-intro-call');
    expect(programPublicPath({ ...intro, link: '/custom' })).toBe('/custom');
  });

  it('ignores placeholder /program link and uses program id', () => {
    const workshop = { id: 'heal-heart-id', title: 'Heal The Heart', link: '/program' };
    expect(programPublicPath(workshop)).toBe('/program/heal-heart-id');
  });
});

describe('indiaProgramRazorpayPath', () => {
  it('uses generic india program path for workshops', () => {
    expect(indiaProgramRazorpayPath({ id: 'stress-id', title: 'Stress Detox' })).toBe(
      '/india/program/stress-id',
    );
  });

  it('routes intro to dedicated india landing', () => {
    expect(
      indiaProgramRazorpayPath({ id: 'intro-1', title: 'AWRP Intro Call', link: '/program/intro-1' }),
    ).toBe('/india/awrp-intro-call');
  });

  it('appends razorpay hash for generic india program checkout', () => {
    expect(
      indiaProgramRazorpayCheckoutPath({ id: 'stress-id', title: 'Stress Detox' }),
    ).toBe('/india/program/stress-id#india-razorpay-reserve');
    expect(
      indiaProgramRazorpayCheckoutPath({ id: 'intro-1', title: 'AWRP Intro Call' }),
    ).toBe('/india/awrp-intro-call');
  });
});