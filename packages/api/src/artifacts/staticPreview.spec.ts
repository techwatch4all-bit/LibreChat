import http from 'node:http';
import express from 'express';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createStaticPreviewRelayMiddleware } from './staticPreview';
import { createSecurityHeaders } from '../security/headers';

const BASE_HOST = 'ai.satchida.com';
const SESSION_HOST = `1a2b3c-${BASE_HOST}`;
const RELAY_JS = '__csb_relay.30yfeq026i8arwjbp19vlgcep8e6tgf.js';
const SW_JS = '__csb_sw.rpfsli6sirrzs1630o3lgzuxwlr2uqc.js';

type HttpResponse = {
  status: number | undefined;
  contentType: string | undefined;
  body: string;
};

let assetsDir: string;
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  assetsDir = mkdtempSync(join(tmpdir(), 'static-preview-'));
  const vendorDir = join(assetsDir, 'vendor', 'sandpack-static-preview');
  mkdirSync(join(vendorDir, '__csb_relay'), { recursive: true });
  writeFileSync(join(vendorDir, 'index.html'), '<html>preview</html>');
  writeFileSync(join(vendorDir, '__csb_relay', 'index.html'), '<html>relay</html>');
  writeFileSync(join(vendorDir, '__csb_relay', RELAY_JS), '// relay module');
  writeFileSync(join(vendorDir, SW_JS), '// service worker');

  const app = express();
  app.use(createStaticPreviewRelayMiddleware({ assets: assetsDir, sessionBaseHost: BASE_HOST }));
  app.use((_req, res) => {
    res.status(404).send('fell-through');
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(assetsDir, { recursive: true, force: true });
});

/** node:http instead of fetch: undici strips the request-line Host header, which
 * is exactly what this middleware routes on. */
const request = (path: string, host: string, method = 'GET') =>
  new Promise<HttpResponse>((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: { Host: host },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            contentType: res.headers['content-type'],
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });

describe('createStaticPreviewRelayMiddleware', () => {
  it('serves the preview page at / for session hosts', async () => {
    const res = await request('/', SESSION_HOST);
    expect(res.status).toBe(200);
    expect(res.contentType).toContain('text/html');
    expect(res.body).toBe('<html>preview</html>');
  });

  it('serves the relay page and its module for session hosts', async () => {
    const page = await request('/__csb_relay/', SESSION_HOST);
    expect(page.status).toBe(200);
    expect(page.contentType).toContain('text/html');
    const script = await request(`/__csb_relay/${RELAY_JS}`, SESSION_HOST);
    expect(script.status).toBe(200);
    expect(script.contentType).toContain('text/javascript');
    expect(script.body).toBe('// relay module');
  });

  it('serves the service worker at the root path session hosts register', async () => {
    const res = await request(`/${SW_JS}`, SESSION_HOST);
    expect(res.status).toBe(200);
    expect(res.contentType).toContain('text/javascript');
  });

  it('accepts HEAD for the preview page', async () => {
    const res = await request('/', SESSION_HOST, 'HEAD');
    expect(res.status).toBe(200);
    expect(res.body).toBe('');
  });

  it('passes through for the base host without a session id prefix', async () => {
    const res = await request('/', BASE_HOST);
    expect(res.status).toBe(404);
    expect(res.body).toBe('fell-through');
  });

  it('passes through for unknown paths on session hosts', async () => {
    const res = await request('/artifact.css', SESSION_HOST);
    expect(res.status).toBe(404);
  });

  it('passes through POST requests on session hosts', async () => {
    const res = await request('/', SESSION_HOST, 'POST');
    expect(res.status).toBe(404);
  });

  it('rejects session hosts built on a different base', async () => {
    const res = await request('/', '1a2b3c-other.example.com');
    expect(res.status).toBe(404);
  });

  it('strips X-Frame-Options and allows cross-origin embedding when securityHeaders runs first', async () => {
    const securedApp = express();
    const securityHeaders = createSecurityHeaders({});
    if (securityHeaders) {
      securedApp.use(securityHeaders);
    }
    securedApp.use(
      createStaticPreviewRelayMiddleware({ assets: assetsDir, sessionBaseHost: BASE_HOST }),
    );
    const securedServer = await new Promise<http.Server>((resolve) => {
      const srv = securedApp.listen(0, '127.0.0.1', () => resolve(srv));
    });
    try {
      const addr = securedServer.address();
      if (!addr || typeof addr === 'string') {
        throw new Error('unexpected address');
      }
      const res = await new Promise<{ status: number; headers: http.IncomingHttpHeaders }>(
        (resolve, reject) => {
          const req = http.request(
            {
              host: '127.0.0.1',
              port: addr.port,
              path: '/',
              method: 'GET',
              headers: { Host: SESSION_HOST },
            },
            (incoming) => {
              incoming.resume();
              incoming.on('end', () =>
                resolve({ status: incoming.statusCode ?? 0, headers: incoming.headers }),
              );
            },
          );
          req.on('error', reject);
          req.end();
        },
      );
      expect(res.status).toBe(200);
      expect(res.headers['x-frame-options']).toBeUndefined();
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(res.headers['cross-origin-opener-policy']).toBe('unsafe-none');
    } finally {
      await new Promise<void>((resolve) => securedServer.close(() => resolve()));
    }
  });
});
