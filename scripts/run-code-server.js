#!/usr/bin/env node
const { spawn } = require('child_process');

const codeServerCmd = 'C:\\Users\\WinDiesel\\AppData\\Roaming\\npm\\code-server.cmd';
const args = [
  '--bind-addr',
  '127.0.0.1:8085',
  '--auth',
  'none',
  '--proxy-domain',
  'localhost:3080',
  '--proxy-domain',
  '127.0.0.1:3080',
];

console.log('Starting code-server on 127.0.0.1:8085...');
const child = spawn(codeServerCmd, args, {
  stdio: 'inherit',
  shell: true,
  windowsHide: true,
});

child.on('exit', (code) => {
  console.log(`code-server exited with code ${code}`);
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to spawn code-server:', err);
  process.exit(1);
});
