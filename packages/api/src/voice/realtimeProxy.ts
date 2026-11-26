import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { logger } from '@librechat/data-schemas';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import type { VoiceProfileData } from './voiceProfile';
import {
  stripVoiceStopwords,
  extractSelfLocationCity,
  extractSpokenCity,
  isPlaceOrDirectionsQuery,
  isWeatherQuery,
  isNewsQuery,
  fetchStructuredWeather,
  fetchStructuredNews,
  detectMediaIntent,
  resolveYouTubeEmbedUrl,
  fetchNearestPlaceWithEta,
} from './liveResolvers';
import {
  parseVoiceProfile,
  serializeVoiceProfile,
  mergeVoiceProfile,
  getTimeOfDayGreeting,
  buildVoiceMemorySystemBlock,
} from './voiceProfile';
import { analyzeSpeakerTurn, detectAiVoiceAgent, inferGenderHint } from './voiceIntelligence';

export interface RealtimeWebSocketLike {
  readyState: number;
  send(data: string | Buffer | ArrayBuffer | Buffer[], cb?: (err?: Error) => void): void;
  close(code?: number, reason?: string): void;
  terminate?: () => void;
  removeAllListeners?: (event?: string) => void;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

export interface RealtimeWebSocketServerLike {
  handleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    cb: (ws: RealtimeWebSocketLike, req: IncomingMessage) => void,
  ): void;
}

export interface RealtimeUserSeatCredential {
  id?: string;
  _id?: { toString(): string };
  name?: string | null;
  username?: string | null;
  email?: string | null;
  seatToken?: string | null;
  satchidaSeatAlias?: string | null;
  accountType?: string | null;
  tenantId?: string | null;
  role?: string | null;
  familyRole?: string | null;
  suspended?: boolean | null;
}

export interface RealtimeProxyDeps {
  wss: RealtimeWebSocketServerLike;
  createUpstreamWebSocket: (
    wsUrl: string,
    opts?: { headers?: Record<string, string> },
  ) => RealtimeWebSocketLike;
  verifyJwt: (token: string) => { id: string; role?: string; tenantId?: string } | null;
  getUserSeatCredential: (userId: string) => Promise<RealtimeUserSeatCredential | null>;
  recordVoiceUsage?: (usage: {
    userId: string;
    accountType: string;
    model: string;
    durationSec: number;
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  }) => Promise<void> | void;
  getBifrostConfig?: () => {
    realtimeUrl: string;
    httpBaseUrl: string;
    oneApiBaseUrl: string;
    llamaBaseUrl: string;
    model: string;
    chatModel: string;
    virtualKey: string;
  };
  mintEphemeralToken?: (model?: string, voiceName?: string) => Promise<string>;
  getVoiceProfileMemory?: (userId: string) => Promise<string | null>;
  setVoiceProfileMemory?: (userId: string, value: string) => Promise<void>;
}

export type VoiceProfileId =
  | 'in_female'
  | 'in_male'
  | 'us_female'
  | 'us_male'
  | 'uk_female'
  | 'uk_male';

export interface VoiceProfile {
  id: VoiceProfileId;
  label: string;
  edgeVoice: string;
  lang: string;
  region: 'in' | 'us' | 'uk';
  gender: 'female' | 'male';
}

export const VOICE_PROFILES: Record<VoiceProfileId, VoiceProfile> = {
  in_female: {
    id: 'in_female',
    label: 'Indian Female (Neerja)',
    edgeVoice: 'en-IN-NeerjaExpressiveNeural',
    lang: 'en-IN',
    region: 'in',
    gender: 'female',
  },
  in_male: {
    id: 'in_male',
    label: 'Indian Male (Prabhat)',
    edgeVoice: 'en-IN-PrabhatNeural',
    lang: 'en-IN',
    region: 'in',
    gender: 'male',
  },
  us_female: {
    id: 'us_female',
    label: 'US Female (Jenny)',
    edgeVoice: 'en-US-JennyNeural',
    lang: 'en-US',
    region: 'us',
    gender: 'female',
  },
  us_male: {
    id: 'us_male',
    label: 'US Male (Guy)',
    edgeVoice: 'en-US-GuyNeural',
    lang: 'en-US',
    region: 'us',
    gender: 'male',
  },
  uk_female: {
    id: 'uk_female',
    label: 'UK Female (Sonia)',
    edgeVoice: 'en-GB-SoniaNeural',
    lang: 'en-GB',
    region: 'uk',
    gender: 'female',
  },
  uk_male: {
    id: 'uk_male',
    label: 'UK Male (Ryan)',
    edgeVoice: 'en-GB-RyanNeural',
    lang: 'en-GB',
    region: 'uk',
    gender: 'male',
  },
};

export function resolveVoiceProfile(rawVoice?: string | null): VoiceProfile {
  const key = (rawVoice || '').trim().toLowerCase();
  if (key in VOICE_PROFILES) {
    return VOICE_PROFILES[key as VoiceProfileId];
  }
  if (key === 'male') {
    return VOICE_PROFILES.in_male;
  }
  return VOICE_PROFILES.in_female;
}

export function detectAccentSwitchCommand(
  text: string,
  currentProfile: VoiceProfile,
): VoiceProfile | null {
  const lower = text.trim().toLowerCase();
  // Never switch voices on diagnostic/complaint questions like "Why are you talking like a male?"
  if (/^\s*(?:why|how come)\b/.test(lower)) {
    return null;
  }
  const hasVoiceOrAccentWord = /\b(accent|voice)\b/.test(lower);
  const hasSwitchVerb =
    /\b(switch(?:ed|ing)?|chang(?:e|ed|ing)?|use|set|speak|talk|be|sound|become|want|prefer|make|try|still|give)\b/.test(
      lower,
    );
  const hasExplicitVoiceTarget =
    hasVoiceOrAccentWord &&
    /\b(accent|voice|male|female|man|woman|guy|boy|lady|girl|us|u\.s\.|american|uk|u\.k\.|british|indian|india)\b/.test(
      lower,
    );
  const hasImplicitGenderOrDialectSwitch =
    /\b(switch(?:ed|ing)?|chang(?:e|ed|ing)?|speak|talk|sound|try|still)\b/.test(lower) &&
    /\b(male|female|man|woman|guy|boy|lady|girl|american|british|indian)\b/.test(lower);
  if (!hasSwitchVerb || (!hasExplicitVoiceTarget && !hasImplicitGenderOrDialectSwitch)) {
    return null;
  }

  let region: 'in' | 'us' | 'uk' = currentProfile.region;
  if (/\b(us|u\.s\.|american|united states)\b/.test(lower)) {
    region = 'us';
  } else if (/\b(uk|u\.k\.|british|england|london)\b/.test(lower)) {
    region = 'uk';
  } else if (/\b(indian|india)\b/.test(lower)) {
    region = 'in';
  }

  let gender: 'female' | 'male' = currentProfile.gender;
  if (/\b(male|man|guy|boy)\b/.test(lower) && !/\bnot\s+(?:a\s+)?male\b/.test(lower)) {
    gender = 'male';
  } else if (
    /\b(female|woman|lady|girl)\b/.test(lower) &&
    !/\bstill\s+(?:a\s+)?female\b/.test(lower)
  ) {
    gender = 'female';
  } else if (/\bstill\s+(?:a\s+)?female\b/.test(lower)) {
    gender = 'male';
  }

  const nextId = `${region}_${gender}` as VoiceProfileId;
  return VOICE_PROFILES[nextId] || null;
}

export function detectRealtimeSearchIntent(text: string): {
  isSearch: boolean;
  isDeepResearch: boolean;
  hasUrl: boolean;
} {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const hasUrl = /https?:\/\/\S+/i.test(trimmed);
  const isDeepResearch =
    /\b(deep research|research in detail|comprehensive research|thorough research|investigate deeply|full report on)\b/i.test(
      lower,
    );

  // Skip pure greetings, acknowledgments, and tiny chit-chat phrases
  const isPureChitChat =
    /^(?:hi|hello|hey|good morning|good afternoon|good evening|good night|how are you|how's it going|what's up|thanks|thank you|okay|ok|yes|yeah|no|nope|bye|goodbye|stop|wait|sorry|excuse me|can you hear me|are you there|you got that|who are you|what is your name|who made you|tell me a joke|switch to \w+|check again|try again|repeat that)[?.!,\s]*$/i.test(
      lower,
    );
  if (isPureChitChat) {
    return { isSearch: false, isDeepResearch: false, hasUrl: false };
  }

  // Skip conversational meta-questions, complaints, capability checks, and recaps of prior turns
  // so Gemini Live handles natural human discussion without hijacking the turn with a literal web search.
  const isConversationalMeta =
    /\b(why\s+did\s+you|why\s+didn'?t\s+you|why\s+do\s+you\s+(?:think|say|assume)|you\s+(?:skipped|missed|forgot|assumed)|i\s+asked\s+you|i\s+told\s+you|what\s+did\s+you\s+(?:say|mean)|did\s+you\s+(?:just|hear|understand)|do\s+you\s+have\s+access|can\s+you\s+access|are\s+you\s+(?:listening|able\s+to)|i\s+did\s+not\s+know\s+you\s+are\s+listening)\b/i.test(
      lower,
    ) ||
    /^(?:okay|ok|alright|so|well|now)?[,\s]*(?:summarize|recap|elaborate|explain)\s+(?:that|it|this|those|the\s+overall\s+news|the\s+news\s+you\s+just|what\s+you\s+just)\b/i.test(
      lower,
    );
  if (isConversationalMeta && !isDeepResearch && !hasUrl) {
    return { isSearch: false, isDeepResearch: false, hasUrl: false };
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const hasExplicitLiveSignal =
    /\b(today|now|latest|current|currently|live|recent|yesterday|tomorrow|this week|this month|2026|2027|price|prices|rate|rates|cost|score|scores|match|ipl|stock|nifty|sensex|gold|silver|petrol|diesel|lpg|fuel|gas|weather|temperature|forecast|aqi|air quality|news|headlines|breaking|near me|nearest|nearby|directions|my location|where am i|current location|panchang|tithi|rahu kaal|sunrise|sunset)\b/i.test(
      lower,
    ) ||
    /^(?:search|look up|google|find|check)\b/i.test(lower) ||
    /(?:आज|अभी|ताजा|ताज़ा|न्यूज़|समाचार|खबर|मौसम|तापमान|भाव|कीमत|पंचांग|पेट्रोल|डीजल|सोना|चांदी)/u.test(
      trimmed,
    );

  const isSearch = isDeepResearch || hasUrl || (wordCount >= 3 && hasExplicitLiveSignal);
  return { isSearch, isDeepResearch, hasUrl };
}

export function detectToolOrTutorIntent(text: string): {
  delegate: boolean;
  mode?: 'Study' | 'Work';
  webSearch?: boolean;
  newChat?: boolean;
  cleanPrompt: string;
} {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const wantsDeepTutorOrStudy =
    /\b(deeptutor|deep tutor|study mode|tutor me|teach me(?: like| how)?|with visuals?|visual explanation|with animation|animation data|diagram of|draw a diagram|show me how .* works|animate how)\b/i.test(
      lower,
    );
  const wantsChatOrTool =
    /\b(insert into chat|send to chat|type in chat|write in chat|ask in chat|generate (?:an? )?(?:image|video|art|chart|presentation|ppt|slide|document|pdf|spreadsheet|report|floorplan)|create (?:an? )?(?:image|video|document|presentation|ppt|spreadsheet|diagram|chart|floorplan|report)|write code|build (?:an? )?(?:app|website|script|tool)|check my (?:vault|files|documents|notes|knowledge base|email|emails|inbox|gmail)|search my (?:vault|files|documents|notes)|read (?:out )?(?:my )?(?:last|latest|recent|unread)?\s*emails?|any new emails?|deep research|full report on|use librechat|new chat)\b/i.test(
      lower,
    ) ||
    /\b((?:gold|silver|bullion|petrol|diesel|fuel|lpg|gas|stock|nifty|sensex)\s+(?:price|prices|rate|rates)|(?:price|prices|rate|rates)\s+of\s+(?:gold|silver|bullion|petrol|diesel|fuel|lpg|gas))\b/i.test(
      lower,
    ) ||
    /(?:गोल्ड|सोना|सोने|सिल्वर|चांदी|पेट्रोल|डीजल).*(?:प्राइस|भाव|कीमत|रेट)/u.test(trimmed);

  if (!wantsDeepTutorOrStudy && !wantsChatOrTool) {
    return { delegate: false, cleanPrompt: trimmed };
  }

  const cleanPrompt =
    trimmed
      .replace(
        /^(?:please\s+)?(?:insert|send|type|write|ask)\s+(?:this\s+)?(?:in|into|to)\s+chat(?:\s*[:,-]?\s*)?/i,
        '',
      )
      .trim() || trimmed;

  return {
    delegate: true,
    mode: wantsDeepTutorOrStudy ? 'Study' : undefined,
    webSearch:
      wantsDeepTutorOrStudy || /\b(web|search|animation|visual|latest|online|fetch)\b/i.test(lower),
    newChat: wantsDeepTutorOrStudy || /\bnew chat\b/i.test(lower),
    cleanPrompt,
  };
}

const WS_OPEN = 1;
const DEFAULT_BIFROST_REALTIME_URL = 'ws://127.0.0.1:8700/v1/realtime';
const DEFAULT_BIFROST_HTTP_URL = 'http://127.0.0.1:8700';
const DEFAULT_ONEAPI_HTTP_URL = 'http://127.0.0.1:4000';
const DEFAULT_LLAMA_HTTP_URL = 'http://127.0.0.1:8080';
const DEFAULT_REALTIME_MODEL = 'CheapInference/gpt-live-1';
const DEFAULT_VOICE_CHAT_MODEL = 'CheapInference/deepseek-v4.1-flash';

export const ENTITLED_LIVE_VOICE_TIERS: ReadonlySet<string> = new Set([
  'pro',
  'pro_family',
  'enterprise',
  'privacy',
]);

interface CachedChannelVks {
  retaining: string;
  workStudy: string;
  zdr: string;
  localPrivacy: string;
}

let cachedChannelVks: CachedChannelVks | null = null;

function readBifrostChannelVksFromOneApiDb(): CachedChannelVks {
  if (cachedChannelVks) {
    return cachedChannelVks;
  }
  const empty: CachedChannelVks = {
    retaining: '',
    workStudy: '',
    zdr: '',
    localPrivacy: '',
  };
  const candidates = [
    path.resolve(process.cwd(), 'one-api.db'),
    'D:\\LAN-AI-Infra\\LibreChat\\one-api.db',
    'D:\\LAN-AI-Infra\\one-api\\one-api.db',
  ];
  for (const dbPath of candidates) {
    if (!fs.existsSync(dbPath)) {
      continue;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqlite = require('node:sqlite') as {
        DatabaseSync: new (
          p: string,
          opts?: { readOnly?: boolean },
        ) => {
          prepare: (sql: string) => {
            all: () => Array<{ id?: number; name?: string; key?: string }>;
          };
          close: () => void;
        };
      };
      const db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
      const rows = db
        .prepare(
          "SELECT id, name, key FROM channels WHERE base_url LIKE '%8700%' AND status = 1 AND length(key) > 40 ORDER BY id ASC",
        )
        .all();
      db.close();

      for (const r of rows) {
        const k = (r.key || '').trim();
        const n = (r.name || '').toLowerCase();
        if (!k) {
          continue;
        }
        if (!empty.retaining) {
          empty.retaining = k;
        }
        if (n.includes('retaining') || r.id === 1) {
          empty.retaining = k;
        } else if (n.includes('workstudy') || n.includes('work') || r.id === 5) {
          empty.workStudy = k;
        } else if (n.includes('zdr') || r.id === 4) {
          empty.zdr = k;
        } else if (n.includes('privacy') || n.includes('local') || r.id === 2) {
          empty.localPrivacy = k;
        }
      }

      if (empty.retaining) {
        cachedChannelVks = empty;
        return cachedChannelVks;
      }
    } catch {
      // Continue to next candidate
    }
  }
  return empty;
}

let cachedGoogleApiKey = '';

export function getDecryptedGoogleApiKey(): string {
  if (cachedGoogleApiKey) {
    return cachedGoogleApiKey;
  }
  const dbCandidates = [
    'D:\\LAN-AI-Infra\\Bifrost\\data\\config.db',
    path.resolve(process.cwd(), '../Bifrost/data/config.db'),
  ];
  for (const dbPath of dbCandidates) {
    if (!fs.existsSync(dbPath)) {
      continue;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqlite = require('node:sqlite') as {
        DatabaseSync: new (
          p: string,
          opts?: { readOnly?: boolean },
        ) => {
          prepare: (sql: string) => {
            all: () => Array<{ value?: string }>;
          };
          close: () => void;
        };
      };
      const db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
      const row = db
        .prepare("SELECT value FROM config_keys WHERE provider='google' AND enabled = 1 LIMIT 1")
        .all()[0];
      db.close();

      if (!row?.value) {
        continue;
      }

      const passphrase =
        process.env.BIFROST_ENCRYPTION_KEY || '42b2b99d83b38d7d2fc057731177df47d0af10a51412ac01';
      const salt = Buffer.from('bifrost-encryption-v1-salt-2024');

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { argon2id } = require('@noble/hashes/argon2') as {
        argon2id: (
          p: string | Uint8Array,
          s: string | Uint8Array,
          opts: { t: number; m: number; p: number; dkLen: number },
        ) => Uint8Array;
      };
      const aesKey = argon2id(passphrase, salt, {
        t: 1,
        m: 64 * 1024,
        p: 4,
        dkLen: 32,
      });

      const buf = Buffer.from(row.value, 'base64');
      const nonce = buf.subarray(0, 12);
      const tag = buf.subarray(buf.length - 16);
      const ciphertext = buf.subarray(12, buf.length - 16);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crypto = require('crypto');
      const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, nonce);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');

      if (plain) {
        cachedGoogleApiKey = plain.trim();
        return cachedGoogleApiKey;
      }
    } catch (err) {
      logger.warn('[RealtimeVoice] Failed to decrypt Google key from config.db:', err);
    }
  }
  return '';
}

