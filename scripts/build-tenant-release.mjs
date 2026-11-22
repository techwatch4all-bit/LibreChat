#!/usr/bin/env node
/**
 * Satchida Enterprise Tenant Release Packager (Track A1)
 *
 * Produces a zero-source, source-map-free runtime release bundle and a
 * SHA-256 file manifest (release-manifest.json) for signed delta auto-updates
 * via gateway.satchida.com.
 *
 * Usage:
 *   node scripts/build-tenant-release.mjs [--out releases] [--skip-build]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const REPO_ROOT = process.cwd();
const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const outIdx = args.indexOf('--out');
const outBase = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : 'releases';

const FORBIDDEN_EXTENSIONS = new Set(['.map', '.ts', '.tsx', '.mts', '.cts']);
const FORBIDDEN_DIRS = new Set(['.git', 'node_modules', '__tests__', 'test', 'tests', 'src']);

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function isAllowedFile(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  for (const seg of segments) {
    if (FORBIDDEN_DIRS.has(seg)) {
      return false;
    }
  }
  const base = path.basename(normalized).toLowerCase();
  if (
    base.endsWith('.spec.js') ||
    base.endsWith('.test.js') ||
    base.endsWith('.d.ts') ||
    base.endsWith('.d.cts') ||
    base.endsWith('.map')
  ) {
    return false;
  }
  const ext = path.extname(base);
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return false;
  }
  return true;
}

function copyFilteredDir(srcDir, dstDir, relBase = '') {
  if (!fs.existsSync(srcDir)) {
    return;
  }
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    const dstPath = path.join(dstDir, entry.name);

    if (entry.isDirectory()) {
      if (FORBIDDEN_DIRS.has(entry.name)) {
        continue;
      }
      copyFilteredDir(srcPath, dstPath, relPath);
    } else if (entry.isFile()) {
      if (!isAllowedFile(relPath)) {
        continue;
      }
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function collectManifest(dir, baseDir, out = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectManifest(full, baseDir, out);
    } else if (entry.isFile()) {
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      if (rel === 'release-manifest.json') {
        continue;
      }
      out[rel] = {
        sha256: sha256File(full),
        size: fs.statSync(full).size,
      };
    }
  }
  return out;
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const version = (pkg.version || '0.8.8').replace(/^v/i, '');

  if (!skipBuild) {
    console.log('[ReleasePackager] Building packages/api and client...');
    execSync('npm run build:api', { cwd: REPO_ROOT, stdio: 'inherit' });
    execSync('npm run build:client', { cwd: REPO_ROOT, stdio: 'inherit' });
  }

  const releaseDir = path.resolve(REPO_ROOT, outBase, `satchida-release-v${version}`);
  fs.rmSync(releaseDir, { recursive: true, force: true });
  fs.mkdirSync(releaseDir, { recursive: true });

  const runtimeDirs = [
    ['packages/api/dist', 'packages/api/dist'],
    ['packages/data-provider/dist', 'packages/data-provider/dist'],
    ['packages/data-schemas/dist', 'packages/data-schemas/dist'],
    ['client/dist', 'client/dist'],
    ['api/server', 'api/server'],
    ['api/models', 'api/models'],
    ['api/strategies', 'api/strategies'],
    ['api/utils', 'api/utils'],
  ];

  for (const [srcRel, dstRel] of runtimeDirs) {
    copyFilteredDir(path.join(REPO_ROOT, srcRel), path.join(releaseDir, dstRel));
  }

  const runtimeFiles = ['package.json', 'librechat.yaml', 'scripts/satchida-updater.mjs'];
  for (const f of runtimeFiles) {
    const src = path.join(REPO_ROOT, f);
    if (fs.existsSync(src)) {
      const dst = path.join(releaseDir, f);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }

  const files = collectManifest(releaseDir, releaseDir);
  const leaked = Object.keys(files).filter(
    (k) => k.endsWith('.map') || k.endsWith('.ts') || k.endsWith('.tsx') || k.includes('.git/'),
  );
  if (leaked.length > 0) {
    throw new Error(`Security invariant failed: source/map files leaked into release: ${leaked.slice(0, 5).join(', ')}`);
  }

  const manifest = {
    version: `v${version}`,
    releasedAt: new Date().toISOString(),
    fileCount: Object.keys(files).length,
    files,
  };

  fs.writeFileSync(
    path.join(releaseDir, 'release-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );

  console.log(
    `[ReleasePackager] Created zero-source release at ${releaseDir} (${manifest.fileCount} files, 0 source/map leaks).`,
  );
}

main();
