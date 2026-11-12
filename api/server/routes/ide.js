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
        let csp = proxyRes.headers['content-security-policy']
          .replace(/frame-ancestors\s+[^;]+;?/gi, '')
          .replace(
            /default-src\s+([^;]+)/i,
            "default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'",
          );
        /** code-server serves several documents (workbench HTML, the extension-host
         *  worker iframe) each with their own CSP; the worker iframe's policy blocks
         *  its blob: web worker (script-src-elem), which kills the extension host and
         *  cascades into workbench WS 1006. Broaden every script/worker directive on
         *  every proxied document: this is an authenticated internal IDE surface. */
        const ensureTokens = (directive, tokens) => {
          const re = new RegExp(directive + '\\s+([^;]+)', 'i');
          if (re.test(csp)) {
            csp = csp.replace(re, (_m, sources) => {
              const additions = tokens.filter(
                (t) => !sources.toLowerCase().includes(t.toLowerCase()),
              );
              return additions.length
                ? `${directive} ${sources} ${additions.join(' ')}`
                : _m;
            });
          } else {
            csp += ` ${directive} ${tokens.join(' ')};`;
          }
        };
        const scriptTokens = ["'unsafe-eval'", "'unsafe-inline'", 'blob:'];
        ensureTokens('script-src', scriptTokens);
        /** Amend script-src-elem/attr ONLY when the upstream response already
         *  carries them (the worker-iframe document). Injecting them fresh onto
         *  the nonce-protected workbench document would strip nonce protection:
         *  script-src-elem takes precedence, and 'unsafe-inline' is ignored
         *  policy-wide once nonces exist, killing the workbench's own scripts. */
        if (/script-src-elem\s+/i.test(csp)) {
          ensureTokens('script-src-elem', scriptTokens);
        }
        if (/script-src-attr\s+/i.test(csp)) {
          ensureTokens('script-src-attr', ["'unsafe-inline'"]);
        }
        ensureTokens('worker-src', ["'self'", 'data:', 'blob:']);
        ensureTokens('child-src', ["'self'", 'data:', 'blob:']);
        proxyRes.headers['content-security-policy'] = csp;
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

// Enforce vscode_server capability gate: only pro, pro_family, privacy, enterprise seats may use the IDE.
// All other tiers (basic, standard, family) are denied with 403 and shown an upgrade prompt.
const IDE_ENTITLED_ACCOUNT_TYPES = new Set(['pro', 'pro_family', 'privacy', 'enterprise']);

router.use((req, res, next) => {
  const user = req.user;
  const accountType = user && user.accountType;
  const capabilities = (user && user.allowedCapabilities) || [];
  const hasCapability =
    capabilities.includes('vscode_server') || IDE_ENTITLED_ACCOUNT_TYPES.has(accountType);
  if (!hasCapability) {
    return res.status(403).json({
      error: 'IDE access requires a Pro, Pro Family, Privacy, or Enterprise plan.',
      code: 'IDE_ENTITLEMENT_REQUIRED',
      currentPlan: accountType || 'unknown',
    });
  }
  return next();
});

router.use('/', vscoderProxy);

module.exports = {
  router,
  vscoderProxy,
  VSCODER_TARGET,
};
