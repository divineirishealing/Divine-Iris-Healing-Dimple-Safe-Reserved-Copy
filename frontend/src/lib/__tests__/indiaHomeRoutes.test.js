import {
  homePathForLocation,
  isIndiaSite,
  programLinkForHome,
  toIndiaSitePath,
} from '../indiaHomeRoutes';

describe('indiaHomeRoutes', () => {
  it('detects India site paths', () => {
    expect(isIndiaSite('/india')).toBe(true);
    expect(isIndiaSite('/india/about')).toBe(true);
    expect(isIndiaSite('/india-payment/x')).toBe(false);
    expect(isIndiaSite('/')).toBe(false);
  });

  it('mirrors internal paths under /india', () => {
    expect(toIndiaSitePath('/programs', '/india')).toBe('/india/programs');
    expect(toIndiaSitePath('/cart', '/india/sessions')).toBe('/india/cart');
    expect(toIndiaSitePath('/#upcoming', '/india')).toBe('/india#upcoming');
    expect(toIndiaSitePath('/india/awrp-intro-call', '/india')).toBe('/india/awrp-intro-call');
    expect(toIndiaSitePath('/enroll/program/x', '/india')).toBe('/enroll/program/x');
    expect(toIndiaSitePath('/programs', '/')).toBe('/programs');
  });

  it('program links on India site', () => {
    const program = { id: 'p1', title: 'Workshop' };
    expect(programLinkForHome('/india', program)).toBe('/india/program/p1');
    expect(programLinkForHome('/india/about', program)).toBe('/india/program/p1');
    expect(programLinkForHome('/', program)).toBe('/program/p1');
  });

  it('home path follows surface', () => {
    expect(homePathForLocation('/india')).toBe('/india');
    expect(homePathForLocation('/india/cart')).toBe('/india');
    expect(homePathForLocation('/')).toBe('/');
  });
});