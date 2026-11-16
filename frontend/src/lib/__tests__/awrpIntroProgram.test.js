import {
  AWRP_INTRO_PROGRAM_TITLE,
  findAwrpIntroProgram,
  isAwrpIntroProgram,
  showInWebsiteProgramsSection,
} from '../awrpIntroProgram';
import { programPublicPath } from '../programRoutes';

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
});