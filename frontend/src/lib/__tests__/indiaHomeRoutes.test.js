import { homePathForLocation, isIndiaMarketingHome, programLinkForHome } from '../indiaHomeRoutes';

describe('indiaHomeRoutes', () => {
  it('detects /india marketing home', () => {
    expect(isIndiaMarketingHome('/india')).toBe(true);
    expect(isIndiaMarketingHome('/')).toBe(false);
  });

  it('uses india program paths only on /india', () => {
    const program = { id: 'p1', title: 'Workshop' };
    expect(programLinkForHome('/india', program)).toBe('/india/program/p1');
    expect(programLinkForHome('/', program)).toBe('/program/p1');
  });

  it('home path follows surface', () => {
    expect(homePathForLocation('/india')).toBe('/india');
    expect(homePathForLocation('/')).toBe('/');
  });
});