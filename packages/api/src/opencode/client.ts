import { logger } from '@librechat/data-schemas';
import type { components, operations } from './generated';
import type { OpenCodeResult } from './errors';
import { getSafeErrorMetadata } from '~/utils/errors';
import { err, ok } from './errors';

// spec: GET /global/health -> operations["global.health"].responses[200].content["application/json"]
export type OpenCodeHealthResponse =
  operations['global.health']['responses'][200]['content']['application/json'];

// spec: POST /session -> operations["session.create"].requestBody.content["application/json"]
export type OpenCodeCreateSessionBody = NonNullable<
  operations['session.create']['requestBody']
>['content']['application/json'];

// spec: GET/POST /session -> components["schemas"]["Session"]
export type OpenCodeSession = components['schemas']['Session'];

// spec: POST /session/{sessionID}/prompt_async -> operations["session.prompt_async"].requestBody.content["application/json"]
export type OpenCodePromptAsyncBody = NonNullable<
  operations['session.prompt_async']['requestBody']
>['content']['application/json'];

// spec: GET /session/{sessionID}/message -> operations["session.messages"].responses[200].content["application/json"]
export type OpenCodeMessageList =
  operations['session.messages']['responses'][200]['content']['application/json'];

// spec: GET /session/{sessionID}/diff -> operations["session.diff"].responses[200].content["application/json"]
export type OpenCodeSessionDiffList =
  operations['session.diff']['responses'][200]['content']['application/json'];

// spec: POST /session/{sessionID}/revert -> operations["session.revert"].requestBody.content["application/json"]
export type OpenCodeRevertSessionBody = NonNullable<
  operations['session.revert']['requestBody']
>['content']['application/json'];

// spec: PATCH /session/{sessionID} -> operations["session.update"].requestBody.content["application/json"]
export type OpenCodeUpdateSessionBody = NonNullable<
  operations['session.update']['requestBody']
>['content']['application/json'];

// spec: POST /permission/{requestID}/reply -> operations["permission.reply"].requestBody.content["application/json"]
export type OpenCodePermissionReplyBody = NonNullable<
  operations['permission.reply']['requestBody']
>['content']['application/json'];

// spec: GET /permission -> components["schemas"]["PermissionRequest"]
export type OpenCodePermissionRequest = components['schemas']['PermissionRequest'];

// spec: GET /question -> components["schemas"]["QuestionRequest"]
export type OpenCodeQuestionRequest = components['schemas']['QuestionRequest'];

// spec: POST /question/{requestID}/reply -> operations["question.reply"].requestBody.content["application/json"]
export type OpenCodeQuestionReplyBody = NonNullable<
  operations['question.reply']['requestBody']
>['content']['application/json'];

// spec: GET /agent -> operations["app.agents"].responses[200].content["application/json"]
export type OpenCodeAgentList =
  operations['app.agents']['responses'][200]['content']['application/json'];

// spec: GET /config/providers -> operations["config.providers"].responses[200].content["application/json"]
export type OpenCodeProvidersResult =
  operations['config.providers']['responses'][200]['content']['application/json'];

// spec: POST /pty -> operations["pty.create"].requestBody.content["application/json"]
export type OpenCodeCreatePtyBody = NonNullable<
  operations['pty.create']['requestBody']
>['content']['application/json'];

// spec: POST /pty -> components["schemas"]["Pty"]
export type OpenCodePty = components['schemas']['Pty'];

// spec: POST /pty/{ptyID}/connect-token -> components["schemas"]["PtyTicketConnectToken"]
export type OpenCodePtyConnectToken = components['schemas']['PtyTicketConnectToken'];

// spec: GET /vcs -> components["schemas"]["VcsInfo"]
export type OpenCodeVcsInfo = components['schemas']['VcsInfo'];

// spec: GET /vcs/status -> components["schemas"]["VcsFileStatus"][]
export type OpenCodeVcsStatusList = components['schemas']['VcsFileStatus'][];

