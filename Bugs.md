# Known Bugs & Recurring Operational Issues

This file tracks recurring bugs, operational hazards, and root-cause notes for the Satchida / LibreChat Windows bare-metal deployment.

---

## B1. Recurring Popup Terminal Windows Every Few Seconds (PM2 Crash-Loops)

- **Status:** Mitigated (2026-11-26) — recurring when PM2 ecosystem is restarted or LibreChat is rebuilt while an orphan server holds `:3080`.
- **Symptom:** Blank/flashing Windows console windows pop up every 1–30 seconds on the desktop.
- **Root Causes (two independent PM2 crash-loops observed on 2026-11-26):**
  1. **`satchida-gateway` vs `satchida-router` port `:4000` collision** (3,576+ restarts, ~1s loop):
     - `satchida-gateway` (`main.go:157`) repeatedly failed with:
       `listen tcp :4000: bind: Only one usage of each socket address (protocol/network address/port) is normally permitted.`
     - `satchida-router` is already online and bound to `:4000`, so PM2 respawned `satchida-gateway` every second, flashing a console window on each attempt.
     - **Mitigation:** `pm2 stop satchida-gateway` (and `pm2 save` once verified). Do not run both `satchida-router` and `satchida-gateway` on `:4000` simultaneously.
  2. **`librechat` port `:3080` `EADDRINUSE` crash-loop** (92+ restarts, ~30s loop):
     - `librechat` booted for ~15s and exited with:
       `Failed to start server: listen EADDRINUSE: address already in use 0.0.0.0:3080`
     - An orphaned/out-of-band `node.exe` process was already listening on `:3080`, causing PM2 to repeatedly respawn `librechat` and flash a terminal window on every restart.
     - **Prevention:** Before restarting or rebuilding LibreChat, check `Get-NetTCPConnection -LocalPort 3080 -State Listen` and ensure only the PM2-managed `librechat` process owns `:3080`.
- **Diagnostic Command:**
  ```powershell
  pm2 jlist | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.filter(p=>p.pm2_env.restart_time>5 || p.pm2_env.status!=='online').map(p=>({name:p.name,status:p.pm2_env.status,restarts:p.pm2_env.restart_time})))"
  ```
