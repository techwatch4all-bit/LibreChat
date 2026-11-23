import fs from 'fs';
import path from 'path';
import http from 'http';
import os from 'os';
import { spawn } from 'child_process';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { logger } from '@librechat/data-schemas';

export interface RealtimeWebSocketLike {
  readyState: number;
  send(data: string | Buffer | ArrayBuffer | Buffer[], cb?: (err?: Error) => void): void;
  close(code?: number, reason?: string): void;
  terminate?: () => void;
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
  getBifrostConfig?: () => {
    realtimeUrl: string;
    httpBaseUrl: string;
    oneApiBaseUrl: string;
    llamaBaseUrl: string;
    model: string;
    chatModel: string;
    virtualKey: string;
  };
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
  const hasSwitchVerb =
    /\b(switch|change|use|set|speak|talk)\b/.test(lower) &&
    /\b(accent|voice|male|female|us|american|uk|british|indian|india)\b/.test(lower);
  if (!hasSwitchVerb) {
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
  if (/\b(female|woman|lady|girl)\b/.test(lower)) {
    gender = 'female';
  } else if (/\b(male|man|guy|boy)\b/.test(lower)) {
    gender = 'male';
  }

  const nextId = `${region}_${gender}` as VoiceProfileId;
  return VOICE_PROFILES[nextId] || null;
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

export async function mintGoogleEphemeralToken(
  model = 'models/gemini-3.8-live',
): Promise<string> {
  const masterKey = getDecryptedGoogleApiKey();
  if (!masterKey) {
    throw new Error('Google master API key not available');
  }

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': masterKey,
    },
    body: JSON.stringify({
      uses: 1,
      bidiGenerateContentSetup: {
        model,
      },
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

export function mapVoiceToGeminiPrebuilt(
  voiceProfile: VoiceProfile,
): 'Aoede' | 'Charon' | 'Fenrir' | 'Kore' | 'Puck' {
  if (voiceProfile.gender === 'female') {
    return voiceProfile.region === 'in' ? 'Kore' : 'Aoede';
  }
  return voiceProfile.region === 'in' ? 'Puck' : 'Fenrir';
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

    const proc = spawn('python', [pythonScript, edgeVoice, tempFile, speechText]);
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

export function createRealtimeVoiceUpgradeHandler(deps: RealtimeProxyDeps) {
  const { wss, createUpstreamWebSocket, verifyJwt, getUserSeatCredential, getBifrostConfig } = deps;

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

      const pendingMessages: Array<string | Buffer | ArrayBuffer | Buffer[]> = [];
      const conversationHistory: Array<{ role: string; content: string }> = [
        {
          role: 'system',
          content:
            'You are Satchida Live Voice, the official conversational voice assistant for Satchida AI. You speak directly to the user in a warm, natural, and concise tone. NEVER mention or disclose backend provider names, raw model identifiers (such as GLM, DeepSeek, Qwen, CheapInference, OpenRouter, DeepInfra, Bifrost, One-API, or local ports), or internal routing infrastructure. If the user asks who or what model you are, always state clearly that you are Satchida AI (or Satchida Live Voice). Keep responses clear, direct, and under 2-3 spoken sentences with no markdown, bullet points, or emojis.',
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
          ['pro', 'pro_family', 'privacy', 'enterprise'].includes(
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

        conversationHistory.push({ role: 'user', content: trimmed });
        sendJson(clientWs, {
          type: 'conversation.item.input_audio_transcription.completed',
          transcript: trimmed,
        });

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
              messages: conversationHistory.slice(-11),
              onDelta,
            });
          } else {
            // Live Voice routes via Motion S2S channel on Satchida Gateway (One-API)
            const liveVoiceTargetModel =
              ['pro', 'pro_family', 'privacy', 'enterprise'].includes(
                (userSeat.accountType || '').toLowerCase(),
              )
                ? 'Motion'
                : activePolicy.semanticMode;

            try {
              const gatewayToken =
                seatToken ||
                (process.env.SATCHIDA_GATEWAY_VK || '').trim() ||
                (process.env.AUTOROUTER_API_KEY || '').trim();
              replyText = await streamChatCompletion({
                baseUrl: config.oneApiBaseUrl,
                authBearer: gatewayToken,
                extraHeaders: {
                  ...turnHeaders,
                  'X-Satchida-Voice': 'true',
                  'X-Satchida-Mode': liveVoiceTargetModel,
                  'x-satchida-account-type': userSeat.accountType || 'pro',
                  'x-satchida-seat-alias': userSeat.satchidaSeatAlias || userSeat.id || 'usr_1',
                },
                model: liveVoiceTargetModel,
                messages: conversationHistory.slice(-11),
                onDelta,
              });
            } catch (oneApiErr) {
              logger.info(
                `[RealtimeVoice] Primary gateway fallback mode=${liveVoiceTargetModel}: ${oneApiErr instanceof Error ? oneApiErr.message : 'err'}`,
              );
              sentenceBuffer = '';
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
                  messages: conversationHistory.slice(-11),
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
                  messages: conversationHistory.slice(-11),
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
      let isGeminiS2sActive = false;
      let upstreamWs: RealtimeWebSocketLike | null = null;

      // Attempt Native S2S with Google Ephemeral Token first (unless Privacy mode)
      if (!modePolicy.isPrivacyMode) {
        try {
          const ephemeralToken = await mintGoogleEphemeralToken('models/gemini-3.8-live');
          const geminiWsUrl =
            'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
          const prebuiltVoice = mapVoiceToGeminiPrebuilt(activeVoiceProfile);

          upstreamWs = createUpstreamWebSocket(geminiWsUrl, {
            headers: {
              Authorization: `Token ${ephemeralToken}`,
            },
          });

          upstreamWs.on('open', () => {
            logger.info(
              `[RealtimeVoice] Google Gemini Live S2S WebSocket connected (model=gemini-3.8-live, voice=${prebuiltVoice})`,
            );
            const setupMsg = {
              setup: {
                model: 'models/gemini-3.8-live',
                generationConfig: {
                  responseModalities: ['AUDIO'],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: {
                        voiceName: prebuiltVoice,
                      },
                    },
                  },
                },
                systemInstruction: {
                  parts: [
                    {
                      text:
                        'You are Satchida Live Voice, the official conversational AI assistant for Satchida AI. You speak directly to the user in a warm, natural, and concise tone. NEVER mention backend providers, models (like GLM, DeepSeek, Google, or Llama), or internal infrastructure. Keep answers clear, direct, and under 2-3 spoken sentences with no markdown, bullet points, or emojis. If asked who or what you are, state that you are Satchida Live Voice.',
                    },
                  ],
                },
              },
            };
            upstreamWs?.send(JSON.stringify(setupMsg));
          });

          upstreamWs.on('message', (data: unknown) => {
            if (clientClosed || clientWs.readyState !== WS_OPEN) {
              return;
            }
            const textData = Buffer.isBuffer(data) ? data.toString('utf8') : String(data ?? '');
            if (!textData.trim()) {
              return;
            }
            try {
              const msg = JSON.parse(textData) as {
                setupComplete?: unknown;
                serverContent?: {
                  modelTurn?: {
                    parts?: Array<{
                      text?: string;
                      inlineData?: { mimeType?: string; data?: string };
                    }>;
                  };
                  turnComplete?: boolean;
                  interrupted?: boolean;
                };
              };

              if (msg.setupComplete) {
                isGeminiS2sActive = true;
                sendJson(clientWs, {
                  type: 'session.created',
                  mode: 'gemini_live_s2s',
                  satchidaMode: modePolicy.semanticMode,
                  seatAttributed: true,
                  toolsAllowed: modePolicy.toolsAllowed,
                  voiceId: activeVoiceProfile.id,
                  voiceLabel: activeVoiceProfile.label,
                });
                return;
              }

              const sc = msg.serverContent;
              if (sc?.interrupted) {
                sendJson(clientWs, { type: 'voice.interrupted' });
              }
              if (sc?.modelTurn?.parts) {
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
                      voiceId: activeVoiceProfile.id,
                    });
                  }
                }
              }
              if (sc?.turnComplete) {
                sendJson(clientWs, {
                  type: 'response.audio_transcript.done',
                });
              }
            } catch {
              // Ignore non-json or unparseable frames
            }
          });

          upstreamWs.on('error', (err: unknown) => {
            logger.warn(
              `[RealtimeVoice] Gemini Live S2S socket error, switching to cascaded bridge: ${err instanceof Error ? err.message : String(err)}`,
            );
            isGeminiS2sActive = false;
            bridgeMode = true;
            upstreamClosed = true;
          });

          upstreamWs.on('close', () => {
            upstreamClosed = true;
            if (isGeminiS2sActive) {
              isGeminiS2sActive = false;
              bridgeMode = true;
            }
          });
        } catch (ephemeralErr) {
          logger.warn(
            `[RealtimeVoice] Ephemeral token minting failed, using cascaded bridge: ${ephemeralErr instanceof Error ? ephemeralErr.message : String(ephemeralErr)}`,
          );
          bridgeMode = true;
          upstreamClosed = true;
        }
      } else {
        bridgeMode = true;
        upstreamClosed = true;
      }

      if (bridgeMode) {
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
            };
            if (parsed.type === 'voice.set_accent' && typeof parsed.voice === 'string') {
              activeVoiceProfile = resolveVoiceProfile(parsed.voice);
              sendJson(clientWs, {
                type: 'voice.accent_changed',
                voiceId: activeVoiceProfile.id,
                label: activeVoiceProfile.label,
                lang: activeVoiceProfile.lang,
              });
              return;
            }
            if (parsed.type === 'voice.turn' && typeof parsed.text === 'string') {
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
        const sessionDurationSec = Math.max(1, Math.round((Date.now() - sessionStartTime) / 1000));
        const estimatedTokens = Math.max(10, Math.round(totalAudioBytesStreamed / 160));
        recordVoiceUsageInOneApi(userSeat.satchidaSeatAlias || authenticatedUserId, estimatedTokens);
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
