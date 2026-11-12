# sandpack static-preview relay (vendored)

Copied verbatim from node_modules/static-browser-server (v1.0.3, Apache-2.0)
out/preview/ on 2026-11-10 — the same files codesandbox serves at
preview.sandpack-static-server.codesandbox.io.

Layout served by the staticPreviewRelay middleware for wildcard session hostnames
(<sessionId>-<base host>):
  /                -> index.html (preview host page / SW bootstrap)
  /__csb_relay/    -> __csb_relay/index.html
  /__csb_relay/__csb_relay.30yfeq026i8arwjbp19vlgcep8e6tgf.js
  /__csb_sw.rpfsli6sirrzs1630o3lgzuxwlr2uqc.js

Nothing was modified; paths inside are root-absolute, which the wildcard host
satisfies. Enable self-hosting by setting SANDPACK_STATIC_BUNDLER_URL to the app's
own public origin (e.g. https://ai.satchida.com); the client then builds
<randomId>-ai.satchida.com session hosts, which cloudflared routes to this server
via a *.satchida.com ingress rule (see Changes.md 2026-11-10).