// spec: GET /vcs/diff -> components["schemas"]["VcsFileDiff"][]
export type OpenCodeVcsDiffList = components['schemas']['VcsFileDiff'][];

export interface OpenCodeClientOptions {
  baseUrl: string;
  password?: string;
  username?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export interface CreateSessionParams {
  directory: string;
  body?: OpenCodeCreateSessionBody;
  signal?: AbortSignal;
}

export interface SessionScopedParams {
  sessionId: string;
  directory: string;
  signal?: AbortSignal;
}

export interface SendPromptAsyncParams extends SessionScopedParams {
  body: OpenCodePromptAsyncBody;
}

export interface RevertSessionParams extends SessionScopedParams {
  body: OpenCodeRevertSessionBody;
}

export interface UpdateSessionParams extends SessionScopedParams {
  body: OpenCodeUpdateSessionBody;
}

export interface CreatePtyParams {
  directory: string;
  body?: OpenCodeCreatePtyBody;
  signal?: AbortSignal;
}

export interface CreatePtyConnectTokenParams {
  ptyId: string;
  directory: string;
  signal?: AbortSignal;
}

export interface ReplyPermissionParams {
  requestId: string;
  directory: string;
  body: OpenCodePermissionReplyBody;
  signal?: AbortSignal;
}

export interface ReplyQuestionParams {
  requestId: string;
  directory: string;
  body: OpenCodeQuestionReplyBody;
  signal?: AbortSignal;
}

export interface RejectQuestionParams {
  requestId: string;
  directory: string;
  signal?: AbortSignal;
}

export interface OpenEventStreamParams {
  directory: string;
  lastEventId?: string;
  signal: AbortSignal;
}

export interface OpenCodeClient {
  getHealth: (signal?: AbortSignal) => Promise<OpenCodeResult<OpenCodeHealthResponse>>;
  listSessions: (params: {
    directory: string;
    signal?: AbortSignal;
  }) => Promise<OpenCodeResult<OpenCodeSession[]>>;
  getSession: (params: SessionScopedParams) => Promise<OpenCodeResult<OpenCodeSession>>;
  createSession: (params: CreateSessionParams) => Promise<OpenCodeResult<OpenCodeSession>>;
  updateSession: (params: UpdateSessionParams) => Promise<OpenCodeResult<OpenCodeSession>>;
  deleteSession: (params: SessionScopedParams) => Promise<OpenCodeResult<boolean>>;
  sendPromptAsync: (params: SendPromptAsyncParams) => Promise<OpenCodeResult<void>>;
  abortSession: (params: SessionScopedParams) => Promise<OpenCodeResult<boolean>>;
  getSessionMessages: (
    params: SessionScopedParams & { limit?: number },
  ) => Promise<OpenCodeResult<OpenCodeMessageList>>;
  getSessionDiff: (
    params: SessionScopedParams & { messageId?: string },
  ) => Promise<OpenCodeResult<OpenCodeSessionDiffList>>;
  revertSession: (params: RevertSessionParams) => Promise<OpenCodeResult<OpenCodeSession>>;
  unrevertSession: (params: SessionScopedParams) => Promise<OpenCodeResult<OpenCodeSession>>;
  listPermissions: (params: {
    directory: string;
    signal?: AbortSignal;
  }) => Promise<OpenCodeResult<OpenCodePermissionRequest[]>>;
  replyPermission: (params: ReplyPermissionParams) => Promise<OpenCodeResult<boolean>>;
  listQuestions: (params: {
    directory: string;
    signal?: AbortSignal;
  }) => Promise<OpenCodeResult<OpenCodeQuestionRequest[]>>;
  replyQuestion: (params: ReplyQuestionParams) => Promise<OpenCodeResult<boolean>>;
  rejectQuestion: (params: RejectQuestionParams) => Promise<OpenCodeResult<boolean>>;
  getProviders: (params: {
    directory: string;
    signal?: AbortSignal;
  }) => Promise<OpenCodeResult<OpenCodeProvidersResult>>;
  listAgents: (params: {
    directory: string;
    signal?: AbortSignal;
  }) => Promise<OpenCodeResult<OpenCodeAgentList>>;
  createPty: (params: CreatePtyParams) => Promise<OpenCodeResult<OpenCodePty>>;
  updatePty: (params: {
    ptyId: string;
    directory: string;
    size?: { rows: number; cols: number };
    title?: string;
    signal?: AbortSignal;
  }) => Promise<OpenCodeResult<OpenCodePty>>;
  removePty: (params: {
    ptyId: string;
    directory: string;
    signal?: AbortSignal;
  }) => Promise<OpenCodeResult<boolean>>;
  createPtyConnectToken: (
    params: CreatePtyConnectTokenParams,
  ) => Promise<OpenCodeResult<OpenCodePtyConnectToken>>;
  getVcsInfo: (params: {
    directory: string;
    signal?: AbortSignal;
  }) => Promise<OpenCodeResult<OpenCodeVcsInfo>>;
  getVcsStatus: (params: {
    directory: string;
    signal?: AbortSignal;
  }) => Promise<OpenCodeResult<OpenCodeVcsStatusList>>;
  getVcsDiff: (params: {
    directory: string;
    signal?: AbortSignal;
  }) => Promise<OpenCodeResult<OpenCodeVcsDiffList>>;
  openEventStream: (params: OpenEventStreamParams) => Promise<OpenCodeResult<globalThis.Response>>;
}

export function buildOpenCodeBasicAuthHeader(
  username: string,
  password: string | undefined,
): string | undefined {
  if (!password || password.length === 0) {
    return undefined;
  }
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

function sanitizeCreateSessionBody(
  body: OpenCodeCreateSessionBody | undefined,
): OpenCodeCreateSessionBody {
  if (!body) {
    return {};
  }
  const clean: OpenCodeCreateSessionBody = {};
  if (body.parentID !== undefined) {
    clean.parentID = body.parentID;
  }
  if (body.title !== undefined) {
    clean.title = body.title;
  }
  if (body.agent !== undefined) {
    clean.agent = body.agent;
  }
  if (body.model !== undefined) {
    clean.model = body.model;
  }
  if (body.metadata !== undefined) {
    clean.metadata = body.metadata;
  }
  if (body.permission !== undefined) {
    clean.permission = body.permission;
  }
  if (body.workspaceID !== undefined) {
    clean.workspaceID = body.workspaceID;
  }
  return clean;
}

function sanitizePromptAsyncBody(body: OpenCodePromptAsyncBody): OpenCodePromptAsyncBody {
  const clean: OpenCodePromptAsyncBody = {
    parts: body.parts,
  };
  if (body.messageID !== undefined) {
    clean.messageID = body.messageID;
  }
  if (body.model !== undefined) {
    clean.model = {
      providerID: body.model.providerID,
      modelID: body.model.modelID,
    };
  }
  if (body.agent !== undefined) {
    clean.agent = body.agent;
  }
  if (body.noReply !== undefined) {
    clean.noReply = body.noReply;
  }
  if (body.tools !== undefined) {
    clean.tools = body.tools;
  }
  if (body.format !== undefined) {
    clean.format = body.format;
  }
  if (body.system !== undefined) {
    clean.system = body.system;
  }
  if (body.variant !== undefined) {
    clean.variant = body.variant;
  }
  return clean;
}

function sanitizeCreatePtyBody(body: OpenCodeCreatePtyBody | undefined): OpenCodeCreatePtyBody {
  if (!body) {
    return {};
  }
  const clean: OpenCodeCreatePtyBody = {};
  if (body.command !== undefined) {
    clean.command = body.command;
  }
  if (body.args !== undefined) {
    clean.args = body.args;
  }
  if (body.cwd !== undefined) {
    clean.cwd = body.cwd;
  }
  if (body.title !== undefined) {
    clean.title = body.title;
  }
  if (body.env !== undefined) {
    clean.env = body.env;
  }
  return clean;
}

function mapUpstreamStatus(status: number): OpenCodeResult<never> {
  if (status === 401 || status === 403) {
    return err('UPSTREAM_AUTH_FAILED', 502);
  }
  if (status === 400 || status === 422) {
    return err('INVALID_REQUEST', 400);
  }
  if (status === 404) {
    return err('FILE_NOT_FOUND', 404);
  }
  return err('UPSTREAM_ERROR', 502);
}

export function createOpenCodeClient(options: OpenCodeClientOptions): OpenCodeClient {
  const normalizedBaseUrl = options.baseUrl.replace(/\/+$/, '');
  const username = options.username ?? 'opencode';
  const authHeader = buildOpenCodeBasicAuthHeader(username, options.password);
  const fetchFn = options.fetchImpl ?? globalThis.fetch;

  async function requestJson<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpointPath: string,
    query?: Record<string, string | undefined>,
    body?: unknown,
    externalSignal?: AbortSignal,
    expectEmptyBody = false,
  ): Promise<OpenCodeResult<T>> {
    if (!authHeader) {
      logger.error('[OpenCodeClient] Refusing upstream call: OPENCODE_SERVER_PASSWORD is unset', {
        endpointPath,
      });
      return err('OPENCODE_MISCONFIGURED', 503);
    }

    const url = new URL(`${normalizedBaseUrl}${endpointPath}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs);

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        return err('UPSTREAM_UNAVAILABLE', 503);
      }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: authHeader,
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetchFn(url.toString(), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        logger.warn('[OpenCodeClient] Upstream returned non-2xx status', {
          endpointPath,
          status: response.status,
        });
        return mapUpstreamStatus(response.status);
      }

      if (expectEmptyBody || response.status === 204) {
        return ok(undefined as T);
      }

      const data = (await response.json()) as T;
      return ok(data);
    } catch (error) {
      if (timedOut) {
        logger.warn('[OpenCodeClient] Upstream request timed out', {
          endpointPath,
          timeoutMs: options.timeoutMs,
        });
        return err('UPSTREAM_TIMEOUT', 504);
      }
      logger.warn('[OpenCodeClient] Upstream request failed', {
        endpointPath,
        ...getSafeErrorMetadata(error),
      });
      return err('UPSTREAM_UNAVAILABLE', 503);
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  return {
    // spec: GET /global/health -> operations["global.health"]
    getHealth: (signal?: AbortSignal) =>
      requestJson<OpenCodeHealthResponse>('GET', '/global/health', undefined, undefined, signal),

    // spec: GET /session?directory=<path> -> operations["session.list"]
    listSessions: ({ directory, signal }) =>
      requestJson<OpenCodeSession[]>('GET', '/session', { directory }, undefined, signal),

    // spec: GET /session/{sessionID}?directory=<path> -> operations["session.get"]
    getSession: ({ sessionId, directory, signal }) =>
      requestJson<OpenCodeSession>(
        'GET',
        `/session/${encodeURIComponent(sessionId)}`,
        { directory },
        undefined,
        signal,
      ),

    // spec: POST /session?directory=<path> -> operations["session.create"] (additionalProperties: false)
    createSession: ({ directory, body, signal }) =>
      requestJson<OpenCodeSession>(
        'POST',
        '/session',
        { directory },
        sanitizeCreateSessionBody(body),
        signal,
      ),

    // spec: POST /session/{sessionID}/prompt_async?directory=<path> -> operations["session.prompt_async"] (204)
    sendPromptAsync: ({ sessionId, directory, body, signal }) =>
      requestJson<void>(
        'POST',
        `/session/${encodeURIComponent(sessionId)}/prompt_async`,
        { directory },
        sanitizePromptAsyncBody(body),
        signal,
        true,
      ),

    // spec: POST /session/{sessionID}/abort?directory=<path> -> operations["session.abort"]
    abortSession: ({ sessionId, directory, signal }) =>
      requestJson<boolean>(
        'POST',
        `/session/${encodeURIComponent(sessionId)}/abort`,
        { directory },
        undefined,
        signal,
      ),

    // spec: GET /session/{sessionID}/message?directory=<path> -> operations["session.messages"]
    getSessionMessages: ({ sessionId, directory, limit, signal }) =>
      requestJson<OpenCodeMessageList>(
        'GET',
        `/session/${encodeURIComponent(sessionId)}/message`,
        {
          directory,
          ...(limit !== undefined && { limit: String(limit) }),
        },
        undefined,
        signal,
      ),

    // spec: GET /session/{sessionID}/diff?directory=<path> -> operations["session.diff"]
    getSessionDiff: ({ sessionId, directory, messageId, signal }) =>
      requestJson<OpenCodeSessionDiffList>(
        'GET',
        `/session/${encodeURIComponent(sessionId)}/diff`,
        {
          directory,
          ...(messageId !== undefined && { messageID: messageId }),
        },
        undefined,
        signal,
      ),

    // spec: POST /session/{sessionID}/revert?directory=<path> -> operations["session.revert"]
    revertSession: ({ sessionId, directory, body, signal }) =>
      requestJson<OpenCodeSession>(
        'POST',
        `/session/${encodeURIComponent(sessionId)}/revert`,
        { directory },
        {
          messageID: body.messageID,
          ...(body.partID !== undefined && { partID: body.partID }),
        },
        signal,
      ),

    // spec: POST /session/{sessionID}/unrevert?directory=<path> -> operations["session.unrevert"]
    unrevertSession: ({ sessionId, directory, signal }) =>
      requestJson<OpenCodeSession>(
        'POST',
        `/session/${encodeURIComponent(sessionId)}/unrevert`,
        { directory },
        undefined,
        signal,
      ),

    // spec: PATCH /session/{sessionID}?directory=<path> -> operations["session.update"]
    updateSession: ({ sessionId, directory, body, signal }) =>
      requestJson<OpenCodeSession>(
        'PATCH',
        `/session/${encodeURIComponent(sessionId)}`,
        { directory },
        body,
        signal,
      ),

    // spec: DELETE /session/{sessionID}?directory=<path> -> operations["session.delete"]
    deleteSession: ({ sessionId, directory, signal }) =>
      requestJson<boolean>(
        'DELETE',
        `/session/${encodeURIComponent(sessionId)}`,
        { directory },
        undefined,
        signal,
      ),

    // spec: GET /permission?directory=<path> -> operations["permission.list"]
    listPermissions: ({ directory, signal }) =>
      requestJson<OpenCodePermissionRequest[]>(
        'GET',
        '/permission',
        { directory },
        undefined,
        signal,
      ),

    // spec: POST /permission/{requestID}/reply?directory=<path> -> operations["permission.reply"]
    replyPermission: ({ requestId, directory, body, signal }) =>
      requestJson<boolean>(
        'POST',
        `/permission/${encodeURIComponent(requestId)}/reply`,
        { directory },
        {
          reply: body.reply,
          ...(body.message !== undefined && { message: body.message }),
        },
        signal,
      ),

    // spec: GET /question?directory=<path> -> operations["question.list"]
    listQuestions: ({ directory, signal }) =>
      requestJson<OpenCodeQuestionRequest[]>('GET', '/question', { directory }, undefined, signal),

    // spec: POST /question/{requestID}/reply?directory=<path> -> operations["question.reply"]
    replyQuestion: ({ requestId, directory, body, signal }) =>
      requestJson<boolean>(
        'POST',
        `/question/${encodeURIComponent(requestId)}/reply`,
        { directory },
        { answers: body.answers },
        signal,
      ),

    // spec: POST /question/{requestID}/reject?directory=<path> -> operations["question.reject"]
    rejectQuestion: ({ requestId, directory, signal }) =>
      requestJson<boolean>(
        'POST',
        `/question/${encodeURIComponent(requestId)}/reject`,
        { directory },
        undefined,
        signal,
      ),

    // spec: GET /config/providers?directory=<path> -> operations["config.providers"]
    getProviders: ({ directory, signal }) =>
      requestJson<OpenCodeProvidersResult>(
        'GET',
        '/config/providers',
        { directory },
        undefined,
        signal,
      ),

    // spec: GET /agent?directory=<path> -> operations["app.agents"]
    listAgents: ({ directory, signal }) =>
      requestJson<OpenCodeAgentList>('GET', '/agent', { directory }, undefined, signal),

    // spec: POST /pty?directory=<path> -> operations["pty.create"] (additionalProperties: false)
    createPty: ({ directory, body, signal }) =>
      requestJson<OpenCodePty>('POST', '/pty', { directory }, sanitizeCreatePtyBody(body), signal),

    // spec: PUT /pty/{ptyID}?directory=<path> -> operations["pty.update"]
    updatePty: ({ ptyId, directory, size, title, signal }) =>
      requestJson<OpenCodePty>(
        'PUT',
        `/pty/${encodeURIComponent(ptyId)}`,
        { directory },
        { ...(size !== undefined && { size }), ...(title !== undefined && { title }) },
        signal,
      ),

    // spec: DELETE /pty/{ptyID}?directory=<path> -> operations["pty.remove"]
    removePty: ({ ptyId, directory, signal }) =>
      requestJson<boolean>(
        'DELETE',
        `/pty/${encodeURIComponent(ptyId)}`,
        { directory },
        undefined,
        signal,
      ),

    // spec: POST /pty/{ptyID}/connect-token?directory=<path> -> operations["pty.connectToken"]
    createPtyConnectToken: ({ ptyId, directory, signal }) =>
      requestJson<OpenCodePtyConnectToken>(
        'POST',
        `/pty/${encodeURIComponent(ptyId)}/connect-token`,
        { directory },
        undefined,
        signal,
      ),

    // spec: GET /vcs?directory=<path> -> operations["vcs.get"]
    getVcsInfo: ({ directory, signal }) =>
      requestJson<OpenCodeVcsInfo>('GET', '/vcs', { directory }, undefined, signal),

    // spec: GET /vcs/status?directory=<path> -> operations["vcs.status"]
    getVcsStatus: ({ directory, signal }) =>
      requestJson<OpenCodeVcsStatusList>('GET', '/vcs/status', { directory }, undefined, signal),

    // spec: GET /vcs/diff?directory=<path> -> operations["vcs.diff"]
    getVcsDiff: ({ directory, signal }) =>
      requestJson<OpenCodeVcsDiffList>('GET', '/vcs/diff', { directory }, undefined, signal),

    // spec: GET /event?directory=<path> -> operations["event.subscribe"] (text/event-stream)
    openEventStream: async ({ directory, lastEventId, signal }) => {
      if (!authHeader) {
        logger.error('[OpenCodeClient] Refusing SSE call: OPENCODE_SERVER_PASSWORD is unset');
        return err('OPENCODE_MISCONFIGURED', 503);
      }

      const url = new URL(`${normalizedBaseUrl}/event`);
      url.searchParams.set('directory', directory);

      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
        Authorization: authHeader,
        'Cache-Control': 'no-cache',
      };
      if (lastEventId) {
        headers['Last-Event-ID'] = lastEventId;
      }

      try {
        const response = await fetchFn(url.toString(), {
          method: 'GET',
          headers,
          signal,
        });
        if (!response.ok || !response.body) {
          logger.warn('[OpenCodeClient] Upstream SSE returned non-2xx status', {
            status: response.status,
          });
          return mapUpstreamStatus(response.status);
        }
        return ok(response);
      } catch (error) {
        logger.warn('[OpenCodeClient] Upstream SSE connection failed', getSafeErrorMetadata(error));
        return err('UPSTREAM_UNAVAILABLE', 503);
      }
    },
  };
}
