/**
 * PM2 launch for LibreChat on Windows.
 *
 * PORT must be set on the APP process, not only in .env. `dotenv` does not
 * override a variable that already exists in the environment, so a PORT inherited
 * from whatever shell started the PM2 daemon wins over the .env value — and the
 * server silently binds the wrong port while reporting "readiness checks passing".
 * That is a real trap here: the inherited value was 5174, and 3080 simply never
 * opened. Setting it here makes the port independent of who started the daemon.
 */
module.exports = {
  apps: [
    {
      name: 'librechat',
      script: 'api/server/index.js',
      cwd: 'D:/LAN-AI-Infra/LibreChat',
      interpreter: 'C:/Program Files/nodejs/node.exe',
      env: { PORT: '3080', HOST: '0.0.0.0', NODE_ENV: 'production' },
    },
    {
      // Satchida smart router - OpenAI-compatible proxy with free-model discovery
      // (OpenRouter, OpenCode). Binds to 127.0.0.1:4001 (ROUTER_PORT).
      // Port 4000 is reserved for satchida-gateway (one-api binary).
      // SATCHIDA_ROUTER_URL in LibreChat/.env points here.
      // server.mjs loads LibreChat/.env itself via dotenv on startup.
      name: 'satchida-router',
      script: 'satchida/router/src/server.mjs',
      cwd: 'D:/LAN-AI-Infra/LibreChat',
      interpreter: 'C:/Program Files/nodejs/node.exe',
      env: { ROUTER_PORT: '4001', ROUTER_HOST: '127.0.0.1' },
    },
    {
      // Satchida tenant-local Privacy router (fleet/scripts/dev-gateway.mjs).
      // Verifies the seat assertion minted by LibreChat and relays the Privacy
      // model to the local llama.cpp runtime on :8080. Loads LibreChat/.env
      // itself via dotenv, so no env vars are required here. Running under PM2
      // (rather than as a detached orphan) so per-request logs are captured and
      // the process survives a reboot after `pm2 save`.
      name: 'satchida-privacy-router',
      script: 'fleet/scripts/dev-gateway.mjs',
      cwd: 'D:/LAN-AI-Infra/LibreChat',
      interpreter: 'C:/Program Files/nodejs/node.exe',
      env: {},
    },
  ],
};
