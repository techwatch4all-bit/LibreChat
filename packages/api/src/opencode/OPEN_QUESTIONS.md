# OpenCode Integration — Open Questions & Observed Upstream Behavior

## Q1: Upstream `POST /pty/{ptyID}/connect-token` returns `403 PtyForbiddenError` on OpenCode 1.19.5

- **Spec reference:** `POST /pty/{ptyID}/connect-token` (`operations["pty.connectToken"]`, `packages/api/src/opencode/__fixtures__/openapi.json`).
- **Observed behavior against live `opencode serve --hostname 127.0.0.1` (v1.19.5, `OPENCODE_SERVER_PASSWORD` set):**
  - `POST /pty?directory=<dir>` with HTTP Basic auth succeeds (`200`, returns `{ id: "pty_...", ... }`).
  - `POST /pty/{ptyID}/connect-token?directory=<dir>` with HTTP Basic auth returns:
    `403 {"_tag":"PtyForbiddenError","message":"Invalid PTY connect token request"}`
    even when `Origin`, `Sec-Fetch-Site: same-origin`, `Sec-Fetch-Mode: cors`, `Sec-Fetch-Dest: empty`, `Content-Type: application/json`, `X-Opencode-Directory`, or `X-Requested-With` headers are supplied.
  - Meanwhile, `GET /pty/{ptyID}/connect?directory=<dir>` (WebSocket upgrade) **rejects unauthenticated upgrades with `401`** and **succeeds with HTTP Basic auth (`Authorization: Basic ...`)**, delivering full interactive PTY I/O (`echo GATE0_PTY_MARKER` echoed back).
- **Phase 0 decision (implemented & tested):**
  - Client ↔ LibreChat WebSocket upgrade uses LibreChat's own single-use, 60-second TTL, SHA-256/timingSafeEqual `connectTicket` (issued by JWT-authenticated `POST /api/opencode/:projectId/pty` and `POST /api/opencode/:projectId/pty/:ptyId/connect-token`) or owner JWT, with strict `OpenCodePtyRegistry` + `getChatProject` ownership verification.
  - LibreChat Backend ↔ OpenCode loopback WebSocket upgrade authenticates via `Authorization: Basic ...` header on `ws://127.0.0.1:<port>/pty/{ptyID}/connect?directory=<projectRoot>` (keeping credentials out of URLs).
  - `OpenCodeClient.createPtyConnectToken` remains implemented per spec if a future OpenCode release or specific CORS/session configuration enables upstream connect-token exchange.