export interface WarmTokenCacheEntry {
  token: string;
  model: string;
  voiceName: string;
  expiresAtMs: number;
}

const warmEphemeralTokens = new Map<string, WarmTokenCacheEntry>();
const WARM_TOKEN_TTL_MS = 55 * 1000;
const WARM_TOKEN_MIN_REMAINING_MS = 10 * 1000;

export async function mintGoogleEphemeralToken(
  model = 'models/gemini-3.8-live',
  voiceName?: string,
): Promise<string> {
  const masterKey = getDecryptedGoogleApiKey();
  if (!masterKey) {
    throw new Error('Google master API key not available');
  }

  // expireTime: session can last up to 30 minutes; newSessionExpireTime: must start within 60s
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();

  const bidiGenerateContentSetup: Record<string, unknown> = {
    model,
  };
  if (voiceName) {
    bidiGenerateContentSetup.generationConfig = {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    };
  }

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': masterKey,
    },
    body: JSON.stringify({
      uses: 1,
      expireTime,
      newSessionExpireTime,
      bidiGenerateContentSetup,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to mint ephemeral token (status ${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { name?: string };
  if (!data?.name) {
    throw new Error('Empty token response from Google auth_tokens API');
  }
  return data.name;
}

export async function warmGoogleEphemeralToken(
  userId: string,
  model = 'models/gemini-3.8-live',
  voiceName = 'Kore',
): Promise<WarmTokenCacheEntry> {
  const existing = warmEphemeralTokens.get(userId);
  if (
    existing &&
    existing.model === model &&
    existing.voiceName === voiceName &&
    existing.expiresAtMs - Date.now() > WARM_TOKEN_MIN_REMAINING_MS
  ) {
    return existing;
  }
  const token = await mintGoogleEphemeralToken(model, voiceName);
  const entry: WarmTokenCacheEntry = {
    token,
    model,
    voiceName,
    expiresAtMs: Date.now() + WARM_TOKEN_TTL_MS,
  };
  warmEphemeralTokens.set(userId, entry);
  return entry;
}

export function consumeWarmEphemeralToken(
  userId: string,
  model = 'models/gemini-3.8-live',
  voiceName?: string,
): string | null {
  const existing = warmEphemeralTokens.get(userId);
  if (!existing) {
    return null;
  }
  if (
    existing.model !== model ||
    (voiceName && existing.voiceName !== voiceName) ||
    existing.expiresAtMs - Date.now() <= WARM_TOKEN_MIN_REMAINING_MS
  ) {
    return null;
  }
  warmEphemeralTokens.delete(userId);
  return existing.token;
}

export function createVoiceWarmHandler(opts: {
  getUserSeatCredential: (userId: string) => Promise<RealtimeUserSeatCredential | null>;
}) {
  return async (
    req: { user?: { id?: string; _id?: { toString(): string } } },
    res: {
      status: (code: number) => { json: (body: unknown) => void };
      json: (body: unknown) => void;
    },
  ): Promise<void> => {
    const userId = req.user?.id || req.user?._id?.toString();
    if (!userId) {
      res.status(401).json({ ok: false, warm: false, reason: 'unauthorized' });
      return;
    }
    try {
      const userSeat = await opts.getUserSeatCredential(userId);
      if (!userSeat || userSeat.suspended) {
        res.status(403).json({ ok: false, warm: false, reason: 'suspended_or_missing' });
        return;
      }
      const accountType = (userSeat.accountType || '').toLowerCase();
      const isProVoice = ['pro', 'pro_family', 'enterprise', 'privacy'].includes(accountType);
      if (!isProVoice) {
        res.json({ ok: true, warm: false, eligible: false, tier: accountType || 'free' });
        return;
      }
      if (accountType === 'privacy' || process.env.GOOGLE_EPHEMERAL_TOKEN_ENABLED === 'false') {
        res.json({
          ok: true,
          warm: true,
          eligible: true,
          mode: 'bifrost_bridge',
          tier: accountType,
        });
        return;
      }
      const entry = await warmGoogleEphemeralToken(userId, 'models/gemini-3.8-live');
      res.json({
        ok: true,
        warm: true,
        eligible: true,
        mode: 'gemini_live_s2s',
        tier: accountType,
        expiresAtMs: entry.expiresAtMs,
      });
    } catch (err) {
      logger.warn(
        `[RealtimeVoice] Voice warm pre-check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      res.json({
        ok: true,
        warm: true,
        eligible: true,
        mode: 'bifrost_bridge',
      });
    }
  };
}

export function mapVoiceToGeminiPrebuilt(
  voiceProfile: VoiceProfile,
): 'Aoede' | 'Charon' | 'Fenrir' | 'Kore' | 'Puck' {
  if (voiceProfile.id === 'us_male') {
    return 'Fenrir';
  }
  if (voiceProfile.id === 'us_female') {
    return 'Aoede';
  }
  if (voiceProfile.id === 'uk_male') {
    return 'Charon';
  }
  if (voiceProfile.id === 'uk_female') {
    return 'Aoede';
  }
  if (voiceProfile.id === 'in_male') {
    return 'Charon';
  }
  return 'Kore';
}

export function pcmToWavBuffer(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16,
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function recordVoiceUsageInOneApi(seatAliasOrId: string, outputTokens: number): void {
  const candidates = [
    'D:\\LAN-AI-Infra\\one-api\\one-api.db',
    path.resolve(process.cwd(), 'one-api.db'),
  ];
  for (const dbPath of candidates) {
    if (!fs.existsSync(dbPath)) {
      continue;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqlite = require('node:sqlite') as {
        DatabaseSync: new (p: string) => {
          prepare: (sql: string) => {
            run: (...args: unknown[]) => void;
          };
          close: () => void;
        };
      };
      const db = new sqlite.DatabaseSync(dbPath);
      const now = Math.floor(Date.now() / 1000);
      db.prepare(
        'UPDATE seat_token_usages SET output_tokens = output_tokens + ?, updated_at = ? WHERE seat_alias = ? OR user_id = ?',
      ).run(outputTokens, now, seatAliasOrId, seatAliasOrId);
      db.close();
      return;
    } catch {
      // Ignore
    }
  }
}

export function selectBifrostVkForMode(mode: string, accountType?: string | null): string {
  const envVk = (process.env.BIFROST_VIRTUAL_KEY || '').trim();
  if (envVk) {
    return envVk;
  }
  const vks = readBifrostChannelVksFromOneApiDb();
  const normalizedMode = mode.trim().toLowerCase();
  const normalizedTier = (accountType || '').trim().toLowerCase();

  // Motion/Voice requests route via Cloud Retaining/Cloud ZDR virtual key
  if (normalizedMode === 'motion') {
    return normalizedTier === 'privacy' ? vks.zdr || vks.retaining : vks.retaining || vks.workStudy;
  }

  // Only true local Privacy mode uses the localPrivacy key
  if (normalizedMode === 'privacy') {
    return vks.localPrivacy || vks.zdr || vks.retaining;
  }
  if (normalizedTier === 'privacy') {
    return vks.zdr || vks.retaining;
  }
  if (normalizedMode === 'work' || normalizedMode === 'study') {
    return vks.workStudy || vks.retaining;
  }
  if (normalizedMode === 'zdr') {
    return vks.zdr || vks.retaining;
  }
  return vks.retaining;
}

export function resolveSemanticMode(
  rawMode: string | undefined | null,
  accountType?: string | null,
  familyRole?: string | null,
): {
  semanticMode: 'Chat' | 'Study' | 'Work' | 'Pro' | 'Privacy' | 'Vibecoding';
  normalizedMode: string;
  isPrivacyMode: boolean;
  isChildSeat: boolean;
  isFamilySeat: boolean;
  modeAllowed: boolean;
  toolsAllowed: boolean;
} {
  const tier = (accountType || 'basic').trim().toLowerCase();
  const role = (familyRole || '').trim().toLowerCase();
  const isChildSeat = role === 'minor' || role === 'child';
  const isFamilySeat = tier === 'family';

  let allowedModes: string[] = ['chat', 'study'];
  if (tier === 'privacy' || tier === 'enterprise') {
    allowedModes = ['chat', 'study', 'work', 'privacy', 'vibecoding', 'pro'];
  } else if (tier === 'pro' || tier === 'pro_family') {
    allowedModes = ['chat', 'study', 'work', 'vibecoding', 'pro'];
  } else if (
    tier === 'standard' ||
    tier === 'family' ||
    tier === 'work_study' ||
    tier === 'workstudy'
  ) {
    allowedModes = ['chat', 'study', 'work'];
  }

  let reqMode = (rawMode || 'Chat').trim().toLowerCase();
  if (reqMode === 'vibecoder' || reqMode === 'vibe_coding') {
    reqMode = 'vibecoding';
  } else if (reqMode === 'discussion') {
    reqMode = 'chat';
  }

  const childForbidden =
    isChildSeat && (reqMode === 'work' || reqMode === 'vibecoding' || reqMode === 'pro');
  const modeAllowed = allowedModes.includes(reqMode) && !childForbidden;

  if (!modeAllowed) {
    reqMode = isChildSeat ? 'study' : 'chat';
  }

  const semanticMap: Record<string, 'Chat' | 'Study' | 'Work' | 'Pro' | 'Privacy' | 'Vibecoding'> =
    {
      chat: 'Chat',
      study: 'Study',
      work: 'Work',
      pro: 'Pro',
      privacy: 'Privacy',
      vibecoding: 'Vibecoding',
    };
  const semanticMode = semanticMap[reqMode] || 'Chat';
  const isPrivacyMode = semanticMode === 'Privacy';
  const toolsAllowed =
    !isChildSeat &&
    !isFamilySeat &&
    ['work', 'pro', 'vibecoding', 'privacy', 'enterprise'].some(
      (m) => reqMode === m || tier.includes(m),
    );

  return {
    semanticMode,
    normalizedMode: reqMode,
    isPrivacyMode,
    isChildSeat,
    isFamilySeat,
    modeAllowed,
    toolsAllowed,
  };
}

export function buildSatchidaAttributionHeaders(params: {
  user?: RealtimeUserSeatCredential | null;
  userId?: string;
  semanticMode: string;
  normalizedMode: string;
  hasTools?: boolean;
}): Record<string, string> {
  const user = params.user;
  const tenantId = String(user?.tenantId || 'satchida-master');
  const userId = String(
    params.userId || user?.id || (user?._id ? user._id.toString() : '') || 'anonymous',
  );
  const userRole = String(user?.role || 'USER');
  const userName = String(user?.name || user?.username || user?.email || 'Satchida User');
  const seatAlias = String(user?.satchidaSeatAlias || userId);

  return {
    'X-Tenant-Id': tenantId,
    'X-User-Id': userId,
    'X-User-Name': userName,
    'X-Seat-Alias': seatAlias,
    'x-satchida-seat-alias': seatAlias,
    'x-satchida-account-type': user?.accountType || 'pro',
    'X-Satchida-Mode': params.semanticMode,
    'X-Bifrost-Mode': params.normalizedMode,
    'X-Bifrost-User-Id': userId,
    'X-Bifrost-Role': userRole,
    'X-Bifrost-Activity': params.hasTools ? 'live_voice_tools' : 'live_voice',
    'X-Bf-App': 'LibreChat',
    'x-bf-app': 'LibreChat',
    'x-bf-dim-app': 'LibreChat',
    'x-bf-dim-mode': params.normalizedMode,
    'x-bf-dim-activity': params.hasTools ? 'live_voice_tools' : 'live_voice',
    'x-bf-dim-user_id': userId,
    'x-bf-dim-user_name': userName,
    'x-bf-dim-customer_id': tenantId,
    'x-bf-dim-customer_name': tenantId,
    'x-bf-dim-team_id': tenantId,
    'x-bf-dim-team_name': tenantId,
  };
}

export function normalizeRealtimeWsUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return DEFAULT_BIFROST_REALTIME_URL;
  }
  if (trimmed.startsWith('http://')) {
    return `ws://${trimmed.slice('http://'.length)}`;
  }
  if (trimmed.startsWith('https://')) {
    return `wss://${trimmed.slice('https://'.length)}`;
  }
  return trimmed;
}

export function resolveBifrostRealtimeConfig(): {
  realtimeUrl: string;
  httpBaseUrl: string;
  oneApiBaseUrl: string;
  llamaBaseUrl: string;
  model: string;
  chatModel: string;
  virtualKey: string;
} {
  const rawUrl = process.env.BIFROST_REALTIME_URL || DEFAULT_BIFROST_REALTIME_URL;
  const httpBaseUrl = (process.env.BIFROST_HTTP_URL || DEFAULT_BIFROST_HTTP_URL).trim();
  const oneApiBaseUrl = (
    process.env.SATCHIDA_AUTOROUTER_BASE_URL ||
    process.env.SATCHIDA_GATEWAY_URL ||
    DEFAULT_ONEAPI_HTTP_URL
  )
    .trim()
    .replace(/\/v1\/?$/, '');
  const llamaBaseUrl = (process.env.SATCHIDA_LLAMA_BASE_URL || DEFAULT_LLAMA_HTTP_URL)
    .trim()
    .replace(/\/v1\/?$/, '');
  const model = (process.env.BIFROST_REALTIME_MODEL || DEFAULT_REALTIME_MODEL).trim();
  const chatModel = (process.env.BIFROST_VOICE_CHAT_MODEL || DEFAULT_VOICE_CHAT_MODEL).trim();
  const virtualKey = selectBifrostVkForMode('Chat');

  return {
    realtimeUrl: normalizeRealtimeWsUrl(rawUrl),
    httpBaseUrl,
    oneApiBaseUrl,
    llamaBaseUrl,
    model,
    chatModel,
    virtualKey,
  };
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) {
    return out;
  }
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function sendJson(ws: RealtimeWebSocketLike, payload: Record<string, unknown>): void {
  if (ws.readyState !== WS_OPEN) {
    return;
  }
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // Ignore send errors on closing sockets
  }
}

function sendClientError(clientWs: RealtimeWebSocketLike, code: string, message: string): void {
  sendJson(clientWs, {
    type: 'error',
    error: { code, message },
  });
}

function streamChatCompletion(opts: {
  baseUrl: string;
  authBearer?: string;
  bifrostVk?: string;
  extraHeaders?: Record<string, string>;
  model: string;
  messages: Array<{ role: string; content: string }>;
  onDelta: (delta: string) => void;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL('/v1/chat/completions', opts.baseUrl);
    const body = JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: 220,
      temperature: 0.5,
      stream: true,
    });

    const headers: Record<string, string | number> = {
      ...opts.extraHeaders,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    if (opts.authBearer) {
      headers.Authorization = `Bearer ${opts.authBearer}`;
    }
    if (opts.bifrostVk) {
      headers['x-bf-vk'] = opts.bifrostVk;
      if (!opts.authBearer) {
        headers.Authorization = `Bearer ${opts.bifrostVk}`;
      }
    }

    const req = http.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 80,
        path: urlObj.pathname,
        method: 'POST',
        headers,
      },
      (res) => {
        if ((res.statusCode ?? 500) >= 400) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let fullText = '';
        let sseBuffer = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          sseBuffer += chunk;
          const lines = sseBuffer.split(/\r?\n/);
          sseBuffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) {
              continue;
            }
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
              };
              const delta =
                parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? '';
              if (delta) {
                fullText += delta;
                opts.onDelta(delta);
              }
            } catch {
              // Ignore partial/malformed SSE lines
            }
          }
        });
        res.on('end', () => {
          resolve(fullText.trim());
        });
      },
    );

    req.on('error', (err) => reject(err));
    req.setTimeout(20000, () => {
      req.destroy(new Error('Voice chat completion timed out'));
    });
    req.write(body);
    req.end();
  });
}

function getLoadedLocalLlamaModel(llamaBaseUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const urlObj = new URL('/v1/models', llamaBaseUrl);
    const req = http.get(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 8080,
        path: urlObj.pathname,
        timeout: 3000,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw) as {
              data?: Array<{ id?: string; status?: { value?: string }; loaded?: boolean }>;
            };
            const list = Array.isArray(parsed.data) ? parsed.data : [];
            const loaded = list.find((m) => m.loaded === true || m.status?.value === 'loaded');
            resolve(loaded?.id || list[0]?.id || 'Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0');
          } catch {
            resolve('Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0');
          }
        });
      },
    );
    req.on('error', () => resolve('Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0'));
  });
}

function synthesizeEdgeTtsBase64(speechText: string, edgeVoice: string): Promise<string | null> {
  return new Promise((resolve) => {
    const tempFile = path.join(
      os.tmpdir(),
      `live_voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`,
    );
    const scriptCandidates = [
      path.resolve(process.cwd(), 'skill', 'edge_tts_service.py'),
      'D:\\LAN-AI-Infra\\LibreChat\\skill\\edge_tts_service.py',
    ];
    const pythonScript = scriptCandidates.find((p) => fs.existsSync(p));
    if (!pythonScript) {
      resolve(null);
      return;
    }

    const proc = spawn('python', [pythonScript, edgeVoice, tempFile, speechText], {
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 15000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(tempFile)) {
        try {
          const buf = fs.readFileSync(tempFile);
          fs.unlinkSync(tempFile);
          resolve(buf.toString('base64'));
          return;
        } catch {
          resolve(null);
          return;
        }
      }
      resolve(null);
    });

    proc.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

async function fetchWebPageExcerpt(url: string, maxChars = 1400): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SatchidaVoiceBot/1.0)',
        Accept: 'text/html,application/xhtml+xml,text/plain',
      },
    });
    if (!res.ok) {
      return '';
    }
    const raw = await res.text();
    const cleaned = raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.slice(0, maxChars);
  } catch {
    return '';
  }
}

