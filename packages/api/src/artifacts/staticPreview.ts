import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

export const STATIC_PREVIEW_VENDOR_DIR = 'vendor/sandpack-static-preview';

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

/**
 * The relay script (vendored from static-browser-server) registers the service
 * worker with an explicit scope of "/", and the relay page references its module
 * and the worker script with root-absolute URLs. The preview iframe navigates to
 * "/" as the no-service-worker fallback. Only these exact paths are served; a
 * session host has no other surface.
 */
const FIXED_ROUTES: Record<string, string> = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/__csb_relay': '__csb_relay/index.html',
  '/__csb_relay/': '__csb_relay/index.html',
  '/__csb_relay/index.html': '__csb_relay/index.html',
};

/** Session hosts are `<hex id>-<base host>` per static-browser-server's
 * generateRandomId (Date.now + random + counter, rendered as hex). */
const buildSessionHostRegExp = (baseHost: string): RegExp => {
  const escaped = baseHost.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^[0-9a-f]+-${escaped}$`);
};

type RelayRouteMap = Record<string, string>;

const discoverRelayRoutes = (vendorDir: string): RelayRouteMap => {
  const routes: RelayRouteMap = { ...FIXED_ROUTES };
  const relayDir = join(vendorDir, '__csb_relay');
  if (!existsSync(relayDir)) {
    return routes;
  }
  for (const name of readdirSync(relayDir)) {
    if (name.endsWith('.js')) {
      routes[`/__csb_relay/${name}`] = join('__csb_relay', name);
    }
  }
  for (const name of readdirSync(vendorDir)) {
    if (name.startsWith('__csb_sw') && name.endsWith('.js')) {
      routes[`/${name}`] = name;
    }
  }
  return routes;
};

/**
 * Middleware serving the self-hosted sandpack static-preview relay for wildcard
 * session hostnames. static-browser-server builds per-session preview hosts as
 * `<sessionId>-<baseUrl hostname>`, so when SANDPACK_STATIC_BUNDLER_URL points
 * at the app's own public origin (e.g. https://ai.satchida.com), requests arrive
 * with hostnames like `1a2b3c-ai.satchida.com`. Those hostnames must route to
 * this server (cloudflared `*.` ingress rule) for the preview to load; every
 * other host passes through untouched.
 */
export const createStaticPreviewRelayMiddleware = (options: {
  assets: string;
  /** Hostname of the configured SANDPACK_STATIC_BUNDLER_URL origin. */
  sessionBaseHost: string;
}): RequestHandler => {
  const vendorDir = join(options.assets, STATIC_PREVIEW_VENDOR_DIR);
  const routes = discoverRelayRoutes(vendorDir);
  const sessionHostRegExp = buildSessionHostRegExp(options.sessionBaseHost);
  const cache = new Map<string, Promise<Buffer>>();

  const loadFile = (relPath: string): Promise<Buffer> => {
    let pending = cache.get(relPath);
    if (!pending) {
      pending = readFile(join(vendorDir, relPath));
      cache.set(relPath, pending);
      pending.catch(() => cache.delete(relPath));
    }
    return pending;
  };

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    const hostname = (req.hostname || '').toLowerCase();
    if (!sessionHostRegExp.test(hostname)) {
      return next();
    }
    const route = routes[req.path];
    if (!route) {
      return next();
    }
    loadFile(route)
      .then((body) => {
        const ext = route.slice(route.lastIndexOf('.'));
        res.setHeader('Content-Type', MIME_BY_EXT[ext] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        if (req.method === 'HEAD') {
          res.setHeader('Content-Length', String(body.length));
          return res.end();
        }
        return res.send(body);
      })
      .catch(() => next());
  };
};

export { buildSessionHostRegExp };
