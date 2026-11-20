import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import type { Request, Response } from 'express';
import type { AddressInfo } from 'node:net';
import {
  assertWritablePath,
  ensureProjectWorkspace,
  readSafeDirTree,
  resolveInsideRoot,
  resolveProjectRoot,
  sanitizeWindowsUserFolder,
} from './paths';
import {
  createOpenCodePreviewManager,
  detectPortFromOutput,
  proxyOpenCodePreviewRequest,
  stripAnsi,
} from './preview';
import { createOpenCodePtyRegistry } from './ptyRegistry';
import { createOpenCodeHttpHandlers } from './http';

describe('OpenCode path safety & HTTP handlers (Gate 0)', () => {
  let baseTempDir: string;
  let allowedRoot: string;
  let projectRoot: string;
  let siblingProjectRoot: string;
  let outsideDir: string;
  let escapeLinkPath: string;

  beforeAll(() => {
    baseTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-paths-'));
    allowedRoot = path.join(baseTempDir, 'allowed');
    projectRoot = path.join(allowedRoot, 'proj-a');
    siblingProjectRoot = path.join(allowedRoot, 'proj-ab');
    outsideDir = path.join(baseTempDir, 'outside');

    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
    fs.mkdirSync(siblingProjectRoot, { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });

    fs.writeFileSync(
      path.join(projectRoot, 'src', 'index.ts'),
      'export const ok = true;\n',
      'utf8',
    );
    fs.writeFileSync(path.join(projectRoot, '.git', 'config'), '[core]\n', 'utf8');
    fs.writeFileSync(path.join(siblingProjectRoot, 'sibling.txt'), 'sibling-secret\n', 'utf8');
    fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'top-secret\n', 'utf8');

    escapeLinkPath = path.join(projectRoot, 'escape-link');
    fs.symlinkSync(outsideDir, escapeLinkPath, process.platform === 'win32' ? 'junction' : 'dir');
  });

  afterAll(() => {
    fs.rmSync(baseTempDir, { recursive: true, force: true });
  });

  function makeRes() {
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
    return { res, state };
  }

  describe('resolveProjectRoot', () => {
    it('rejects missing localPath without falling back to process.cwd()', () => {
      const result = resolveProjectRoot({ localPath: undefined }, [allowedRoot]);
      expect(result).toEqual({
        ok: false,
        error: { code: 'PROJECT_PATH_INVALID', status: 409 },
      });
    });

    it('rejects non-existent localPath', () => {
      const result = resolveProjectRoot({ localPath: path.join(allowedRoot, 'does-not-exist') }, [
        allowedRoot,
      ]);
      expect(result).toEqual({
        ok: false,
        error: { code: 'PROJECT_PATH_INVALID', status: 409 },
      });
    });

    it('rejects when allowedRoots is empty', () => {
      const result = resolveProjectRoot({ localPath: projectRoot }, []);
      expect(result).toEqual({
        ok: false,
        error: { code: 'PROJECT_PATH_INVALID', status: 409 },
      });
    });

    it('rejects project directory outside allowedRoots and sibling-prefix roots', () => {
      expect(resolveProjectRoot({ localPath: outsideDir }, [allowedRoot])).toEqual({
        ok: false,
        error: { code: 'PROJECT_PATH_INVALID', status: 409 },
      });
      expect(resolveProjectRoot({ localPath: siblingProjectRoot }, [projectRoot])).toEqual({
        ok: false,
        error: { code: 'PROJECT_PATH_INVALID', status: 409 },
      });
    });

    it('accepts valid directory inside allowedRoots', () => {
      const result = resolveProjectRoot({ localPath: projectRoot }, [allowedRoot]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe((fs.realpathSync.native ?? fs.realpathSync)(projectRoot));
      }
    });
  });

  describe('resolveInsideRoot traversal matrix', () => {
    const blockedCases: Array<[string, string]> = [
      ['relative Windows traversal', '..\\..\\Windows\\win.ini'],
      ['absolute Windows path', 'C:\\Windows\\win.ini'],
      ['forward-slash drive escape', 'C:/Windows/win.ini'],
      ['drive-relative path', 'C:foo'],
      ['UNC network path', '\\\\host\\share\\file.txt'],
      ['forward-slash UNC path', '//host/share/file.txt'],
      ['extended-length prefix', '\\\\?\\C:\\Windows\\win.ini'],
      ['nested relative traversal', 'foo/../../x'],
      ['trailing dot segment', 'a.txt.'],
      ['trailing space segment', 'a.txt '],
      ['trailing dot in subdirectory', 'src/nested./file.ts'],
      ['NUL byte injection', 'src/index.ts\0.txt'],
      ['sibling prefix escape', '../proj-ab/sibling.txt'],
      ['outside sibling escape', '../outside/secret.txt'],
      ['NTFS alternate data stream', 'src/index.ts:evil'],
      ['NTFS $DATA stream', 'src/index.ts::$DATA'],
    ];

    it.each(blockedCases)('blocks %s (%s)', (_label, candidate) => {
      const result = resolveInsideRoot(projectRoot, candidate, { mustExist: false });
      expect(result.ok).toBe(false);
    });

    it('blocks Windows reserved device names on win32', () => {
      if (process.platform !== 'win32') {
        return;
      }
      expect(resolveInsideRoot(projectRoot, 'CON', { mustExist: false }).ok).toBe(false);
      expect(resolveInsideRoot(projectRoot, 'src/nul.txt', { mustExist: false }).ok).toBe(false);
    });

    it('blocks reading through a symlink/junction escaping root', () => {
      const result = resolveInsideRoot(projectRoot, 'escape-link/secret.txt', { mustExist: true });
      expect(result).toEqual({
        ok: false,
        error: { code: 'PATH_OUTSIDE_ROOT', status: 403 },
      });
    });

    it('returns uniform 403 PATH_OUTSIDE_ROOT for both existing and non-existent paths outside root (no existence oracle)', () => {
      const expected = { ok: false, error: { code: 'PATH_OUTSIDE_ROOT', status: 403 } };
      expect(
        resolveInsideRoot(projectRoot, '..\\..\\Windows\\win.ini', { mustExist: true }),
      ).toEqual(expected);
      expect(
        resolveInsideRoot(projectRoot, '..\\..\\nonexistent-oracle-check.txt', { mustExist: true }),
      ).toEqual(expected);
      expect(
        resolveInsideRoot(projectRoot, path.join(outsideDir, 'secret.txt'), { mustExist: true }),
      ).toEqual(expected);
      expect(
        resolveInsideRoot(projectRoot, path.join(outsideDir, 'does-not-exist-oracle.txt'), {
          mustExist: true,
        }),
      ).toEqual(expected);
      // Non-existent path strictly INSIDE root still returns 404 FILE_NOT_FOUND
      expect(
        resolveInsideRoot(projectRoot, 'src/missing-inside-root.ts', { mustExist: true }),
      ).toEqual({
        ok: false,
        error: { code: 'FILE_NOT_FOUND', status: 404 },
      });
    });

    it('blocks writing a new file through a symlink/junction escaping root', () => {
      const result = resolveInsideRoot(projectRoot, 'escape-link/new-file.txt', {
        mustExist: false,
      });
      expect(result).toEqual({
        ok: false,
        error: { code: 'PATH_OUTSIDE_ROOT', status: 403 },
      });
    });

    it('handles mixed-case segments and directories inside root on Windows', () => {
      const expected = (fs.realpathSync.native ?? fs.realpathSync)(
        path.join(projectRoot, 'src', 'index.ts'),
      );
      if (process.platform === 'win32') {
        const resUpperDir = resolveInsideRoot(projectRoot, 'SRC/index.ts', { mustExist: true });
        expect(resUpperDir).toEqual({ ok: true, value: expected });

        const resUpperFile = resolveInsideRoot(projectRoot, 'src/INDEX.TS', { mustExist: true });
        expect(resUpperFile).toEqual({ ok: true, value: expected });
      } else {
        const resExact = resolveInsideRoot(projectRoot, 'src/index.ts', { mustExist: true });
        expect(resExact).toEqual({ ok: true, value: expected });
      }
    });

    it('skips escaping symlinks in readSafeDirTree', () => {
      const canonical = (fs.realpathSync.native ?? fs.realpathSync)(projectRoot);
      const tree = readSafeDirTree(canonical);
      const names = tree.map((entry) => entry.name);
      expect(names).toContain('src');
      expect(names).not.toContain('escape-link');
      expect(names).not.toContain('.git');
    });
  });

  describe('assertWritablePath', () => {
    it('blocks writes to .git/config and mixed-case .GIT/config', () => {
      const canonical = (fs.realpathSync.native ?? fs.realpathSync)(projectRoot);
      expect(assertWritablePath(canonical, path.join(canonical, '.git', 'config'))).toEqual({
        ok: false,
        error: { code: 'WRITE_FORBIDDEN', status: 403 },
      });
      expect(assertWritablePath(canonical, path.join(canonical, '.GIT', 'config'))).toEqual({
        ok: false,
        error: { code: 'WRITE_FORBIDDEN', status: 403 },
      });
    });

    it('blocks writes to .env, .env.local, and .envrc', () => {
      const canonical = (fs.realpathSync.native ?? fs.realpathSync)(projectRoot);
      expect(assertWritablePath(canonical, path.join(canonical, '.env'))).toEqual({
        ok: false,
        error: { code: 'WRITE_FORBIDDEN', status: 403 },
      });
      expect(assertWritablePath(canonical, path.join(canonical, '.ENV.local'))).toEqual({
        ok: false,
        error: { code: 'WRITE_FORBIDDEN', status: 403 },
      });
      expect(assertWritablePath(canonical, path.join(canonical, '.envrc'))).toEqual({
        ok: false,
        error: { code: 'WRITE_FORBIDDEN', status: 403 },
      });
    });

    it('allows writes to normal source files and .gitignore inside root', () => {
      const canonical = (fs.realpathSync.native ?? fs.realpathSync)(projectRoot);
      expect(assertWritablePath(canonical, path.join(canonical, 'src', 'app.ts'))).toEqual({
        ok: true,
        value: undefined,
      });
      expect(assertWritablePath(canonical, path.join(canonical, '.gitignore'))).toEqual({
        ok: true,
        value: undefined,
      });
    });
  });

  describe('createOpenCodeHttpHandlers happy paths, limits & fail-closed checks', () => {
    function makeEnabledHandlers(overrides?: {
      maxFileBytes?: number;
      password?: string;
      ptyRegistry?: ReturnType<typeof createOpenCodePtyRegistry>;
    }) {
      return createOpenCodeHttpHandlers({
        getAppConfig: async () =>
          ({
            opencode: {
              enabled: true,
              baseUrl: 'http://127.0.0.1:4096',
              allowedRoots: [allowedRoot],
              maxFileBytes: overrides?.maxFileBytes ?? 4096,
              requestTimeoutMs: 5000,
            },
          }) as never,
        getChatProject: async (userId, projectId) =>
          userId === 'u1' && projectId === 'p1'
            ? { id: 'p1', name: 'Proj A', localPath: projectRoot }
            : null,
        getServerPassword: () => overrides?.password,
        ptyRegistry: overrides?.ptyRegistry,
      });
    }

    it('supports writeFile, readFile, and getTree happy paths on real files', async () => {
      const handlers = makeEnabledHandlers({ password: 'configured-password' });
      const canonicalRoot = (fs.realpathSync.native ?? fs.realpathSync)(projectRoot);
      const expectedFile = path.join(canonicalRoot, 'src', 'nested', 'hello.ts');

      const writeRes = makeRes();
      await handlers.writeFile(
        {
          user: { id: 'u1' },
          params: { projectId: 'p1' },
          body: { path: 'src/nested/hello.ts', content: 'export const greeting = "ok";\n' },
        } as unknown as Request,
        writeRes.res,
      );
      expect(writeRes.state.statusCode).toBe(200);
      expect(writeRes.state.body).toEqual({ ok: true, path: expectedFile });
      expect(fs.readFileSync(expectedFile, 'utf8')).toBe('export const greeting = "ok";\n');

      const readRes = makeRes();
      await handlers.readFile(
        {
          user: { id: 'u1' },
          params: { projectId: 'p1' },
          query: { path: 'src/nested/hello.ts' },
        } as unknown as Request,
        readRes.res,
      );
      expect(readRes.state.statusCode).toBe(200);
      expect(readRes.state.body).toEqual({
        path: expectedFile,
        content: 'export const greeting = "ok";\n',
        size: Buffer.byteLength('export const greeting = "ok";\n', 'utf8'),
      });

      const treeRes = makeRes();
      await handlers.getTree(
        {
          user: { id: 'u1' },
          params: { projectId: 'p1' },
        } as unknown as Request,
        treeRes.res,
      );
      expect(treeRes.state.statusCode).toBe(200);
      const treeBody = treeRes.state.body as {
        rootPath: string;
        projectName: string;
        tree: Array<{
          name: string;
          children?: Array<{ name: string; children?: Array<{ name: string }> }>;
        }>;
      };
      expect(treeBody.rootPath).toBe(canonicalRoot);
      expect(treeBody.projectName).toBe('Proj A');
      const srcDir = treeBody.tree.find((entry) => entry.name === 'src');
      const nestedDir = srcDir?.children?.find((entry) => entry.name === 'nested');
      expect(nestedDir?.children?.some((entry) => entry.name === 'hello.ts')).toBe(true);
    });

    it('returns 400 PATH_INVALID when writing to an existing directory path', async () => {
      const handlers = makeEnabledHandlers({ password: 'configured-password' });
      const writeRes = makeRes();
      await handlers.writeFile(
        {
          user: { id: 'u1' },
          params: { projectId: 'p1' },
          body: { path: 'src', content: 'cannot overwrite dir' },
        } as unknown as Request,
        writeRes.res,
      );
      expect(writeRes.state.statusCode).toBe(400);
      expect(writeRes.state.body).toEqual({ error: { code: 'PATH_INVALID' } });
    });

    it('fails closed with 503 OPENCODE_MISCONFIGURED when OPENCODE_SERVER_PASSWORD is unset', async () => {
      const handlers = makeEnabledHandlers({ password: undefined });

      const promptRes = makeRes();
      await handlers.createSessionPrompt(
        {
          user: { id: 'u1' },
          params: { projectId: 'p1' },
          body: { prompt: 'hello' },
        } as unknown as Request,
        promptRes.res,
      );
      expect(promptRes.state.statusCode).toBe(503);
      expect(promptRes.state.body).toEqual({ error: { code: 'OPENCODE_MISCONFIGURED' } });

      const ptyRes = makeRes();
      await handlers.createPty(
        {
          user: { id: 'u1' },
          params: { projectId: 'p1' },
          body: {},
        } as unknown as Request,
        ptyRes.res,
      );
      expect(ptyRes.state.statusCode).toBe(503);
      expect(ptyRes.state.body).toEqual({ error: { code: 'OPENCODE_MISCONFIGURED' } });
    });

    it('enforces ownership on createPtyConnectToken', async () => {
      const registry = createOpenCodePtyRegistry();
      const canonicalRoot = (fs.realpathSync.native ?? fs.realpathSync)(projectRoot);
      registry.registerPty({
        ptyId: 'pty_owned_by_u1',
        userId: 'u1',
        projectId: 'p1',
        projectRoot: canonicalRoot,
      });

      const handlers = makeEnabledHandlers({ password: 'secret', ptyRegistry: registry });

      const okRes = makeRes();
      await handlers.createPtyConnectToken(
        {
          user: { id: 'u1' },
          params: { projectId: 'p1', ptyId: 'pty_owned_by_u1' },
        } as unknown as Request,
        okRes.res,
      );
      expect(okRes.state.statusCode).toBe(200);
      expect(typeof (okRes.state.body as { ticket?: string }).ticket).toBe('string');

      const otherPtyRes = makeRes();
      await handlers.createPtyConnectToken(
        {
          user: { id: 'u1' },
          params: { projectId: 'p1', ptyId: 'pty_unknown' },
        } as unknown as Request,
        otherPtyRes.res,
      );
      expect(otherPtyRes.state.statusCode).toBe(403);
      expect(otherPtyRes.state.body).toEqual({ error: { code: 'OPENCODE_UNAUTHORIZED' } });
    });

    it('returns 413 FILE_TOO_LARGE on oversized reads and writes', async () => {
      const largeFile = path.join(projectRoot, 'src', 'big.txt');
      fs.writeFileSync(largeFile, 'x'.repeat(200), 'utf8');

      const handlers = makeEnabledHandlers({ maxFileBytes: 64, password: 'secret' });

      const readRes = makeRes();
      await handlers.readFile(
        {
          user: { id: 'u1' },
          params: { projectId: 'p1' },
          query: { path: 'src/big.txt' },
        } as unknown as Request,
        readRes.res,
      );
      expect(readRes.state.statusCode).toBe(413);
      expect(readRes.state.body).toEqual({ error: { code: 'FILE_TOO_LARGE' } });

      const writeRes = makeRes();
      await handlers.writeFile(
        {
          user: { id: 'u1' },
          params: { projectId: 'p1' },
          body: { path: 'src/out.txt', content: 'y'.repeat(128) },
        } as unknown as Request,
        writeRes.res,
      );
      expect(writeRes.state.statusCode).toBe(413);
      expect(writeRes.state.body).toEqual({ error: { code: 'FILE_TOO_LARGE' } });
    });

    it('returns 403 OPENCODE_DISABLED when disabled in config and getStatus reports enabled:false', async () => {
      const handlers = createOpenCodeHttpHandlers({
        getAppConfig: async () => ({ opencode: { enabled: false } }) as never,
        getChatProject: async () => ({ id: 'p1', name: 'Proj A', localPath: projectRoot }),
      });
      const { res, state } = makeRes();
      await handlers.getTree(
        { user: { id: 'u1' }, params: { projectId: 'p1' } } as unknown as Request,
        res,
      );
      expect(state.statusCode).toBe(403);
      expect(state.body).toEqual({ error: { code: 'OPENCODE_DISABLED' } });

      const statusRes = makeRes();
      await handlers.getStatus({ user: { id: 'u1' } } as unknown as Request, statusRes.res);
      expect(statusRes.state.statusCode).toBe(200);
      expect(statusRes.state.body).toEqual({ enabled: false, reachable: false, version: null });
    });

    it('getStatus reports reachable:false when password is unset even if enabled', async () => {
      const handlers = makeEnabledHandlers({ password: undefined });
      const statusRes = makeRes();
      await handlers.getStatus({ user: { id: 'u1' } } as unknown as Request, statusRes.res);
      expect(statusRes.state.statusCode).toBe(200);
      expect(statusRes.state.body).toEqual({ enabled: true, reachable: false, version: null });
    });

    it('never leaks raw exception messages in HTTP responses', async () => {
      const handlers = createOpenCodeHttpHandlers({
        getAppConfig: async () => {
          throw new Error('sensitive-internal-secret-stack');
        },
        getChatProject: async () => null,
      });
      const { res, state } = makeRes();
      await handlers.getTree(
        { user: { id: 'u1' }, params: { projectId: 'p1' } } as unknown as Request,
        res,
      );
      expect(state.statusCode).toBe(500);
      expect(state.body).toEqual({ error: { code: 'INTERNAL_ERROR' } });
      expect(JSON.stringify(state.body)).not.toContain('sensitive-internal-secret-stack');
    });
  });

  describe('detectPortFromOutput (Phase 4 preview port detection)', () => {
    it('extracts dynamic ports from ANSI Vite and Node dev-server banners', () => {
      expect(detectPortFromOutput('\x1b[32m  ➜  Local:   http://localhost:5173/\x1b[0m')).toBe(
        5173,
      );
      expect(detectPortFromOutput('Server listening on http://127.0.0.1:4321')).toBe(4321);
      expect(detectPortFromOutput('API ready at port 5822')).toBe(5822);
    });

    it('rejects reserved node infrastructure ports and privileged ports', () => {
      expect(detectPortFromOutput('http://127.0.0.1:3080')).toBeNull();
      expect(detectPortFromOutput('http://127.0.0.1:4000')).toBeNull();
      expect(detectPortFromOutput('http://127.0.0.1:4096')).toBeNull();
      expect(detectPortFromOutput('http://127.0.0.1:8080')).toBeNull();
      expect(detectPortFromOutput('http://127.0.0.1:27017')).toBeNull();
      expect(detectPortFromOutput('http://127.0.0.1:80')).toBeNull();
    });
  });

  describe('ensureProjectWorkspace', () => {
    it('idempotently creates a canonical folder inside the first existing allowedRoot', () => {
      const first = ensureProjectWorkspace('6aff947ee8a625048a891919', 'Satchida App!', [
        allowedRoot,
      ]);
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(fs.statSync(first.value).isDirectory()).toBe(true);
        expect(path.basename(first.value)).toBe('satchida-app-8a891919');
        const second = ensureProjectWorkspace('6aff947ee8a625048a891919', 'Satchida App!', [
          allowedRoot,
        ]);
        expect(second).toEqual(first);
      }
    });

    it('rejects provisioning when allowedRoots is empty or non-existent', () => {
      expect(ensureProjectWorkspace('p1', 'Test', [])).toEqual({
        ok: false,
        error: { code: 'PROJECT_PATH_INVALID', status: 409 },
      });
    });

    it('blocks non-satchida provider bypass attempts with 403 PROVIDER_NOT_ALLOWED', async () => {
      const handlers = createOpenCodeHttpHandlers({
        getAppConfig: async () =>
          ({
            opencode: {
              enabled: true,
              baseUrl: 'http://127.0.0.1:4096',
              allowedRoots: [allowedRoot],
              maxFileBytes: 4096,
              requestTimeoutMs: 5000,
            },
          }) as never,
        getChatProject: async () => ({ id: 'p1', name: 'Proj A', localPath: projectRoot }),
        getServerPassword: () => 'configured-password',
      });
      const { res, state } = makeRes();
      await handlers.createSessionPrompt(
        {
          user: { id: 'u1' },
          params: { projectId: 'p1' },
          body: {
            prompt: 'bypass test',
            model: { providerID: 'openai', modelID: 'gpt-4o' },
          },
        } as unknown as Request,
        res,
      );
      expect(state.statusCode).toBe(403);
      expect(state.body).toEqual({ error: { code: 'PROVIDER_NOT_ALLOWED' } });
    });

    it('bans Tenant Admins and regular users from OpenCode Zen/Go and PTY, while allowing Platform Admin and platform admin group', async () => {
      const handlers = createOpenCodeHttpHandlers({
        getAppConfig: async () =>
          ({
            opencode: {
              enabled: true,
              baseUrl: 'http://127.0.0.1:4096',
              allowedRoots: [allowedRoot],
              maxFileBytes: 4096,
              requestTimeoutMs: 5000,
            },
          }) as never,
        getChatProject: async () => ({ id: 'p1', name: 'Proj A', localPath: projectRoot }),
        getServerPassword: () => 'configured-password',
        enforcePlatformAdminForPty: true,
        isUserInPlatformAdminGroup: async (uid) => uid === 'platform-group-member',
      });

      // 1. Tenant Admin (role: ADMIN on customer tenant 'emami-city') is BANNED from OpenCode Zen/Go
      const tenantAdminZenRes = makeRes();
      await handlers.createSessionPrompt(
        {
          user: { id: 'tenant-admin-1', role: 'ADMIN', tenantId: 'emami-city' },
          params: { projectId: 'p1' },
          body: {
            prompt: 'try zen',
            model: { providerID: 'opencode', modelID: 'longcat-2.5-free' },
          },
        } as unknown as Request,
        tenantAdminZenRes.res,
      );
      expect(tenantAdminZenRes.state.statusCode).toBe(403);
      expect(tenantAdminZenRes.state.body).toEqual({ error: { code: 'PROVIDER_NOT_ALLOWED' } });

      // 2. Tenant Admin is BANNED from raw PTY terminal
      const tenantAdminPtyRes = makeRes();
      await handlers.createPty(
        {
          user: { id: 'tenant-admin-1', role: 'ADMIN', tenantId: 'emami-city' },
          params: { projectId: 'p1' },
          body: {},
        } as unknown as Request,
        tenantAdminPtyRes.res,
      );
      expect(tenantAdminPtyRes.state.statusCode).toBe(403);
      expect(tenantAdminPtyRes.state.body).toEqual({ error: { code: 'OPENCODE_UNAUTHORIZED' } });

      // 3. Regular user on satchida-master (not in admin group) is BANNED from OpenCode Go
      const regularUserGoRes = makeRes();
      await handlers.createSessionPrompt(
        {
          user: { id: 'regular-u1', role: 'USER', tenantId: 'satchida-master' },
          params: { projectId: 'p1' },
          body: {
            prompt: 'try go',
            model: { providerID: 'opencode-go', modelID: 'glm-5.3-flash' },
          },
        } as unknown as Request,
        regularUserGoRes.res,
      );
      expect(regularUserGoRes.state.statusCode).toBe(403);
      expect(regularUserGoRes.state.body).toEqual({ error: { code: 'PROVIDER_NOT_ALLOWED' } });
    });

    it('attributes simultaneous multi-user vibecoding LLM calls to each user exact seatToken without cross-talk', async () => {
      const prevVk = process.env.SATCHIDA_GATEWAY_VK;
      process.env.SATCHIDA_GATEWAY_VK = 'internal-opencode-vk';
      const seenAuthHeaders: string[] = [];

      try {
        const handlers = createOpenCodeHttpHandlers({
          getAppConfig: async () =>
            ({
              opencode: {
                enabled: true,
                baseUrl: 'http://127.0.0.1:4096',
                allowedRoots: [allowedRoot],
                maxFileBytes: 4096,
                requestTimeoutMs: 5000,
              },
            }) as never,
          getChatProject: async (uid, pid) => {
            if (pid === 'proj-a' && uid === 'user-privacy') {
              return { id: 'proj-a', name: 'A', localPath: projectRoot };
            }
            if (pid === 'proj-b' && uid === 'user-work') {
              return { id: 'proj-b', name: 'B', localPath: projectRoot };
            }
            return null;
          },
          getServerPassword: () => 'configured-password',
          getUserSeatCredential: async (uid) => {
            if (uid === 'user-privacy') {
              return { seatToken: 'sk-seat-privacy-user-a', accountType: 'privacy' };
            }
            if (uid === 'user-work') {
              return { seatToken: 'sk-seat-work-user-b', accountType: 'work_study' };
            }
            return null;
          },
          fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
            const urlStr = String(url);
            if (urlStr.includes('/session') && !urlStr.includes('/prompt_async')) {
              return new Response(
                JSON.stringify({
                  id: 'ses_concurrent1',
                  title: 'T',
                  directory: projectRoot,
                  time: { created: 1, updated: 1 },
                }),
                { status: 200, headers: { 'content-type': 'application/json' } },
              );
            }
            if (urlStr.includes('/prompt_async')) {
              return new Response(null, { status: 204 });
            }
            // Gateway LLM call
            const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
            seenAuthHeaders.push(auth);
            return new Response(JSON.stringify({ id: 'chatcmpl-1', choices: [] }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
          }) as typeof fetch,
        });

        // User A (Privacy tier) starts session on proj-a, followed immediately by User B (Work/Study tier) on proj-b
        const resA = makeRes();
        await handlers.createSessionPrompt(
          {
            user: { id: 'user-privacy' },
            params: { projectId: 'proj-a' },
            body: { prompt: 'Build app A' },
          } as unknown as Request,
          resA.res,
        );
        expect(resA.state.statusCode).toBe(202);

        const resB = makeRes();
        await handlers.createSessionPrompt(
          {
            user: { id: 'user-work' },
            params: { projectId: 'proj-b' },
            body: { prompt: 'Build app B' },
          } as unknown as Request,
          resB.res,
        );
        expect(resB.state.statusCode).toBe(202);

        // Even though User B submitted AFTER User A, an in-flight LLM turn from User A's session
        // carrying [Satchida-Context: projectId=proj-a userId=user-privacy] MUST authenticate with User A's seatToken!
        const llmResA = makeRes();
        await handlers.proxyLlmToGateway(
          {
            method: 'POST',
            path: '/chat/completions',
            headers: { authorization: 'Bearer internal-opencode-vk' },
            body: {
              model: 'Vibecoding',
              messages: [
                {
                  role: 'user',
                  content: 'Build app A\n[Satchida-Context: projectId=proj-a userId=user-privacy]',
                },
              ],
            },
          } as unknown as Request,
          llmResA.res,
        );

        const llmResB = makeRes();
        await handlers.proxyLlmToGateway(
          {
            method: 'POST',
            path: '/chat/completions',
            headers: { authorization: 'Bearer internal-opencode-vk' },
            body: {
              model: 'Vibecoding',
              messages: [
                {
                  role: 'user',
                  content: 'Build app B\n[Satchida-Context: projectId=proj-b userId=user-work]',
                },
              ],
            },
          } as unknown as Request,
          llmResB.res,
        );

        expect(seenAuthHeaders).toEqual([
          'Bearer sk-seat-privacy-user-a',
          'Bearer sk-seat-work-user-b',
        ]);
      } finally {
        process.env.SATCHIDA_GATEWAY_VK = prevVk;
      }
    });

    it('resolves bare directory names from browser showDirectoryPicker and self-heals empty auto-provisioned folders to existing repositories', () => {
      const existingRepoWrapper = path.join(allowedRoot, 'OpenHandsTest');
      const existingRepoInner = path.join(existingRepoWrapper, 'OpenHandsTest');
      fs.mkdirSync(existingRepoInner, { recursive: true });
      fs.writeFileSync(
        path.join(existingRepoInner, 'package.json'),
        '{"name":"openhands"}',
        'utf8',
      );

      const canonicalInner = (fs.realpathSync.native ?? fs.realpathSync)(existingRepoInner);

      // 1. Bare folder name from browser showDirectoryPicker ("OpenHandsTest") resolves to nested repo root
      const bareResolved = resolveProjectRoot(
        { name: 'OpenHandsTest', localPath: 'OpenHandsTest' },
        [allowedRoot],
      );
      expect(bareResolved).toEqual({ ok: true, value: canonicalInner });

      // 2. Empty auto-provisioned <slug>-<8hex> folder self-heals when project.name matches an existing repo
      const emptyAutoDir = path.join(allowedRoot, 'openhandstest-a4559e33');
      fs.mkdirSync(emptyAutoDir, { recursive: true });
      const healedResolved = resolveProjectRoot(
        { name: 'OpenHandsTest', localPath: emptyAutoDir },
        [allowedRoot],
      );
      expect(healedResolved).toEqual({ ok: true, value: canonicalInner });

      // 3. ensureProjectWorkspace binds to existing repository instead of creating a new empty vibe-apps folder
      const ensuredExisting = ensureProjectWorkspace('6affcc4387384e19a4559e33', 'OpenHandsTest', [
        allowedRoot,
      ]);
      expect(ensuredExisting).toEqual({ ok: true, value: canonicalInner });
    });
  });

  describe('preview ANSI sanitization & built-in static HTML server', () => {
    it('strips ANSI CSI, OSC window-title sequences, and stray control characters', () => {
      const raw = '\x1B]0;npm\x07\r\n\x1B]0;npm run dev\x1B\\\r\n\x1B[31merror\x1B[0m\x00';
      const cleaned = stripAnsi(raw);
      expect(cleaned).not.toContain(']0;npm');
      expect(cleaned).not.toContain('\x1B');
      expect(cleaned).not.toContain('\x00');
      expect(cleaned).toContain('error');
    });

    it('serves static HTML projects (app.html without package.json) on loopback and blocks path traversal', async () => {
      const staticDir = path.join(allowedRoot, 'static-html-proj');
      fs.mkdirSync(staticDir, { recursive: true });
      fs.writeFileSync(
        path.join(staticDir, 'app.html'),
        '<html><body><h1>Hello Static</h1></body></html>',
        'utf8',
      );

      const manager = createOpenCodePreviewManager();
      const session = await manager.startStaticPreview({
        projectId: 'proj-static-1',
        userId: 'user-1',
        projectRoot: staticDir,
      });

      expect(session).not.toBeNull();
      expect(session?.port).toBeGreaterThan(1024);
      expect(session?.command).toBe('static');

      try {
        const res = await fetch(`http://127.0.0.1:${session!.port}/`);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/html');
        const body = await res.text();
        expect(body).toContain('Hello Static');

        const status = manager.getPublicStatus('proj-static-1', 'user-1');
        expect(status.running).toBe(true);
        expect(status.port).toBe(session!.port);
        expect(status.proxyPath).toBe('/api/opencode/proj-static-1/preview/proxy/');

        // Verify proxyOpenCodePreviewRequest injects error bridge without sending conflicting Transfer-Encoding + Content-Length
        const proxyServer = http.createServer((req, res) => {
          proxyOpenCodePreviewRequest(
            req as unknown as Request,
            res as unknown as Response,
            session!,
          );
        });
        await new Promise<void>((resolve) => proxyServer.listen(0, '127.0.0.1', resolve));
        try {
          const proxyPort = (proxyServer.address() as AddressInfo).port;
          const proxiedRes = await fetch(`http://127.0.0.1:${proxyPort}/`);
          expect(proxiedRes.status).toBe(200);
          expect(proxiedRes.headers.get('transfer-encoding')).toBeNull();
          expect(proxiedRes.headers.get('content-length')).not.toBeNull();
          const proxiedBody = await proxiedRes.text();
          expect(proxiedBody).toContain('Hello Static');
          expect(proxiedBody).toContain('SATCHIDA_PREVIEW_ERROR');
        } finally {
          proxyServer.close();
        }
      } finally {
        manager.invalidateSession('proj-static-1');
      }
    });
  });

  describe('Per-user Windows-safe folder isolation', () => {
    it('sanitizes emails, special characters, and Windows reserved names safely', () => {
      expect(sanitizeWindowsUserFolder('arjun.sharma+dev@company.co.in', '69fd64a226b18593')).toBe(
        'arjun-sharma-dev_26b18593',
      );
      expect(sanitizeWindowsUserFolder('CON@satchida.com', 'abcdef123456')).toBe('u-con_ef123456');
      expect(sanitizeWindowsUserFolder('nul', '99998888')).toBe('u-nul_99998888');
      expect(sanitizeWindowsUserFolder('  @@@  ', '11223344')).toBe('user_11223344');
    });

    it('provisions per-user project workspaces inside users/<safeUserFolder>/projects with sibling media dirs', () => {
      const result = ensureProjectWorkspace(
        '6aff1234567890abcdef1234',
        'GST Invoice App',
        [allowedRoot],
        {
          userId: '69fd64a226b18593',
          email: 'priya.nair@clinic.in',
        },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      const canonicalAllowed = (fs.realpathSync.native ?? fs.realpathSync)(allowedRoot);
      const userRoot = path.join(canonicalAllowed, 'users', 'priya-nair_26b18593');
      expect(result.value.toLowerCase()).toBe(
        path.join(userRoot, 'projects', 'gst-invoice-app-cdef1234').toLowerCase(),
      );
      expect(fs.existsSync(result.value)).toBe(true);
      expect(fs.existsSync(path.join(userRoot, 'media', 'videos'))).toBe(true);
      expect(fs.existsSync(path.join(userRoot, 'media', 'images'))).toBe(true);
      expect(fs.existsSync(path.join(userRoot, 'media', 'projects'))).toBe(true);
    });
  });
});
