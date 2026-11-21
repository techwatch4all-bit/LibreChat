const express = require('express');
const {
  createProxyMiddleware,
  fixRequestBody,
  responseInterceptor,
} = require('http-proxy-middleware');
const fs = require('fs');
const path = require('path');
const os = require('os');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const { logger } = require('@librechat/data-schemas');

const router = express.Router();

function getStudioRunInfo() {
  const runFile = path.join(os.homedir(), '.openfilm', 'run.json');
  if (!fs.existsSync(runFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(runFile, 'utf8'));
  } catch {
    return null;
  }
}

const OPENFILM_PORT = process.env.OPENFILM_PORT || 4747;
const OPENFILM_TARGET = `http://127.0.0.1:${OPENFILM_PORT}`;

// Create OpenFilm Studio proxy middleware
const openfilmProxy = createProxyMiddleware({
  pathRewrite: (path) => {
    // If request comes as /api/openfilm/projects -> /api/projects
    if (path.startsWith('/api/openfilm/')) {
      return path.replace('/api/openfilm/', '/api/');
    }
    if (path === '/api/openfilm') {
      return '/api';
    }
    return path;
  },
  target: OPENFILM_TARGET,
  changeOrigin: true,
  selfHandleResponse: true,
  // Upgraded explicitly in api/server/index.js; ws:true would auto-hook server.on('upgrade')
  // globally without a pathFilter and hijack unrelated WebSockets (e.g. /api/opencode/pty).
  ws: false,
  xfwd: true,
  router: (_req) => {
    const runInfo = getStudioRunInfo();
    return runInfo?.origin || OPENFILM_TARGET;
  },
  on: {
    proxyReq: (proxyReq, req, _res) => {
      const runInfo = getStudioRunInfo();
      const studioKey = runInfo?.key || '';
      const port = runInfo?.origin ? new URL(runInfo.origin).port : OPENFILM_PORT;

      // Inject required OpenFilm headers & cookies
      if (studioKey) {
        proxyReq.setHeader('x-studio-key', studioKey);

        // OpenFilm checks origin strictly on mutations: must match Studio's internal origin
        const internalOrigin = runInfo?.origin || OPENFILM_TARGET;
        proxyReq.setHeader('origin', internalOrigin);

        // OpenFilm sets cookies keyed by port: openfilm_studio_<port> and openfilm_studio_<port>_framed
        const cName1 = `openfilm_studio_${port}`;
        const cName2 = `openfilm_studio_${port}_framed`;
        const existingCookie = req.headers['cookie'] || '';

        let newCookie = existingCookie;
        if (!newCookie.includes(cName1)) {
          newCookie = `${cName1}=${studioKey}; ${newCookie}`.trim();
        }
        if (!newCookie.includes(cName2)) {
          newCookie = `${cName2}=${studioKey}; ${newCookie}`.trim();
        }
        proxyReq.setHeader('cookie', newCookie);
      }

      if (req.user) {
        proxyReq.setHeader('x-forwarded-user', req.user.email || req.user.id);
      }
      fixRequestBody(proxyReq, req);
    },
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      // Remove restrictive headers so OpenFilm can be embedded in an <iframe> in LibreChat
      delete proxyRes.headers['x-frame-options'];
      if (proxyRes.headers['content-security-policy']) {
        let csp = proxyRes.headers['content-security-policy']
          .replace(/frame-ancestors\s+[^;]+;?/gi, '')
          .replace(
            /default-src\s+([^;]+)/i,
            "default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'",
          );
        proxyRes.headers['content-security-policy'] = csp;
      }
      proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';

      // Set cookies for the client browser so any direct resource fetches carry the key
      const runInfo = getStudioRunInfo();
      if (runInfo?.key) {
        const port = runInfo.origin ? new URL(runInfo.origin).port : OPENFILM_PORT;
        res.cookie(`openfilm_studio_${port}`, runInfo.key, {
          path: '/',
          httpOnly: false,
          sameSite: 'lax',
          secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        });
        res.cookie(`openfilm_studio_${port}_framed`, runInfo.key, {
          path: '/',
          httpOnly: false,
          sameSite: 'none',
          secure: true,
        });
      }

      // If returning project metadata JSON, rewrite port 4748 URLs to relative /p/ paths
      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const bodyStr = responseBuffer.toString('utf8');
        if (
          bodyStr.includes('http://localhost:4748/') ||
          bodyStr.includes('http://127.0.0.1:4748/')
        ) {
          const rewritten = bodyStr
            .replace(/http:\/\/localhost:4748\//g, '/')
            .replace(/http:\/\/127\.0\.0\.1:4748\//g, '/');
          return rewritten;
        }
      }

      return responseBuffer;
    }),
    error: (err, req, res) => {
      logger.warn(`[OpenFilm Proxy Error]: ${err.message}`);
      if (res && !res.headersSent && typeof res.status === 'function') {
        res.status(502).json({
          error: 'OpenFilm Studio backend unavailable',
          details: err.message,
          target: OPENFILM_TARGET,
        });
      }
    },
  },
});

// Middleware: Relax global security headers specifically on /api/openfilm for iframe embedding
router.use((_req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Cross-Origin-Embedder-Policy');
  next();
});

