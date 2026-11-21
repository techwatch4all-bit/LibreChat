import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { IncomingMessage } from 'node:http';
import type { Request, Response } from 'express';
import { createOpenCodePtyRegistry } from './ptyRegistry';
import { createOpenCodePtyUpgradeHandler } from './ws';
import { createOpenCodeHttpHandlers } from './http';
import { getActiveOpenCodeSseCount } from './sse';
import { createOpenCodeClient } from './client';

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to bind ephemeral port')));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl: string, password: string, timeoutMs = 20_000): Promise<void> {
  const client = createOpenCodeClient({ baseUrl, password, timeoutMs: 2_000 });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await client.getHealth();
    if (health.ok && health.value.healthy === true) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error('Timed out waiting for opencode serve /global/health');
}

function killProcessTree(child: ChildProcess | undefined): void {
  if (!child || child.pid === undefined) {
    return;
  }
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    child.kill('SIGKILL');
  }
}

function attemptWsConnect(
  url: string,
  headers?: Record<string, string>,
): Promise<{ opened: boolean; statusCode?: number; ws?: WebSocket }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, { headers });
    let settled = false;
    ws.on('open', () => {
      if (!settled) {
        settled = true;
        resolve({ opened: true, ws });
      }
    });
    ws.on('unexpected-response', (_req: unknown, res: IncomingMessage) => {
      if (!settled) {
        settled = true;
        resolve({ opened: false, statusCode: res.statusCode });
      }
    });
    ws.on('error', () => {
      if (!settled) {
        settled = true;
        resolve({ opened: false });
      }
    });
  });
}

