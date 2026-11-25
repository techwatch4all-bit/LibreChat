import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { logger } from '@librechat/data-schemas';
import type { Request, Response } from 'express';
import type { AddressInfo } from 'node:net';
import type { OpenCodeWebSocketLike } from './ws';
import type { OpenCodeClient } from './client';
import { buildOpenCodeBasicAuthHeader } from './client';
import { getSafeErrorMetadata } from '~/utils/errors';

// Never allow preview proxy to target core node infrastructure ports
const RESERVED_NODE_PORTS = new Set([3080, 4000, 4096, 4099, 4747, 8080, 8188, 8700, 27017]);
const MAX_LOG_LINES = 120;
/* eslint-disable no-control-regex */
const ANSI_OSC_RE = /\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g;
const ANSI_DCS_RE = /\x1B[PX^_][^\x1B]*\x1B\\/g;
const ANSI_CSI_RE = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const ANSI_TWO_BYTE_RE = /\x1B[@-Z\\-_]/g;
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
/* eslint-enable no-control-regex */
const PTY_CURSOR_FRAME_RE = /^\{"cursor"\s*:\s*\d+\}$/;

const STATIC_MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export interface OpenCodePreviewSession {
  readonly projectId: string;
  readonly userId: string;
  readonly projectRoot: string;
  readonly ptyId: string | null;
  readonly command: string;
  readonly previewToken: string;
  readonly tokenDigest: Buffer;
  port: number | null;
  readonly logs: string[];
  ws?: OpenCodeWebSocketLike;
  staticServer?: http.Server;
  readonly startedAt: number;
}

export interface OpenCodePreviewPublicStatus {
  running: boolean;
  ptyId: string | null;
  port: number | null;
  proxyPath: string | null;
  command: string | null;
  logs: string[];
  availableScripts?: string[];
  recommendedCommand?: string;
}

export interface OpenCodePreviewManager {
  getSession: (projectId: string) => OpenCodePreviewSession | null;
  invalidateSession: (projectId: string) => void;
  getPublicStatus: (projectId: string, userId: string) => OpenCodePreviewPublicStatus;
  verifyPreviewCookie: (
    projectId: string,
    cookieValue: string | undefined,
  ) => OpenCodePreviewSession | null;
  startPreview: (params: {
    projectId: string;
    userId: string;
    projectRoot: string;
    command: string;
    args: string[];
    baseUrl: string;
    password: string;
    client: OpenCodeClient;
    createUpstreamWebSocket?: (
      url: string,
      options?: { headers?: Record<string, string> },
    ) => OpenCodeWebSocketLike;
  }) => Promise<OpenCodePreviewSession | null>;
  startStaticPreview: (params: {
    projectId: string;
    userId: string;
    projectRoot: string;
    client?: OpenCodeClient;
  }) => Promise<OpenCodePreviewSession | null>;
  stopPreview: (params: {
    projectId: string;
    userId: string;
    client: OpenCodeClient;
  }) => Promise<boolean>;
}

function sha256(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

export function stripAnsi(text: string): string {
  return text
    .replace(ANSI_OSC_RE, '')
    .replace(ANSI_DCS_RE, '')
    .replace(ANSI_CSI_RE, '')
    .replace(ANSI_TWO_BYTE_RE, '')
    .replace(CONTROL_CHARS_RE, '');
}

function resolveDefaultHtmlFile(projectRoot: string): string | null {
  for (const candidate of ['index.html', 'app.html']) {
    if (fs.existsSync(path.join(projectRoot, candidate))) {
      return candidate;
    }
  }
  try {
    const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
    const htmlFile = entries.find((entry) => entry.isFile() && /\.(?:html|htm)$/i.test(entry.name));
    return htmlFile ? htmlFile.name : null;
  } catch {
    return null;
  }
}

function isInsideRoot(rootDir: string, candidatePath: string): boolean {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedCandidate = path.resolve(candidatePath);
  const rel = path.relative(resolvedRoot, resolvedCandidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Extracts a real listening loopback port from dev-server stdout/stderr text.
 * Rejects privileged ports (<1024), invalid ports (>65535), and reserved node service ports.
 */
export function detectPortFromOutput(rawText: string): number | null {
  const clean = stripAnsi(rawText);
  const patterns = [
    /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d{2,5})/gi,
    /(?:listening|running|started|ready|serving)\s+(?:on|at)\s+(?:https?:\/\/[^\s:]+:|port\s+|:)(\d{2,5})/gi,
  ];

  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(clean)) !== null) {
      const candidate = Number.parseInt(match[1], 10);
      if (
        Number.isInteger(candidate) &&
        candidate >= 1024 &&
        candidate <= 65535 &&
        !RESERVED_NODE_PORTS.has(candidate)
      ) {
        return candidate;
      }
    }
  }
  return null;
}

