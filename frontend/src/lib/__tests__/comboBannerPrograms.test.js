import { programsForComboBanner } from '../comboBannerPrograms';

describe('programsForComboBanner', () => {
  const catalog = [
    { id: 'a', title: 'Heal The Heart' },
    { id: 'b', title: 'Cord Cutting' },
    { id: 'c', title: 'AWRP Intro Call' },
  ];

  it('limits banner to rule program_ids', () => {
    const rules = [{ min_programs: 2, discount_pct: 20, program_ids: ['a', 'b'] }];
    expect(programsForComboBanner(catalog, rules).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('shows all open programs when no program_ids on rules', () => {
    expect(programsForComboBanner(catalog, [{ min_programs: 2, discount_pct: 10 }]).length).toBe(3);
  });
});