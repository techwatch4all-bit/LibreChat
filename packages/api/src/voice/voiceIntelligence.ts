import type { GenderHint, KnownSpeakerProfile, VoiceProfileData } from './voiceProfile';

export interface SpeakerTurnAnalysis {
  status: 'primary' | 'known_guest' | 'unknown_guest' | 'calibrating';
  genderHint: GenderHint;
  pitchHz: number;
  matchedSpeaker?: KnownSpeakerProfile;
}

export interface AiAgentDetectionResult {
  isLikelyAi: boolean;
  confidence: number;
  reason?: string;
}

export function inferGenderHint(pitchHz: number): GenderHint {
  if (!Number.isFinite(pitchHz) || pitchHz < 70 || pitchHz > 360) {
    return 'unknown';
  }
  return pitchHz >= 165 ? 'female' : 'male';
}

export function analyzeSpeakerTurn(
  avgPitchHz: number,
  _pitchStdHz: number,
  profile: VoiceProfileData,
): SpeakerTurnAnalysis {
  const genderHint = inferGenderHint(avgPitchHz);
  const roundedPitch = Math.round(avgPitchHz);

  const primary = profile.primary_voiceprint;
  if (!primary || primary.samples < 2) {
    return {
      status: 'calibrating',
      genderHint,
      pitchHz: roundedPitch,
    };
  }

  const deltaFromPrimary = Math.abs(roundedPitch - primary.avg_pitch_hz);
  if (deltaFromPrimary < 45) {
    return {
      status: 'primary',
      genderHint,
      pitchHz: roundedPitch,
    };
  }

  const knownSpeakers = profile.known_speakers ?? [];
  let bestMatch: KnownSpeakerProfile | undefined;
  let bestDelta = Infinity;
  for (const guest of knownSpeakers) {
    if (typeof guest.avg_pitch_hz === 'number') {
      const d = Math.abs(roundedPitch - guest.avg_pitch_hz);
      if (d <= 30 && d < bestDelta) {
        bestDelta = d;
        bestMatch = guest;
      }
    }
  }

  if (bestMatch) {
    return {
      status: 'known_guest',
      genderHint,
      pitchHz: roundedPitch,
      matchedSpeaker: bestMatch,
    };
  }

  return {
    status: 'unknown_guest',
    genderHint,
    pitchHz: roundedPitch,
  };
}

const STRONG_AI_PATTERNS: RegExp[] = [
  /\bas an ai\b/i,
  /\bi am (?:an? )?(?:ai|artificial intelligence|large language model|virtual assistant)\b/i,
  /\bi(?:'m| am) (?:chatgpt|copilot|claude|gemini|perplexity|siri|alexa)\b/i,
  /\bdeveloped by (?:openai|microsoft|anthropic|google)\b/i,
  /\bhow can i assist you today\b/i,
  /\bis there anything else i can (?:help|assist) you with today\b/i,
];

const FORMAL_ASSISTANT_GREETING =
  /\b(?:how (?:can|may) i (?:help|assist) you|i(?:'d| would) be happy to (?:help|assist)|feel free to ask|let me know if you need anything else)\b/i;

export function detectAiVoiceAgent(
  transcript: string,
  recentUserTurns: string[] = [],
): AiAgentDetectionResult {
  const clean = (transcript || '').trim();
  if (!clean) {
    return { isLikelyAi: false, confidence: 0 };
  }

  for (const pattern of STRONG_AI_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isLikelyAi: true,
        confidence: 0.92,
        reason: 'explicit_ai_phrase',
      };
    }
  }

  if (FORMAL_ASSISTANT_GREETING.test(clean)) {
    const previousFormalCount = recentUserTurns
      .slice(-3)
      .filter((t) => FORMAL_ASSISTANT_GREETING.test(t)).length;
    if (previousFormalCount >= 1) {
      return {
        isLikelyAi: true,
        confidence: 0.78,
        reason: 'reciprocal_assistant_loop',
      };
    }
  }

  return { isLikelyAi: false, confidence: 0 };
}