// Token extraction from query / cookie / header (similar to IDE proxy)
router.use((req, res, next) => {
  const queryToken = req.query?.token;
  if (queryToken && typeof queryToken === 'string') {
    res.cookie('openfilm_token', queryToken, {
      path: '/api/openfilm',
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    });
    req.headers.authorization = `Bearer ${queryToken}`;
  } else if (!req.headers.authorization) {
    const cookieToken = req.cookies?.openfilm_token || req.cookies?.token;
    if (cookieToken && typeof cookieToken === 'string') {
      req.headers.authorization = `Bearer ${cookieToken}`;
    }
  }
  next();
});

// Authenticate user via JWT (allow studioKey, referer, or project-sync query token for framed OpenFilm UI requests)
router.use((req, res, next) => {
  const runInfo = getStudioRunInfo();
  const validKey = runInfo?.key;
  const referer = req.headers['referer'] || '';
  const p = req.originalUrl || req.url;

  // Always allow project-sync lookup
  if (p.includes('/project-sync')) {
    return next();
  }

  if (validKey) {
    if (
      req.query?.key === validKey ||
      req.headers['x-studio-key'] === validKey ||
      req.cookies?.['openfilm_studio_4747'] === validKey ||
      referer.includes('/projects/') ||
      referer.includes('/api/openfilm/')
    ) {
      return next();
    }
  }
  return requireJwtAuth(req, res, next);
});

// Endpoint to get or initialize an OpenFilm project for the chat/user
router.get('/project-sync', async (req, res) => {
  try {
    const runInfo = getStudioRunInfo();
    if (!runInfo || !runInfo.origin) {
      return res.status(503).json({ error: 'OpenFilm Studio is not active' });
    }
    const targetOrigin = runInfo.origin;
    const studioKey = runInfo.key;

    // Fetch existing projects
    const listRes = await fetch(`${targetOrigin}/api/projects`, {
      headers: { 'x-studio-key': studioKey },
    });
    const listData = await listRes.json();
    const requestedName = (req.query.name || '').trim();
    const sanitizedName = requestedName.replace(/[^a-zA-Z0-9_-]/g, '') || 'DawnValley';
    const projectName = sanitizedName;
    let matched = (listData.projects || []).find(
      (p) => p.name.toLowerCase() === projectName.toLowerCase(),
    );

    if (!matched) {
      // Create new project
      const createRes = await fetch(`${targetOrigin}/api/projects`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-studio-key': studioKey,
        },
        body: JSON.stringify({ name: projectName }),
      });
      const createdData = await createRes.json();
      matched = createdData.project;
    }

    // Always seed or update the project's media if mediaSource is provided
    try {
      if (matched && matched.path) {
        const projectDir = matched.path;
        const assetsDir = path.join(projectDir, 'assets');
        if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

        const mediaSource = req.query.media;
        if (mediaSource) {
          const publicGenerated = path.join(process.cwd(), 'client', 'public', 'generated');
          const studioGenerated = path.resolve(
            'D:\\LAN-AI-Infra\\Satchida-Studio\\exports\\generated',
          );
          let srcPath = path.join(publicGenerated, path.basename(mediaSource));
          if (!fs.existsSync(srcPath)) {
            srcPath = path.join(studioGenerated, path.basename(mediaSource));
          }
          const destPath = path.join(assetsDir, path.basename(mediaSource));
          if (
            fs.existsSync(srcPath) &&
            (!fs.existsSync(destPath) ||
              fs.statSync(srcPath).mtimeMs > fs.statSync(destPath).mtimeMs)
          ) {
            fs.copyFileSync(srcPath, destPath);
          }
          const filmHtmlPath = path.join(projectDir, 'film.html');
          const relAsset = `assets/${path.basename(mediaSource)}`;
          const filmHtml = `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=1920, height=1080">\n</head>\n<body>\n<section>\n  <video id="clip-1" src="${relAsset}" at="0" style="left: 0px; top: 0px; width: 1920px; height: 1080px"></video>\n</section>\n</body>\n</html>\n`;
          fs.writeFileSync(filmHtmlPath, filmHtml, 'utf8');
        }
      }
    } catch (seedErr) {
      logger.warn('[OpenFilm seed project error]', seedErr);
    }

    return res.json({
      success: true,
      project: matched,
      studioKey,
      studioOrigin: targetOrigin,
      studioUrl: `/projects/${matched.id}?key=${studioKey}`,
    });
  } catch (err) {
    logger.error('[OpenFilm project-sync error]', err);
    return res.status(500).json({ error: err.message });
  }
});

// Create OpenFilm Media server proxy (port 4748)
const openfilmMediaProxy = createProxyMiddleware({
  target: 'http://127.0.0.1:4748',
  changeOrigin: true,
  pathRewrite: (path) => {
    if (!path.startsWith('/p')) {
      return `/p${path}`;
    }
    return path;
  },
  on: {
    proxyRes: (proxyRes) => {
      proxyRes.headers['access-control-allow-origin'] = '*';
      delete proxyRes.headers['x-frame-options'];
    },
  },
});

// Proxy all other requests to OpenFilm Studio
router.use('/', openfilmProxy);

module.exports = {
  router,
  openfilmProxy,
  openfilmMediaProxy,
  OPENFILM_TARGET,
  getStudioRunInfo,
};
