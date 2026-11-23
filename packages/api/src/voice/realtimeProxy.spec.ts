import { EventEmitter } from 'events';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import {
  createRealtimeVoiceUpgradeHandler,
  resolveSemanticMode,
  buildSatchidaAttributionHeaders,
  detectAccentSwitchCommand,
  resolveVoiceProfile,
  VOICE_PROFILES,
  type RealtimeWebSocketLike,
  type RealtimeWebSocketServerLike,
  type RealtimeUserSeatCredential,
} from './realtimeProxy';

class FakeWebSocket extends EventEmitter implements RealtimeWebSocketLike {
  readyState = 1;
  sent: string[] = [];
  closeCode?: number;
  closeReason?: string;

  send(data: string | Buffer): void {
    this.sent.push(Buffer.isBuffer(data) ? data.toString('utf8') : String(data));
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3;
    this.closeCode = code;
    this.closeReason = reason;
    this.emit('close', code, reason);
  }
}

function createFakeSocket() {
  const written: string[] = [];
  let destroyed = false;
  const socket = {
    write: jest.fn((chunk: string) => {
      written.push(chunk);
      return true;
    }),
    destroy: jest.fn(() => {
      destroyed = true;
    }),
    get written() {
      return written;
    },
    get destroyed() {
      return destroyed;
    },
  };
  return socket as unknown as Duplex & { written: string[]; destroyed: boolean };
}

function createFakeWss(): {
  wss: RealtimeWebSocketServerLike;
  getLastClientWs: () => FakeWebSocket | null;
} {
  let lastClientWs: FakeWebSocket | null = null;
  const wss: RealtimeWebSocketServerLike = {
    handleUpgrade(_req, _socket, _head, cb) {
      lastClientWs = new FakeWebSocket();
      cb(lastClientWs, _req);
    },
  };
  return {
    wss,
    getLastClientWs: () => lastClientWs,
  };
}

