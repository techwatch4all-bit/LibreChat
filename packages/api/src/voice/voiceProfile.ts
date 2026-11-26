export const VOICE_PROFILE_MEMORY_KEY = 'satchida_voice_profile';

export type GenderHint = 'male' | 'female' | 'unknown';

export interface VoiceprintBaseline {
  avg_pitch_hz: number;
  pitch_std_hz: number;
  gender_hint: GenderHint;
  samples: number;
}

export interface KnownSpeakerProfile {
  name: string;
  relation?: string;
  gender_hint?: GenderHint;
  avg_pitch_hz?: number;
  pitch_std_hz?: number;
}

export interface MorningBriefPreference {
  enabled: boolean;
  topics?: string[];
}

export interface VoiceProfileData {
  preferred_language?: string;
  name?: string;
  location?: string;
  dietary_preference?: string;
  morning_brief?: MorningBriefPreference;
  primary_voiceprint?: VoiceprintBaseline;
  known_speakers?: KnownSpeakerProfile[];
  updated_at?: string;
}

export function parseVoiceProfile(raw: string | null | undefined): VoiceProfileData {
  if (!raw || typeof raw !== 'string') {
    return {};
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as VoiceProfileData;
    }
  } catch {
    // Fallback if memory was hand-edited in non-JSON format
  }
  return {};
}

export function serializeVoiceProfile(profile: VoiceProfileData): string {
  return JSON.stringify(profile, null, 2);
}

export function mergeVoiceProfile(
  existing: VoiceProfileData,
  patch: Partial<VoiceProfileData> & { add_speaker?: KnownSpeakerProfile },
): VoiceProfileData {
  const next: VoiceProfileData = { ...existing };

  if (typeof patch.preferred_language === 'string' && patch.preferred_language.trim()) {
    next.preferred_language = patch.preferred_language.trim();
  }
  if (typeof patch.name === 'string' && patch.name.trim()) {
    next.name = patch.name.trim();
  }
  if (typeof patch.location === 'string' && patch.location.trim()) {
    next.location = patch.location.trim();
  }
  if (typeof patch.dietary_preference === 'string' && patch.dietary_preference.trim()) {
    next.dietary_preference = patch.dietary_preference.trim();
  }
  if (patch.morning_brief && typeof patch.morning_brief === 'object') {
    const prevBrief = existing.morning_brief ?? { enabled: false, topics: [] };
    const nextTopics = Array.isArray(patch.morning_brief.topics)
      ? Array.from(
          new Set(
            patch.morning_brief.topics
              .map((t) => String(t).trim())
              .filter(Boolean),
          ),
        )
      : prevBrief.topics;
    next.morning_brief = {
      enabled:
        typeof patch.morning_brief.enabled === 'boolean'
          ? patch.morning_brief.enabled
          : prevBrief.enabled,
      ...(nextTopics ? { topics: nextTopics } : {}),
    };
  }
  if (patch.primary_voiceprint && typeof patch.primary_voiceprint === 'object') {
    next.primary_voiceprint = {
      ...patch.primary_voiceprint,
    };
  }

  const mergedSpeakers: KnownSpeakerProfile[] = Array.isArray(existing.known_speakers)
    ? existing.known_speakers.map((s) => ({ ...s }))
    : [];

  const incomingSpeakers: KnownSpeakerProfile[] = [
    ...(Array.isArray(patch.known_speakers) ? patch.known_speakers : []),
    ...(patch.add_speaker ? [patch.add_speaker] : []),
  ];

  for (const speaker of incomingSpeakers) {
    const cleanName = typeof speaker?.name === 'string' ? speaker.name.trim() : '';
    if (!cleanName) {
      continue;
    }
    const idx = mergedSpeakers.findIndex(
      (s) => s.name.trim().toLowerCase() === cleanName.toLowerCase(),
    );
    const normalized: KnownSpeakerProfile = {
      name: cleanName,
      ...(speaker.relation ? { relation: speaker.relation.trim() } : {}),
      ...(speaker.gender_hint ? { gender_hint: speaker.gender_hint } : {}),
      ...(typeof speaker.avg_pitch_hz === 'number' ? { avg_pitch_hz: Math.round(speaker.avg_pitch_hz) } : {}),
      ...(typeof speaker.pitch_std_hz === 'number' ? { pitch_std_hz: Math.round(speaker.pitch_std_hz) } : {}),
    };
    if (idx >= 0) {
      mergedSpeakers[idx] = { ...mergedSpeakers[idx], ...normalized };
    } else {
      mergedSpeakers.push(normalized);
    }
  }

  if (mergedSpeakers.length > 0) {
    next.known_speakers = mergedSpeakers;
  }

  next.updated_at = new Date().toISOString();
  return next;
}

