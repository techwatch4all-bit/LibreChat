import {
  stripVoiceStopwords,
  extractSpokenCity,
  isPlaceOrDirectionsQuery,
  isWeatherQuery,
  isNewsQuery,
  detectMediaIntent,
} from './liveResolvers';

describe('liveResolvers', () => {
  test('stripVoiceStopwords removes spoken filler and preserves core search keywords', () => {
    expect(
      stripVoiceStopwords('Okay, are you able to provide top news in India for today?'),
    ).toBe('top news in India today');
    expect(stripVoiceStopwords('Can you please give me the weather in Mumbai?')).toBe(
      'weather in Mumbai',
    );
  });

  test('extractSpokenCity extracts cities from natural follow-up location statements', () => {
    expect(extractSpokenCity('You can consider my location as Mumbai.')).toBe('Mumbai');
    expect(extractSpokenCity("I'm in Pune right now")).toBe('Pune');
    expect(extractSpokenCity('What is the weather in New Delhi today?')).toBe('New Delhi');
    expect(extractSpokenCity("And what's the AQI of Mumbai?")).toBe('Mumbai');
    expect(extractSpokenCity("What's the AQI of Delhi?")).toBe('Delhi');
    expect(extractSpokenCity('Tell me a joke')).toBeNull();
  });

  test('isPlaceOrDirectionsQuery triggers only on places/directions, never on weather or news', () => {
    expect(isPlaceOrDirectionsQuery('Find the nearest doctor near me')).toBe(true);
    expect(isPlaceOrDirectionsQuery('Directions to Apollo Hospital')).toBe(true);
    expect(isPlaceOrDirectionsQuery('What is the temperature weather today?')).toBe(false);
    expect(isPlaceOrDirectionsQuery('Top news in India today')).toBe(false);
  });

  test('isWeatherQuery and isNewsQuery classify accurately', () => {
    expect(isWeatherQuery('temperature in Mumbai')).toBe(true);
    expect(isNewsQuery('top 5 news headlines from India')).toBe(true);
  });

  test('detectMediaIntent builds YouTube and Spotify launcher cards with Install fallback', () => {
    const sp = detectMediaIntent('Play relaxing piano music on Spotify');
    expect(sp?.kind).toBe('media');
    expect(sp?.platform).toBe('spotify');
    expect(sp?.openUrl).toContain('open.spotify.com/search/');
    expect(sp?.installUrl).toContain('play.google.com');

    const yt = detectMediaIntent('Play Arijit Singh songs on YouTube');
    expect(yt?.kind).toBe('media');
    expect(yt?.platform).toBe('youtube');
    expect(yt?.openUrl).toContain('m.youtube.com/results');

    expect(detectMediaIntent('What is the weather today?')).toBeNull();
  });
});