describe('realtimeProxy security & seatToken/mode enforcement', () => {
  const defaultBifrostConfig = () => ({
    realtimeUrl: 'ws://127.0.0.1:8700/v1/realtime',
    httpBaseUrl: 'http://127.0.0.1:8700',
    oneApiBaseUrl: 'http://127.0.0.1:4000',
    llamaBaseUrl: 'http://127.0.0.1:8080',
    model: 'CheapInference/gpt-live-1',
    chatModel: 'CheapInference/deepseek-v4.1-flash',
    virtualKey: 'bf-vk-test-96-char-virtual-key',
  });

  test('rejects anonymous upgrade (no token query, header, or cookie) with 401 Unauthorized', () => {
    const { wss, getLastClientWs } = createFakeWss();
    const createUpstreamWebSocket = jest.fn();
    const getUserSeatCredential = jest.fn();
    const handler = createRealtimeVoiceUpgradeHandler({
      wss,
      createUpstreamWebSocket,
      verifyJwt: () => ({ id: 'should-not-be-called' }),
      getUserSeatCredential,
      getBifrostConfig: defaultBifrostConfig,
    });

    const req = {
      url: '/api/voice/realtime?mode=Work',
      headers: { host: 'localhost:3080' },
    } as unknown as IncomingMessage;
    const socket = createFakeSocket();

    const handled = handler(req, socket, Buffer.alloc(0));
    expect(handled).toBe(true);
    expect(socket.written.join('')).toContain('401 Unauthorized');
    expect(socket.destroyed).toBe(true);
    expect(getLastClientWs()).toBeNull();
    expect(getUserSeatCredential).not.toHaveBeenCalled();
    expect(createUpstreamWebSocket).not.toHaveBeenCalled();
  });

  test('rejects invalid or expired JWT with 401 Unauthorized', () => {
    const { wss, getLastClientWs } = createFakeWss();
    const createUpstreamWebSocket = jest.fn();
    const getUserSeatCredential = jest.fn();
    const handler = createRealtimeVoiceUpgradeHandler({
      wss,
      createUpstreamWebSocket,
      verifyJwt: () => null,
      getUserSeatCredential,
      getBifrostConfig: defaultBifrostConfig,
    });

    const req = {
      url: '/api/voice/realtime?token=forged.jwt.token',
      headers: { host: 'localhost:3080' },
    } as unknown as IncomingMessage;
    const socket = createFakeSocket();

    handler(req, socket, Buffer.alloc(0));
    expect(socket.written.join('')).toContain('401 Unauthorized');
    expect(socket.destroyed).toBe(true);
    expect(getLastClientWs()).toBeNull();
    expect(getUserSeatCredential).not.toHaveBeenCalled();
    expect(createUpstreamWebSocket).not.toHaveBeenCalled();
  });

  test('rejects suspended or missing user account with 1008 account_unauthorized', async () => {
    const { wss, getLastClientWs } = createFakeWss();
    const createUpstreamWebSocket = jest.fn();
    const handler = createRealtimeVoiceUpgradeHandler({
      wss,
      createUpstreamWebSocket,
      verifyJwt: () => ({ id: 'user-suspended' }),
      getUserSeatCredential: async () => ({
        id: 'user-suspended',
        accountType: 'pro',
        seatToken: 'tk_satchida_123',
        suspended: true,
      }),
      getBifrostConfig: defaultBifrostConfig,
    });

    const req = {
      url: '/api/voice/realtime?token=valid.jwt',
      headers: { host: 'localhost:3080' },
    } as unknown as IncomingMessage;
    const socket = createFakeSocket();

    handler(req, socket, Buffer.alloc(0));
    await new Promise((r) => setImmediate(r));

    const clientWs = getLastClientWs();
    expect(clientWs).not.toBeNull();
    expect(clientWs?.closeCode).toBe(1008);
    expect(JSON.parse(clientWs!.sent[0]).error.code).toBe('account_unauthorized');
    expect(createUpstreamWebSocket).not.toHaveBeenCalled();
  });

  test('rejects non-entitled tier (e.g. basic/standard) attempting to bypass UI Pro gate', async () => {
    const { wss, getLastClientWs } = createFakeWss();
    const createUpstreamWebSocket = jest.fn();
    const handler = createRealtimeVoiceUpgradeHandler({
      wss,
      createUpstreamWebSocket,
      verifyJwt: () => ({ id: 'user-basic' }),
      getUserSeatCredential: async () => ({
        id: 'user-basic',
        accountType: 'basic',
        seatToken: 'tk_satchida_basic',
      }),
      getBifrostConfig: defaultBifrostConfig,
    });

    const req = {
      url: '/api/voice/realtime?token=valid.jwt',
      headers: { host: 'localhost:3080' },
    } as unknown as IncomingMessage;
    const socket = createFakeSocket();

    handler(req, socket, Buffer.alloc(0));
    await new Promise((r) => setImmediate(r));

    const clientWs = getLastClientWs();
    expect(clientWs?.closeCode).toBe(1008);
    expect(JSON.parse(clientWs!.sent[0]).error.code).toBe('tier_not_entitled');
    expect(createUpstreamWebSocket).not.toHaveBeenCalled();
  });

  test('rejects authenticated user without a provisioned seatToken (zero operator-key fallback)', async () => {
    const { wss, getLastClientWs } = createFakeWss();
    const createUpstreamWebSocket = jest.fn();
    const handler = createRealtimeVoiceUpgradeHandler({
      wss,
      createUpstreamWebSocket,
      verifyJwt: () => ({ id: 'user-no-seat' }),
      getUserSeatCredential: async () => ({
        id: 'user-no-seat',
        accountType: 'pro',
        seatToken: '',
      }),
      getBifrostConfig: defaultBifrostConfig,
    });

    const req = {
      url: '/api/voice/realtime?token=valid.jwt',
      headers: { host: 'localhost:3080' },
    } as unknown as IncomingMessage;
    const socket = createFakeSocket();

    handler(req, socket, Buffer.alloc(0));
    await new Promise((r) => setImmediate(r));

    const clientWs = getLastClientWs();
    expect(clientWs?.closeCode).toBe(1008);
    expect(JSON.parse(clientWs!.sent[0]).error.code).toBe('seat_not_provisioned');
    expect(createUpstreamWebSocket).not.toHaveBeenCalled();
  });

  test('rejects pro user attempting to use Privacy mode without privacy/enterprise tier', async () => {
    const { wss, getLastClientWs } = createFakeWss();
    const createUpstreamWebSocket = jest.fn();
    const handler = createRealtimeVoiceUpgradeHandler({
      wss,
      createUpstreamWebSocket,
      verifyJwt: () => ({ id: 'user-pro' }),
      getUserSeatCredential: async () => ({
        id: 'user-pro',
        accountType: 'pro',
        seatToken: 'tk_satchida_pro_1',
      }),
      getBifrostConfig: defaultBifrostConfig,
    });

    const req = {
      url: '/api/voice/realtime?token=valid.jwt&mode=Privacy',
      headers: { host: 'localhost:3080' },
    } as unknown as IncomingMessage;
    const socket = createFakeSocket();

    handler(req, socket, Buffer.alloc(0));
    await new Promise((r) => setImmediate(r));

    const clientWs = getLastClientWs();
    expect(clientWs?.closeCode).toBe(1008);
    expect(JSON.parse(clientWs!.sent[0]).error.code).toBe('mode_not_allowed');
    expect(createUpstreamWebSocket).not.toHaveBeenCalled();
  });

  test('rejects child/minor seat attempting to use Work mode', async () => {
    const { wss, getLastClientWs } = createFakeWss();
    const createUpstreamWebSocket = jest.fn();
    const handler = createRealtimeVoiceUpgradeHandler({
      wss,
      createUpstreamWebSocket,
      verifyJwt: () => ({ id: 'user-minor' }),
      getUserSeatCredential: async () => ({
        id: 'user-minor',
        accountType: 'pro_family',
        familyRole: 'minor',
        seatToken: 'tk_satchida_minor_1',
      }),
      getBifrostConfig: defaultBifrostConfig,
    });

    const req = {
      url: '/api/voice/realtime?token=valid.jwt&mode=Work',
      headers: { host: 'localhost:3080' },
    } as unknown as IncomingMessage;
    const socket = createFakeSocket();

    handler(req, socket, Buffer.alloc(0));
    await new Promise((r) => setImmediate(r));

    const clientWs = getLastClientWs();
    expect(clientWs?.closeCode).toBe(1008);
    expect(JSON.parse(clientWs!.sent[0]).error.code).toBe('mode_not_allowed');
    expect(createUpstreamWebSocket).not.toHaveBeenCalled();
  });

  test('connects authenticated seated Pro user with seatToken, alias, mode, and tool delegation', async () => {
    const { wss, getLastClientWs } = createFakeWss();
    const createUpstreamWebSocket = jest.fn();

    const userRecord: RealtimeUserSeatCredential = {
      id: 'user-pro-42',
      name: 'Aditi Sharma',
      accountType: 'pro',
      tenantId: 'school-alpha',
      seatToken: 'tk_school_alpha_aditi42',
      satchidaSeatAlias: 'seat_Aditi_aditi42',
      role: 'USER',
    };

    const handler = createRealtimeVoiceUpgradeHandler({
      wss,
      createUpstreamWebSocket,
      verifyJwt: (tok) => (tok === 'valid.pro.jwt' ? { id: 'user-pro-42' } : null),
      getUserSeatCredential: async () => userRecord,
      getBifrostConfig: defaultBifrostConfig,
    });

    const req = {
      url: '/api/voice/realtime?token=valid.pro.jwt&mode=Work&tools=true&voice=us_male',
      headers: { host: 'localhost:3080' },
    } as unknown as IncomingMessage;
    const socket = createFakeSocket();

    handler(req, socket, Buffer.alloc(0));
    await new Promise((r) => setImmediate(r));

    const clientWs = getLastClientWs()!;
    const createdEvent = JSON.parse(clientWs.sent[0]);
    expect(createdEvent).toEqual({
      type: 'session.created',
      mode: 'bifrost_bridge',
      satchidaMode: 'Work',
      seatAttributed: true,
      toolsAllowed: true,
      voiceId: 'us_male',
      voiceLabel: 'US Male (Guy)',
    });

    // Send a tool-requiring voice turn -> should emit voice.delegate_tools
    clientWs.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'voice.turn',
          text: 'Search the web for latest RBI circular',
          voice: 'us_male',
          mode: 'Work',
          hasTools: true,
        }),
      ),
    );
    await new Promise((r) => setImmediate(r));

    const delegatedEvent = JSON.parse(clientWs.sent[1]);
    expect(delegatedEvent).toEqual({
      type: 'voice.delegate_tools',
      text: 'Search the web for latest RBI circular',
      mode: 'Work',
    });
  });

  test('detectAccentSwitchCommand switches between IN, US, and UK male/female accents on the fly', () => {
    expect(
      detectAccentSwitchCommand('switch to US male accent', VOICE_PROFILES.in_female)?.id,
    ).toBe('us_male');
    expect(detectAccentSwitchCommand('use British female voice', VOICE_PROFILES.us_male)?.id).toBe(
      'uk_female',
    );
    expect(detectAccentSwitchCommand('change to Indian male', VOICE_PROFILES.uk_female)?.id).toBe(
      'in_male',
    );
    expect(detectAccentSwitchCommand('speak in female voice', VOICE_PROFILES.uk_male)?.id).toBe(
      'uk_female',
    );
    expect(
      detectAccentSwitchCommand('what is the weather in London', VOICE_PROFILES.in_female),
    ).toBeNull();
    expect(resolveVoiceProfile('uk_male').edgeVoice).toBe('en-GB-RyanNeural');
  });

  test('resolveSemanticMode enforces child and tier restrictions accurately', () => {
    expect(resolveSemanticMode('Work', 'pro', null)).toMatchObject({
      semanticMode: 'Work',
      modeAllowed: true,
      toolsAllowed: true,
    });
    expect(resolveSemanticMode('Work', 'pro_family', 'minor')).toMatchObject({
      semanticMode: 'Study',
      modeAllowed: false,
      toolsAllowed: false,
    });
    expect(resolveSemanticMode('Privacy', 'privacy', null)).toMatchObject({
      semanticMode: 'Privacy',
      isPrivacyMode: true,
      modeAllowed: true,
    });
    expect(resolveSemanticMode('Privacy', 'pro', null)).toMatchObject({
      semanticMode: 'Chat',
      isPrivacyMode: false,
      modeAllowed: false,
    });
    expect(
      buildSatchidaAttributionHeaders({
        user: {
          id: 'u1',
          name: 'Test User',
          tenantId: 't1',
          satchidaSeatAlias: 'seat_u1',
          role: 'ADMIN',
        },
        semanticMode: 'Study',
        normalizedMode: 'study',
        hasTools: false,
      })['X-Seat-Alias'],
    ).toBe('seat_u1');
  });

  test('never leaks internal infrastructure names (Bifrost, One-API, ports, virtual keys) on upstream error', async () => {
    const prevFlag = process.env.BIFROST_NATIVE_REALTIME_ENABLED;
    process.env.BIFROST_NATIVE_REALTIME_ENABLED = 'true';
    try {
      const { wss, getLastClientWs } = createFakeWss();
      const upstreamWs = new FakeWebSocket();

      const handler = createRealtimeVoiceUpgradeHandler({
        wss,
        createUpstreamWebSocket: () => upstreamWs,
        verifyJwt: () => ({ id: 'user-pro-1' }),
        getUserSeatCredential: async () => ({
          id: 'user-pro-1',
          accountType: 'pro',
          seatToken: 'tk_tenant_1',
        }),
        getBifrostConfig: defaultBifrostConfig,
      });

      const req = {
        url: '/api/voice/realtime?token=valid.jwt&mode=Chat',
        headers: { host: 'localhost:3080' },
      } as unknown as IncomingMessage;
      const socket = createFakeSocket();

      handler(req, socket, Buffer.alloc(0));
      await new Promise((r) => setImmediate(r));

      upstreamWs.emit('error', new Error('connect ECONNREFUSED 127.0.0.1:8700'));
      const clientWs = getLastClientWs()!;
      const errPayload = JSON.parse(clientWs.sent[0]);
      expect(errPayload.type).toBe('error');
      expect(errPayload.error.message).toBe(
        'Live Voice is temporarily unavailable right now. Please try again later.',
      );
      expect(errPayload.error.message).not.toMatch(/bifrost|one-?api|8700|4000|8080|virtual key/i);
    } finally {
      process.env.BIFROST_NATIVE_REALTIME_ENABLED = prevFlag;
    }
  });

  test('configures Gemini Live S2S with Google Search grounding, strict Satchida identity, and Fenrir for us_male', async () => {
    const { wss, getLastClientWs } = createFakeWss();
    const createdUpstreamSockets: FakeWebSocket[] = [];

    const handler = createRealtimeVoiceUpgradeHandler({
      wss,
      createUpstreamWebSocket: () => {
        const sock = new FakeWebSocket();
        createdUpstreamSockets.push(sock);
        return sock;
      },
      verifyJwt: () => ({ id: 'user-pro-99' }),
      getUserSeatCredential: async () => ({
        id: 'user-pro-99',
        accountType: 'pro',
        seatToken: 'tk_seat_99',
      }),
      mintEphemeralToken: async () => 'mock_gemini_ephemeral_token',
    });

    const req = {
      url: '/api/voice/realtime?token=valid.jwt&mode=Chat&voice=us_male',
      headers: { host: 'localhost:3080' },
    } as unknown as IncomingMessage;
    const socket = createFakeSocket();

    handler(req, socket, Buffer.alloc(0));
    await new Promise((r) => setImmediate(r));

    expect(createdUpstreamSockets.length).toBe(1);
    const initialUpstream = createdUpstreamSockets[0];

    // Simulate upstream open event to trigger setup frame
    initialUpstream.emit('open');

    expect(initialUpstream.sent.length).toBe(1);
    const setupFrame = JSON.parse(initialUpstream.sent[0]);
    expect(setupFrame.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe(
      'Fenrir',
    );
    expect(setupFrame.setup.tools).toEqual([{ googleSearch: {} }]);
    expect(setupFrame.setup.systemInstruction.parts[0].text).toContain('Satchida Live Voice');
    expect(setupFrame.setup.systemInstruction.parts[0].text).toContain('developed exclusively by Satchida AI');
    expect(setupFrame.setup.systemInstruction.parts[0].text).toContain('REALTIME SEARCH');

    // Simulate setupComplete
    initialUpstream.emit('message', Buffer.from(JSON.stringify({ setupComplete: {} })));
    const clientWs = getLastClientWs()!;
    const sessionEvent = JSON.parse(clientWs.sent[0]);
    expect(sessionEvent.mode).toBe('gemini_live_s2s');
    expect(sessionEvent.voiceId).toBe('us_male');

    // Now test dynamic voice switch to IN Male (Puck)
    clientWs.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'voice.set_accent', voice: 'in_male' })),
    );
    await new Promise((r) => setImmediate(r));

    // A second upstream connection should have been created with Puck
    expect(createdUpstreamSockets.length).toBe(2);
    const secondUpstream = createdUpstreamSockets[1];
    secondUpstream.emit('open');
    const secondSetup = JSON.parse(secondUpstream.sent[0]);
    expect(secondSetup.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe(
      'Puck',
    );
  });
});
