import { parseExperienceMoment, stripBulletsFromText } from '../parseExperienceMoment';

describe('parseExperienceMoment', () => {
  it('uses title as quote and body as message', () => {
    const result = parseExperienceMoment({
      title: 'Healing is possible.',
      subtitle: 'How It Can Be Life-Changing',
      body: 'Clients feel lighter and more free.',
    });
    expect(result.quote).toBe('Healing is possible.');
    expect(result.heading).toBe('How It Can Be Life-Changing');
    expect(result.message).toContain('lighter');
  });

  it('strips bullet lists from experience copy', () => {
    const cleaned = stripBulletsFromText(
      'Every journey is unique.\n\n✦ Reduced pain\n✦ Better mobility',
    );
    expect(cleaned).toContain('Every journey is unique');
    expect(cleaned).not.toContain('Reduced pain');
  });
});