export function getPreviewCookieName(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `opencode_preview_${safeId}`;
}

export function getPreviewProxyBasePath(projectId: string): string {
  return `/api/opencode/${encodeURIComponent(projectId)}/preview/proxy/`;
}

export function createOpenCodePreviewManager(): OpenCodePreviewManager {
  const sessions = new Map<string, OpenCodePreviewSession>();

  function closeSessionResources(session: OpenCodePreviewSession | undefined): void {
    if (!session) {
      return;
    }
    if (session.ws) {
      try {
        session.ws.close();
      } catch {
        /* ignore */
      }
      session.ws = undefined;
    }
    if (session.staticServer) {
      try {
        session.staticServer.close();
      } catch {
        /* ignore */
      }
      session.staticServer = undefined;
    }
  }

  return {
    getSession(projectId) {
      return sessions.get(projectId) ?? null;
    },

    invalidateSession(projectId) {
      const existing = sessions.get(projectId);
      if (existing) {
        closeSessionResources(existing);
        sessions.delete(projectId);
      }
    },

    getPublicStatus(projectId, userId) {
      const entry = sessions.get(projectId);
      if (!entry || entry.userId !== userId) {
        return {
          running: false,
          ptyId: null,
          port: null,
          proxyPath: null,
          command: null,
          logs: [],
        };
      }
      const timedOutWaitingForPort =
        entry.port === null &&
        (Date.now() - entry.startedAt > 22_000 || (!entry.ws && !entry.staticServer));
      if (timedOutWaitingForPort) {
        return {
          running: false,
          ptyId: entry.ptyId,
          port: null,
          proxyPath: null,
          command: entry.command,
          logs: [...entry.logs],
        };
      }
      return {
        running: true,
        ptyId: entry.ptyId,
        port: entry.port,
        proxyPath: entry.port !== null ? getPreviewProxyBasePath(projectId) : null,
        command: entry.command,
        logs: [...entry.logs],
      };
    },

    verifyPreviewCookie(projectId, cookieValue) {
      if (!cookieValue || cookieValue.length === 0) {
        return null;
      }
      const entry = sessions.get(projectId);
      if (!entry) {
        return null;
      }
      const candidateDigest = sha256(cookieValue);
      if (!crypto.timingSafeEqual(entry.tokenDigest, candidateDigest)) {
        return null;
      }
      return entry;
    },

    async startStaticPreview({ projectId, userId, projectRoot, client }) {
      const existing = sessions.get(projectId);
      if (existing && existing.userId === userId) {
        closeSessionResources(existing);
        if (existing.ptyId && client) {
          await client.removePty({ ptyId: existing.ptyId, directory: existing.projectRoot });
        }
        sessions.delete(projectId);
      }

      const defaultHtml = resolveDefaultHtmlFile(projectRoot);
      const server = http.createServer((req, res) => {
        try {
          const urlPath = new URL(req.url || '/', 'http://127.0.0.1').pathname;
          const decodedPath = decodeURIComponent(urlPath);
          const relPath =
            decodedPath === '/' || decodedPath === ''
              ? defaultHtml || 'index.html'
              : decodedPath.replace(/^\/+/, '');
          let filePath = path.resolve(projectRoot, relPath);

          if (!isInsideRoot(projectRoot, filePath)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Forbidden');
            return;
          }

          if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            const nestedDefault = resolveDefaultHtmlFile(filePath);
            if (nestedDefault) {
              filePath = path.join(filePath, nestedDefault);
            }
          }

          const fileStat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
          if (!fileStat || !fileStat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`File not found: ${relPath}`);
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const contentType = STATIC_MIME_TYPES[ext] || 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': String(fileStat.size),
            'Cache-Control': 'no-store',
          });
          fs.createReadStream(filePath).pipe(res);
        } catch {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Internal preview server error');
          }
        }
      });

      const boundPort = await new Promise<number | null>((resolve) => {
        server.once('error', () => resolve(null));
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address() as AddressInfo | null;
          resolve(addr && typeof addr.port === 'number' ? addr.port : null);
        });
      });

      if (boundPort === null) {
        try {
          server.close();
        } catch {
          /* ignore */
        }
        return null;
      }

      const previewToken = crypto.randomBytes(32).toString('hex');
      const session: OpenCodePreviewSession = {
        projectId,
        userId,
        projectRoot,
        ptyId: null,
        command: 'static',
        previewToken,
        tokenDigest: sha256(previewToken),
        port: boundPort,
        logs: [`[static] Serving ${defaultHtml || projectRoot} on http://127.0.0.1:${boundPort}`],
        staticServer: server,
        startedAt: Date.now(),
      };
      sessions.set(projectId, session);
      return session;
    },

    async startPreview({
      projectId,
      userId,
      projectRoot,
      command,
      args,
      baseUrl,
      password,
      client,
      createUpstreamWebSocket,
    }) {
      const existing = sessions.get(projectId);
      if (existing && existing.userId === userId) {
        closeSessionResources(existing);
        if (existing.ptyId) {
          await client.removePty({ ptyId: existing.ptyId, directory: existing.projectRoot });
        }
        sessions.delete(projectId);
      }

      const isWinBatchCmd =
        process.platform === 'win32' && /^(?:npm|npx|pnpm|yarn|bunx)$/i.test(command.trim());
      const resolvedCommand = isWinBatchCmd ? `${command.trim()}.cmd` : command;

      const ptyRes = await client.createPty({
        directory: projectRoot,
        body: {
          cwd: projectRoot,
          command: resolvedCommand,
          args,
          title: 'Dev Preview',
        },
      });
      if (!ptyRes.ok) {
        return null;
      }

      const previewToken = crypto.randomBytes(32).toString('hex');
      const session: OpenCodePreviewSession = {
        projectId,
        userId,
        projectRoot,
        ptyId: ptyRes.value.id,
        command: [command, ...args].join(' ').trim(),
        previewToken,
        tokenDigest: sha256(previewToken),
        port: null,
        logs: [],
        startedAt: Date.now(),
      };
      sessions.set(projectId, session);

      if (createUpstreamWebSocket) {
        const authHeader = buildOpenCodeBasicAuthHeader('opencode', password);
        const wsUrl = new URL(baseUrl);
        wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl.pathname = `/pty/${encodeURIComponent(ptyRes.value.id)}/connect`;
        wsUrl.search = '';
        wsUrl.searchParams.set('directory', projectRoot);

        let resolvePortFound: (() => void) | undefined;
        const portFoundPromise = new Promise<void>((resolve) => {
          resolvePortFound = resolve;
        });

        const ws = createUpstreamWebSocket(wsUrl.toString(), {
          headers: authHeader ? { Authorization: authHeader } : undefined,
        });
        session.ws = ws;

        ws.on('message', (chunk) => {
          if (Buffer.isBuffer(chunk) && chunk.length > 0 && chunk[0] === 0x00) {
            return;
          }
          const text = stripAnsi(String(chunk ?? ''));
          const lines = text
            .split(/\r?\n/)
            .map((l) => l.trimEnd())
            .filter((l) => l.trim().length > 0 && !PTY_CURSOR_FRAME_RE.test(l.trim()));
          for (const line of lines) {
            session.logs.push(line.slice(0, 500));
            if (session.logs.length > MAX_LOG_LINES) {
              session.logs.shift();
            }
          }
          if (session.port === null) {
            const detected = detectPortFromOutput(text);
            if (detected !== null) {
              session.port = detected;
              resolvePortFound?.();
            }
          }
        });

        ws.on('close', () => {
          if (session.ws === ws) {
            session.ws = undefined;
          }
          resolvePortFound?.();
        });

        ws.on('error', () => {
          resolvePortFound?.();
        });

        // Wait up to 8s for fast dev servers to print their listening port
        await Promise.race([
          portFoundPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 8_000)),
        ]);
      }

      return session;
    },

    async stopPreview({ projectId, userId, client }) {
      const existing = sessions.get(projectId);
      if (!existing || existing.userId !== userId) {
        return false;
      }
      closeSessionResources(existing);
      sessions.delete(projectId);
      if (existing.ptyId) {
        await client.removePty({ ptyId: existing.ptyId, directory: existing.projectRoot });
      }
      return true;
    },
  };
}

