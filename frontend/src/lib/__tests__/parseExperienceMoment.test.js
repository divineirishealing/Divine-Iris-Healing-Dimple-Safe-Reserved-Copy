import {
  parseExperienceMoment,
  stripBulletsFromText,
  experienceMomentHasContent,
} from '../parseExperienceMoment';

describe('parseExperienceMoment', () => {
  it('uses only explicit admin fields', () => {
    const result = parseExperienceMoment({
      title: 'Healing is possible.',
      subtitle: 'How It Can Be Life-Changing',
      body: 'Clients feel lighter and more free.',
    });
    expect(result.quote).toBe('Healing is possible.');
    expect(result.heading).toBe('How It Can Be Life-Changing');
    expect(result.message).toContain('lighter');
  });

  it('does not invent placeholder copy', () => {
    expect(parseExperienceMoment({})).toEqual({ quote: '', heading: '', message: '' });
    expect(experienceMomentHasContent({}, '')).toBe(false);
  });

  it('strips bullet lists from experience copy', () => {
    const cleaned = stripBulletsFromText(
      'Every journey is unique.\n\n✦ Reduced pain\n✦ Better mobility',
    );
    expect(cleaned).toContain('Every journey is unique');
    expect(cleaned).not.toContain('Reduced pain');
  });
});
