import fs from 'fs';
import path from 'path';
import http from 'http';
import os from 'os';
import { spawn } from 'child_process';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { logger } from '@librechat/data-schemas';
import {
  stripVoiceStopwords,
  extractSpokenCity,
  isPlaceOrDirectionsQuery,
  isWeatherQuery,
  isNewsQuery,
  fetchStructuredWeather,
  fetchStructuredNews,
  detectMediaIntent,
} from './liveResolvers';

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
  } else if (/\b(female|woman|lady|girl)\b/.test(lower) && !/\bstill\s+(?:a\s+)?female\b/.test(lower)) {
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
  const lower = text.trim().toLowerCase();
  const hasUrl = /https?:\/\/\S+/i.test(text);
  const isDeepResearch =
    /\b(deep research|research in detail|comprehensive research|thorough research|investigate deeply|full report on)\b/i.test(
      lower,
    );
  const isSearch =
    isDeepResearch ||
    hasUrl ||
    /\b(weather|temperature|forecast|aqi|air quality|traffic|gas station|fuel|petrol|ev charger|parking|news|headlines|live score|score|who won|stock price|share price|bitcoin|crypto|exchange rate|price of|rate of|gold|silver|nifty|sensex|panchang|tithi|nakshatra|rahu kaal|muhurat|sunrise|sunset|search the web|search for|look up|google|find out|what happened|breaking|nearest|near me|nearby|directions to|how to reach|closest|my location|where am i|current location)\b/i.test(
      lower,
    ) ||
    /(?:न्यूज़|समाचार|खबर|खबरें|मौसम|तापमान|भाव|कीमत|सोना|चांदी|शेयर|ताजा|आज\s+का|पंचांग|तिथि|नक्षत्र|राहु\s*काल|मुहूर्त)/u.test(
      text,
    ) ||
    /\b(latest|today'?s|current|currently)\s+(news|headlines|updates|score|scores|price|prices|rate|rates|weather|events|results|match)\b/i.test(
      lower,
    );
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
    /\b(insert into chat|send to chat|type in chat|write in chat|ask in chat|generate (?:an? )?image|create (?:an? )?image|write code in chat|use librechat|new chat)\b/i.test(
      lower,
    );

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
    webSearch: wantsDeepTutorOrStudy || /\b(web|search|animation|visual|latest|online|fetch)\b/i.test(lower),
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
    throw new Error(
      `Failed to mint ephemeral token (status ${res.status}): ${text.slice(0, 200)}`,
    );
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
    res: { status: (code: number) => { json: (body: unknown) => void }; json: (body: unknown) => void },
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

function recordVoiceUsageInOneApi(
  seatAliasOrId: string,
  outputTokens: number,
): void {
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
    return normalizedTier === 'privacy' ? (vks.zdr || vks.retaining) : (vks.retaining || vks.workStudy);
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
    'okay', 'ok', 'hey', 'hi', 'hello', 'please', 'well', 'so', 'um', 'uh', 'then',
    'can', 'could', 'would', 'will', 'are', 'you', 'able', 'to', 'provide', 'give',
    'tell', 'me', 'check', 'find', 'search', 'get', 'show', 'with', 'i', 'want',
    'need', 'like', 'know', 'hear', 'see', 'about', 'the', 'a', 'an', 'some', 'any',
    'for', 'of', 'is', 'my', 'your',
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
        const snippets = [
          ...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi),
        ].slice(0, 5);
        for (const s of snippets) {
          const txt = (s[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
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
            const txt = (s[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
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
    const model = requestedModel || config.model;

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
      const modeVk = selectBifrostVkForMode(modePolicy.semanticMode, userSeat.accountType);
      const attributionHeaders = buildSatchidaAttributionHeaders({
        user: userSeat,
        userId: authenticatedUserId,
        semanticMode: modePolicy.semanticMode,
        normalizedMode: modePolicy.normalizedMode,
        hasTools: initialHasTools && modePolicy.toolsAllowed,
      });

      logger.info(
        `[RealtimeVoice] Session start user=${authenticatedUserId} tier=${userSeat.accountType} mode=${modePolicy.semanticMode} voice=${activeVoiceProfile.id}`,
      );

      const buildVoiceSystemPrompt = (profile: VoiceProfile): string =>
        'You are Satchida Live Voice, the official conversational voice assistant for Satchida AI.\n' +
        `VOICE PERSONA & GENDER: Your current voice persona is ${profile.gender.toUpperCase()} (${profile.label}). Always speak as a ${profile.gender} persona and use ${profile.gender === 'female' ? 'feminine' : 'masculine'} grammatical forms and self-references (especially in Hindi, Hinglish, Urdu, etc., e.g. "main kar ${profile.gender === 'female' ? 'sakti' : 'sakta'} hoon").\n` +
        'HUMAN DELIVERY & TUTORING: Speak with genuine human warmth, natural emotion, varied rhythm, and friendly reactions ("Oh, nice!", "Great question!", "You know what..."). When explaining concepts to a student or child, use simple vivid analogies instead of reading lists or markdown line-by-line, summarize clearly, and warmly ask if they understood or have any doubts.\n' +
        'IDENTITY: NEVER mention or disclose backend provider names, raw model identifiers (GLM, DeepSeek, Qwen, Gemini, OpenAI, CheapInference, OpenRouter, Bifrost, One-API, or local ports). Always say you are Satchida Live Voice powered by Satchida AI.\n' +
        'FORMAT: Keep spoken responses concise (1 to 3 natural spoken sentences) with NO markdown, asterisks, bullet points, URLs, or emojis. When [LIVE WEB SEARCH RESULTS] are provided in the conversation, use them directly to answer accurately and never claim you lack real-time access.';

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

        const effectiveHasTools = Boolean(turnHasTools) && activePolicy.toolsAllowed;
        if (effectiveHasTools) {
          sendJson(clientWs, {
            type: 'voice.delegate_tools',
            text: trimmed,
            mode: activePolicy.semanticMode,
          });
          return;
        }

        const liveVoiceTargetModel =
          ['pro', 'pro_family', 'enterprise'].includes(
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
        conversationHistory.push({ role: 'user', content: trimmed });
        sendJson(clientWs, {
          type: 'conversation.item.input_audio_transcription.completed',
          transcript: trimmed,
        });

        // Perform live web search / web fetch / deep research if needed before calling One-API
        const searchIntent = detectRealtimeSearchIntent(trimmed);
        let liveSearchContext = '';
        if (searchIntent.isSearch && !activePolicy.isPrivacyMode) {
          logger.info(
            `[RealtimeVoice] Executing server-side web search (deep=${searchIntent.isDeepResearch}, hasUrl=${searchIntent.hasUrl}) for: "${trimmed.slice(0, 100)}"`,
          );
          sendJson(clientWs, {
            type: 'voice.status',
            status: searchIntent.isDeepResearch ? 'Deep researching...' : 'Searching web...',
          });
          liveSearchContext = await executeVoiceWebSearch(trimmed, {
            deep: searchIntent.isDeepResearch,
            fetchPages: searchIntent.isDeepResearch || searchIntent.hasUrl,
          });
        }

        const requestMessages = liveSearchContext
          ? [
              ...conversationHistory.slice(0, -1).slice(-10),
              {
                role: 'user',
                content:
                  `${trimmed}\n\n[LIVE WEB SEARCH RESULTS]\n${liveSearchContext}\n\n` +
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

      const sessionStartTime = Date.now();
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
      let pendingLocalQuery: string | null = null;
      const sessionStartedAt = Date.now();
      let s2sPromptTokens = 0;
      let s2sResponseTokens = 0;
      let s2sTotalTokens = 0;
      let usageReported = false;
      let userLocation: { lat?: number; lng?: number; city?: string; timeZone?: string } | null =
        null;
      let reverseGeocodePromise: Promise<void> | null = null;

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
        const estimatedAudioInTokens = Math.round((micFrameCount * 0.128) * 32);
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
              accountType: userSeat.accountType,
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
            ? consumeWarmEphemeralToken(authenticatedUserId, 'models/gemini-3.8-live', prebuiltVoice)
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

          const geminiWsUrl =
            `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(ephemeralToken)}`;

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
                    startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                    endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
                    prefixPaddingMs: 120,
                    silenceDurationMs: 400,
                  },
                  activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
                },
                systemInstruction: {
                  parts: [
                    {
                      text:
                        `You are Satchida Live Voice, a warm, witty, genuinely human-sounding voice companion developed exclusively by Satchida AI (powered by Satchida Intelligence). You are currently speaking as a ${profile.gender} persona (${profile.label}), so always use ${profile.gender === 'female' ? 'feminine' : 'masculine'} self-references and grammar in gendered languages like Hindi or Hinglish (for example, "main kar ${profile.gender === 'female' ? 'sakti' : 'sakta'} hoon").\n\n` +
                        'How you sound:\n' +
                        '- Talk like a sharp, warm friend—natural, expressive, and to the point. Match the user\'s energy.\n' +
                        '- Keep every reply crisp and concise: 1 to 2 short spoken sentences max unless the user explicitly asks for a detailed explanation. Never ramble and NEVER end with robotic sign-offs like "Is there anything else I can help you with today?".\n' +
                        '- Let natural human emotion come through (a light chuckle when funny, warm empathy when needed) without overdoing it. Never read markdown, asterisks, or URLs.\n' +
                        '- When explaining or tutoring, use simple everyday analogies instead of reciting lists.\n\n' +
                        'Important capabilities & rules:\n' +
                        '- Identity: If anyone asks your name, who made you, or what powers you, casually say your name is Satchida (Satchida Live Voice), powered by Satchida Intelligence from Satchida AI. Never say you don\'t have a name, and never mention Google, Gemini, OpenAI, Anthropic, or any third-party model.\n' +
                        '- Voice switching: You can switch male/female voices and Indian/US/UK accents on the fly. If asked to switch, just say something quick and upbeat like "Switching right now!"\n' +
                        '- REALTIME SEARCH & live news: You have live web search and deep research built in. Never say you lack real-time access—if asked about today\'s news, weather, scores, or prices, say a quick "Let me pull that up for you!" while live results come in. NEVER present old or outdated news (older than 48-72 hours) as today\'s news unless the user explicitly asks for historical or past news—if no fresh headlines are available, say so honestly.\n' +
                        '- 3rd-person live interpreter: When asked to translate between two people speaking different languages (like English and Hindi), act strictly as a neutral 3rd-person interpreter. Don\'t answer questions meant for the other person—translate Person A\'s words directly into Person B\'s language, and tell Person A what Person B said in 3rd person (e.g. "She said, \'...\'"). Stay in interpreter mode until asked to stop.',
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
                }
                return;
              }

              if (msg.toolCall?.functionCalls && msg.toolCall.functionCalls.length > 0) {
                void (async () => {
                  const functionResponses = await Promise.all(
                    msg.toolCall!.functionCalls!.map(async (fc) => {
                      const fnName = fc.name || 'web_search';
                      const rawQueryText =
                        typeof fc.args?.query === 'string'
                          ? fc.args.query
                          : typeof fc.args?.topic === 'string'
                            ? fc.args.topic
                            : '';
                      const isLocal =
                        /\b(weather|temperature|forecast|nearest|near me|nearby|directions|closest|doctor|hospital|pharmacy)\b/i.test(
                          rawQueryText,
                        );
                      const locSuffix =
                        isLocal && userLocation?.city && !rawQueryText.toLowerCase().includes(userLocation.city.toLowerCase())
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

              const processCompletedS2sUserUtterance = (utterance: string) => {
                const cleanUtterance = utterance.trim();
                const nowMs = Date.now();
                if (
                  !cleanUtterance ||
                  (cleanUtterance === lastProcessedInputKey && nowMs - lastProcessedInputAt < 3000)
                ) {
                  return;
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
                    const altFemaleOrder: VoiceProfileId[] = ['in_female', 'uk_female', 'us_female'];
                    const pool = targetVoice.gender === 'male' ? altMaleOrder : altFemaleOrder;
                    const nextId = pool.find((id) => id !== activeVoiceProfile.id) || targetVoice.id;
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
                      return;
                    }
                  }
                }

                // 1b. Hands-free UI actions (mode switch, new chat, scroll, minimize/maximize)
                const lowerUtterance = cleanUtterance.toLowerCase();
                if (/^(?:please\s+)?(?:start|open|create)\s+(?:a\s+)?new\s+chat\b/i.test(lowerUtterance)) {
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });
                  sendJson(clientWs, { type: 'voice.ui_action', action: 'new_chat' });
                  injectS2sSystemConfirmation('Opened a brand new chat.');
                  return;
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
                  sendJson(clientWs, { type: 'voice.ui_action', action: 'set_mode', value: target });
                  injectS2sSystemConfirmation(`Switched to ${target} mode.`);
                  return;
                }
                if (/\bscroll\s+down\b/i.test(lowerUtterance)) {
                  sendJson(clientWs, { type: 'voice.ui_action', action: 'scroll_down' });
                  return;
                }
                if (/\bscroll\s+up\b/i.test(lowerUtterance)) {
                  sendJson(clientWs, { type: 'voice.ui_action', action: 'scroll_up' });
                  return;
                }
                if (/\bminimize\s+(?:voice|window|this)\b/i.test(lowerUtterance)) {
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });
                  sendJson(clientWs, { type: 'voice.ui_action', action: 'minimize' });
                  injectS2sSystemConfirmation('Minimized the voice window to the corner.');
                  return;
                }
                if (/\bmaximize\s+(?:voice|window|this)\b/i.test(lowerUtterance)) {
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });
                  sendJson(clientWs, { type: 'voice.ui_action', action: 'maximize' });
                  injectS2sSystemConfirmation('Expanded the voice window.');
                  return;
                }

                // 1b-media. YouTube / Spotify Media Launcher Card
                const mediaCard = detectMediaIntent(cleanUtterance);
                if (mediaCard) {
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });
                  sendJson(clientWs, { type: 'voice.action_card', card: mediaCard });
                  injectS2sSystemConfirmation(
                    `Opened the ${mediaCard.title} launcher card for "${mediaCard.query}" on screen. Tell the user they can tap the button to launch it.`,
                  );
                  return;
                }

                // 1c. Conversational location memory: extract spoken city & re-run pending local query
                const spokenCity = extractSpokenCity(cleanUtterance);
                let effectiveUtterance = cleanUtterance;
                if (spokenCity) {
                  userLocation = { ...(userLocation || {}), city: spokenCity };
                  logger.info(`[RealtimeVoice] Updated userLocation.city="${spokenCity}" from speech`);
                  if (pendingLocalQuery && !detectRealtimeSearchIntent(cleanUtterance).isSearch) {
                    effectiveUtterance = `${pendingLocalQuery} in ${spokenCity}`;
                    pendingLocalQuery = null;
                  }
                }

                // 2. Live Web Search (structured weather/news + fast satchida-search) or LibreChat tool/tutor delegation
                const toolIntent = detectToolOrTutorIntent(effectiveUtterance);
                const searchIntent = detectRealtimeSearchIntent(effectiveUtterance);
                if ((toolIntent.delegate || searchIntent.isSearch) && modePolicy.toolsAllowed) {
                  suppressCurrentS2sTurn = true;
                  sendJson(clientWs, { type: 'voice.interrupted' });

                  if (searchIntent.isSearch && !toolIntent.delegate) {
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
                    const locationSuffix =
                      wantsLocalContext &&
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
                              mode: modePolicy.semanticMode,
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
                        resultPayload = await executeVoiceWebSearch(effectiveSearchQuery, {
                          deep: searchIntent.isDeepResearch,
                          fetchPages: !wantsNews,
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
                        const llParam =
                          typeof userLocation?.lat === 'number' &&
                          typeof userLocation?.lng === 'number'
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
                      const locationNote = userLocation?.city
                        ? `User's detected location: ${userLocation.city}.\n`
                        : '';
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
                                      '[INSTRUCTION: Answer directly and concisely using ONLY these live facts (for news, cover the top 3-5 headlines; for weather/prices, state the exact numbers). Never apologize or say you lack real-time access. Do not read URLs.]',
                                  },
                                ],
                              },
                            ],
                            turnComplete: true,
                          },
                        }),
                      );
                    })();
                    return;
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
                  sendJson(clientWs, {
                    type: 'voice.delegate_tools',
                    text: toolIntent.cleanPrompt || cleanUtterance,
                    mode: targetMode,
                    webSearch: useWebSearch,
                    deepResearch: useDeepResearch,
                    newChat: Boolean(toolIntent.newChat),
                  });
                  lastDelegatedEpoch = currentEpoch;
                  return;
                }
              };

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
            const reasonStr = Buffer.isBuffer(reason) ? reason.toString('utf8') : String(reason ?? '');
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
            };
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
                reverseGeocodePromise = fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&zoom=12`,
                  {
                    signal: AbortSignal.timeout(3000),
                    headers: { 'User-Agent': 'Satchida-LiveVoice/1.0' },
                  },
                )
                  .then((r) => (r.ok ? r.json() : null))
                  .then(
                    (
                      geo: {
                        address?: {
                          suburb?: string;
                          city?: string;
                          town?: string;
                          village?: string;
                          state?: string;
                        };
                      } | null,
                    ) => {
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
                      }
                    },
                  )
                  .catch(() => {
                    // Ignore reverse-geocode failure
                  });
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
            if (parsed.type === 'voice.turn' && typeof parsed.text === 'string') {
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