/**
 * Proxies an authenticated HTTP request from `/api/opencode/:projectId/preview/proxy/*`
 * to the detected loopback dev server (`127.0.0.1:${session.port}`).
 */
export function proxyOpenCodePreviewRequest(
  req: Request,
  res: Response,
  session: OpenCodePreviewSession,
  onUpstreamError?: () => void,
): void {
  if (session.port === null) {
    res.status(503).json({ error: { code: 'UPSTREAM_UNAVAILABLE' } });
    return;
  }

  const targetPath = req.url && req.url.length > 0 ? req.url : '/';
  const forwardHeaders: Record<string, string | string[] | undefined> = {
    ...req.headers,
    host: `127.0.0.1:${session.port}`,
  };
  delete forwardHeaders.authorization;
  delete forwardHeaders.cookie;
  delete forwardHeaders['accept-encoding'];

  const ERROR_BRIDGE_SCRIPT =
    '<script>(function(){var inspectOn=false,lastEl=null,prevOut="";function cssPath(el){if(!el||el.nodeType!==1)return"";var parts=[];while(el&&el.nodeType===1&&parts.length<5){var s=el.nodeName.toLowerCase();if(el.id){s+="#"+el.id;parts.unshift(s);break;}if(el.className&&typeof el.className==="string"){var c=el.className.trim().split(/\\s+/).slice(0,2).join(".");if(c)s+="."+c;}parts.unshift(s);el=el.parentElement;}return parts.join(" > ");}var origErr=console.error;console.error=function(){try{var msg=Array.prototype.slice.call(arguments).map(function(a){return typeof a==="object"?(a&&a.message?a.message:JSON.stringify(a)):String(a);}).join(" ");window.parent.postMessage({type:"SATCHIDA_PREVIEW_ERROR",message:msg.slice(0,400)},"*");}catch(_){}return origErr.apply(console,arguments);};window.addEventListener("error",function(e){try{window.parent.postMessage({type:"SATCHIDA_PREVIEW_ERROR",message:String(e.message||"Runtime error"),source:String(e.filename||"")+":"+String(e.lineno||0)},"*");}catch(_){}});window.addEventListener("unhandledrejection",function(e){try{window.parent.postMessage({type:"SATCHIDA_PREVIEW_ERROR",message:String(e.reason&&e.reason.message||e.reason||"Unhandled rejection")},"*");}catch(_){}});window.addEventListener("message",function(ev){if(ev.data&&ev.data.type==="SATCHIDA_TOGGLE_INSPECT"){inspectOn=Boolean(ev.data.enabled);if(!inspectOn&&lastEl){lastEl.style.outline=prevOut;lastEl=null;}}});document.addEventListener("mouseover",function(e){if(!inspectOn)return;var t=e.target;if(!t||t===lastEl)return;if(lastEl)lastEl.style.outline=prevOut;lastEl=t;prevOut=t.style.outline||"";t.style.outline="2px solid #10b981";},true);document.addEventListener("click",function(e){if(!inspectOn)return;e.preventDefault();e.stopPropagation();var t=e.target;if(lastEl){lastEl.style.outline=prevOut;lastEl=null;}inspectOn=false;try{window.parent.postMessage({type:"SATCHIDA_ELEMENT_SELECTED",tag:t.tagName.toLowerCase(),selector:cssPath(t),text:String(t.innerText||t.textContent||"").trim().slice(0,120)},"*");}catch(_){}},true);})();</script>';

  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: session.port,
      path: targetPath,
      method: req.method,
      headers: forwardHeaders,
    },
    (proxyRes) => {
      res.removeHeader('x-frame-options');
      res.removeHeader('content-security-policy');
      const responseHeaders = { ...proxyRes.headers };
      delete responseHeaders['x-frame-options'];
      delete responseHeaders['content-security-policy'];
      delete responseHeaders['connection'];
      delete responseHeaders['keep-alive'];
      const contentType = String(responseHeaders['content-type'] ?? '');
      if (
        req.method === 'GET' &&
        contentType.includes('text/html') &&
        !contentType.includes('text/event-stream')
      ) {
        const chunks: Buffer[] = [];
        proxyRes.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        proxyRes.on('end', () => {
          const rawHtml = Buffer.concat(chunks).toString('utf8');
          const injectedHtml = rawHtml.includes('</body>')
            ? rawHtml.replace('</body>', `${ERROR_BRIDGE_SCRIPT}</body>`)
            : `${rawHtml}${ERROR_BRIDGE_SCRIPT}`;
          const outBuf = Buffer.from(injectedHtml, 'utf8');
          delete responseHeaders['transfer-encoding'];
          delete responseHeaders['content-encoding'];
          responseHeaders['content-length'] = String(outBuf.byteLength);
          res.writeHead(proxyRes.statusCode ?? 200, responseHeaders);
          res.end(outBuf);
        });
        return;
      }
      res.writeHead(proxyRes.statusCode ?? 502, responseHeaders);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (error) => {
    logger.warn('[OpenCodePreview] Upstream proxy error', getSafeErrorMetadata(error));
    onUpstreamError?.();
    if (!res.headersSent) {
      const accept = String(req.headers.accept ?? '');
      if (req.method === 'GET' && accept.includes('text/html')) {
        res
          .status(503)
          .setHeader('Content-Type', 'text/html; charset=utf-8')
          .send(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="2">' +
              '<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;font-size:14px}</style>' +
              '</head><body><div>Starting live preview server…</div></body></html>',
          );
        return;
      }
      res.status(502).json({ error: { code: 'UPSTREAM_UNAVAILABLE' } });
    }
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.readable && !req.readableEnded) {
      req.pipe(proxyReq);
    } else if (req.body !== undefined) {
      const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      proxyReq.end(bodyStr);
    } else {
      proxyReq.end();
    }
  } else {
    proxyReq.end();
  }
}
