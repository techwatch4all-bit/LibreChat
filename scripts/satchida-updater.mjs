#!/usr/bin/env node
/**
 * Satchida Enterprise Tenant Delta Auto-Updater (Track A3)
 *
 * Fetches the Ed25519-signed release manifest from gateway.satchida.com,
 * verifies the cryptographic signature, and applies only changed files
 * (delta update) with SHA-256 verification.
 *
 * Usage:
 *   node scripts/satchida-updater.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SATCHIDA_MASTER_PUBLIC_KEY =
  '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAbR6Cz0USZkPutuGIoq69nWmPHbrUt71aG5YDpkCuBiM=\n-----END PUBLIC KEY-----\n';

const REPO_ROOT = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const jsonOut = process.argv.includes('--json');
const gatewayBase = (
  process.env.SATCHIDA_GATEWAY_URL || 'https://gateway.satchida.com'
).replace(/\/+$/, '');

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function verifySignedManifest(manifestRaw, signatureB64Url) {
  if (!manifestRaw || !signatureB64Url) {
    return false;
  }
  try {
    return crypto.verify(
      null,
      Buffer.from(manifestRaw, 'utf8'),
      SATCHIDA_MASTER_PUBLIC_KEY,
      Buffer.from(signatureB64Url, 'base64url'),
    );
  } catch {
    return false;
  }
}

async function main() {
  const vk = process.env.SATCHIDA_GATEWAY_VK || '';
  const headers = vk ? { Authorization: `Bearer ${vk}` } : {};

  if (!jsonOut) {
    console.log(`[SatchidaUpdater] Checking ${gatewayBase}/api/releases/latest ...`);
  }
  const res = await fetch(`${gatewayBase}/api/releases/latest`, { headers });
  if (!res.ok) {
    throw new Error(`Release check failed with HTTP ${res.status}`);
  }

  const envelope = await res.json();
  const manifestRaw = envelope?.manifestRaw;
  const signature = envelope?.signature;

  if (!verifySignedManifest(manifestRaw, signature)) {
    throw new Error('Ed25519 release manifest signature verification FAILED. Aborting update.');
  }

  const manifest = JSON.parse(manifestRaw);
  const changedFiles = [];

  for (const [relPath, meta] of Object.entries(manifest.files || {})) {
    if (relPath.includes('..') || path.isAbsolute(relPath)) {
      throw new Error(`Unsafe path in release manifest: ${relPath}`);
    }
    const localPath = path.resolve(REPO_ROOT, relPath);
    if (!localPath.startsWith(REPO_ROOT)) {
      throw new Error(`Path traversal rejected: ${relPath}`);
    }
    const currentHash = sha256File(localPath);
    if (currentHash !== meta.sha256) {
      changedFiles.push({ relPath, expectedHash: meta.sha256, localPath });
    }
  }

  if (changedFiles.length === 0) {
    if (jsonOut) {
      console.log(
        JSON.stringify({
          success: true,
          version: manifest.version,
          appliedFiles: 0,
          verified: true,
          message: `Already up to date (${manifest.version})`,
        }),
      );
    } else {
      console.log(`[SatchidaUpdater] Node is already up to date (${manifest.version}).`);
    }
    return;
  }

  if (!jsonOut) {
    console.log(
      `[SatchidaUpdater] Found ${changedFiles.length} delta file(s) for ${manifest.version}.`,
    );
  }
  if (dryRun) {
    if (jsonOut) {
      console.log(
        JSON.stringify({
          success: true,
          version: manifest.version,
          appliedFiles: 0,
          pendingFiles: changedFiles.length,
          verified: true,
          dryRun: true,
        }),
      );
    } else {
      console.log('[SatchidaUpdater] Dry-run mode; no files modified.');
    }
    return;
  }

  for (const item of changedFiles) {
    const fileUrl = `${gatewayBase}/api/releases/${encodeURIComponent(manifest.version)}/file?path=${encodeURIComponent(item.relPath)}`;
    const fRes = await fetch(fileUrl, { headers });
    if (!fRes.ok) {
      throw new Error(`Failed to fetch delta file ${item.relPath}: HTTP ${fRes.status}`);
    }
    const buf = Buffer.from(await fRes.arrayBuffer());
    const actualHash = crypto.createHash('sha256').update(buf).digest('hex');
    if (actualHash !== item.expectedHash) {
      throw new Error(`SHA-256 mismatch on ${item.relPath}. Aborting update.`);
    }
    fs.mkdirSync(path.dirname(item.localPath), { recursive: true });
    const tmpPath = `${item.localPath}.satchida-tmp`;
    fs.writeFileSync(tmpPath, buf);
    fs.renameSync(tmpPath, item.localPath);
  }

  // Post-apply verification: confirm every updated file on disk matches expected SHA-256
  for (const item of changedFiles) {
    if (sha256File(item.localPath) !== item.expectedHash) {
      throw new Error(`Post-apply verification failed on ${item.relPath}`);
    }
  }

  if (jsonOut) {
    console.log(
      JSON.stringify({
        success: true,
        version: manifest.version,
        appliedFiles: changedFiles.length,
        verified: true,
        message: `Applied and verified ${changedFiles.length} file(s) for ${manifest.version}`,
      }),
    );
  } else {
    console.log(
      `[SatchidaUpdater] Applied & verified ${changedFiles.length} delta file(s) for ${manifest.version}.`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main().catch((err) => {
    console.error('[SatchidaUpdater] Error:', err.message);
    process.exit(1);
  });
}
