import { logger } from '@librechat/data-schemas';
import { opencodeConfigSchema } from 'librechat-data-provider';
import type { AppConfig } from '@librechat/data-schemas';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { OpenCodePtyOwnership, OpenCodePtyRegistry } from './ptyRegistry';
import type { OpenCodeProjectRecord } from './paths';
import { buildOpenCodeBasicAuthHeader } from './client';
import { getSafeErrorMetadata } from '~/utils/errors';
import { resolveProjectRoot } from './paths';
import { sandboxedBrowserManager } from './browser';

const PTY_CONNECT_PATH_RE = /^\/api\/opencode\/pty\/(pty_[^/]+)\/connect$/;
const BROWSER_SCREENCAST_PATH_RE = /^\/api\/opencode\/([a-zA-Z0-9_-]+)\/browser\/screencast$/;
const WS_OPEN_STATE = 1;

export type OpenCodeWsPayload = string | Buffer | ArrayBuffer | Buffer[];

export interface OpenCodeWebSocketLike {
  readonly readyState: number;
  send: (data: OpenCodeWsPayload) => void;
  close: (code?: number, reason?: string) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
}

export interface OpenCodeWebSocketServerLike {
  handleUpgrade: (
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    cb: (clientWs: OpenCodeWebSocketLike) => void,
  ) => void;
}

export interface VerifiedWsJwt {
  id: string;
  tenantId?: string;
}

export interface OpenCodePtyUpgradeDeps {
  wss: OpenCodeWebSocketServerLike;
  registry: OpenCodePtyRegistry;
  getAppConfig: (options?: { tenantId?: string }) => Promise<AppConfig | null | undefined>;
  getChatProject: (userId: string, projectId: string) => Promise<OpenCodeProjectRecord | null>;
  verifyJwt: (token: string) => VerifiedWsJwt | null;
  createUpstreamWebSocket: (
    url: string,
    options?: { headers?: Record<string, string> },
  ) => OpenCodeWebSocketLike;
  getServerPassword?: () => string | undefined;
}

function rejectUpgrade(socket: Duplex, statusCode: number, statusText: string): void {
  try {
    if (!socket.destroyed) {
      socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
    }
  } catch {
    /* socket may already be closed */
  } finally {
    try {
      socket.destroy();
    } catch {
      /* socket already destroyed */
    }
  }
}

function extractJwtToken(req: IncomingMessage, url: URL): string | undefined {
  const authHeader = req.headers.authorization;
  const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (typeof authValue === 'string' && /^Bearer\s+/i.test(authValue)) {
    return authValue.replace(/^Bearer\s+/i, '').trim();
  }
  const queryToken = url.searchParams.get('token');
  if (queryToken && queryToken.length > 0) {
    return queryToken;
  }
  return undefined;
}

function buildUpstreamPtyWsUrl(baseUrl: string, ptyId: string, directory: string): string {
  const parsed = new URL(baseUrl);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  // spec: GET /pty/{ptyID}/connect?directory=<path> -> operations["pty.connect"]
  parsed.pathname = `/pty/${encodeURIComponent(ptyId)}/connect`;
  parsed.search = '';
  parsed.searchParams.set('directory', directory);
  return parsed.toString();
}

