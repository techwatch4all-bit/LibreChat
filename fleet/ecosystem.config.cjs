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
      // Fixed roster engine with the 2026-10-09 pricing directives (0.60 auto,
      // 1.30 ban, 20% price-change guard, 24h staleness, 6h refresh). Runs on
      // 4002 because a stale pre-fix instance still holds 4001 (zombie, not
      // killable from this shell); SATCHIDA_ROUTER_URL in LibreChat/.env points
      // here. server.mjs loads LibreChat/.env itself (dotenv), so the VK and
      // token config travel with the process.
      name: 'satchida-router',
      script: 'satchida/router/src/server.mjs',
      cwd: 'D:/LAN-AI-Infra/LibreChat',
      interpreter: 'C:/Program Files/nodejs/node.exe',
      env: { ROUTER_PORT: '4001', ROUTER_HOST: '127.0.0.1' },
    },
  ],
};
