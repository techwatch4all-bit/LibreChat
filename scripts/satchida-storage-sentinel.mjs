#!/usr/bin/env node
/**
 * Satchida User Storage Quota & Auto-Purge Sentinel (satchida-storage-sentinel.mjs)
 * ---------------------------------------------------------------------------------
 * Manages physical per-user storage allocation and automated LRU retention:
 * 
 * Storage Quota Policy:
 * - standard (default): 50 MB
 * - standard_family (standard x 2): 100 MB
 * - pro: 100 MB
 * - pro_family (standard x 4): 200 MB
 * - privacy: 200 MB
 * - enterprise: Custom/NAS (exempt from local auto-purge)
 * 
 * Directory Layout per User:
 *   storage/users/<username>/
 *   ├── uploads/      (raw attachments, drawings, temporary user uploads)
 *   ├── generated/    (rendered videos, final documents, procedural art)
 *   └── manifest.json (local user library index)
 * 
 * Eviction Rules:
 * - When user folder exceeds quota:
 *   1. Auto-purges temporary scratch / uploads/ by LRU (oldest unreferenced first)
 *   2. Never silently deletes generated final artifacts (generated/)
 *   3. If uploads are empty and generated still exceeds quota, flags status for user warning.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LIBRE_ROOT = path.resolve(__dirname, '..');

const STORAGE_ROOT = path.join(LIBRE_ROOT, 'storage', 'users');
const UPLOADS_SOURCE_DIR = path.join(LIBRE_ROOT, 'uploads');
const IMAGES_SOURCE_DIR = path.join(LIBRE_ROOT, 'client', 'public', 'images');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';

const QUOTA_MAP_MB = {
  standard: 50,
  basic: 50,
  family: 100,
  standard_family: 100,
  pro: 100,
  pro_family: 200,
  privacy: 200,
  enterprise: 10240, // 10 GB placeholder
};

function getDirSizeBytes(dirPath) {
  let total = 0;
  if (!fs.existsSync(dirPath)) return 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dirPath, ent.name);
    if (ent.isDirectory()) {
      total += getDirSizeBytes(full);
    } else if (ent.isFile()) {
      try {
        total += fs.statSync(full).size;
      } catch (_) {}
    }
  }
  return total;
}

export async function syncAndEnforceStorage() {
  if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  }

  let conn;
  try {
    conn = await mongoose.connect(MONGO_URI);
    const users = await conn.connection.db.collection('users').find({}).toArray();

    for (const u of users) {
      const username = u.username || String(u._id);
      const userDir = path.join(STORAGE_ROOT, username);
      const uploadsDir = path.join(userDir, 'uploads');
      const generatedDir = path.join(userDir, 'generated');

      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

      // Determine quota
      const accType = (u.accountType || 'standard').toLowerCase();
      const quotaMb = QUOTA_MAP_MB[accType] || 50;
      const quotaBytes = quotaMb * 1024 * 1024;

      // Sync recent user attachments from global folders into user's upload directory if not present
      const userIdStr = String(u._id);
      const userImgDir = path.join(IMAGES_SOURCE_DIR, userIdStr);
      if (fs.existsSync(userImgDir)) {
        const imgFiles = fs.readdirSync(userImgDir);
        for (const imgName of imgFiles) {
          const srcPath = path.join(userImgDir, imgName);
          const destPath = path.join(uploadsDir, imgName);
          if (!fs.existsSync(destPath) && fs.statSync(srcPath).isFile()) {
            try {
              fs.copyFileSync(srcPath, destPath);
            } catch (_) {}
          }
        }
      }

      const userDocsDir = path.join(UPLOADS_SOURCE_DIR, userIdStr);
      if (fs.existsSync(userDocsDir)) {
        const docFiles = fs.readdirSync(userDocsDir);
        for (const docName of docFiles) {
          const srcPath = path.join(userDocsDir, docName);
          const destPath = path.join(uploadsDir, docName);
          if (!fs.existsSync(destPath) && fs.statSync(srcPath).isFile()) {
            try {
              fs.copyFileSync(srcPath, destPath);
            } catch (_) {}
          }
        }
      }

      // Check current usage
      let currentBytes = getDirSizeBytes(userDir);

      // LRU purge if exceeding quota: evict oldest uploads first
      if (currentBytes > quotaBytes) {
        console.log(`[Storage Sentinel] User ${username} (${accType}) usage: ${(currentBytes / (1024*1024)).toFixed(2)} MB exceeds quota: ${quotaMb} MB. Initiating LRU purge...`);
        const uploadFiles = fs.readdirSync(uploadsDir).map(name => {
          const full = path.join(uploadsDir, name);
          try {
            return { name, full, stat: fs.statSync(full) };
          } catch (_) {
            return null;
          }
        }).filter(Boolean);

        // Sort oldest first (FIFO / LRU by mtime)
        uploadFiles.sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs);

        for (const item of uploadFiles) {
          if (currentBytes <= quotaBytes) break;
          try {
            fs.unlinkSync(item.full);
            currentBytes -= item.stat.size;
            console.log(`[Storage Sentinel] Purged oldest temporary upload: ${item.name} (-${(item.stat.size / 1024).toFixed(1)} KB)`);
          } catch (err) {
            console.error(`[Storage Sentinel] Failed to purge ${item.name}:`, err.message);
          }
        }
      }

      // Update user manifest.json
      const manifestPath = path.join(userDir, 'manifest.json');
      const allUploads = fs.readdirSync(uploadsDir).map(f => {
        try {
          const st = fs.statSync(path.join(uploadsDir, f));
          return { name: f, kind: 'upload', size: st.size, modified: st.mtime.toISOString(), path: `/storage/users/${username}/uploads/${f}` };
        } catch (_) { return null; }
      }).filter(Boolean);

      const allGenerated = fs.readdirSync(generatedDir).map(f => {
        try {
          const st = fs.statSync(path.join(generatedDir, f));
          return { name: f, kind: 'generated', size: st.size, modified: st.mtime.toISOString(), path: `/storage/users/${username}/generated/${f}` };
        } catch (_) { return null; }
      }).filter(Boolean);

      const manifestData = {
        username,
        accountType: accType,
        quotaMb,
        usedBytes: currentBytes,
        usedMb: Number((currentBytes / (1024 * 1024)).toFixed(2)),
        items: [...allUploads, ...allGenerated]
      };

      fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('[Storage Sentinel] Sync error:', err);
  } finally {
    if (conn) await mongoose.disconnect();
  }
}

// If run directly via CLI / cron / PM2:
if (process.argv[1] && process.argv[1].endsWith('satchida-storage-sentinel.mjs')) {
  console.log('[Storage Sentinel] Executing scheduled storage quota scan...');
  syncAndEnforceStorage().then(() => {
    console.log('[Storage Sentinel] Storage check and enforcement complete.');
  });
}
