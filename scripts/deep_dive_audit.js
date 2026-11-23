const fs = require('fs');
const path = require('path');

console.log('=== Deep-Dive Audit: LibreChat In-Repo Paths & Static Routes ===');

// 1. Check storage directories
const storageDirs = [
  'storage',
  'storage/users',
  'storage/exports',
  'storage/exports/generated',
  'storage/exports/videos',
  'storage/exports/projects',
  'data'
];
for (const d of storageDirs) {
  console.log(`[Storage Check] ${d} -> exists: ${fs.existsSync(d)}`);
}

// 2. Check repos submodules
const repos = [
  'repos/Satchida-Studio',
  'repos/Satchida-Studio/venv',
  'repos/Satchida-Studio/venv/Scripts/python.exe',
  'repos/Satchida-Studio/external/OpenMontage',
  'repos/satchida-motion-art',
  'repos/satchida-procedural-art'
];
for (const r of repos) {
  console.log(`[Repo Submodule Check] ${r} -> exists: ${fs.existsSync(r)}`);
}

// 3. Check client public static routes
const publicPaths = [
  'client/public/motion',
  'client/public/assets',
  'client/public/images',
  'client/public/templates',
  'client/public/temp_audio'
];
for (const p of publicPaths) {
  console.log(`[Client Public Check] ${p} -> exists: ${fs.existsSync(p)}`);
}

// 4. Verify generated manifest.json
const inRepoManifest = 'storage/exports/generated/manifest.json';
if (fs.existsSync(inRepoManifest)) {
  try {
    const data = JSON.parse(fs.readFileSync(inRepoManifest, 'utf8'));
    console.log(`[Manifest Audit] ${inRepoManifest} is valid JSON with ${data.length} items`);
    // Check first 5 items
    let broken = 0;
    for (const item of data) {
      if (item.url && item.url.startsWith('/generated/')) {
        const localFile = path.join('storage/exports/generated', item.url.replace('/generated/', ''));
        if (!fs.existsSync(localFile)) {
          broken++;
        }
      }
    }
    console.log(`[Manifest Audit] Total verified files: ${data.length}, missing files on disk: ${broken}`);
  } catch (err) {
    console.error(`[Manifest Audit] Error parsing manifest:`, err.message);
  }
} else {
  console.log(`[Manifest Audit] ${inRepoManifest} NOT FOUND!`);
}
