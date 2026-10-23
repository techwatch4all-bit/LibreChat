const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const { logger } = require('@librechat/data-schemas');

const router = express.Router();

const VSCODER_PORT = process.env.VSCODER_PORT || 8085;
const VSCODER_TARGET = `http://127.0.0.1:${VSCODER_PORT}`;

// Create proxy middleware instance for code-server
const vscoderProxy = createProxyMiddleware({
  target: VSCODER_TARGET,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  on: {
    proxyReq: (proxyReq, req, _res) => {
      // Forward user identification to upstream if authenticated
      if (req.user) {
        proxyReq.setHeader('x-forwarded-user', req.user.email || req.user.id);
      }
    },
    proxyRes: (proxyRes, _req, _res) => {
      // Remove restrictive framing & cross-origin isolation headers from code-server response
      // so it can render seamlessly inside LibreChat's same-origin <iframe>
      delete proxyRes.headers['x-frame-options'];
      if (proxyRes.headers['content-security-policy']) {
        proxyRes.headers['content-security-policy'] = proxyRes.headers['content-security-policy']
          .replace(/frame-ancestors\s+[^;]+;?/gi, '')
          .replace(
            /default-src\s+([^;]+)/i,
            "default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'",
          );
      }
      proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';
    },
    error: (err, req, res) => {
      logger.warn(`[VScoder Proxy Error]: ${err.message}`);
      if (res && !res.headersSent && typeof res.status === 'function') {
        res.status(502).json({
          error: 'VScoder upstream service unavailable',
          details: err.message,
          target: VSCODER_TARGET,
        });
      }
    },
  },
});

// Middleware: Relax global security headers specifically on /api/ide for iframe compatibility
router.use((_req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Cross-Origin-Embedder-Policy');
  next();
});

// Middleware: Extract JWT token from query param ?token=..., cookie, or Authorization header.
// When an iframe initially opens with ?token=..., set an HttpOnly ide_token cookie scoped to /api/ide
// so all subsequent module/CSS/worker/WebSocket requests automatically carry the authentication cookie.
router.use((req, res, next) => {
  const queryToken = req.query?.token;
  if (queryToken && typeof queryToken === 'string') {
    res.cookie('ide_token', queryToken, {
      path: '/api/ide',
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    });
    req.headers.authorization = `Bearer ${queryToken}`;
  } else if (!req.headers.authorization) {
    const cookieToken = req.cookies?.ide_token || req.cookies?.token;
    if (cookieToken && typeof cookieToken === 'string') {
      req.headers.authorization = `Bearer ${cookieToken}`;
    }
  }
  next();
});

// Enforce JWT Auth on all IDE proxy calls
router.use(requireJwtAuth);
router.use('/', vscoderProxy);

module.exports = {
  router,
  vscoderProxy,
  VSCODER_TARGET,
};
