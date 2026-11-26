import {
  parseVoiceProfile,
  serializeVoiceProfile,
  mergeVoiceProfile,
  getTimeOfDayGreeting,
  buildVoiceMemorySystemBlock,
} from './voiceProfile';

describe('voiceProfile', () => {
  it('parses valid JSON and falls back cleanly on invalid input', () => {
    expect(parseVoiceProfile(null)).toEqual({});
    expect(parseVoiceProfile('not-json')).toEqual({});
    expect(parseVoiceProfile('{"name":"Golu","preferred_language":"Hindi"}')).toEqual({
      name: 'Golu',
      preferred_language: 'Hindi',
    });
  });

  it('deep-merges preferences and deduplicates known_speakers into one record', () => {
    const initial = mergeVoiceProfile({}, { preferred_language: 'Hindi', name: 'Golu' });
    const updated = mergeVoiceProfile(initial, {
      location: 'Mumbai',
      dietary_preference: 'vegetarian',
      morning_brief: { enabled: true, topics: ['markets', 'weather'] },
      add_speaker: { name: 'Priya', relation: 'wife', gender_hint: 'female', avg_pitch_hz: 215 },
    });

    expect(updated.preferred_language).toBe('Hindi');
    expect(updated.name).toBe('Golu');
    expect(updated.location).toBe('Mumbai');
    expect(updated.dietary_preference).toBe('vegetarian');
    expect(updated.morning_brief).toEqual({ enabled: true, topics: ['markets', 'weather'] });
    expect(updated.known_speakers).toHaveLength(1);

    const updatedAgain = mergeVoiceProfile(updated, {
      add_speaker: { name: 'priya', avg_pitch_hz: 220 },
    });
    expect(updatedAgain.known_speakers).toHaveLength(1);
    expect(updatedAgain.known_speakers?.[0].avg_pitch_hz).toBe(220);
    expect(updatedAgain.known_speakers?.[0].relation).toBe('wife');
    expect(JSON.parse(serializeVoiceProfile(updatedAgain)).name).toBe('Golu');
  });

  it('returns correct time-of-day greetings', () => {
    expect(getTimeOfDayGreeting(8)).toBe('Good morning');
    expect(getTimeOfDayGreeting(14)).toBe('Good afternoon');
    expect(getTimeOfDayGreeting(20)).toBe('Good evening');
  });

  it('builds onboarding prompt when language is missing and returning prompt when profile exists', () => {
    const freshPrompt = buildVoiceMemorySystemBlock({}, 9);
    expect(freshPrompt).toContain('FIRST GREETING RULE');
    expect(freshPrompt).toContain('Good morning');
    expect(freshPrompt).toContain('save_voice_profile');

    const returningPrompt = buildVoiceMemorySystemBlock(
      { preferred_language: 'Hindi', name: 'Golu' },
      19,
    );
    expect(returningPrompt).toContain('Returning user: Greet Golu warmly in Hindi');
    expect(returningPrompt).toContain('Good evening');
  });
});