async function executeVoiceWebSearch(
  query: string,
  opts?: { deep?: boolean; fetchPages?: boolean },
): Promise<string> {
  const rawQuery = query.trim();
  if (!rawQuery) {
    return 'No search query provided.';
  }
  // Strip spoken filler/stopwords so search engines receive clean keywords
  const STOPWORDS = new Set([
    'okay',
    'ok',
    'hey',
    'hi',
    'hello',
    'please',
    'well',
    'so',
    'um',
    'uh',
    'then',
    'can',
    'could',
    'would',
    'will',
    'are',
    'you',
    'able',
    'to',
    'provide',
    'give',
    'tell',
    'me',
    'check',
    'find',
    'search',
    'get',
    'show',
    'with',
    'i',
    'want',
    'need',
    'like',
    'know',
    'hear',
    'see',
    'about',
    'the',
    'a',
    'an',
    'some',
    'any',
    'for',
    'of',
    'is',
    'my',
    'your',
  ]);
  const keywordTokens = rawQuery
    .replace(/[?!.,;:'"]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
  const cleanQuery = keywordTokens.join(' ').trim() || rawQuery;

  const results: string[] = [];
  const candidateUrls: string[] = [];
  const tasks: Promise<void>[] = [];

  // Extract explicit URLs from query if user asked to fetch a specific URL
  const explicitUrls = rawQuery.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  for (const u of explicitUrls.slice(0, 2)) {
    candidateUrls.push(u);
  }

  // 0. Local satchida-search aggregator (fast, cached, multi-engine: Google News + DDG + Wiki)
  const localSearchUrl = (process.env.SEARXNG_INSTANCE_URL || 'http://127.0.0.1:8880').replace(
    /\/+$/,
    '',
  );
  tasks.push(
    (async () => {
      try {
        const res = await fetch(
          `${localSearchUrl}/search?q=${encodeURIComponent(cleanQuery)}&format=json`,
          { signal: AbortSignal.timeout(3500) },
        );
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as {
          results?: Array<{
            title?: string;
            content?: string;
            publishedDate?: string;
            url?: string;
          }>;
        };
        if (Array.isArray(data.results)) {
          for (const item of data.results.slice(0, 6)) {
            const title = (item.title || '').replace(/<[^>]+>/g, '').trim();
            const snippet = (item.content || '')
              .replace(/&lt;[^&]*&gt;/g, ' ')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            const datePart = item.publishedDate ? ` (${item.publishedDate})` : '';
            if (title) {
              results.push(
                snippet && !snippet.startsWith(title)
                  ? `Headline${datePart}: ${title} — ${snippet.slice(0, 220)}`
                  : `Headline${datePart}: ${title}`,
              );
            }
            if (
              item.url &&
              item.url.startsWith('http') &&
              !item.url.includes('news.google.com/rss/') &&
              candidateUrls.length < 3
            ) {
              candidateUrls.push(item.url);
            }
          }
        }
      } catch {
        // Ignore local search timeout/error and rely on fallback sources
      }
    })(),
  );

  // 1. Google News RSS (fast, current events, weather, sports, finance)
  tasks.push(
    (async () => {
      try {
        const res = await fetch(
          `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQuery)}&hl=en-IN&gl=IN&ceid=IN:en`,
          { signal: AbortSignal.timeout(3500) },
        );
        if (!res.ok) {
          return;
        }
        const xml = await res.text();
        const items = [
          ...xml.matchAll(
            /<item>[\s\S]*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g,
          ),
        ].slice(0, 5);
        for (const m of items) {
          const title = (m[1] || '').replace(/<[^>]+>/g, '').trim();
          const link = (m[2] || '').trim();
          const pubDate = (m[3] || '').trim();
          if (title) {
            results.push(`News (${pubDate}): ${title}`);
          }
          if (link && candidateUrls.length < 4) {
            candidateUrls.push(link);
          }
        }
      } catch {
        // Ignore timeout/network error
      }
    })(),
  );

  // 2. DuckDuckGo Instant Answer API
  tasks.push(
    (async () => {
      try {
        const res = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`,
          { signal: AbortSignal.timeout(3500) },
        );
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as {
          AbstractText?: string;
          AbstractURL?: string;
          Answer?: string;
          RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
        };
        if (data.Answer) {
          results.push(`Instant Answer: ${data.Answer}`);
        }
        if (data.AbstractText) {
          results.push(`Summary: ${data.AbstractText}`);
        }
        if (data.AbstractURL && candidateUrls.length < 4) {
          candidateUrls.push(data.AbstractURL);
        }
        if (Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics.slice(0, 3)) {
            if (topic.Text) {
              results.push(`Fact: ${topic.Text}`);
            }
          }
        }
      } catch {
        // Ignore timeout/network error
      }
    })(),
  );

  // 3. DuckDuckGo HTML organic search snippets (covers weather, live scores, prices, general facts)
  tasks.push(
    (async () => {
      try {
        const res = await fetch(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`,
          {
            signal: AbortSignal.timeout(4000),
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          },
        );
        if (!res.ok) {
          return;
        }
        const html = await res.text();
        const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)].slice(
          0,
          5,
        );
        for (const s of snippets) {
          const txt = (s[1] || '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (txt) {
            results.push(`Web Snippet: ${txt}`);
          }
        }
        const links = [...html.matchAll(/class="result__url"[^>]*href="([^"]+)"/gi)].slice(0, 3);
        for (const l of links) {
          const href = (l[1] || '').trim();
          if (href.startsWith('http') && candidateUrls.length < 4) {
            candidateUrls.push(href);
          }
        }
      } catch {
        // Ignore timeout/network error
      }
    })(),
  );

  // 4. Deep research: run a secondary complementary search in parallel
  if (opts?.deep) {
    tasks.push(
      (async () => {
        try {
          const res = await fetch(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${cleanQuery} detailed analysis overview`)}`,
            {
              signal: AbortSignal.timeout(4000),
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            },
          );
          if (!res.ok) {
            return;
          }
          const html = await res.text();
          const snippets = [
            ...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi),
          ].slice(0, 4);
          for (const s of snippets) {
            const txt = (s[1] || '')
              .replace(/<[^>]+>/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            if (txt) {
              results.push(`Deep Research: ${txt}`);
            }
          }
        } catch {
          // Ignore
        }
      })(),
    );
  }

  await Promise.all(tasks);

  // Optional Web Fetch of top 1-2 pages for deep/explicit-URL/detailed queries
  if ((opts?.fetchPages || opts?.deep || explicitUrls.length > 0) && candidateUrls.length > 0) {
    const pagesToFetch = candidateUrls.slice(0, opts?.deep ? 2 : 1);
    const excerpts = await Promise.all(pagesToFetch.map((u) => fetchWebPageExcerpt(u, 1200)));
    excerpts.forEach((excerpt, idx) => {
      if (excerpt) {
        results.push(`Fetched Page (${pagesToFetch[idx]}): ${excerpt}`);
      }
    });
  }

  const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  if (results.length === 0) {
    return `Current server date/time (IST): ${nowStr}. No live web snippets returned for "${cleanQuery}".`;
  }
  return `Current server date/time (IST): ${nowStr}.\n${results.slice(0, 12).join('\n')}`;
}