describe('OpenCodeClient & PTY WS proxy real server integration (Gate 0)', () => {
  jest.setTimeout(40_000);

  let serverProcess: ChildProcess | undefined;
  let baseUrl = '';
  let password = '';
  let projectDir = '';

  beforeAll(async () => {
    const port = await getFreePort();
    password = crypto.randomBytes(16).toString('hex');
    baseUrl = `http://127.0.0.1:${port}`;
    projectDir = (fs.realpathSync.native ?? fs.realpathSync)(
      fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-int-')),
    );

    const command = process.platform === 'win32' ? 'opencode.cmd' : 'opencode';
    serverProcess = spawn(command, ['serve', '--port', String(port), '--hostname', '127.0.0.1'], {
      env: {
        ...process.env,
        OPENCODE_SERVER_PASSWORD: password,
      },
      stdio: 'ignore',
      shell: process.platform === 'win32',
      windowsHide: true,
    });

    await waitForHealth(baseUrl, password);
  });

  afterAll(() => {
    killProcessTree(serverProcess);
    if (projectDir) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('fails closed with OPENCODE_MISCONFIGURED when password is unset', async () => {
    const misconfiguredClient = createOpenCodeClient({
      baseUrl,
      timeoutMs: 5_000,
    });
    const result = await misconfiguredClient.createSession({
      directory: projectDir,
      body: { title: 'Should Not Send' },
    });
    expect(result).toEqual({
      ok: false,
      error: { code: 'OPENCODE_MISCONFIGURED', status: 503 },
    });
  });

  it('rejects unauthenticated requests with 401 and maps wrong password to UPSTREAM_AUTH_FAILED', async () => {
    const rawResponse = await fetch(
      `${baseUrl}/session?directory=${encodeURIComponent(projectDir)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Unauthorized Check' }),
      },
    );
    expect(rawResponse.status).toBe(401);

    const wrongPasswordClient = createOpenCodeClient({
      baseUrl,
      password: 'invalid-password',
      timeoutMs: 5_000,
    });
    const result = await wrongPasswordClient.createSession({
      directory: projectDir,
      body: { title: 'Unauthorized Check' },
    });
    expect(result).toEqual({
      ok: false,
      error: { code: 'UPSTREAM_AUTH_FAILED', status: 502 },
    });
  });

  it('creates a session with Basic auth and directory query param', async () => {
    const client = createOpenCodeClient({
      baseUrl,
      password,
      timeoutMs: 20_000,
    });

    const health = await client.getHealth();
    expect(health.ok).toBe(true);
    if (health.ok) {
      expect(health.value.healthy).toBe(true);
      expect(typeof health.value.version).toBe('string');
      expect(health.value.version.length).toBeGreaterThan(0);
    }

    const result = await client.createSession({
      directory: projectDir,
      body: { title: 'Gate 0 Integration Session' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.value.id).toBe('string');
      expect(result.value.id.length).toBeGreaterThan(0);
      const returnedDir = path.resolve(result.value.directory);
      const expectedDir = path.resolve(projectDir);
      if (process.platform === 'win32') {
        expect(returnedDir.toLowerCase()).toBe(expectedDir.toLowerCase());
      } else {
        expect(returnedDir).toBe(expectedDir);
      }
    }
  });

  it('authenticates PTY WebSocket upgrades, blocks unauthenticated & cross-user access, and bridges live PTY I/O', async () => {
    const jwtSecret = crypto.randomBytes(24).toString('hex');
    const registry = createOpenCodePtyRegistry();
    let currentPassword: string | undefined = password;

    const getAppConfig = async () =>
      ({
        opencode: {
          enabled: true,
          baseUrl,
          allowedRoots: [path.dirname(projectDir)],
          maxFileBytes: 1024 * 1024,
          requestTimeoutMs: 10_000,
        },
      }) as never;

    const getChatProject = async (userId: string, projectId: string) =>
      userId === 'user-a' && projectId === 'proj-1'
        ? { id: 'proj-1', name: 'Integration Project', localPath: projectDir }
        : null;

    const handlers = createOpenCodeHttpHandlers({
      getAppConfig,
      getChatProject,
      ptyRegistry: registry,
      getServerPassword: () => currentPassword,
    });

    const createState: { statusCode: number; body: unknown } = { statusCode: 200, body: undefined };
    const createRes = {
      status(code: number) {
        createState.statusCode = code;
        return createRes;
      },
      json(payload: unknown) {
        createState.body = payload;
        return createRes;
      },
    } as unknown as Response;

    await handlers.createPty(
      {
        user: { id: 'user-a' },
        params: { projectId: 'proj-1' },
        body: { mode: 'shell' },
      } as unknown as Request,
      createRes,
    );

    expect(createState.statusCode).toBe(200);
    const created = createState.body as { id: string; connectTicket: string };
    expect(created.id).toMatch(/^pty_/);
    expect(typeof created.connectTicket).toBe('string');

    // Verify upstream OpenCode WS itself requires Basic auth (401 without credentials)
    const rawUpstreamWsUrl = `${baseUrl.replace(/^http/, 'ws')}/pty/${encodeURIComponent(created.id)}/connect?directory=${encodeURIComponent(projectDir)}`;
    const rawNoAuth = await attemptWsConnect(rawUpstreamWsUrl);
    expect(rawNoAuth.opened).toBe(false);
    expect(rawNoAuth.statusCode).toBe(401);

    const proxyPort = await getFreePort();
    const proxyServer = http.createServer();
    const proxyWss = new WebSocketServer({ noServer: true });
    const handleUpgrade = createOpenCodePtyUpgradeHandler({
      wss: proxyWss,
      registry,
      getAppConfig,
      getChatProject,
      verifyJwt: (token) => {
        const decoded = jwt.verify(token, jwtSecret);
        if (!decoded || typeof decoded !== 'object' || typeof decoded.id !== 'string') {
          return null;
        }
        return { id: decoded.id };
      },
      createUpstreamWebSocket: (wsUrl, opts) => new WebSocket(wsUrl, opts),
      getServerPassword: () => currentPassword,
    });

    proxyServer.on('upgrade', (req, socket, head) => {
      void handleUpgrade(req, socket, head);
    });

    await new Promise<void>((resolve) => proxyServer.listen(proxyPort, '127.0.0.1', resolve));

    try {
      const wsBase = `ws://127.0.0.1:${proxyPort}/api/opencode/pty/${created.id}/connect`;

      // 1. Unauthenticated upgrade -> 401
      const unauth = await attemptWsConnect(wsBase);
      expect(unauth.opened).toBe(false);
      expect(unauth.statusCode).toBe(401);

      // 2. Cross-user JWT (user-b attempting to access user-a's PTY) -> 403
      const userBToken = jwt.sign({ id: 'user-b' }, jwtSecret);
      const crossUser = await attemptWsConnect(wsBase, {
        Authorization: `Bearer ${userBToken}`,
      });
      expect(crossUser.opened).toBe(false);
      expect(crossUser.statusCode).toBe(403);

      // 3. Owner with valid single-use connectTicket -> connects to real opencode serve & exchanges live PTY I/O
      const withTicket = await attemptWsConnect(
        `${wsBase}?ticket=${encodeURIComponent(created.connectTicket)}`,
      );
      expect(withTicket.opened).toBe(true);
      const receivedMarker = await new Promise<boolean>((resolve) => {
        let output = '';
        const timer = setTimeout(() => resolve(false), 5_000);
        withTicket.ws?.on('message', (chunk) => {
          output += chunk.toString();
          if (output.includes('GATE0_PTY_MARKER')) {
            clearTimeout(timer);
            resolve(true);
          }
        });
        withTicket.ws?.send('echo GATE0_PTY_MARKER\r');
      });
      expect(receivedMarker).toBe(true);
      withTicket.ws?.close();

      // 4. Replaying the same single-use connectTicket -> 401
      const replay = await attemptWsConnect(
        `${wsBase}?ticket=${encodeURIComponent(created.connectTicket)}`,
      );
      expect(replay.opened).toBe(false);
      expect(replay.statusCode).toBe(401);

      // 5. Owner with valid JWT -> connects to real opencode serve
      const userAToken = jwt.sign({ id: 'user-a' }, jwtSecret);
      const withOwnerJwt = await attemptWsConnect(wsBase, {
        Authorization: `Bearer ${userAToken}`,
      });
      expect(withOwnerJwt.opened).toBe(true);
      withOwnerJwt.ws?.close();

      // 6. Missing OPENCODE_SERVER_PASSWORD -> fails closed with 503
      currentPassword = undefined;
      const misconfigured = await attemptWsConnect(wsBase, {
        Authorization: `Bearer ${userAToken}`,
      });
      expect(misconfigured.opened).toBe(false);
      expect(misconfigured.statusCode).toBe(503);
    } finally {
      proxyWss.close();
      await new Promise<void>((resolve) => proxyServer.close(() => resolve()));
    }
  });

  it('enforces cross-user session IDOR isolation and cleans up SSE upstream connections on disconnect (Gate 2)', async () => {
    const projectDirB = (fs.realpathSync.native ?? fs.realpathSync)(
      fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-int-b-')),
    );

    const getAppConfig = async () =>
      ({
        opencode: {
          enabled: true,
          baseUrl,
          allowedRoots: [path.dirname(projectDir), path.dirname(projectDirB)],
          maxFileBytes: 1024 * 1024,
          requestTimeoutMs: 10_000,
        },
      }) as never;

    const getChatProject = async (userId: string, projectId: string) => {
      if (userId === 'user-a' && projectId === 'proj-a') {
        return { id: 'proj-a', name: 'Proj A', localPath: projectDir };
      }
      if (userId === 'user-b' && projectId === 'proj-b') {
        return { id: 'proj-b', name: 'Proj B', localPath: projectDirB };
      }
      return null;
    };

    const handlers = createOpenCodeHttpHandlers({
      getAppConfig,
      getChatProject,
      getServerPassword: () => password,
    });

    const invoke = async (
      fn: (req: Request, res: Response) => Promise<Response>,
      req: Record<string, unknown>,
    ) => {
      const state: { statusCode: number; body: unknown } = { statusCode: 200, body: undefined };
      const res = {
        status(code: number) {
          state.statusCode = code;
          return res;
        },
        json(payload: unknown) {
          state.body = payload;
          return res;
        },
      } as unknown as Response;
      await fn(req as unknown as Request, res);
      return state;
    };

    try {
      // User A creates a session in proj-a
      const created = await invoke(handlers.createSession, {
        user: { id: 'user-a' },
        params: { projectId: 'proj-a' },
        body: { title: 'User A Private Session' },
      });
      expect(created.statusCode).toBe(200);
      const sessionA = created.body as { id: string };
      expect(sessionA.id).toMatch(/^ses/);

      // User B listing sessions in proj-b must NOT see User A's session
      const listB = await invoke(handlers.listSessions, {
        user: { id: 'user-b' },
        params: { projectId: 'proj-b' },
      });
      expect(listB.statusCode).toBe(200);
      expect((listB.body as Array<{ id: string }>).some((s) => s.id === sessionA.id)).toBe(false);

      // User B attempting IDOR on User A's sessionId via proj-b -> 404
      const idorMsgs = await invoke(handlers.getSessionMessages, {
        user: { id: 'user-b' },
        params: { projectId: 'proj-b', sessionId: sessionA.id },
      });
      expect(idorMsgs.statusCode).toBe(404);

      const idorAbort = await invoke(handlers.abortSession, {
        user: { id: 'user-b' },
        params: { projectId: 'proj-b', sessionId: sessionA.id },
      });
      expect(idorAbort.statusCode).toBe(404);

      // User A can read providers, agents, messages, diff, and abort their own session
      const agentsRes = await invoke(handlers.listAgents, {
        user: { id: 'user-a' },
        params: { projectId: 'proj-a' },
      });
      expect(agentsRes.statusCode).toBe(200);
      expect(Array.isArray(agentsRes.body)).toBe(true);

      const msgsA = await invoke(handlers.getSessionMessages, {
        user: { id: 'user-a' },
        params: { projectId: 'proj-a', sessionId: sessionA.id },
      });
      expect(msgsA.statusCode).toBe(200);
      expect(Array.isArray(msgsA.body)).toBe(true);

      const diffA = await invoke(handlers.getSessionDiff, {
        user: { id: 'user-a' },
        params: { projectId: 'proj-a', sessionId: sessionA.id },
        query: {},
      });
      expect(diffA.statusCode).toBe(200);
      expect(Array.isArray(diffA.body)).toBe(true);

      // SSE relay via real HTTP server + verify zero upstream connection leak on client disconnect
      const ssePort = await getFreePort();
      const sseServer = http.createServer((rawReq, rawRes) => {
        const parsed = new URL(rawReq.url ?? '/', `http://127.0.0.1:${ssePort}`);
        const req = Object.assign(rawReq, {
          user: { id: 'user-a' },
          params: { projectId: 'proj-a' },
          query: Object.fromEntries(parsed.searchParams.entries()),
        }) as unknown as Request;
        const res = Object.assign(rawRes, {
          status(code: number) {
            rawRes.statusCode = code;
            return res;
          },
          json(payload: unknown) {
            rawRes.setHeader('Content-Type', 'application/json');
            rawRes.end(JSON.stringify(payload));
            return res;
          },
        }) as unknown as Response;
        void handlers.streamEvents(req, res);
      });

      await new Promise<void>((resolve) => sseServer.listen(ssePort, '127.0.0.1', resolve));
      try {
        const sseAbort = new AbortController();
        const sseResp = await fetch(
          `http://127.0.0.1:${ssePort}/events?sessionId=${encodeURIComponent(sessionA.id)}`,
          { signal: sseAbort.signal },
        );
        expect(sseResp.status).toBe(200);
        expect(sseResp.headers.get('content-type')).toContain('text/event-stream');

        const reader = sseResp.body?.getReader();
        expect(reader).toBeDefined();
        const firstChunk = await reader!.read();
        const text = new TextDecoder().decode(firstChunk.value);
        expect(text).toContain(': connected');
        expect(getActiveOpenCodeSseCount()).toBe(1);

        // Disconnect client and verify upstream SSE connection count drops back to 0
        sseAbort.abort();
        try {
          await reader!.cancel();
        } catch {
          /* ignore */
        }

        for (let i = 0; i < 20 && getActiveOpenCodeSseCount() > 0; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        expect(getActiveOpenCodeSseCount()).toBe(0);
      } finally {
        await new Promise<void>((resolve) => sseServer.close(() => resolve()));
      }
    } finally {
      fs.rmSync(projectDirB, { recursive: true, force: true });
    }
  });
});
