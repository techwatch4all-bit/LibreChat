/**
 * Portable PM2 profile for a self-contained Satchida tenant edge node.
 * Run from the LibreChat directory:  pm2 start ecosystem.config.cjs
 * The llama-watchdog here is the repo-local copy of
 * D:\LAN-AI-Infra\ops-scripts\llama-watchdog.mjs (identical behaviour; cold-start only).
 * NOTE: do not run `pm2 start` on the HQ node — the live llama-watchdog already
 * runs under PM2 from ops-scripts and must not be duplicated.
 */
module.exports = {
  apps: [
    {
      name: 'librechat',
      script: './api/server/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3080,
        HOST: '0.0.0.0',
      },
      max_memory_restart: '1500M',
      restart_delay: 3000,
    },
    {
      name: 'llama-watchdog',
      script: './scripts/ops/llama-watchdog.mjs',
      cwd: __dirname,
      autorestart: true,
    },
  ],
};
