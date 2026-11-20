import { logger } from '@librechat/data-schemas';
import type { Request, Response } from 'express';
import type { OpenCodeClient } from './client';
import { getSafeErrorMetadata } from '~/utils/errors';
import { isPathInsideRoot } from './paths';

const HEARTBEAT_INTERVAL_MS = 15_000;

let activeUpstreamSseConnections = 0;

export function getActiveOpenCodeSseCount(): number {
  return activeUpstreamSseConnections;
}

export interface RelayOpenCodeEventsParams {
  req: Request;
  res: Response;
  client: OpenCodeClient;
  projectRoot: string;
  sessionFilter?: string;
}

function extractEventSessionId(payload: Record<string, unknown>): string | undefined {
  const props = payload.properties;
  if (!props || typeof props !== 'object') {
    return undefined;
  }
  const record = props as Record<string, unknown>;
  if (typeof record.sessionID === 'string' && record.sessionID.length > 0) {
    return record.sessionID;
  }
  if (record.info && typeof record.info === 'object') {
    const info = record.info as Record<string, unknown>;
    if (typeof info.sessionID === 'string' && info.sessionID.length > 0) {
      return info.sessionID;
    }
    if (typeof info.id === 'string' && info.id.startsWith('ses')) {
      return info.id;
    }
  }
  if (record.part && typeof record.part === 'object') {
    const part = record.part as Record<string, unknown>;
    if (typeof part.sessionID === 'string' && part.sessionID.length > 0) {
      return part.sessionID;
    }
  }
  return undefined;
}

function shouldForwardEvent(
  payload: Record<string, unknown>,
  projectRoot: string,
  allowedSessions: Set<string>,
  sessionFilter?: string,
): boolean {
  const type = typeof payload.type === 'string' ? payload.type : '';
  if (type === 'server.connected' || type === 'server.heartbeat') {
    return true;
  }

  if (type === 'file.edited') {
    const props = payload.properties as Record<string, unknown> | undefined;
    const editedFile = typeof props?.file === 'string' ? props.file : '';
    return editedFile.length > 0 && isPathInsideRoot(projectRoot, editedFile);
  }

  if (type === 'session.created' || type === 'session.updated') {
    const props = payload.properties as Record<string, unknown> | undefined;
    const info = props?.info as Record<string, unknown> | undefined;
    const dir = typeof info?.directory === 'string' ? info.directory : '';
    const sid = typeof info?.id === 'string' ? info.id : undefined;
    if (dir && isPathInsideRoot(projectRoot, dir) && sid) {
      allowedSessions.add(sid);
      return !sessionFilter || sessionFilter === sid;
    }
    return false;
  }

  const eventSessionId = extractEventSessionId(payload);
  if (!eventSessionId) {
    return false;
  }
  if (sessionFilter) {
    return eventSessionId === sessionFilter;
  }
  return allowedSessions.has(eventSessionId);
}

/**
 * Relays OpenCode's `GET /event?directory=` SSE stream verbatim to an authenticated LibreChat client,
 * filtering events strictly to the authorized project/session and tearing down upstream connections
 * immediately when the client disconnects.
 */
export async function relayOpenCodeEvents({
  req,
  res,
  client,
  projectRoot,
  sessionFilter,
}: RelayOpenCodeEventsParams): Promise<void> {
  const upstreamAbort = new AbortController();
  const allowedSessions = new Set<string>();
  if (sessionFilter) {
    allowedSessions.add(sessionFilter);
  } else {
    const sessionsRes = await client.listSessions({ directory: projectRoot });
    if (sessionsRes.ok) {
      for (const session of sessionsRes.value) {
        if (session.directory && isPathInsideRoot(projectRoot, session.directory)) {
          allowedSessions.add(session.id);
        }
      }
    }
  }

  const lastEventIdHeader = req.headers['last-event-id'];
  let lastEventId: string | undefined;
  if (typeof lastEventIdHeader === 'string' && lastEventIdHeader.length > 0) {
    lastEventId = lastEventIdHeader;
  } else if (typeof req.query?.lastEventId === 'string' && req.query.lastEventId.length > 0) {
    lastEventId = req.query.lastEventId;
  }

  let cleanedUp = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let counted = false;

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }
    if (!upstreamAbort.signal.aborted) {
      upstreamAbort.abort();
    }
    if (counted) {
      counted = false;
      activeUpstreamSseConnections = Math.max(0, activeUpstreamSseConnections - 1);
    }
  };

  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);

  const streamResult = await client.openEventStream({
    directory: projectRoot,
    lastEventId,
    signal: upstreamAbort.signal,
  });

  if (!streamResult.ok || !streamResult.value.body) {
    cleanup();
    if (!res.headersSent) {
      res
        .status(streamResult.ok ? 502 : streamResult.error.status)
        .json({ error: { code: streamResult.ok ? 'UPSTREAM_ERROR' : streamResult.error.code } });
    }
    return;
  }

  if (cleanedUp) {
    try {
      await streamResult.value.body.cancel();
    } catch {
      /* ignore cancel error */
    }
    return;
  }

  activeUpstreamSseConnections += 1;
  counted = true;

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(': connected\n\n');

  heartbeatTimer = setInterval(() => {
    if (!cleanedUp && !res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, HEARTBEAT_INTERVAL_MS);

  const reader = streamResult.value.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processFrame = (rawFrame: string) => {
    const lines = rawFrame.split(/\r?\n/);
    let eventId = '';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('id:')) {
        eventId = line.slice(3).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length === 0) {
      return;
    }
    const rawData = dataLines.join('\n');
    let parsed: Record<string, unknown>;
    try {
      const candidate = JSON.parse(rawData) as unknown;
      if (!candidate || typeof candidate !== 'object') {
        return;
      }
      parsed = candidate as Record<string, unknown>;
    } catch {
      return;
    }

    if (!shouldForwardEvent(parsed, projectRoot, allowedSessions, sessionFilter)) {
      return;
    }

    if (cleanedUp || res.writableEnded) {
      return;
    }
    const outId = eventId || (typeof parsed.id === 'string' ? parsed.id : '');
    if (outId) {
      res.write(`id: ${outId}\n`);
    }
    res.write(`data: ${rawData}\n\n`);
  };

  try {
    while (!cleanedUp) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        if (frame.trim().length > 0) {
          processFrame(frame);
        }
      }
    }
  } catch (error) {
    if (!cleanedUp && !upstreamAbort.signal.aborted) {
      logger.warn(
        '[OpenCodeSSE] Upstream event stream ended with error',
        getSafeErrorMetadata(error),
      );
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    cleanup();
    if (!res.writableEnded) {
      res.end();
    }
  }
}
