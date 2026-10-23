#!/usr/bin/env node
/**
 * Create the Satchida keyring: a master key file with a restrictive ACL.
 *
 *   node fleet/scripts/init-keyring.mjs            create (refuses to overwrite)
 *   node fleet/scripts/init-keyring.mjs --rotate   replace, after re-sealing secrets
 *
 * The key is printed ONCE, to stdout. It is never written by this process and
 * never stored in an environment variable, a .env file, or the repository.
 * Pipe it into the file yourself, then paste-restrict it into source control.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { generateMasterKey, masterKeyPath } from '../src/keystore.mjs';

const path = masterKeyPath();
const rotate = process.argv.includes('--rotate');

if (existsSync(path) && !rotate) {
  console.error(`Refusing to overwrite an existing keyring at ${path}`);
  console.error('Use --rotate only after re-sealing every stored secret.');
  process.exit(1);
}

mkdirSync(path.replace(/[\\/][^\\/]+$/, ''), { recursive: true });

const key = generateMasterKey();
writeFileSync(path, key + '\n', { encoding: 'utf8', mode: 0o600 });

// Windows-only ACL hardening. Silently skipped elsewhere.
if (process.platform === 'win32') {
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync('icacls', [path, '/inheritance:r', '/grant:r', 'F'], { stdio: 'ignore' });
    console.log('ACL restricted: the current account only (run as administrator for SYSTEM access).');
  } catch {
    console.warn('Could not set ACL automatically. Restrict it manually:');
    console.warn(`  icacls "${path}" /inheritance:r /grant:r "F"`);
  }
}

console.log(`Keyring written to: ${path}\n`);
console.log('Store this value in your password manager now. It is not shown again.');
console.log('Anyone holding this file can decrypt every sealed provider API key.');
console.log('It cannot be recovered if lost — re-sealing would be required.');
process.stdout.write('\n--- BEGIN KEY (store securely, then delete this line) ---\n');
process.stdout.write(`${key}\n--- END KEY ---\n`);