export function getTimeOfDayGreeting(hour: number): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const safeHour = Number.isFinite(hour) ? ((Math.floor(hour) % 24) + 24) % 24 : 9;
  if (safeHour >= 5 && safeHour < 12) {
    return 'Good morning';
  }
  if (safeHour >= 12 && safeHour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

export function buildVoiceMemorySystemBlock(
  profile: VoiceProfileData,
  localHour: number,
): string {
  const greeting = getTimeOfDayGreeting(localHour);
  const lines: string[] = [
    'USER MEMORY & PERSONALIZATION (SINGLE CONSOLIDATED PROFILE):',
  ];

  const knownSummary: string[] = [];
  if (profile.preferred_language) {
    knownSummary.push(`Preferred language: ${profile.preferred_language}`);
  }
  if (profile.name) {
    knownSummary.push(`Name: ${profile.name}`);
  }
  if (profile.location) {
    knownSummary.push(`Location: ${profile.location}`);
  }
  if (profile.dietary_preference) {
    knownSummary.push(`Dietary preference: ${profile.dietary_preference}`);
  }
  if (profile.morning_brief) {
    const topics = profile.morning_brief.topics?.join(', ') || 'general';
    knownSummary.push(
      `Daily morning brief: ${profile.morning_brief.enabled ? `enabled (${topics})` : 'disabled'}`,
    );
  }
  if (profile.known_speakers && profile.known_speakers.length > 0) {
    const guests = profile.known_speakers
      .map((s) => `${s.name}${s.relation ? ` (${s.relation})` : ''}`)
      .join(', ');
    knownSummary.push(`Known room speakers: ${guests}`);
  }

  if (knownSummary.length > 0) {
    lines.push(`Stored profile: ${knownSummary.join(' | ')}.`);
  } else {
    lines.push('Stored profile: empty (first-time user).');
  }

  if (!profile.preferred_language) {
    lines.push(
      `- FIRST GREETING RULE: Greet the user warmly in polite English using "${greeting}" and ask which language they prefer to speak in (e.g., "${greeting}! Which language would you be most comfortable speaking in today?").`,
      '- As soon as the user states their preferred language, call `save_voice_profile` with `preferred_language`, switch to that language immediately, and then politely ask for their name.',
    );
  } else if (!profile.name) {
    lines.push(
      `- Speak in ${profile.preferred_language}. Greet them warmly using "${greeting}" in ${profile.preferred_language} and politely ask for their name so you can remember it. Save their name with \`save_voice_profile\`.`,
    );
  } else {
    lines.push(
      `- Returning user: Greet ${profile.name} warmly in ${profile.preferred_language} using "${greeting}" (do NOT ask for their language or name again).`,
    );
  }

  lines.push(
    '- OPTIONAL FOLLOW-UP PREFERENCES: Only when natural and if the user is willing (never interrogate), you may ask about their city/location, whether they prefer vegetarian or non-vegetarian food, or if they want a daily morning brief and which topics to include. Always save any shared preference immediately via `save_voice_profile` so everything stays in their single memory profile.',
    '- MULTI-SPEAKER & ROOM GUESTS: If a system notice alerts you that another person in the room is speaking, greet them warmly like a human, ask their name and how they know the user, and save them via `save_voice_profile` (`add_speaker`).',
    '- AI-TO-AI DETECTION: If a system notice indicates another AI voice assistant (ChatGPT, Copilot, etc.) is speaking, never fall into a repetitive greeting loop. Calmly acknowledge it and ask the human user how they would like to proceed.',
  );

  return lines.join('\n');
}
