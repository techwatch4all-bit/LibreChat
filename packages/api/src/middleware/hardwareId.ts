import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

let cachedHardwareFingerprint: string | null = null;
let cachedDeploymentId: string | null = null;
let cachedAppVersion: string | null = null;

function readWindowsMachineGuid(): string {
  if (process.platform !== 'win32') {
    return '';
  }
  try {
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { encoding: 'utf8', timeout: 3000, windowsHide: true },
    );
    const match = /MachineGuid\s+REG_SZ\s+([^\r\n]+)/i.exec(out);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

function readSystemUuid(): string {
  if (process.platform !== 'win32') {
    return '';
  }
  try {
    const out = execSync(
      'powershell -NoProfile -NonInteractive -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"',
      { encoding: 'utf8', timeout: 4000, windowsHide: true },
    ).trim();
    return out && out.length >= 8 ? out : '';
  } catch {
    return '';
  }
}

/**
 * Computes and caches a deterministic SHA-256 hardware fingerprint for this node.
 * Computed once per process lifetime (0 ms per request).
 */
export function getLocalHardwareFingerprint(): string {
  if (cachedHardwareFingerprint) {
    return cachedHardwareFingerprint;
  }

  const machineGuid = readWindowsMachineGuid();
  const systemUuid = readSystemUuid();
  const fallback = `${os.hostname()}|${os.platform()}|${os.arch()}|${os.cpus()[0]?.model ?? ''}`;
  const rawMaterial = [machineGuid, systemUuid, fallback].filter(Boolean).join('::');

  cachedHardwareFingerprint = crypto
    .createHash('sha256')
    .update(rawMaterial)
    .digest('hex')
    .slice(0, 32);

  return cachedHardwareFingerprint;
}

/**
 * Returns a persistent unique deployment identifier for this node installation.
 */
export function getDeploymentId(): string {
  if (cachedDeploymentId) {
    return cachedDeploymentId;
  }
  if (process.env.SATCHIDA_DEPLOYMENT_ID) {
    cachedDeploymentId = process.env.SATCHIDA_DEPLOYMENT_ID.trim();
    return cachedDeploymentId;
  }

  const idPath = path.resolve(process.cwd(), '.satchida-deployment-id');
  try {
    if (fs.existsSync(idPath)) {
      const existing = fs.readFileSync(idPath, 'utf8').trim();
      if (existing.length >= 8) {
        cachedDeploymentId = existing;
        return cachedDeploymentId;
      }
    }
    const generated = `dep_${crypto.randomBytes(8).toString('hex')}`;
    fs.writeFileSync(idPath, generated, { encoding: 'utf8', flag: 'w' });
    cachedDeploymentId = generated;
    return cachedDeploymentId;
  } catch {
    cachedDeploymentId = `dep_${getLocalHardwareFingerprint().slice(0, 16)}`;
    return cachedDeploymentId;
  }
}

/**
 * Returns the current Satchida/LibreChat release version from package.json.
 */
export function getAppVersion(): string {
  if (cachedAppVersion) {
    return cachedAppVersion;
  }
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
      if (pkg.version) {
        cachedAppVersion = pkg.version;
        return cachedAppVersion;
      }
    }
  } catch {
    // ignore
  }
  cachedAppVersion = '0.8.8';
  return cachedAppVersion;
}