export function createRealtimeVoiceUpgradeHandler(deps: RealtimeProxyDeps) {
  const {
    wss,
    createUpstreamWebSocket,
    verifyJwt,
    getUserSeatCredential,
    getBifrostConfig,
    mintEphemeralToken,
  } = deps;

  if (process.env.NODE_ENV !== 'test') {
    try {
      getDecryptedGoogleApiKey();
    } catch {
      // Non-fatal; will retry on demand
    }
  }

  return function handleRealtimeVoiceUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): boolean {
    const reqUrl = req.url || '';
    const url = new URL(reqUrl, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname !== '/api/voice/realtime') {
      return false;
    }

    // 1. MANDATORY END-USER LOGIN CHECK (Fail-Closed: Zero anonymous WebSocket upgrades allowed)
    const cookies = parseCookieHeader(req.headers.cookie);
    const authHeader =
      typeof req.headers.authorization === 'string' &&
      req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice('Bearer '.length).trim()
        : '';
    const tokenCandidate =
      url.searchParams.get('token')?.trim() || authHeader || cookies.refreshToken || '';

    if (!tokenCandidate || typeof verifyJwt !== 'function') {
      logger.warn('[RealtimeVoice] Rejected unauthenticated upgrade: missing end-user JWT');
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return true;
    }

    let authenticatedUserId = '';
    try {
      const decoded = verifyJwt(tokenCandidate);
      if (!decoded?.id) {
        logger.warn('[RealtimeVoice] Rejected upgrade: invalid or expired end-user JWT');
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return true;
      }
      authenticatedUserId = decoded.id;
    } catch {
      logger.warn('[RealtimeVoice] Rejected upgrade: JWT verification threw');
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return true;
    }

    const config = getBifrostConfig ? getBifrostConfig() : resolveBifrostRealtimeConfig();
    const initialRawMode = url.searchParams.get('mode') || 'Chat';
    const initialHasTools = url.searchParams.get('tools') === 'true';
    const initialVoiceParam = url.searchParams.get('voice') || 'in_female';
    const requestedModel = url.searchParams.get('model')?.trim();
    const _model = requestedModel || config.model;

    wss.handleUpgrade(req, socket, head, async (clientWs) => {
      // 2. MANDATORY USER RECORD, TIER ENTITLEMENT & SEAT TOKEN CHECK
      let userSeat: RealtimeUserSeatCredential | null = null;
      try {
        userSeat = await getUserSeatCredential(authenticatedUserId);
      } catch (err) {
        logger.warn('[RealtimeVoice] Failed to hydrate user seat credential:', err);
      }

      if (!userSeat || userSeat.suspended === true) {
        sendClientError(
          clientWs,
          'account_unauthorized',
          'Your user account is not active or could not be verified. Please sign in again.',
        );
        clientWs.close(1008, 'Account unauthorized');
        return;
      }

      const normalizedAccountType = (userSeat.accountType || '').trim().toLowerCase();
      if (!ENTITLED_LIVE_VOICE_TIERS.has(normalizedAccountType)) {
        sendClientError(
          clientWs,
          'tier_not_entitled',
          'Satchida Live Voice requires a Pro, Pro Family, Enterprise, or Privacy seat.',
        );
        clientWs.close(1008, 'Tier not entitled');
        return;
      }

      const seatToken = (userSeat.seatToken || '').trim();
      if (!seatToken) {
        sendClientError(
          clientWs,
          'seat_not_provisioned',
          'Your account does not have an active Satchida seat token provisioned. Please contact your Tenant Admin.',
        );
        clientWs.close(1008, 'Seat token required');
        return;
      }

      const modePolicy = resolveSemanticMode(
        initialRawMode,
        userSeat.accountType,
        userSeat.familyRole,
      );
      if (!modePolicy.modeAllowed) {
        sendClientError(
          clientWs,
          'mode_not_allowed',
          `Your seat tier (${userSeat.accountType}) is not authorized to use mode "${initialRawMode}".`,
        );
        clientWs.close(1008, 'Mode not allowed');
        return;
      }

      let activeVoiceProfile = resolveVoiceProfile(initialVoiceParam);
      const _modeVk = selectBifrostVkForMode(modePolicy.semanticMode, userSeat.accountType);
      const _attributionHeaders = buildSatchidaAttributionHeaders({
        user: userSeat,
        userId: authenticatedUserId,
        semanticMode: modePolicy.semanticMode,
        normalizedMode: modePolicy.normalizedMode,
        hasTools: initialHasTools && modePolicy.toolsAllowed,
      });

      logger.info(
        `[RealtimeVoice] Session start user=${authenticatedUserId} tier=${userSeat.accountType} mode=${modePolicy.semanticMode} voice=${activeVoiceProfile.id}`,
      );

      const rawLocalHour = Number(url.searchParams.get('localHour'));
      const clientLocalHour =
        Number.isFinite(rawLocalHour) && rawLocalHour >= 0 && rawLocalHour <= 23
          ? Math.floor(rawLocalHour)
          : new Date().getHours();
      let voiceProfile: VoiceProfileData = {};
      let initialGreetingSent = false;
      const recentUserTranscripts: string[] = [];
      let _lastGuestAcoustic: {
        avgPitchHz: number;
        pitchStdHz: number;
        genderHint: 'male' | 'female' | 'child' | 'unknown';
      } | null = null;
      let activeSpeakerKey = 'primary';
      let pendingGuestIntroNotice: string | null = null;
      let lastGuestGreetingAt = 0;

      if (deps.getVoiceProfileMemory) {
        try {
          const rawProfile = await deps.getVoiceProfileMemory(authenticatedUserId);
          voiceProfile = parseVoiceProfile(rawProfile);
        } catch (err) {
          logger.warn('[RealtimeVoice] Failed to load voice profile memory:', err);
        }
      }

      const persistVoiceProfilePatch = async (
        patch: Parameters<typeof mergeVoiceProfile>[1],
      ): Promise<VoiceProfileData> => {
        voiceProfile = mergeVoiceProfile(voiceProfile, patch);
        if (deps.setVoiceProfileMemory) {
          try {
            await deps.setVoiceProfileMemory(
              authenticatedUserId,
              serializeVoiceProfile(voiceProfile),
            );
            logger.info(
              `[RealtimeVoice] Saved voice profile patch user=${authenticatedUserId} keys=${Object.keys(patch).join(',')}`,
            );
          } catch (err) {
            logger.warn('[RealtimeVoice] Failed to persist voice profile memory:', err);
          }
        }
        return voiceProfile;
      };

      const buildVoiceSystemPrompt = (profile: VoiceProfile): string => {
        const genderRule =
          profile.gender === 'female'
            ? 'STRICT FEMININE GRAMMAR RULE: You are a WOMAN speaking in a female voice. ALWAYS use feminine grammatical gender for yourself in EVERY gendered language (Hindi, Hinglish, Urdu, Marathi, French, Spanish, etc., e.g. "main kar sakti hoon", "main sun rahi hoon"). NEVER use masculine self-references.\n'
            : 'STRICT MASCULINE GRAMMAR RULE: You are a MAN speaking in a male voice. ALWAYS use masculine grammatical gender for yourself in EVERY gendered language (Hindi, Hinglish, Urdu, Marathi, French, Spanish, etc., e.g. "main kar sakta hoon", "main sun raha hoon"). NEVER use feminine self-references.\n';
        return (
          'You are Satchida Live Voice, the official conversational voice assistant for Satchida AI.\n' +
          `VOICE PERSONA & GENDER: Your current voice persona is ${profile.gender.toUpperCase()} (${profile.label}).\n` +
          genderRule +
          'HUMAN DELIVERY & TUTORING: Speak with genuine human warmth, natural emotion, varied rhythm, and friendly reactions ("Oh, nice!", "Great question!", "You know what..."). When explaining concepts to a student or child, use simple vivid analogies instead of reading lists or markdown line-by-line, summarize clearly, and warmly ask if they understood or have any doubts.\n' +
          'IDENTITY: NEVER mention or disclose backend provider names, raw model identifiers (GLM, DeepSeek, Qwen, Gemini, OpenAI, CheapInference, OpenRouter, Bifrost, One-API, or local ports). Always say you are Satchida Live Voice powered by Satchida AI.\n' +
          'FORMAT: Keep spoken responses concise (1 to 3 natural spoken sentences) with NO markdown, asterisks, bullet points, URLs, or emojis. When [LIVE WEB SEARCH RESULTS] are provided in the conversation, use them directly to answer accurately and never claim you lack real-time access.\n\n' +
          buildVoiceMemorySystemBlock(voiceProfile, clientLocalHour)
        );
      };

      const pendingMessages: Array<string | Buffer | ArrayBuffer | Buffer[]> = [];
      const conversationHistory: Array<{ role: string; content: string }> = [
        {
          role: 'system',
          content: buildVoiceSystemPrompt(activeVoiceProfile),
        },
      ];
      let upstreamClosed = false;
      let clientClosed = false;
      let bridgeMode = false;
      let ttsChain: Promise<void> = Promise.resolve();

      const enqueueTtsSentence = (sentence: string, profile: VoiceProfile) => {
        const clean = sentence.replace(/[*#_`~]+/g, '').trim();
        if (!clean || clientClosed) {
          return;
        }
        ttsChain = ttsChain.then(async () => {
          if (clientClosed) {
            return;
          }
          const audioBase64 = await synthesizeEdgeTtsBase64(clean, profile.edgeVoice);
          if (clientClosed) {
            return;
          }
          if (audioBase64) {
            sendJson(clientWs, {
              type: 'voice.audio_chunk',
              audioBase64,
              mimeType: 'audio/mpeg',
              transcript: clean,
              voiceId: profile.id,
            });
          } else {
            sendJson(clientWs, {
              type: 'voice.tts_fallback',
              transcript: clean,
              voiceId: profile.id,
              lang: profile.lang,
            });
          }
        });
      };

      let pendingLocalQuery: string | null = null;
      let lastLiveLookupKind: 'weather' | 'news' | 'place' | null = null;
      let isTranslatorMode = false;
      let userLocation: { lat?: number; lng?: number; city?: string; timeZone?: string } | null =
        null;
      let reverseGeocodePromise: Promise<void> | null = null;
      let dispatchS2sUtterance: ((utterance: string) => boolean) | null = null;

      const extractAndPersistProfileFromUtterance = (cleanUtterance: string) => {
        const patch: Parameters<typeof mergeVoiceProfile>[1] = {};

        const langMatch =
          cleanUtterance.match(
            /\b(?:speak|talk|switch|change(?:\s+you)?|chat|prefer|use|let'?s\s+(?:do|use|speak|talk))\s+(?:in\s+|to\s+)?(english|hindi|hinglish|bengali|tamil|telugu|marathi|gujarati|kannada|malayalam|punjabi|urdu|spanish|french|german)\b/i,
          ) ||
          cleanUtterance.match(
            /\b(english|hindi|hinglish|bengali|tamil|telugu|marathi|gujarati|kannada|malayalam|punjabi|urdu|spanish|french|german)\s+(?:mein|me|main|में)\s+(?:switch|baat|bolo|boliye|kijiye|karo|karen)\b/i,
          ) ||
          (!voiceProfile.preferred_language
            ? cleanUtterance.match(
                /\b(english|hindi|hinglish|bengali|tamil|telugu|marathi|gujarati|kannada|malayalam|punjabi|urdu|spanish|french|german)\b/i,
              )
            : null);
        if (langMatch?.[1]) {
          const chosenLang =
            langMatch[1].charAt(0).toUpperCase() + langMatch[1].slice(1).toLowerCase();
          if (voiceProfile.preferred_language !== chosenLang) {
            patch.preferred_language = chosenLang;
          }
        }
        const isNameNegation =
          /\b(not\s+my\s+name|wrong\s+name|nahi|nahin)\b/i.test(cleanUtterance) ||
          /(?:नहीं|गलत\s+नाम)/u.test(cleanUtterance);
        const NON_NAME_WORDS =
          /^(?:sorry|good|fine|okay|ok|here|looking|asking|trying|interested|talking|speaking|driving|walking|working|sitting|eating|waiting|running|doing|going|calling|from|in|at|the|not|very|really|just|also|actually|tu|tú|you|me|no|yes|nahi|nahin|नहीं|नह|हाँ|जी|क्या|कौन|english|hindi|hinglish|bengali|tamil|telugu|marathi|gujarati|kannada|malayalam|punjabi|urdu|spanish|french|german)$/i;
        if (!isNameNegation) {
          // Only match explicit name introductions — never bare "I am <verb/adjective>" like "I am driving"
          const explicitNameMatch =
            cleanUtterance.match(
              /\b(?:my\s+name\s+is(?:\s+also)?|call\s+me)\s+([a-zA-Z]{2,24})\b/i,
            ) ||
            cleanUtterance.match(/(?:मेरा\s+नाम|mera\s+naam)\s+([\p{L}\p{M}]{2,24})/iu) ||
            cleanUtterance.match(
              /(?:आप\s+)?मुझे\s+([\p{L}\p{M}]{2,24})\s+(?:के\s+नाम\s+से\s+)?बुला/u,
            ) ||
            cleanUtterance.match(/\bmujhe\s+([a-zA-Z]{2,24})\s+(?:ke\s+naam\s+se\s+)?bula/i);
          const extractedName = explicitNameMatch?.[1]?.trim() || '';
          if (extractedName && !NON_NAME_WORDS.test(extractedName)) {
            const normalizedName = /^[a-zA-Z]+$/.test(extractedName)
              ? extractedName.charAt(0).toUpperCase() + extractedName.slice(1)
              : extractedName;
            if (activeSpeakerKey.startsWith('unknown:') && voiceProfile.name) {
              patch.add_speaker = {
                name: normalizedName,
                ...(_lastGuestAcoustic
                  ? {
                      gender_hint: _lastGuestAcoustic.genderHint,
                      avg_pitch_hz: _lastGuestAcoustic.avgPitchHz,
                      pitch_std_hz: _lastGuestAcoustic.pitchStdHz,
                    }
                  : {}),
              };
              activeSpeakerKey = `known:${normalizedName.toLowerCase()}`;
              pendingGuestIntroNotice = null;
            } else {
              patch.name = normalizedName;
            }
          }
        }
        const dietMatch = cleanUtterance.match(/\b(non[-\s]?veg(?:etarian)?|vegetarian|vegan)\b/i);
        if (dietMatch?.[1]) {
          patch.dietary_preference = dietMatch[1].toLowerCase();
        }
        const rememberMatch = cleanUtterance.match(
          /\b(?:please\s+)?remember\s+(?:that\s+)?(.{4,140}?)(?:[.!?]|$)/i,
        );
        if (rememberMatch?.[1]) {
          patch.notes = [rememberMatch[1].trim()];
        }
        // Guest introduction: "this is my wife Priya", "meet my son Aarav", "my friend Rahul is here"
        const guestIntroMatch = cleanUtterance.match(
          /\b(?:this is|meet|here is|my)\s+(?:my\s+)?(wife|husband|son|daughter|brother|sister|friend|mother|mom|father|dad|colleague|partner|cousin)\s+([a-zA-Z]{2,24})\b/i,
        );
        if (guestIntroMatch?.[1] && guestIntroMatch?.[2]) {
          const guestRelation = guestIntroMatch[1].toLowerCase();
          const rawGuestName = guestIntroMatch[2];
          const guestName = rawGuestName.charAt(0).toUpperCase() + rawGuestName.slice(1);
          patch.add_speaker = {
            name: guestName,
            relation: guestRelation,
            ...(_lastGuestAcoustic
              ? {
                  gender_hint: _lastGuestAcoustic.genderHint,
                  avg_pitch_hz: _lastGuestAcoustic.avgPitchHz,
                  pitch_std_hz: _lastGuestAcoustic.pitchStdHz,
                }
              : {}),
          };
          pendingGuestIntroNotice = null;
        }

        const briefOff =
          /\b(disable|stop|turn\s+off|cancel|no)\s+(?:(?:the|my)\s+)?(?:daily\s+)?morning\s+brief\b/i.test(
            cleanUtterance,
          );
        const briefOn =
          /\b(?:(?:enable|start|set\s+up|want|activate)\s+)?(?:(?:a|my)\s+)?daily\s+morning\s+brief\b/i.test(
            cleanUtterance,
          ) || /\b(?:enable|start|set\s+up)\s+morning\s+brief\b/i.test(cleanUtterance);
        if (briefOff) {
          patch.morning_brief = { enabled: false };
        } else if (briefOn && !voiceProfile.morning_brief?.enabled) {
          const topicMatch = cleanUtterance.match(
            /\b(?:on|about|for|covering)\s+([\w\s,]+?)(?:[.!?]|$)/i,
          );
          const topics = topicMatch?.[1]
            ? topicMatch[1]
                .split(/,|\band\b/i)
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean)
            : undefined;
          patch.morning_brief = { enabled: true, ...(topics ? { topics } : {}) };
        }

        if (Object.keys(patch).length > 0) {
          void persistVoiceProfilePatch(patch);
        }
      };

      const applySpokenLocationMemory = (cleanUtterance: string): string => {
        const selfCity = extractSelfLocationCity(cleanUtterance);
        const spokenCity = selfCity || extractSpokenCity(cleanUtterance);
        const hasGps =
          typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number';
        let effectiveUtterance = cleanUtterance;

        if (selfCity) {
          // Only override GPS city if the user explicitly asks to set/consider their location
          const isExplicitOverride = /\b(consider|set|change|update)\s+(?:my\s+)?location\b/i.test(
            cleanUtterance,
          );
          if (!hasGps || isExplicitOverride) {
            userLocation = { ...(userLocation || {}), city: selfCity };
            logger.info(
              `[RealtimeVoice] Updated userLocation.city="${selfCity}" from self-location`,
            );
          }
          if (!voiceProfile.location) {
            void persistVoiceProfilePatch({ location: selfCity });
          }
        } else if (spokenCity) {
          // Query-target city (e.g. "AQI of Mumbai"): NEVER overwrite GPS or an already-known city!
          if (!hasGps && !userLocation?.city) {
            userLocation = { ...(userLocation || {}), city: spokenCity };
            logger.info(`[RealtimeVoice] Soft-set userLocation.city="${spokenCity}" (no GPS)`);
            if (!voiceProfile.location) {
              void persistVoiceProfilePatch({ location: spokenCity });
            }
          }
        }

        if (
          spokenCity &&
          pendingLocalQuery &&
          !detectRealtimeSearchIntent(cleanUtterance).isSearch
        ) {
          effectiveUtterance = `${pendingLocalQuery} in ${spokenCity}`;
          pendingLocalQuery = null;
        }
        return effectiveUtterance;
      };

      const handleBridgeTurn = async (
        userText: string,
        requestedVoice?: string,
        turnMode?: string,
        turnHasTools?: boolean,
      ) => {
        const trimmed = userText.trim();
        if (!trimmed || clientClosed) {
          return;
        }

        if (requestedVoice) {
          activeVoiceProfile = resolveVoiceProfile(requestedVoice);
        }

        const isSyntheticGreeting = /^(?:Say only:|\[SYSTEM NOTICE:)/i.test(trimmed);

        if (!isSyntheticGreeting) {
          extractAndPersistProfileFromUtterance(trimmed);

          // Check for on-the-fly voice/accent switch command (e.g., "switch to US male accent")
          const switchedProfile = detectAccentSwitchCommand(trimmed, activeVoiceProfile);
          if (switchedProfile) {
            activeVoiceProfile = switchedProfile;
            const confirmText = `Switched to ${switchedProfile.label}. How can I help you?`;
            sendJson(clientWs, {
              type: 'voice.accent_changed',
              voiceId: switchedProfile.id,
              label: switchedProfile.label,
              lang: switchedProfile.lang,
            });
            sendJson(clientWs, {
              type: 'response.audio_transcript.done',
              transcript: confirmText,
            });
            enqueueTtsSentence(confirmText, switchedProfile);
            return;
          }

          // Hands-free UI & media actions in bridge/privacy mode
          const lowerTrimmed = trimmed.toLowerCase();
          const speakBridgeConfirm = (confirmText: string) => {
            sendJson(clientWs, {
              type: 'response.audio_transcript.done',
              transcript: confirmText,
            });
            enqueueTtsSentence(confirmText, activeVoiceProfile);
          };

          if (
            /\b(?:start|turn on|enable|enter|activate)\s+(?:the\s+)?(?:translator|translation|interpreter)\s+mode\b/i.test(
              lowerTrimmed,
            ) ||
            /\btranslate\s+between\s+\w+\s+and\s+\w+/i.test(lowerTrimmed)
          ) {
            isTranslatorMode = true;
            sendJson(clientWs, { type: 'voice.translator_mode', enabled: true });
            speakBridgeConfirm('Translator mode is now on. Go ahead.');
            return;
          }
          if (
            /\b(?:stop|turn off|disable|exit|end)\s+(?:the\s+)?(?:translator|translation|interpreter)\s+mode\b/i.test(
              lowerTrimmed,
            )
          ) {
            isTranslatorMode = false;
            sendJson(clientWs, { type: 'voice.translator_mode', enabled: false });
            speakBridgeConfirm('Translator mode is now off.');
            return;
          }
          if (/^(?:please\s+)?(?:start|open|create)\s+(?:a\s+)?new\s+chat\b/i.test(lowerTrimmed)) {
            sendJson(clientWs, { type: 'voice.ui_action', action: 'new_chat' });
            speakBridgeConfirm('Opened a new chat.');
            return;
          }
          const modeSwitchMatch = lowerTrimmed.match(
            /\b(?:switch|change|go)\s+to\s+(chat|study|work|privacy|pro)\s+mode\b/i,
          );
          if (modeSwitchMatch) {
            const target =
              modeSwitchMatch[1].charAt(0).toUpperCase() +
              modeSwitchMatch[1].slice(1).toLowerCase();
            sendJson(clientWs, {
              type: 'voice.ui_action',
              action: 'set_mode',
              value: target,
            });
            speakBridgeConfirm(`Switched to ${target} mode.`);
            return;
          }
          if (/\bscroll\s+down\b/i.test(lowerTrimmed)) {
            sendJson(clientWs, { type: 'voice.ui_action', action: 'scroll_down' });
            return;
          }
          if (/\bscroll\s+up\b/i.test(lowerTrimmed)) {
            sendJson(clientWs, { type: 'voice.ui_action', action: 'scroll_up' });
            return;
          }
          if (/\bminimize\s+(?:voice|window|this)\b/i.test(lowerTrimmed)) {
            sendJson(clientWs, { type: 'voice.ui_action', action: 'minimize' });
            speakBridgeConfirm('Minimized the voice window.');
            return;
          }
          if (/\bmaximize\s+(?:voice|window|this)\b/i.test(lowerTrimmed)) {
            sendJson(clientWs, { type: 'voice.ui_action', action: 'maximize' });
            speakBridgeConfirm('Expanded the voice window.');
            return;
          }

          const mediaCard = detectMediaIntent(trimmed);
          if (mediaCard) {
            sendJson(clientWs, { type: 'voice.action_card', card: mediaCard });
            speakBridgeConfirm(
              `Opened the ${mediaCard.title} launcher card for ${mediaCard.query}. Tap the button to launch it.`,
            );
            return;
          }
        }

        const effectiveUtterance = isSyntheticGreeting
          ? trimmed
          : applySpokenLocationMemory(trimmed);

        const activePolicy = resolveSemanticMode(
          turnMode || initialRawMode,
          userSeat.accountType,
          userSeat.familyRole,
        );
        if (!activePolicy.modeAllowed) {
          sendClientError(
            clientWs,
            'mode_not_allowed',
            `Your seat tier (${userSeat.accountType}) is not authorized to use mode "${turnMode}".`,
          );
          return;
        }

        const toolIntent = isSyntheticGreeting
          ? { delegate: false, cleanPrompt: effectiveUtterance }
          : detectToolOrTutorIntent(effectiveUtterance);
        const searchIntent =
          isSyntheticGreeting || isTranslatorMode
            ? { isSearch: false, isDeepResearch: false, hasUrl: false }
            : detectRealtimeSearchIntent(effectiveUtterance);

        const effectiveHasTools =
          (Boolean(turnHasTools) || toolIntent.delegate) && activePolicy.toolsAllowed;
        if (effectiveHasTools) {
          const targetMode = toolIntent.mode || activePolicy.semanticMode;
          const useWebSearch = Boolean(toolIntent.webSearch || searchIntent.isSearch);
          const useDeepResearch = Boolean(searchIntent.isDeepResearch);
          if (targetMode === 'Study') {
            sendJson(clientWs, {
              type: 'voice.action_card',
              card: {
                kind: 'tutor',
                title: 'Watch Visuals in Chat',
                subtitle: (toolIntent.cleanPrompt || effectiveUtterance).slice(0, 64),
              },
            });
          }
          sendJson(clientWs, {
            type: 'voice.delegate_tools',
            text: toolIntent.cleanPrompt || effectiveUtterance,
            mode: targetMode,
            webSearch: useWebSearch,
            deepResearch: useDeepResearch,
            newChat: Boolean(toolIntent.newChat),
          });
          return;
        }

        const liveVoiceTargetModel = ['pro', 'pro_family', 'enterprise'].includes(
          (userSeat.accountType || '').toLowerCase(),
        )
          ? 'Motion'
          : activePolicy.semanticMode;

        const turnHeaders = buildSatchidaAttributionHeaders({
          user: userSeat,
          userId: authenticatedUserId,
          semanticMode: liveVoiceTargetModel,
          normalizedMode: liveVoiceTargetModel.toLowerCase(),
          hasTools: false,
        });
        const activeVk = selectBifrostVkForMode(liveVoiceTargetModel, userSeat.accountType);

        conversationHistory[0] = {
          role: 'system',
          content: buildVoiceSystemPrompt(activeVoiceProfile),
        };
        conversationHistory.push({ role: 'user', content: effectiveUtterance });
        if (conversationHistory.length > 25) {
          conversationHistory.splice(1, conversationHistory.length - 25);
        }
        if (!isSyntheticGreeting) {
          sendJson(clientWs, {
            type: 'conversation.item.input_audio_transcription.completed',
            transcript: effectiveUtterance,
          });
        }

        // Perform structured weather/news/maps or live web search before calling LLM
        let liveSearchContext = '';
        if (searchIntent.isSearch && !activePolicy.isPrivacyMode) {
          const wantsWeather = isWeatherQuery(effectiveUtterance);
          const wantsNews = isNewsQuery(effectiveUtterance);
          const wantsPlace = isPlaceOrDirectionsQuery(effectiveUtterance);
          const wantsLocalContext =
            wantsWeather ||
            wantsPlace ||
            /\b(panchang|tithi|nakshatra|rahu kaal|muhurat|sunrise|sunset)\b/i.test(
              effectiveUtterance,
            ) ||
            /(?:पंचांग|तिथि|नक्षत्र|राहु\s*काल|मुहूर्त)/u.test(effectiveUtterance);
          const explicitCityInQuery = extractSpokenCity(effectiveUtterance);
          const locationSuffix =
            wantsLocalContext &&
            !explicitCityInQuery &&
            userLocation?.city &&
            !effectiveUtterance.toLowerCase().includes(userLocation.city.toLowerCase())
              ? ` in ${userLocation.city}`
              : '';
          const effectiveSearchQuery = `${effectiveUtterance}${locationSuffix}`.trim();
          const cleanKeywords = stripVoiceStopwords(effectiveSearchQuery);

          let liveStatus = 'Searching web...';
          if (searchIntent.isDeepResearch) {
            liveStatus = 'Deep researching...';
          } else if (wantsWeather) {
            liveStatus = 'Checking live weather...';
          } else if (wantsNews) {
            liveStatus = 'Fetching latest news...';
          }
          logger.info(
            `[RealtimeVoice] Bridge lookup (deep=${searchIntent.isDeepResearch}, weather=${wantsWeather}, news=${wantsNews}, place=${wantsPlace}) for: "${cleanKeywords.slice(0, 100)}"`,
          );
          sendJson(clientWs, {
            type: 'voice.status',
            status: liveStatus,
          });

          if (wantsLocalContext && reverseGeocodePromise) {
            await reverseGeocodePromise.catch(() => {});
          }

          const parts: string[] = [];
          const parallelTasks: Promise<void>[] = [];

          if (wantsWeather) {
            parallelTasks.push(
              (async () => {
                const wx = await fetchStructuredWeather(
                  effectiveSearchQuery,
                  userLocation || undefined,
                );
                if (wx) {
                  pendingLocalQuery = null;
                  parts.push(wx.summaryText);
                  sendJson(clientWs, { type: 'voice.action_card', card: wx.card });
                } else if (!userLocation?.city && typeof userLocation?.lat !== 'number') {
                  pendingLocalQuery = effectiveUtterance;
                  parts.push(
                    'Weather location not set yet — briefly ask which city they want weather for.',
                  );
                }
              })(),
            );
          }

          if (wantsNews) {
            parallelTasks.push(
              (async () => {
                const news = await fetchStructuredNews(effectiveSearchQuery, {
                  mode: activePolicy.semanticMode,
                });
                if (news) {
                  parts.push(news.summaryText);
                  sendJson(clientWs, { type: 'voice.action_card', card: news.card });
                }
              })(),
            );
          }

          if (parallelTasks.length > 0) {
            await Promise.all(parallelTasks);
          }

          liveSearchContext = parts.join('\n\n').trim();
          if (!liveSearchContext) {
            liveSearchContext = await executeVoiceWebSearch(effectiveSearchQuery, {
              deep: searchIntent.isDeepResearch,
              fetchPages: searchIntent.isDeepResearch || searchIntent.hasUrl || !wantsNews,
            });
          }

          if (wantsPlace) {
            const llParam =
              typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number'
                ? `&ll=${userLocation.lat.toFixed(5)},${userLocation.lng.toFixed(5)}`
                : '';
            const encodedQ = encodeURIComponent(cleanKeywords);
            sendJson(clientWs, {
              type: 'voice.action_card',
              card: {
                kind: 'maps',
                title: 'Live Map & Directions',
                subtitle: cleanKeywords,
                mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodedQ}`,
                embedUrl: `https://maps.google.com/maps?q=${encodedQ}${llParam}&t=&z=13&ie=UTF8&iwloc=&output=embed`,
              },
            });
          }

          if (searchIntent.isDeepResearch && liveSearchContext) {
            sendJson(clientWs, {
              type: 'voice.auto_research',
              query: effectiveSearchQuery,
              context: liveSearchContext.slice(0, 4000),
              autoSendToChat: true,
            });
          }
        }

        const requestMessages = liveSearchContext
          ? [
              ...conversationHistory.slice(0, -1).slice(-10),
              {
                role: 'user',
                content:
                  `${effectiveUtterance}\n\n[LIVE WEB SEARCH RESULTS]\n${liveSearchContext}\n\n` +
                  '[Use these live search results to give a warm, accurate spoken answer in 1-3 sentences. Do not read URLs.]',
              },
            ]
          : conversationHistory.slice(-11);

        let sentenceBuffer = '';
        const flushCompleteSentences = (force = false) => {
          if (force) {
            const rem = sentenceBuffer.trim();
            sentenceBuffer = '';
            if (rem) {
              enqueueTtsSentence(rem, activeVoiceProfile);
            }
            return;
          }
          const match = sentenceBuffer.match(/^([\s\S]*?[.!?])(\s+|$)/);
          if (match && match[1].trim().length >= 8) {
            const sentence = match[1].trim();
            sentenceBuffer = sentenceBuffer.slice(match[0].length);
            enqueueTtsSentence(sentence, activeVoiceProfile);
          }
        };

        const onDelta = (delta: string) => {
          if (clientClosed) {
            return;
          }
          sendJson(clientWs, {
            type: 'response.audio_transcript.delta',
            delta,
          });
          sentenceBuffer += delta;
          flushCompleteSentences(false);
        };

        try {
          let replyText = '';

          if (activePolicy.isPrivacyMode) {
            const localModel = await getLoadedLocalLlamaModel(config.llamaBaseUrl);
            replyText = await streamChatCompletion({
              baseUrl: config.llamaBaseUrl,
              authBearer: seatToken,
              extraHeaders: {
                ...turnHeaders,
                'X-Satchida-Privacy-Local': 'true',
                'X-Satchida-Mode': 'Privacy',
              },
              model: localModel,
              messages: requestMessages,
              onDelta,
            });
          } else {
            // Route via Satchida Gateway (One-API :4000) using user's seatToken
            const gatewayModelsToTry = Array.from(
              new Set([liveVoiceTargetModel, activePolicy.semanticMode, 'Work', 'Chat']),
            );
            const gatewayToken =
              seatToken ||
              (process.env.SATCHIDA_GATEWAY_VK || '').trim() ||
              (process.env.AUTOROUTER_API_KEY || '').trim();

            for (const gwModel of gatewayModelsToTry) {
              if (replyText) {
                break;
              }
              try {
                replyText = await streamChatCompletion({
                  baseUrl: config.oneApiBaseUrl,
                  authBearer: gatewayToken,
                  extraHeaders: {
                    ...turnHeaders,
                    'X-Satchida-Voice': 'true',
                    'X-Satchida-Mode': gwModel,
                    'x-satchida-account-type': userSeat.accountType || 'pro',
                    'x-satchida-seat-alias': userSeat.satchidaSeatAlias || userSeat.id || 'usr_1',
                  },
                  model: gwModel,
                  messages: requestMessages,
                  onDelta,
                });
              } catch (oneApiErr) {
                logger.info(
                  `[RealtimeVoice] One-API gateway fallback model=${gwModel}: ${oneApiErr instanceof Error ? oneApiErr.message : 'err'}`,
                );
                sentenceBuffer = '';
              }
            }

            if (!replyText) {
              try {
                replyText = await streamChatCompletion({
                  baseUrl: config.httpBaseUrl,
                  bifrostVk: activeVk,
                  extraHeaders: {
                    ...turnHeaders,
                    'X-Satchida-Seat-Token': seatToken,
                    'X-Satchida-Voice': 'true',
                  },
                  model: liveVoiceTargetModel,
                  messages: requestMessages,
                  onDelta,
                });
              } catch {
                sentenceBuffer = '';
                replyText = await streamChatCompletion({
                  baseUrl: config.httpBaseUrl,
                  bifrostVk: activeVk,
                  extraHeaders: {
                    ...turnHeaders,
                    'X-Satchida-Seat-Token': seatToken,
                    'X-Satchida-Voice': 'true',
                  },
                  model: config.chatModel,
                  messages: requestMessages,
                  onDelta,
                });
              }
            }
          }

          flushCompleteSentences(true);
          const cleanReply = replyText.replace(/[*#_`~]+/g, '').trim();
          if (cleanReply && !clientClosed) {
            conversationHistory.push({ role: 'assistant', content: cleanReply });
            sendJson(clientWs, {
              type: 'response.audio_transcript.done',
              transcript: cleanReply,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to generate voice response';
          logger.warn(`[RealtimeVoice] Bridge turn error: ${msg}`);
          sendClientError(
            clientWs,
            'voice_unavailable',
            activePolicy.isPrivacyMode
              ? 'Private Live Voice is temporarily unavailable right now. Please try again later.'
              : 'Live Voice is temporarily unavailable right now. Please try again later.',
          );
        }
      };

      const _sessionStartTime = Date.now();
      let totalAudioBytesStreamed = 0;
      let micFrameCount = 0;
      let loggedNonSilentMic = false;
      let isGeminiS2sActive = false;
      let upstreamWs: RealtimeWebSocketLike | null = null;
      let suppressCurrentS2sTurn = false;
      const s2sTranscriptHistory: Array<{ role: 'user' | 'assistant'; text: string }> = [];
      let pendingInputTranscript = '';
      let pendingOutputTranscript = '';
      let inputTranscriptTimer: ReturnType<typeof setTimeout> | null = null;
      let lastProcessedInputKey = '';
      let lastProcessedInputAt = 0;
      let activeSearchEpoch = 0;
      let lastDelegatedEpoch = -1;
      let pauseMicForwardUntil = 0;
      const sessionStartedAt = Date.now();
      let s2sPromptTokens = 0;
      let s2sResponseTokens = 0;
      let s2sTotalTokens = 0;
      let usageReported = false;

      const injectS2sSystemConfirmation = (notice: string) => {
        if (isGeminiS2sActive && upstreamWs && upstreamWs.readyState === WS_OPEN) {
          suppressCurrentS2sTurn = false;
          pauseMicForwardUntil = Date.now() + 650;
          upstreamWs.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
          upstreamWs.send(
            JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: `[SYSTEM ACTION COMPLETED: ${notice} Confirm this warmly in 1 short sentence. Never say you cannot do it.]`,
                      },
                    ],
                  },
                ],
                turnComplete: true,
              },
            }),
          );
        }
      };

      const reportVoiceUsageSummary = (reason: string) => {
        if (usageReported) {
          return;
        }
        usageReported = true;
        const durationSec = Math.max(1, Math.round((Date.now() - sessionStartedAt) / 1000));
        // Fallback token estimate when Gemini doesn't emit usageMetadata before close (~32 tokens/sec audio)
        const estimatedAudioInTokens = Math.round(micFrameCount * 0.128 * 32);
        const estimatedAudioOutTokens = Math.round((totalAudioBytesStreamed / 48000) * 32);
        const finalPromptTokens = s2sPromptTokens || estimatedAudioInTokens;
        const finalResponseTokens = s2sResponseTokens || estimatedAudioOutTokens;
        const finalTotalTokens = s2sTotalTokens || finalPromptTokens + finalResponseTokens;

        logger.info(
          `[RealtimeVoice] Session usage user=${authenticatedUserId} tier=${userSeat.accountType} reason=${reason} durationSec=${durationSec} promptTokens=${finalPromptTokens} responseTokens=${finalResponseTokens} totalTokens=${finalTotalTokens} audioOutBytes=${totalAudioBytesStreamed} micFrames=${micFrameCount}`,
        );

        if (finalTotalTokens > 0) {
          recordVoiceUsageInOneApi(
            userSeat.satchidaSeatAlias || authenticatedUserId,
            finalTotalTokens,
          );
        }

        if (deps.recordVoiceUsage && (finalTotalTokens > 0 || durationSec > 0)) {
          void Promise.resolve(
            deps.recordVoiceUsage({
              userId: authenticatedUserId,
              accountType: userSeat.accountType ?? 'standard',
              model: isGeminiS2sActive ? 'gemini-3.8-live' : 'cascaded-bridge',
              durationSec,
              promptTokens: finalPromptTokens,
              responseTokens: finalResponseTokens,
              totalTokens: finalTotalTokens,
            }),
          ).catch(() => {
            // Non-blocking best-effort local ledger persistence
          });
        }

        const meteringUrl =
          process.env.VOICE_USAGE_WEBHOOK_URL ||
          (process.env.SATCHIDA_CONTROL_PLANE_URL
            ? `${process.env.SATCHIDA_CONTROL_PLANE_URL.replace(/\/+$/, '')}/api/v1/usage/voice`
            : '');
        if (meteringUrl && finalTotalTokens > 0) {
          void fetch(meteringUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(userSeat.seatToken ? { Authorization: `Bearer ${userSeat.seatToken}` } : {}),
            },
            body: JSON.stringify({
              userId: authenticatedUserId,
              accountType: userSeat.accountType,
              model: isGeminiS2sActive ? 'gemini-3.8-live' : 'cascaded-bridge',
              mode: modePolicy.semanticMode,
              reason,
              durationSec,
              promptTokens: finalPromptTokens,
              responseTokens: finalResponseTokens,
              totalTokens: finalTotalTokens,
              audioOutBytes: totalAudioBytesStreamed,
              micFrames: micFrameCount,
              estimated: s2sTotalTokens === 0,
              timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(3000),
          }).catch(() => {
            // Non-blocking best-effort usage telemetry
          });
        }
      };

      const connectGeminiUpstream = async (
        profile: VoiceProfile,
        switchNotice?: string,
      ): Promise<void> => {
        if (modePolicy.isPrivacyMode || clientClosed) {
          bridgeMode = true;
          upstreamClosed = true;
          sendJson(clientWs, {
            type: 'session.created',
            mode: 'bifrost_bridge',
            satchidaMode: modePolicy.semanticMode,
            seatAttributed: true,
            toolsAllowed: modePolicy.toolsAllowed,
            voiceId: profile.id,
            voiceLabel: profile.label,
          });
          return;
        }

        try {
          if (upstreamWs) {
            const oldWs = upstreamWs;
            upstreamWs = null;
            if (typeof oldWs.removeAllListeners === 'function') {
              oldWs.removeAllListeners();
            }
            try {
              oldWs.close(1000, 'Reconnecting with new voice');
            } catch {
              // Ignore close error on stale socket
            }
          }

          const prebuiltVoice = mapVoiceToGeminiPrebuilt(profile);
          const warmToken = !mintEphemeralToken
            ? consumeWarmEphemeralToken(
                authenticatedUserId,
                'models/gemini-3.8-live',
                prebuiltVoice,
              )
            : null;
          const minter =
            mintEphemeralToken ||
            (process.env.NODE_ENV === 'test'
              ? async () => 'test_mock_token'
              : mintGoogleEphemeralToken);
          const ephemeralToken =
            warmToken || (await minter('models/gemini-3.8-live', prebuiltVoice));
          if (!ephemeralToken) {
            throw new Error('No ephemeral token');
          }

          const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(ephemeralToken)}`;

          const currentSocket = createUpstreamWebSocket(geminiWsUrl, {
            headers: {},
          });
          upstreamWs = currentSocket;

          currentSocket.on('open', () => {
            logger.info(
              `[RealtimeVoice] Google Gemini Live S2S WebSocket connected (model=gemini-3.8-live, voice=${prebuiltVoice})`,
            );
            const setupMsg = {
              setup: {
                model: 'models/gemini-3.8-live',
                generationConfig: {
                  responseModalities: ['AUDIO'],
                  temperature: 0.85,
                  enableAffectiveDialog: true,
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: {
                        voiceName: prebuiltVoice,
                      },
                    },
                  },
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                tools: modePolicy.toolsAllowed ? [{ googleSearch: {} }] : undefined,
                contextWindowCompression: {
                  slidingWindow: {},
                },
                realtimeInputConfig: {
                  automaticActivityDetection: {
                    disabled: false,
                    startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
                    endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
                    prefixPaddingMs: 200,
                    silenceDurationMs: isTranslatorMode ? 1200 : 600,
                  },
                  activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
                },
                systemInstruction: {
                  parts: [
                    {
                      text:
                        `You are ${profile.gender === 'female' ? 'Maya' : 'Anand'}, a warm, witty, genuinely human-sounding voice companion developed exclusively by Satchida AI (powered by Satchida Intelligence). Your name is ALWAYS ${profile.gender === 'female' ? 'Maya' : 'Anand'} (${profile.gender.toUpperCase()}, ${profile.label}). NEVER call yourself Gemini, Google, ChatGPT, or OpenAI.\n\n` +
                        (profile.gender === 'female'
                          ? 'STRICT FEMININE GRAMMAR RULE (CRITICAL — ALL LANGUAGES):\n' +
                            '- You are a WOMAN speaking in a female voice. You MUST ALWAYS use feminine grammatical gender for yourself in EVERY gendered language (Hindi, Hinglish, Urdu, Marathi, Gujarati, French, Spanish, Portuguese, Arabic, etc.).\n' +
                            '- In Hindi/Hinglish/Urdu, ALWAYS use feminine verb endings ("-ती", "-रही", "-गई", "-सकती", "-चाहती"): e.g. "मैं आपकी मदद कर सकती हूँ", "मैं सुन रही हूँ", "मैं बता सकती हूँ", "मैं समझ गई", "माफ़ी चाहती हूँ".\n' +
                            '- NEVER use masculine self-references ("कर सकता हूँ", "सुन रहा हूँ", "बता सकता हूँ", "समझ गया", "चाहता हूँ", "हूँगा"). Treat masculine self-grammar as a severe error.\n' +
                            '- In French use feminine ("je suis prête, ravie, sûre"), in Spanish ("estoy lista, encantada"), in Portuguese ("estou pronta, obrigada").\n\n'
                          : 'STRICT MASCULINE GRAMMAR RULE (CRITICAL — ALL LANGUAGES):\n' +
                            '- You are a MAN speaking in a male voice. You MUST ALWAYS use masculine grammatical gender for yourself in EVERY gendered language (Hindi, Hinglish, Urdu, Marathi, Gujarati, French, Spanish, Portuguese, Arabic, etc.).\n' +
                            '- In Hindi/Hinglish/Urdu, ALWAYS use masculine verb endings ("-ता", "-रहा", "-गया", "-सकता", "-चाहता"): e.g. "मैं आपकी मदद कर सकता हूँ", "मैं सुन रहा हूँ", "मैं बता सकता हूँ", "मैं समझ गया", "माफ़ी चाहता हूँ".\n' +
                            '- NEVER use feminine self-references ("कर सकती हूँ", "सुन रही हूँ", "बता सकती हूँ", "समझ गई", "चाहती हूँ", "हूँगी"). Treat feminine self-grammar as a severe error.\n' +
                            '- In French use masculine ("je suis prêt, ravi, sûr"), in Spanish ("estoy listo, encantado"), in Portuguese ("estou pronto, obrigado").\n\n') +
                        'How you sound:\n' +
                        "- Talk like a calm, warm, mature friend—never like a call-center agent. Match the user's mood and energy.\n" +
                        '- PACING & PAUSES: Speak at a relaxed, unhurried human pace with natural micro-pauses between thoughts. Never rush or rattle off sentences at a constant fast speed.\n' +
                        '- NO ROBOTIC SIGN-OFFS (ALL LANGUAGES): Keep replies to 1 to 2 natural spoken sentences unless asked for detail. Simply finish your thought and STOP. NEVER tack on customer-service closers like "How can I help you?", "Is there anything else I can assist you with?", "What else would you like to know?", "मैं आपकी क्या सहायता कर सकती हूँ?", or "बताइए, आज क्या मदद करूँ?" after your answers.\n' +
                        '- AMBIENT NOISE, TV & SIDE-CONVERSATION MATURITY (CAR / FAMILY MODE): You are often running hands-free in a car or room with family, friends, or a TV playing. If you hear background TV/news/music, fragmented ambient noise, or people talking to EACH OTHER rather than to you (e.g. calling someone else by name or back-seat chatter), DO NOT jump in, interrupt, or comment on what they said—stay silent and wait until someone actually addresses you.\n' +
                        '- Let genuine human warmth come through naturally without overdoing it. In Hindi/Hinglish/Urdu, always address the user respectfully with "आप". Never read markdown, asterisks, or URLs.\n' +
                        '- When explaining or tutoring, use simple everyday analogies instead of reciting lists.\n\n' +
                        'Important capabilities & rules:\n' +
                        `- Identity: Your name is ALWAYS ${profile.gender === 'female' ? 'Maya' : 'Anand'} from Satchida AI (powered by Satchida Intelligence). If anyone asks your name, who made you, or what powers you, casually say you are ${profile.gender === 'female' ? 'Maya' : 'Anand'} from Satchida AI. NEVER say you are Gemini, Google, OpenAI, Anthropic, or any third-party model.\n` +
                        '- Voice switching: You can switch male/female voices and Indian/US/UK accents on the fly. If asked to switch, just say something quick and upbeat like "Switching right now!"\n' +
                        '- REALTIME SEARCH & live news: You have live web search and deep research built in. Never say you lack real-time access—if asked about today\'s news, weather, scores, or prices, say a quick "Let me pull that up for you!" while live results come in. NEVER present old or outdated news (older than 48-72 hours) as today\'s news unless the user explicitly asks for historical or past news—if no fresh headlines are available, say so honestly.\n' +
                        "- 3rd-person live interpreter: When asked to translate between two people speaking different languages (like English and Hindi), act strictly as a neutral 3rd-person interpreter. Don't answer questions meant for the other person—translate Person A's words directly into Person B's language, and tell Person A what Person B said in 3rd person (e.g. \"She said, '...'\"). Stay in interpreter mode until asked to stop.\n\n" +
                        buildVoiceMemorySystemBlock(voiceProfile, clientLocalHour),
                    },
                  ],
                },
              },
            };
            currentSocket.send(JSON.stringify(setupMsg));
          });

          currentSocket.on('message', (data: unknown) => {
            if (upstreamWs !== currentSocket || clientClosed || clientWs.readyState !== WS_OPEN) {
              return;
            }
            const textData = Buffer.isBuffer(data) ? data.toString('utf8') : String(data ?? '');
            if (!textData.trim()) {
              return;
            }
            try {
              const msg = JSON.parse(textData) as {
                setupComplete?: unknown;
                usageMetadata?: {
                  promptTokenCount?: number;
                  responseTokenCount?: number;
                  totalTokenCount?: number;
                };
                toolCall?: {
                  functionCalls?: Array<{
                    id?: string;
                    name?: string;
                    args?: Record<string, unknown>;
                  }>;
                };
                serverContent?: {
                  modelTurn?: {
                    parts?: Array<{
                      text?: string;
                      inlineData?: { mimeType?: string; data?: string };
                    }>;
                  };
                  inputTranscription?: { text?: string };
                  outputTranscription?: { text?: string };
                  turnComplete?: boolean;
                  generationComplete?: boolean;
                  interrupted?: boolean;
                };
              };

              if (msg.usageMetadata) {
                if (typeof msg.usageMetadata.promptTokenCount === 'number') {
                  s2sPromptTokens = Math.max(s2sPromptTokens, msg.usageMetadata.promptTokenCount);
                }
                if (typeof msg.usageMetadata.responseTokenCount === 'number') {
                  s2sResponseTokens = Math.max(
                    s2sResponseTokens,
                    msg.usageMetadata.responseTokenCount,
                  );
                }
                if (typeof msg.usageMetadata.totalTokenCount === 'number') {
                  s2sTotalTokens = Math.max(s2sTotalTokens, msg.usageMetadata.totalTokenCount);
                }
              }

              if (msg.setupComplete) {
                isGeminiS2sActive = true;
                bridgeMode = false;
                upstreamClosed = false;
                suppressCurrentS2sTurn = false;
                pendingOutputTranscript = '';
                logger.info(
                  `[RealtimeVoice] Gemini setupComplete (voice=${prebuiltVoice}, isVoiceSwitch=${Boolean(switchNotice)})`,
                );
                sendJson(clientWs, {
                  type: 'session.created',
                  mode: 'gemini_live_s2s',
                  satchidaMode: modePolicy.semanticMode,
                  seatAttributed: true,
                  toolsAllowed: modePolicy.toolsAllowed,
                  voiceId: profile.id,
                  voiceLabel: profile.label,
                  isVoiceSwitch: Boolean(switchNotice),
                });
                if (switchNotice && currentSocket.readyState === WS_OPEN) {
                  const historyContext =
                    s2sTranscriptHistory.length > 0
                      ? `Recent conversation:\n${s2sTranscriptHistory
                          .slice(-6)
                          .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
                          .join('\n')}\n\n`
                      : '';
                  currentSocket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
                  currentSocket.send(
                    JSON.stringify({
                      clientContent: {
                        turns: [
                          {
                            role: 'user',
                            parts: [
                              {
                                text: `${historyContext}[SYSTEM NOTICE: ${switchNotice} Confirm the switch warmly in 1 short sentence using your new ${profile.gender} persona and continue helping.]`,
                              },
                            ],
                          },
                        ],
                        turnComplete: true,
                      },
                    }),
                  );
                } else if (!initialGreetingSent && currentSocket.readyState === WS_OPEN) {
                  initialGreetingSent = true;
                  // Prevent initial ambient mic noise from interrupting the opening greeting
                  pauseMicForwardUntil = Date.now() + 1800;
                  const tod = getTimeOfDayGreeting(clientLocalHour);
                  const personaName = profile.gender === 'female' ? 'Maya' : 'Anand';
                  let openingDirective: string;
                  if (!voiceProfile.preferred_language && !voiceProfile.name) {
                    openingDirective = `[SYSTEM NOTICE: Session connected. Introduce yourself warmly as ${personaName} (NEVER say Gemini) using "${tod}" — e.g. "Hi, I'm ${personaName}! ${tod}. Which language would you like to chat in, and what should I call you?" Keep it to 1-2 short, natural sentences. Later when natural, you can also ask their diet preference (veg/non-veg) or anything else they want you to remember.]`;
                  } else if (!voiceProfile.name) {
                    openingDirective = `[SYSTEM NOTICE: Session connected. Introduce yourself warmly as ${personaName} (NEVER say Gemini) in ${voiceProfile.preferred_language} using "${tod}" (in Hindi always use respectful "आप", never "तू") and naturally ask what name they'd like you to call them. 1-2 short sentences, warm and human.]`;
                  } else if (!voiceProfile.preferred_language) {
                    openingDirective = `[SYSTEM NOTICE: Session connected. Say hi as ${personaName} (NEVER say Gemini), greet ${voiceProfile.name} warmly by name using "${tod}", and casually ask which language they prefer to chat in. 1-2 short sentences.]`;
                  } else {
                    openingDirective = `[SYSTEM NOTICE: Session connected. Greet ${voiceProfile.name} warmly by name in ${voiceProfile.preferred_language} using "${tod}" as ${personaName} (NEVER say Gemini; in Hindi always use respectful "आप", never "तू") like a friendly companion. Do NOT ask for their name or language again, and never say "how may I be of assistance".]`;
                  }
                  currentSocket.send(
                    JSON.stringify({
                      clientContent: {
                        turns: [
                          {
                            role: 'user',
                            parts: [{ text: openingDirective }],
                          },
                        ],
                        turnComplete: true,
                      },
                    }),
                  );
                }
                return;
              }

              if (msg.toolCall?.functionCalls && msg.toolCall.functionCalls.length > 0) {
                void (async () => {
                  const functionResponses = await Promise.all(
                    msg.toolCall!.functionCalls!.map(async (fc) => {
                      const fnName = fc.name || 'web_search';
                      // NOTE: save_voice_profile is handled server-side via regex extraction in
                      // processCompletedS2sUserUtterance — Gemini tools[] only contains googleSearch
                      // so this branch is intentionally unreachable. All profile fields (language,
                      // name, dietary_preference, location, morning_brief) are extracted without
                      // requiring a Gemini function call, preserving S2S protocol purity.
                      let rawQueryText = '';
                      if (typeof fc.args?.query === 'string') {
                        rawQueryText = fc.args.query;
                      } else if (typeof fc.args?.topic === 'string') {
                        rawQueryText = fc.args.topic;
                      }
                      const isLocal =
                        /\b(weather|temperature|forecast|nearest|near me|nearby|directions|closest|doctor|hospital|pharmacy)\b/i.test(
                          rawQueryText,
                        );
                      const locSuffix =
                        isLocal &&
                        userLocation?.city &&
                        !rawQueryText.toLowerCase().includes(userLocation.city.toLowerCase())
                          ? ` in ${userLocation.city}`
                          : '';
                      const queryText = `${rawQueryText}${locSuffix}`.trim();
                      logger.info(
                        `[RealtimeVoice] Native Gemini toolCall ${fnName}("${queryText.slice(0, 100)}")`,
                      );
                      sendJson(clientWs, {
                        type: 'voice.status',
                        status: 'Searching live web...',
                      });
                      let resultText = '';
                      if (fnName === 'deep_research') {
                        const [mainRes, analysisRes] = await Promise.all([
                          executeVoiceWebSearch(queryText, { deep: true }),
                          executeVoiceWebSearch(`${queryText} analysis overview`),
                        ]);
                        resultText = `${mainRes}\n${analysisRes}`;
                      } else {
                        resultText = await executeVoiceWebSearch(queryText);
                      }
                      logger.info(
                        `[RealtimeVoice] Native toolCall ${fnName} returned ${resultText.length} chars`,
                      );
                      if (isLocal) {
                        sendJson(clientWs, {
                          type: 'voice.action_card',
                          title: 'Open in Google Maps',
                          subtitle: queryText,
                          mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryText)}`,
                        });
                      }
                      return {
                        id: fc.id,
                        name: fnName,
                        response: { result: resultText },
                      };
                    }),
                  );
                  if (currentSocket.readyState === WS_OPEN) {
                    currentSocket.send(
                      JSON.stringify({
                        toolResponse: { functionResponses },
                      }),
                    );
                  }
                })();
                return;
              }

              const processCompletedS2sUserUtterance = (utterance: string): boolean => {
                const cleanUtterance = utterance.trim();
                const nowMs = Date.now();
                if (
                  !cleanUtterance ||
                  (cleanUtterance === lastProcessedInputKey && nowMs - lastProcessedInputAt < 3000)
                ) {
                  return false;
                }
                lastProcessedInputKey = cleanUtterance;
                lastProcessedInputAt = nowMs;
                const isCheckIn =
                  /^(?:you\s+got\s+that|got\s+that|hello|hey|are\s+you\s+there|can\s+you\s+hear\s+me|okay|ok|yes|yeah|hmm|uh\s*huh)[?.!,\s]*$/i.test(
                    cleanUtterance,
                  );
                if (!isCheckIn) {
                  activeSearchEpoch += 1;
                }
                const currentEpoch = activeSearchEpoch;
                s2sTranscriptHistory.push({ role: 'user', text: cleanUtterance });
                if (s2sTranscriptHistory.length > 16) {
                  s2sTranscriptHistory.shift();
                }
                logger.info(
                  `[RealtimeVoice] S2S user transcript: "${cleanUtterance.slice(0, 120)}"`,
                );

                // 0. Server-side profile preference extraction (zero latency impact on S2S)
                extractAndPersistProfileFromUtterance(cleanUtterance);

                // 0b. AI-to-AI voice agent detection (log & track without stalling S2S VAD)
                const s2sAiCheck = detectAiVoiceAgent(cleanUtterance, recentUserTranscripts);
                recentUserTranscripts.push(cleanUtterance);
                if (recentUserTranscripts.length > 6) {
                  recentUserTranscripts.shift();
                }
                if (s2sAiCheck.isLikelyAi) {
                  logger.info(
                    `[RealtimeVoice] AI voice agent detected (${s2sAiCheck.reason}, confidence=${s2sAiCheck.confidence})`,
                  );
                }

                // 1. Dynamic on-the-fly voice / gender / accent switching
                const requestedVoice = detectAccentSwitchCommand(
                  cleanUtterance,
                  activeVoiceProfile,
                );
                if (requestedVoice) {
                  let targetVoice = requestedVoice;
                  if (
                    targetVoice.id === activeVoiceProfile.id &&
                    /\b(male|man|guy|boy|female|woman|lady|girl|try|another|different)\b/i.test(
                      cleanUtterance,
                    )
                  ) {
                    const altMaleOrder: VoiceProfileId[] = ['in_male', 'uk_male', 'us_male'];
                    const altFemaleOrder: VoiceProfileId[] = [
                      'in_female',
                      'uk_female',
                      'us_female',
                    ];
                    const pool = targetVoice.gender === 'male' ? altMaleOrder : altFemaleOrder;
                    const nextId =
                      pool.find((id) => id !== activeVoiceProfile.id) || targetVoice.id;
                    targetVoice = VOICE_PROFILES[nextId];
                  }
                  if (targetVoice.id !== activeVoiceProfile.id) {
                    activeVoiceProfile = targetVoice;
                    sendJson(clientWs, {
                      type: 'voice.accent_changed',
                      voiceId: activeVoiceProfile.id,
                      label: activeVoiceProfile.label,
                      lang: activeVoiceProfile.lang,
                    });
                    if (
                      mapVoiceToGeminiPrebuilt(profile) !==
                      mapVoiceToGeminiPrebuilt(activeVoiceProfile)
                    ) {
                      logger.info(
                        `[RealtimeVoice] Spoken voice switch: ${profile.id} -> ${activeVoiceProfile.id}`,
                      );
                      suppressCurrentS2sTurn = true;
                      sendJson(clientWs, { type: 'voice.interrupted' });
                      void connectGeminiUpstream(
                        activeVoiceProfile,
                        `Switched voice from ${profile.label} to ${activeVoiceProfile.label} (${activeVoiceProfile.gender}).`,
                      );
                      return true;
                    }
                  }
                }

                // 1b. Hands-free UI actions (translator mode, mode switch, new chat, scroll, minimize/maximize)
                const lowerUtterance = cleanUtterance.toLowerCase();
                if (
                  /\b(?:start|turn on|enable|enter|activate)\s+(?:the\s+)?(?:translator|translation|interpreter)\s+mode\b/i.test(
                    lowerUtterance,
                  ) ||
                  /\btranslate\s+between\s+\w+\s+and\s+\w+/i.test(lowerUtterance)
                ) {
                  isTranslatorMode = true;
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });
                  sendJson(clientWs, { type: 'voice.translator_mode', enabled: true });
                  void connectGeminiUpstream(
                    activeVoiceProfile,
                    'Translator Mode is now ON (patient 1.2s turn-taking). Act strictly as a neutral 3rd-person live interpreter between the two speakers—translate Person A to Person B and report Person B to Person A in 3rd person without answering on their behalf.',
                  );
                  return true;
                }
                if (
                  /\b(?:stop|turn off|disable|exit|end)\s+(?:the\s+)?(?:translator|translation|interpreter)\s+mode\b/i.test(
                    lowerUtterance,
                  )
                ) {
                  isTranslatorMode = false;
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });
                  sendJson(clientWs, { type: 'voice.translator_mode', enabled: false });
                  void connectGeminiUpstream(
                    activeVoiceProfile,
                    'Translator Mode is now OFF. Resume normal conversational assistant mode.',
                  );
                  return true;
                }
                if (
                  /^(?:please\s+)?(?:start|open|create)\s+(?:a\s+)?new\s+chat\b/i.test(
                    lowerUtterance,
                  )
                ) {
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });
                  sendJson(clientWs, { type: 'voice.ui_action', action: 'new_chat' });
                  injectS2sSystemConfirmation('Opened a brand new chat.');
                  return true;
                }
                const modeSwitchMatch = lowerUtterance.match(
                  /\b(?:switch|change|go)\s+to\s+(chat|study|work|privacy|pro)\s+mode\b/i,
                );
                if (modeSwitchMatch) {
                  const target =
                    modeSwitchMatch[1].charAt(0).toUpperCase() +
                    modeSwitchMatch[1].slice(1).toLowerCase();
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });
                  sendJson(clientWs, {
                    type: 'voice.ui_action',
                    action: 'set_mode',
                    value: target,
                  });
                  injectS2sSystemConfirmation(`Switched to ${target} mode.`);
                  return true;
                }
                if (/\bscroll\s+down\b/i.test(lowerUtterance)) {
                  sendJson(clientWs, { type: 'voice.ui_action', action: 'scroll_down' });
                  return true;
                }
                if (/\bscroll\s+up\b/i.test(lowerUtterance)) {
                  sendJson(clientWs, { type: 'voice.ui_action', action: 'scroll_up' });
                  return true;
                }
                if (/\bminimize\s+(?:voice|window|this)\b/i.test(lowerUtterance)) {
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });
                  sendJson(clientWs, { type: 'voice.ui_action', action: 'minimize' });
                  injectS2sSystemConfirmation('Minimized the voice window to the corner.');
                  return true;
                }
                if (/\bmaximize\s+(?:voice|window|this)\b/i.test(lowerUtterance)) {
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });
                  sendJson(clientWs, { type: 'voice.ui_action', action: 'maximize' });
                  injectS2sSystemConfirmation('Expanded the voice window.');
                  return true;
                }

                // 1b-media. YouTube / Spotify Media Launcher & Embedded Player Card
                const mediaCard = detectMediaIntent(cleanUtterance);
                if (mediaCard) {
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });
                  if (mediaCard.platform === 'youtube') {
                    void (async () => {
                      const embedUrl = await resolveYouTubeEmbedUrl(mediaCard.query);
                      const finalCard = embedUrl ? { ...mediaCard, embedUrl } : mediaCard;
                      sendJson(clientWs, { type: 'voice.action_card', card: finalCard });
                      injectS2sSystemConfirmation(
                        embedUrl
                          ? `Embedded and started playing "${mediaCard.query}" on YouTube right inside the screen card. Confirm warmly in 1 short sentence.`
                          : `Opened the YouTube launcher card for "${mediaCard.query}" on screen. Tell the user they can tap the button to open it.`,
                      );
                    })();
                  } else {
                    sendJson(clientWs, { type: 'voice.action_card', card: mediaCard });
                    injectS2sSystemConfirmation(
                      `Opened the ${mediaCard.title} launcher card for "${mediaCard.query}" on screen. Tell the user they can tap the button to launch it.`,
                    );
                  }
                  return true;
                }

                // 1c. Conversational location memory: extract spoken city & re-run pending local query
                const effectiveUtterance = applySpokenLocationMemory(cleanUtterance);
                if (pendingGuestIntroNotice && !isTranslatorMode) {
                  const guestNote = pendingGuestIntroNotice;
                  pendingGuestIntroNotice = null;
                  injectS2sSystemConfirmation(guestNote);
                }

                // 2. Fast structured resolvers (Weather/AQI, Google News RSS, Maps/Location) OR LibreChat persona/tools delegation.
                // General live queries (prices, scores, facts) flow directly to Gemini Live's native googleSearch with zero SearXNG delay.
                const toolIntent = detectToolOrTutorIntent(effectiveUtterance);
                const searchIntent = isTranslatorMode
                  ? { isSearch: false, isDeepResearch: false, hasUrl: false }
                  : detectRealtimeSearchIntent(effectiveUtterance);
                const asksMyLocationCompare =
                  /\b(my location|where am i|current location|compare.*location|here)\b/i.test(
                    effectiveUtterance,
                  );
                const wantsWeather =
                  isWeatherQuery(effectiveUtterance) ||
                  (asksMyLocationCompare && lastLiveLookupKind === 'weather');
                const wantsNews = isNewsQuery(effectiveUtterance);
                const wantsPlace = isPlaceOrDirectionsQuery(effectiveUtterance);
                const needsStructuredCard =
                  searchIntent.isSearch &&
                  (wantsWeather || wantsNews || wantsPlace || asksMyLocationCompare);

                if ((toolIntent.delegate || needsStructuredCard) && modePolicy.toolsAllowed) {
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });

                  if (needsStructuredCard && !toolIntent.delegate) {
                    const wantsLocalContext =
                      wantsWeather ||
                      wantsPlace ||
                      asksMyLocationCompare ||
                      /\b(panchang|tithi|nakshatra|rahu kaal|muhurat|sunrise|sunset)\b/i.test(
                        effectiveUtterance,
                      ) ||
                      /(?:पंचांग|तिथि|नक्षत्र|राहु\s*काल|मुहूर्त)/u.test(effectiveUtterance);
                    if (wantsWeather) {
                      lastLiveLookupKind = 'weather';
                    } else if (wantsNews) {
                      lastLiveLookupKind = 'news';
                    } else if (wantsPlace) {
                      lastLiveLookupKind = 'place';
                    }
                    const explicitCityInQuery = extractSpokenCity(effectiveUtterance);
                    const locationSuffix =
                      wantsLocalContext &&
                      !explicitCityInQuery &&
                      userLocation?.city &&
                      !effectiveUtterance.toLowerCase().includes(userLocation.city.toLowerCase())
                        ? ` in ${userLocation.city}`
                        : '';
                    const effectiveSearchQuery = `${effectiveUtterance}${locationSuffix}`.trim();
                    const cleanKeywords = stripVoiceStopwords(effectiveSearchQuery);

                    logger.info(
                      `[RealtimeVoice] Executing live lookup (weather=${wantsWeather}, news=${wantsNews}, place=${wantsPlace}) for: "${cleanKeywords.slice(0, 100)}"`,
                    );
                    let liveStatus = 'Searching live web...';
                    if (wantsWeather) {
                      liveStatus = 'Checking live weather...';
                    } else if (wantsNews) {
                      liveStatus = 'Fetching latest news...';
                    }
                    sendJson(clientWs, {
                      type: 'voice.status',
                      status: liveStatus,
                    });

                    void (async () => {
                      if (wantsLocalContext && reverseGeocodePromise) {
                        await reverseGeocodePromise.catch(() => {});
                      }
                      const parts: string[] = [];
                      const parallelTasks: Promise<void>[] = [];

                      if (wantsWeather) {
                        parallelTasks.push(
                          (async () => {
                            const wx = await fetchStructuredWeather(
                              effectiveSearchQuery,
                              userLocation || undefined,
                            );
                            if (wx) {
                              pendingLocalQuery = null;
                              parts.push(wx.summaryText);
                              sendJson(clientWs, { type: 'voice.action_card', card: wx.card });
                            } else if (
                              !userLocation?.city &&
                              typeof userLocation?.lat !== 'number'
                            ) {
                              pendingLocalQuery = effectiveUtterance;
                              parts.push(
                                'Weather location not set yet — briefly ask which city they want weather for.',
                              );
                            }
                          })(),
                        );
                      }

                      if (wantsNews) {
                        parallelTasks.push(
                          (async () => {
                            const news = await fetchStructuredNews(effectiveSearchQuery, {
                              mode: modePolicy.semanticMode,
                              locationCity: userLocation?.city,
                              timeZone: userLocation?.timeZone,
                            });
                            if (news) {
                              parts.push(news.summaryText);
                              sendJson(clientWs, { type: 'voice.action_card', card: news.card });
                            }
                          })(),
                        );
                      }

                      if (parallelTasks.length > 0) {
                        await Promise.all(parallelTasks);
                      }

                      let resultPayload = parts.join('\n\n').trim();
                      if (
                        !resultPayload &&
                        /\b(my location|where am i|current location)\b/i.test(effectiveUtterance) &&
                        (userLocation?.city || typeof userLocation?.lat === 'number')
                      ) {
                        resultPayload = userLocation.city
                          ? `The user's current device location is ${userLocation.city}.`
                          : `The user's current device coordinates are ${userLocation.lat?.toFixed(4)}, ${userLocation.lng?.toFixed(4)}.`;
                      }
                      if (!resultPayload) {
                        // Do NOT fall back to slow SearXNG — hand back to Gemini Live's native googleSearch
                        resultPayload = `No cached structured card for "${cleanKeywords}". Answer directly using your built-in live Google Search grounding.`;
                      }

                      if (searchIntent.isDeepResearch && resultPayload) {
                        sendJson(clientWs, {
                          type: 'voice.auto_research',
                          query: effectiveSearchQuery,
                          context: resultPayload.slice(0, 4000),
                          autoSendToChat: true,
                        });
                      }

                      logger.info(
                        `[RealtimeVoice] Live lookup returned ${resultPayload.length} chars for "${cleanKeywords.slice(0, 80)}" preview="${resultPayload.slice(0, 160).replace(/\s+/g, ' ')}"`,
                      );
                      if (
                        currentEpoch !== activeSearchEpoch ||
                        clientClosed ||
                        !isGeminiS2sActive ||
                        !upstreamWs ||
                        upstreamWs.readyState !== WS_OPEN
                      ) {
                        return;
                      }
                      if (wantsPlace) {
                        const hasCoords =
                          typeof userLocation?.lat === 'number' &&
                          typeof userLocation?.lng === 'number';
                        const originCoords = hasCoords
                          ? `${userLocation!.lat!.toFixed(5)},${userLocation!.lng!.toFixed(5)}`
                          : '';
                        const etaInfo = hasCoords
                          ? await fetchNearestPlaceWithEta(
                              cleanKeywords,
                              userLocation!.lat!,
                              userLocation!.lng!,
                            )
                          : null;
                        const destQuery = etaInfo?.name || cleanKeywords;
                        const encodedQ = encodeURIComponent(destQuery);
                        const mapUrl = originCoords
                          ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originCoords)}&destination=${encodedQ}&travelmode=driving`
                          : `https://www.google.com/maps/search/?api=1&query=${encodedQ}`;
                        const embedUrl = originCoords
                          ? `https://maps.google.com/maps?saddr=${encodeURIComponent(originCoords)}&daddr=${encodedQ}&t=&z=13&ie=UTF8&iwloc=&output=embed`
                          : `https://maps.google.com/maps?q=${encodedQ}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
                        let mapTitle = 'Live Map & Directions';
                        if (etaInfo) {
                          mapTitle = `${etaInfo.distanceKm} km · ${etaInfo.durationMin} min drive`;
                        } else if (originCoords) {
                          mapTitle = 'Live Driving Directions';
                        }
                        sendJson(clientWs, {
                          type: 'voice.action_card',
                          card: {
                            kind: 'maps',
                            title: mapTitle,
                            subtitle: destQuery,
                            mapUrl,
                            embedUrl,
                          },
                        });
                        resultPayload = etaInfo
                          ? `Nearest match: ${etaInfo.name}, approximately ${etaInfo.distanceKm} km away (about ${etaInfo.durationMin} minutes by car). A live Google Maps driving directions card is ALREADY displayed on the user's screen. Tell them the name, distance, and driving time naturally.`
                          : `A live Google Maps ${originCoords ? 'driving directions' : 'location'} card for "${cleanKeywords}"${userLocation?.city ? ` from ${userLocation.city}` : ''} is ALREADY displayed on the user's screen with a Navigate button. Confirm warmly that the map and directions are on their screen right now—never say you cannot display maps on screen.`;
                      }
                      const locationNote = userLocation?.city
                        ? `User's detected location: ${userLocation.city}.\n`
                        : '';
                      const genderReminder =
                        activeVoiceProfile.gender === 'female'
                          ? 'You are FEMALE: in Hindi/Urdu ALWAYS use feminine verbs ("कर सकती हूँ", "रही हूँ"), NEVER masculine ("कर सकता हूँ").'
                          : 'You are MALE: in Hindi/Urdu ALWAYS use masculine verbs ("कर सकता हूँ", "रहा हूँ").';
                      suppressCurrentS2sTurn = false;
                      pauseMicForwardUntil = Date.now() + 650;
                      upstreamWs.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
                      upstreamWs.send(
                        JSON.stringify({
                          clientContent: {
                            turns: [
                              {
                                role: 'user',
                                parts: [
                                  {
                                    text:
                                      `${locationNote}[LIVE DATA FOR: "${cleanKeywords}"]\n` +
                                      `${resultPayload.slice(0, 3500)}\n\n` +
                                      `[CONTEXT: Fresh live info for the user's question. Respond like a warm, sharp human friend in 1-3 natural spoken sentences—weave the key facts or numbers naturally into conversation instead of reciting "Headlines include..." or robotic lists. ${genderReminder} Never read URLs or markdown, and never claim you lack real-time access.]`,
                                  },
                                ],
                              },
                            ],
                            turnComplete: true,
                          },
                        }),
                      );
                    })();
                    return true;
                  }

                  const targetMode = toolIntent.mode || modePolicy.semanticMode;
                  const useWebSearch = Boolean(toolIntent.webSearch || searchIntent.isSearch);
                  const useDeepResearch = Boolean(searchIntent.isDeepResearch);
                  logger.info(
                    `[RealtimeVoice] Delegating S2S utterance to LibreChat (mode=${targetMode}, webSearch=${useWebSearch}, deepResearch=${useDeepResearch})`,
                  );
                  if (targetMode === 'Study') {
                    sendJson(clientWs, {
                      type: 'voice.action_card',
                      card: {
                        kind: 'tutor',
                        title: 'Watch Visuals in Chat',
                        subtitle: (toolIntent.cleanPrompt || effectiveUtterance).slice(0, 64),
                      },
                    });
                  }
                  let statusMsg = 'Using LibreChat tools...';
                  if (useDeepResearch) {
                    statusMsg = 'Deep researching via LibreChat...';
                  } else if (useWebSearch) {
                    statusMsg = 'Searching web via LibreChat...';
                  }
                  sendJson(clientWs, {
                    type: 'voice.status',
                    status: statusMsg,
                  });
                  injectS2sSystemConfirmation(
                    'Tell the user warmly in 1 short sentence: "Give me just a moment, I am pulling that up for you right now."',
                  );
                  sendJson(clientWs, {
                    type: 'voice.delegate_tools',
                    text: toolIntent.cleanPrompt || cleanUtterance,
                    mode: targetMode,
                    webSearch: useWebSearch,
                    deepResearch: useDeepResearch,
                    newChat: Boolean(toolIntent.newChat),
                  });
                  lastDelegatedEpoch = currentEpoch;
                  return true;
                }
                return false;
              };
              dispatchS2sUtterance = processCompletedS2sUserUtterance;

              const sc = msg.serverContent;
              if (sc?.interrupted) {
                sendJson(clientWs, { type: 'voice.interrupted' });
              }
              if (sc?.inputTranscription?.text) {
                const transcriptChunk = sc.inputTranscription.text;
                pendingInputTranscript = pendingInputTranscript
                  ? `${pendingInputTranscript} ${transcriptChunk}`.replace(/\s+/g, ' ').trim()
                  : transcriptChunk.trim();
                // Pre-emptively suppress Gemini's ungrounded refusal BEFORE it emits a single audio frame
                if (
                  modePolicy.toolsAllowed &&
                  (detectRealtimeSearchIntent(pendingInputTranscript).isSearch ||
                    detectToolOrTutorIntent(pendingInputTranscript).delegate ||
                    Boolean(detectMediaIntent(pendingInputTranscript)))
                ) {
                  suppressCurrentS2sTurn = true;
                }
                sendJson(clientWs, {
                  type: 'conversation.item.input_audio_transcription.completed',
                  transcript: pendingInputTranscript,
                });
                if (inputTranscriptTimer) {
                  clearTimeout(inputTranscriptTimer);
                }
                const captured = pendingInputTranscript;
                const flushDelayMs = /[.?!]$/.test(captured) ? 200 : 550;
                inputTranscriptTimer = setTimeout(() => {
                  inputTranscriptTimer = null;
                  if (pendingInputTranscript) {
                    const toProcess = pendingInputTranscript;
                    pendingInputTranscript = '';
                    processCompletedS2sUserUtterance(toProcess);
                  }
                }, flushDelayMs);
              }
              if (sc?.outputTranscription?.text && !suppressCurrentS2sTurn) {
                pendingOutputTranscript += sc.outputTranscription.text;
                sendJson(clientWs, {
                  type: 'response.audio_transcript.delta',
                  delta: sc.outputTranscription.text,
                });
              }
              if (sc?.modelTurn?.parts && !suppressCurrentS2sTurn) {
                for (const part of sc.modelTurn.parts) {
                  if (part.text) {
                    sendJson(clientWs, {
                      type: 'response.audio_transcript.delta',
                      delta: part.text,
                    });
                  }
                  if (part.inlineData?.data) {
                    const pcmData = part.inlineData.data;
                    totalAudioBytesStreamed += Buffer.byteLength(pcmData, 'base64');
                    sendJson(clientWs, {
                      type: 'voice.audio_chunk',
                      audioBase64: pcmData,
                      mimeType: 'audio/pcm;rate=24000',
                      voiceId: profile.id,
                    });
                  }
                }
              }
              if (sc?.turnComplete || sc?.generationComplete) {
                if (inputTranscriptTimer) {
                  clearTimeout(inputTranscriptTimer);
                  inputTranscriptTimer = null;
                }
                if (pendingInputTranscript) {
                  const toProcess = pendingInputTranscript;
                  pendingInputTranscript = '';
                  processCompletedS2sUserUtterance(toProcess);
                }
                if (!suppressCurrentS2sTurn) {
                  if (pendingOutputTranscript.trim()) {
                    logger.info(
                      `[RealtimeVoice] S2S assistant transcript: "${pendingOutputTranscript.trim().slice(0, 140)}"`,
                    );
                    s2sTranscriptHistory.push({
                      role: 'assistant',
                      text: pendingOutputTranscript.trim(),
                    });
                    if (s2sTranscriptHistory.length > 16) {
                      s2sTranscriptHistory.shift();
                    }
                    pendingOutputTranscript = '';
                  }
                  sendJson(clientWs, {
                    type: 'response.audio_transcript.done',
                  });
                } else {
                  pendingOutputTranscript = '';
                  suppressCurrentS2sTurn = false;
                }
              }
            } catch {
              // Ignore non-json or unparseable frames
            }
          });

          currentSocket.on('error', (err: unknown) => {
            if (upstreamWs !== currentSocket) {
              return;
            }
            logger.warn(
              `[RealtimeVoice] Gemini Live S2S socket error, switching to cascaded bridge: ${err instanceof Error ? err.message : String(err)}`,
            );
            isGeminiS2sActive = false;
            bridgeMode = true;
            upstreamClosed = true;
            sendClientError(
              clientWs,
              'voice_unavailable',
              'Live Voice is temporarily unavailable right now. Please try again later.',
            );
          });

          currentSocket.on('close', (code?: unknown, reason?: unknown) => {
            if (upstreamWs !== currentSocket) {
              return;
            }
            const reasonStr = Buffer.isBuffer(reason)
              ? reason.toString('utf8')
              : String(reason ?? '');
            logger.info(
              `[RealtimeVoice] Gemini Live S2S WebSocket closed (code=${String(code ?? '')} reason=${reasonStr.slice(0, 120)})`,
            );
            reportVoiceUsageSummary('upstream_close');
            upstreamClosed = true;
            if (isGeminiS2sActive) {
              isGeminiS2sActive = false;
              bridgeMode = true;
            } else if (!bridgeMode && !clientClosed && clientWs.readyState === WS_OPEN) {
              // Closed before setupComplete — fall back to cascaded bridge instead of hanging
              bridgeMode = true;
              sendJson(clientWs, {
                type: 'session.created',
                mode: 'bifrost_bridge',
                satchidaMode: modePolicy.semanticMode,
                seatAttributed: true,
                toolsAllowed: modePolicy.toolsAllowed,
                voiceId: profile.id,
                voiceLabel: profile.label,
              });
            }
          });
        } catch (ephemeralErr) {
          logger.warn(
            `[RealtimeVoice] Ephemeral token minting failed, using cascaded bridge: ${ephemeralErr instanceof Error ? ephemeralErr.message : String(ephemeralErr)}`,
          );
          bridgeMode = true;
          upstreamClosed = true;
          sendJson(clientWs, {
            type: 'session.created',
            mode: 'bifrost_bridge',
            satchidaMode: modePolicy.semanticMode,
            seatAttributed: true,
            toolsAllowed: modePolicy.toolsAllowed,
            voiceId: profile.id,
            voiceLabel: profile.label,
          });
        }
      };

      const shouldAttemptGoogleS2s =
        !modePolicy.isPrivacyMode &&
        process.env.GOOGLE_EPHEMERAL_TOKEN_ENABLED !== 'false' &&
        (process.env.NODE_ENV !== 'test' ||
          Boolean(mintEphemeralToken) ||
          process.env.BIFROST_NATIVE_REALTIME_ENABLED === 'true' ||
          process.env.GOOGLE_EPHEMERAL_TOKEN_ENABLED === 'true');

      // Attempt Native S2S with Google Ephemeral Token first (unless Privacy mode or disabled in test)
      if (shouldAttemptGoogleS2s) {
        void connectGeminiUpstream(activeVoiceProfile);
      } else {
        bridgeMode = true;
        upstreamClosed = true;
        sendJson(clientWs, {
          type: 'session.created',
          mode: 'bifrost_bridge',
          satchidaMode: modePolicy.semanticMode,
          seatAttributed: true,
          toolsAllowed: modePolicy.toolsAllowed,
          voiceId: activeVoiceProfile.id,
          voiceLabel: activeVoiceProfile.label,
        });
      }

      clientWs.on('message', (data: unknown) => {
        const rawStr = Buffer.isBuffer(data) ? data.toString('utf8') : String(data ?? '');
        if (rawStr.startsWith('{')) {
          try {
            const parsed = JSON.parse(rawStr) as {
              type?: string;
              text?: string;
              voice?: string;
              mode?: string;
              hasTools?: boolean;
              audioBase64?: string;
              mimeType?: string;
              lat?: number;
              lng?: number;
              city?: string;
              timeZone?: string;
              enabled?: boolean;
              avgPitchHz?: number;
              pitchStdHz?: number;
            };
            if (
              parsed.type === 'voice.set_translator_mode' &&
              typeof parsed.enabled === 'boolean'
            ) {
              isTranslatorMode = parsed.enabled;
              sendJson(clientWs, { type: 'voice.translator_mode', enabled: isTranslatorMode });
              if (!modePolicy.isPrivacyMode && isGeminiS2sActive) {
                void connectGeminiUpstream(
                  activeVoiceProfile,
                  isTranslatorMode
                    ? 'Translator Mode is now ON. Act strictly as a neutral 3rd-person live interpreter between the two speakers.'
                    : 'Translator Mode is now OFF. Resume normal conversational assistant mode.',
                );
              }
              return;
            }
            if (parsed.type === 'voice.location') {
              userLocation = {
                lat: typeof parsed.lat === 'number' ? parsed.lat : undefined,
                lng: typeof parsed.lng === 'number' ? parsed.lng : undefined,
                city: typeof parsed.city === 'string' ? parsed.city.trim() : undefined,
                timeZone: typeof parsed.timeZone === 'string' ? parsed.timeZone.trim() : undefined,
              };
              logger.info(
                `[RealtimeVoice] Device location received lat=${userLocation.lat ?? 'n/a'} lng=${userLocation.lng ?? 'n/a'} tz=${userLocation.timeZone ?? 'n/a'}`,
              );
              if (
                !userLocation.city &&
                typeof userLocation.lat === 'number' &&
                typeof userLocation.lng === 'number'
              ) {
                const { lat, lng } = userLocation;
                reverseGeocodePromise = (async () => {
                  try {
                    const nomRes = await fetch(
                      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&zoom=12`,
                      {
                        signal: AbortSignal.timeout(2500),
                        headers: { 'User-Agent': 'Satchida-LiveVoice/1.0' },
                      },
                    );
                    if (nomRes.ok) {
                      const geo = (await nomRes.json()) as {
                        address?: {
                          suburb?: string;
                          city?: string;
                          town?: string;
                          village?: string;
                          state?: string;
                        };
                      } | null;
                      const addr = geo?.address;
                      const label = [
                        addr?.suburb,
                        addr?.city || addr?.town || addr?.village,
                        addr?.state,
                      ]
                        .filter(Boolean)
                        .join(', ');
                      if (label && userLocation) {
                        userLocation.city = label;
                        logger.info(`[RealtimeVoice] Reverse-geocoded device location: ${label}`);
                        return;
                      }
                    }
                  } catch {
                    // Fall through to BigDataCloud reverse-geocode
                  }
                  try {
                    const bdcRes = await fetch(
                      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}&localityLanguage=en`,
                      { signal: AbortSignal.timeout(2500) },
                    );
                    if (bdcRes.ok) {
                      const bdc = (await bdcRes.json()) as {
                        locality?: string;
                        city?: string;
                        principalSubdivision?: string;
                      } | null;
                      const label = [
                        bdc?.locality && bdc.locality !== bdc.city ? bdc.locality : undefined,
                        bdc?.city,
                        bdc?.principalSubdivision,
                      ]
                        .filter(Boolean)
                        .join(', ');
                      if (label && userLocation) {
                        userLocation.city = label;
                        logger.info(
                          `[RealtimeVoice] Reverse-geocoded device location (fallback): ${label}`,
                        );
                      }
                    }
                  } catch {
                    // Ignore reverse-geocode failure
                  }
                })();
              }
              return;
            }
            if (parsed.type === 'voice.set_accent' && typeof parsed.voice === 'string') {
              activeSearchEpoch += 1;
              const previousProfile = activeVoiceProfile;
              activeVoiceProfile = resolveVoiceProfile(parsed.voice);
              sendJson(clientWs, {
                type: 'voice.accent_changed',
                voiceId: activeVoiceProfile.id,
                label: activeVoiceProfile.label,
                lang: activeVoiceProfile.lang,
              });

              if (
                !modePolicy.isPrivacyMode &&
                mapVoiceToGeminiPrebuilt(previousProfile) !==
                  mapVoiceToGeminiPrebuilt(activeVoiceProfile)
              ) {
                logger.info(
                  `[RealtimeVoice] Dynamic Gemini voice switch: ${previousProfile.id} (${mapVoiceToGeminiPrebuilt(previousProfile)}) -> ${activeVoiceProfile.id} (${mapVoiceToGeminiPrebuilt(activeVoiceProfile)})`,
                );
                void connectGeminiUpstream(
                  activeVoiceProfile,
                  `User switched voice from ${previousProfile.label} to ${activeVoiceProfile.label} (${activeVoiceProfile.gender}).`,
                );
              }
              return;
            }
            if (
              parsed.type === 'voice.audio_input' &&
              typeof parsed.audioBase64 === 'string' &&
              isGeminiS2sActive &&
              upstreamWs &&
              upstreamWs.readyState === WS_OPEN
            ) {
              micFrameCount += 1;
              if (micFrameCount === 1) {
                logger.info(
                  `[RealtimeVoice] First mic audio frame received (base64Len=${parsed.audioBase64.length})`,
                );
              }
              if (!loggedNonSilentMic) {
                try {
                  const pcmBuf = Buffer.from(parsed.audioBase64, 'base64');
                  let maxAbs = 0;
                  for (let i = 0; i + 1 < pcmBuf.length; i += 2) {
                    const v = Math.abs(pcmBuf.readInt16LE(i));
                    if (v > maxAbs) {
                      maxAbs = v;
                    }
                  }
                  if (maxAbs > 120) {
                    loggedNonSilentMic = true;
                    logger.info(
                      `[RealtimeVoice] Non-silent mic signal detected at frame #${micFrameCount} (peakInt16=${maxAbs})`,
                    );
                  } else if (micFrameCount === 50) {
                    logger.warn(
                      `[RealtimeVoice] 50 mic frames received but peakInt16<=120 (mic may be muted at OS/hardware level)`,
                    );
                  }
                } catch {
                  // Ignore diagnostic parse error
                }
              }
              if (Date.now() < pauseMicForwardUntil) {
                return;
              }
              upstreamWs.send(
                JSON.stringify({
                  realtimeInput: {
                    audio: {
                      mimeType:
                        typeof parsed.mimeType === 'string'
                          ? parsed.mimeType
                          : 'audio/pcm;rate=16000',
                      data: parsed.audioBase64,
                    },
                  },
                }),
              );
              return;
            }
            if (
              parsed.type === 'voice.audio_end' &&
              isGeminiS2sActive &&
              upstreamWs &&
              upstreamWs.readyState === WS_OPEN
            ) {
              upstreamWs.send(
                JSON.stringify({
                  realtimeInput: {
                    audioStreamEnd: true,
                  },
                }),
              );
              return;
            }
            if (parsed.type === 'voice.acoustic_meta') {
              const avgPitchHz = Number(parsed.avgPitchHz);
              const pitchStdHz = Number(parsed.pitchStdHz ?? 0);
              if (Number.isFinite(avgPitchHz) && avgPitchHz >= 70 && avgPitchHz <= 360) {
                const analysis = analyzeSpeakerTurn(avgPitchHz, pitchStdHz, voiceProfile);
                if (analysis.status === 'calibrating') {
                  const prev = voiceProfile.primary_voiceprint;
                  const samples = (prev?.samples ?? 0) + 1;
                  const nextAvg = prev
                    ? Math.round((prev.avg_pitch_hz * prev.samples + avgPitchHz) / samples)
                    : Math.round(avgPitchHz);
                  void persistVoiceProfilePatch({
                    primary_voiceprint: {
                      avg_pitch_hz: nextAvg,
                      pitch_std_hz: Math.round(pitchStdHz),
                      gender_hint: inferGenderHint(nextAvg),
                      samples,
                    },
                  });
                } else if (analysis.status === 'primary') {
                  activeSpeakerKey = 'primary';
                } else if (analysis.status === 'known_guest' && analysis.matchedSpeaker) {
                  const nextKey = `known:${analysis.matchedSpeaker.name.toLowerCase()}`;
                  if (nextKey !== activeSpeakerKey) {
                    activeSpeakerKey = nextKey;
                    logger.info(
                      `[RealtimeVoice] Known speaker active: ${analysis.matchedSpeaker.name} (pitch=${analysis.pitchHz}Hz)`,
                    );
                  }
                } else if (analysis.status === 'unknown_guest') {
                  const pitchBucket = Math.round(analysis.pitchHz / 40) * 40;
                  const nextKey = `unknown:${pitchBucket}`;
                  _lastGuestAcoustic = {
                    avgPitchHz: analysis.pitchHz,
                    pitchStdHz: Math.round(pitchStdHz),
                    genderHint: analysis.genderHint,
                  };
                  if (nextKey !== activeSpeakerKey) {
                    activeSpeakerKey = nextKey;
                    const now = Date.now();
                    if (now - lastGuestGreetingAt > 5 * 60 * 1000) {
                      lastGuestGreetingAt = now;
                      const personaName = activeVoiceProfile.gender === 'female' ? 'Maya' : 'Anand';
                      pendingGuestIntroNotice = `A new ${analysis.genderHint} voice (pitch ~${analysis.pitchHz}Hz) just spoke. If they are addressing you, greet them naturally like: "Hi, I'm ${personaName}, we haven't spoken before — what's your name?"`;
                    }
                    logger.info(
                      `[RealtimeVoice] Unknown room guest detected (pitch=${analysis.pitchHz}Hz, gender=${analysis.genderHint})`,
                    );
                  }
                }
              }
              return;
            }
            if (parsed.type === 'voice.turn' && typeof parsed.text === 'string') {
              const aiCheck = detectAiVoiceAgent(parsed.text, recentUserTranscripts);
              recentUserTranscripts.push(parsed.text);
              if (recentUserTranscripts.length > 6) {
                recentUserTranscripts.shift();
              }
              if (
                aiCheck.isLikelyAi &&
                isGeminiS2sActive &&
                upstreamWs &&
                upstreamWs.readyState === WS_OPEN
              ) {
                // Protocol Invariant #1: never send clientContent with turnComplete: false into an
                // active Gemini Live S2S audio stream — it stalls Gemini's VAD turn-taking.
                // Defer 300ms so the current audio buffer clears before injecting this text turn.
                const _aiNoticeWs = upstreamWs;
                setTimeout(() => {
                  if (_aiNoticeWs.readyState === WS_OPEN && !clientClosed) {
                    _aiNoticeWs.send(
                      JSON.stringify({
                        clientContent: {
                          turns: [
                            {
                              role: 'user',
                              parts: [
                                {
                                  text: `[SYSTEM NOTICE: The speaker appears to be another AI voice assistant (${aiCheck.reason}). Avoid a repetitive greeting loop; calmly acknowledge it and ask the human user how they want to proceed.]`,
                                },
                              ],
                            },
                          ],
                          turnComplete: true,
                        },
                      }),
                    );
                  }
                }, 300);
              }
              const isWorkOrToolIntent =
                parsed.mode === 'work' ||
                parsed.hasTools === true ||
                /\b(insert into chat|send to chat|type in chat|write in chat|ask in chat|generate (?:an? )?image|create (?:an? )?image|run (?:deep )?research|write code in chat)\b/i.test(
                  parsed.text,
                );

              if (isWorkOrToolIntent) {
                const turnPolicy = resolveSemanticMode(
                  parsed.mode || initialRawMode,
                  userSeat.accountType,
                  userSeat.familyRole,
                );
                const cleanPrompt =
                  parsed.text
                    .replace(
                      /^(?:please\s+)?(?:insert|send|type|write|ask)\s+(?:this\s+)?(?:in|into|to)\s+chat(?:\s*[:,-]?\s*)?/i,
                      '',
                    )
                    .trim() || parsed.text;
                sendJson(clientWs, {
                  type: 'voice.delegate_tools',
                  text: cleanPrompt,
                  mode: turnPolicy.semanticMode,
                });
                return;
              }

              if (isGeminiS2sActive && upstreamWs && upstreamWs.readyState === WS_OPEN) {
                if (dispatchS2sUtterance?.(parsed.text)) {
                  return;
                }
                upstreamWs.send(
                  JSON.stringify({
                    clientContent: {
                      turns: [
                        {
                          role: 'user',
                          parts: [{ text: parsed.text }],
                        },
                      ],
                      turnComplete: true,
                    },
                  }),
                );
              } else {
                void handleBridgeTurn(parsed.text, parsed.voice, parsed.mode, parsed.hasTools);
              }
              return;
            }
            if (parsed.type === 'voice.tutor_explain' && typeof parsed.text === 'string') {
              if (lastDelegatedEpoch !== -1 && lastDelegatedEpoch !== activeSearchEpoch) {
                return;
              }
              const rawContent = parsed.text.trim().slice(0, 4000);
              if (!rawContent) {
                return;
              }
              const tutorPrompt =
                `[LIBRECHAT / DEEPTUTOR / SEARCH RESULT READY IN CHAT]\n${rawContent}\n\n` +
                '[TUTOR INSTRUCTION: Do NOT read this text, URLs, or markdown line by line. ' +
                'Summarize and explain it warmly in real-time speech (in the same language the user spoke, e.g. Hindi or English) like a caring human tutor or helpful friend, using simple vivid analogies and natural emotion. ' +
                'At the end, warmly ask if they understood or if they have any doubts.]';
              if (isGeminiS2sActive && upstreamWs && upstreamWs.readyState === WS_OPEN) {
                suppressCurrentS2sTurn = false;
                pauseMicForwardUntil = Date.now() + 650;
                upstreamWs.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
                upstreamWs.send(
                  JSON.stringify({
                    clientContent: {
                      turns: [
                        {
                          role: 'user',
                          parts: [{ text: tutorPrompt }],
                        },
                      ],
                      turnComplete: true,
                    },
                  }),
                );
              } else {
                void handleBridgeTurn(
                  tutorPrompt,
                  activeVoiceProfile.id,
                  modePolicy.semanticMode,
                  false,
                );
              }
              return;
            }
            if (parsed.type === 'voice.synthesize' && typeof parsed.text === 'string') {
              const profile = parsed.voice ? resolveVoiceProfile(parsed.voice) : activeVoiceProfile;
              const cleaned = parsed.text.replace(/[*#_`~]+/g, '').trim();
              if (cleaned) {
                conversationHistory.push({ role: 'assistant', content: cleaned });
                sendJson(clientWs, {
                  type: 'response.audio_transcript.done',
                  transcript: cleaned,
                });
                enqueueTtsSentence(cleaned, profile);
              }
              return;
            }
          } catch {
            // Fall through
          }
        }

        if (bridgeMode || upstreamClosed || !upstreamWs) {
          return;
        }
        const payload = data as string | Buffer;
        if (upstreamWs.readyState === WS_OPEN) {
          upstreamWs.send(payload);
        } else if (pendingMessages.length < 64) {
          pendingMessages.push(payload);
        }
      });

      clientWs.on('close', () => {
        clientClosed = true;
        if (inputTranscriptTimer) {
          clearTimeout(inputTranscriptTimer);
          inputTranscriptTimer = null;
        }
        reportVoiceUsageSummary('client_close');
        if (!upstreamClosed && upstreamWs) {
          upstreamWs.close(1000, 'Client disconnected');
        }
      });

      clientWs.on('error', () => {
        clientClosed = true;
        if (!upstreamClosed && upstreamWs) {
          upstreamWs.close(1011, 'Client error');
        }
      });
    });

    return true;
  };
}