export function createOpenCodePtyUpgradeHandler(deps: OpenCodePtyUpgradeDeps) {
  const resolvePassword = deps.getServerPassword ?? (() => process.env.OPENCODE_SERVER_PASSWORD);

  return async function handleOpenCodePtyUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<boolean> {
    let url: URL;
    try {
      url = new URL(req.url ?? '', `http://${req.headers.host || 'localhost'}`);
    } catch {
      return false;
    }

    const browserMatch = url.pathname.match(BROWSER_SCREENCAST_PATH_RE);
    if (browserMatch) {
      const projectId = browserMatch[1];
      const jwtToken = extractJwtToken(req, url);
      if (!jwtToken) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return true;
      }
      const jwtUser = deps.verifyJwt(jwtToken);
      if (!jwtUser || !jwtUser.id) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return true;
      }

      deps.wss.handleUpgrade(req, socket, head, async (clientWs) => {
        try {
          const session = await sandboxedBrowserManager.getOrCreateSession({
            projectId,
            userId: jwtUser.id,
          });
          await sandboxedBrowserManager.startScreencast(projectId, clientWs as any);
        } catch (err) {
          logger.error(`[OpenCodeWS] Failed to start browser screencast for ${projectId}:`, err);
          clientWs.close(1011, 'Browser session error');
        }
      });
      return true;
    }

    const match = url.pathname.match(PTY_CONNECT_PATH_RE);
    if (!match) {
      return false;
    }

    const ptyId = match[1];
    try {
      const jwtToken = extractJwtToken(req, url);
      const queryTicket = url.searchParams.get('ticket');

      let jwtUser: VerifiedWsJwt | null = null;
      if (jwtToken) {
        try {
          jwtUser = deps.verifyJwt(jwtToken);
        } catch {
          jwtUser = null;
        }
        if (!jwtUser || !jwtUser.id) {
          logger.warn('[OpenCodeWS] rejected upgrade', { reason: 'invalid_jwt', ptyId });
          rejectUpgrade(socket, 401, 'Unauthorized');
          return true;
        }
      }

      let ownership: OpenCodePtyOwnership | null = null;
      if (queryTicket) {
        ownership = deps.registry.consumeConnectTicket(ptyId, queryTicket);
        if (!ownership) {
          logger.warn('[OpenCodeWS] rejected upgrade', {
            reason: 'invalid_ticket',
            ptyId,
            hasOwner: Boolean(deps.registry.getPtyOwner(ptyId)),
          });
          rejectUpgrade(socket, 401, 'Unauthorized');
          return true;
        }
        if (jwtUser && jwtUser.id !== ownership.userId) {
          logger.warn('[OpenCodeWS] rejected upgrade', { reason: 'jwt_owner_mismatch', ptyId });
          rejectUpgrade(socket, 403, 'Forbidden');
          return true;
        }
      } else if (jwtUser) {
        const candidate = deps.registry.getPtyOwner(ptyId);
        if (!candidate || candidate.userId !== jwtUser.id) {
          logger.warn('[OpenCodeWS] rejected upgrade', {
            reason: 'jwt_not_owner',
            ptyId,
            hasOwner: Boolean(candidate),
          });
          rejectUpgrade(socket, 403, 'Forbidden');
          return true;
        }
        ownership = candidate;
      } else {
        logger.warn('[OpenCodeWS] rejected upgrade', { reason: 'no_credentials', ptyId });
        rejectUpgrade(socket, 401, 'Unauthorized');
        return true;
      }

      const appConfig = await deps.getAppConfig({ tenantId: ownership.tenantId });
      const parsedConfig = opencodeConfigSchema.safeParse(appConfig?.opencode ?? {});
      const config = parsedConfig.success ? parsedConfig.data : opencodeConfigSchema.parse({});
      if (!config.enabled) {
        rejectUpgrade(socket, 403, 'Forbidden');
        return true;
      }

      const password = resolvePassword();
      const authHeader = buildOpenCodeBasicAuthHeader('opencode', password);
      if (!authHeader) {
        logger.error('[OpenCodeWS] Refusing PTY upgrade: OPENCODE_SERVER_PASSWORD is unset');
        rejectUpgrade(socket, 503, 'Service Unavailable');
        return true;
      }

      const project = await deps.getChatProject(ownership.userId, ownership.projectId);
      if (!project) {
        rejectUpgrade(socket, 403, 'Forbidden');
        return true;
      }

      const rootCheck = resolveProjectRoot(project, config.allowedRoots);
      if (!rootCheck.ok || rootCheck.value !== ownership.projectRoot) {
        rejectUpgrade(socket, 409, 'Conflict');
        return true;
      }

      const upstreamUrl = buildUpstreamPtyWsUrl(config.baseUrl, ptyId, ownership.projectRoot);

      deps.wss.handleUpgrade(req, socket, head, (clientWs) => {
        const targetWs = deps.createUpstreamWebSocket(upstreamUrl, {
          headers: { Authorization: authHeader },
        });

        const pendingFromClient: OpenCodeWsPayload[] = [];

        clientWs.on('message', (msg, isBinary) => {
          const payload =
            !isBinary && Buffer.isBuffer(msg) ? msg.toString('utf8') : (msg as OpenCodeWsPayload);
          if (targetWs.readyState === WS_OPEN_STATE) {
            targetWs.send(payload);
          } else {
            pendingFromClient.push(payload);
          }
        });

        targetWs.on('open', () => {
          while (pendingFromClient.length > 0 && targetWs.readyState === WS_OPEN_STATE) {
            const nextPayload = pendingFromClient.shift();
            if (nextPayload !== undefined) {
              targetWs.send(nextPayload);
            }
          }
        });

        targetWs.on('message', (data, isBinary) => {
          if (clientWs.readyState === WS_OPEN_STATE) {
            const out =
              !isBinary && Buffer.isBuffer(data)
                ? data.toString('utf8')
                : (data as OpenCodeWsPayload);
            clientWs.send(out);
          }
        });

        const closeBoth = () => {
          try {
            clientWs.close();
          } catch {
            /* socket already closed */
          }
          try {
            targetWs.close();
          } catch {
            /* socket already closed */
          }
        };

        clientWs.on('close', closeBoth);
        clientWs.on('error', closeBoth);
        targetWs.on('close', closeBoth);
        targetWs.on('error', closeBoth);
      });
      return true;
    } catch (error) {
      logger.error('[OpenCodeWS] PTY upgrade failed', getSafeErrorMetadata(error));
      rejectUpgrade(socket, 500, 'Internal Server Error');
      return true;
    }
  };
}
