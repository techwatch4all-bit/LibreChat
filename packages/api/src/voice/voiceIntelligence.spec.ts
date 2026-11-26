import { analyzeSpeakerTurn, detectAiVoiceAgent, inferGenderHint } from './voiceIntelligence';

describe('voiceIntelligence', () => {
  it('infers gender hint from pitch', () => {
    expect(inferGenderHint(125)).toBe('male');
    expect(inferGenderHint(215)).toBe('female');
    expect(inferGenderHint(20)).toBe('unknown');
  });

  it('detects primary user, known guest, and unknown guest by pitch delta', () => {
    const profile = {
      primary_voiceprint: {
        avg_pitch_hz: 125,
        pitch_std_hz: 15,
        gender_hint: 'male' as const,
        samples: 4,
      },
      known_speakers: [
        { name: 'Priya', relation: 'wife', gender_hint: 'female' as const, avg_pitch_hz: 215 },
      ],
    };

    expect(analyzeSpeakerTurn(132, 14, profile).status).toBe('primary');

    const known = analyzeSpeakerTurn(210, 18, profile);
    expect(known.status).toBe('known_guest');
    expect(known.matchedSpeaker?.name).toBe('Priya');

    const unknown = analyzeSpeakerTurn(270, 20, profile);
    expect(unknown.status).toBe('unknown_guest');
    expect(unknown.genderHint).toBe('female');
  });

  it('returns calibrating status when primary_voiceprint is not yet established', () => {
    const res = analyzeSpeakerTurn(130, 15, {});
    expect(res.status).toBe('calibrating');
    expect(res.genderHint).toBe('male');
    expect(res.isNewGuest).toBeFalsy();
  });

  it('detects another AI voice agent via explicit phrasing or reciprocal assistant loops', () => {
    expect(detectAiVoiceAgent('Hello, as an AI language model, how can I assist you today?').isLikelyAi).toBe(
      true,
    );
    expect(
      detectAiVoiceAgent('How can I help you today?', [
        'I would be happy to assist you with anything you need.',
      ]).isLikelyAi,
    ).toBe(true);
    expect(detectAiVoiceAgent('Hey, what is the weather in Mumbai today?').isLikelyAi).toBe(false);
  });
});
