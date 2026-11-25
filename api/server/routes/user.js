const fs = require('fs');
const path = require('path');
const express = require('express');
const { createUserPreferencesHandler } = require('@librechat/api');
const {
  updateUserPluginsController,
  resendVerificationController,
  getTermsStatusController,
  acceptTermsController,
  verifyEmailController,
  deleteUserController,
  getUserController,
} = require('~/server/controllers/UserController');
const {
  verifyEmailLimiter,
  verifyEmailSubmissionLimiter,
  configMiddleware,
  canDeleteAccount,
  requireJwtAuth,
} = require('~/server/middleware');

const settings = require('./settings');
const { updateUserStatefulCodeEnvironment, getUserById } = require('~/models');

const router = express.Router();

const ONEAPI_BASE_URL = (process.env.ONEAPI_BASE_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const ONEAPI_ADMIN_TOKEN = process.env.ONEAPI_ADMIN_ACCESS_TOKEN || '';

const STORAGE_QUOTA_MB = {
  standard: 50,
  basic: 50,
  family: 100,
  standard_family: 100,
  pro: 100,
  pro_family: 200,
  privacy: 200,
  enterprise: 10240, // 10 GB
};

function getDirSizeBytes(dirPath) {
  let total = 0;
  try {
    if (!fs.existsSync(dirPath)) return 0;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dirPath, ent.name);
      if (ent.isDirectory()) {
        total += getDirSizeBytes(full);
      } else if (ent.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
  return total;
}

function computeUserStorage(username, userId, tier) {
  const normTier = String(tier || 'standard').toLowerCase().trim();
  const quotaMb = STORAGE_QUOTA_MB[normTier] || 50;
  const quotaBytes = quotaMb * 1024 * 1024;
  const rootDir = path.resolve(process.cwd(), 'storage', 'users', String(username || userId || ''));
  let usedBytes = getDirSizeBytes(rootDir);
  if (usedBytes === 0 && userId) {
    const imgDir = path.resolve(process.cwd(), 'client', 'public', 'images', String(userId));
    usedBytes = getDirSizeBytes(imgDir);
  }
  const availableBytes = Math.max(0, quotaBytes - usedBytes);
  return {
    usedBytes,
    quotaBytes,
    availableBytes,
    quotaMb,
  };
}

function classifyMediaKind(filename) {
  const lower = filename.toLowerCase();
  if (/\.(mp4|webm|mkv|mov)$/.test(lower)) return 'video';
  if (/\.(mp3|wav|aac|m4a|ogg|flac)$/.test(lower)) return 'audio';
  if (/\.(png|jpg|jpeg|webp|gif|svg|bmp)$/.test(lower)) return 'image';
  return 'document';
}

function listUserStorageItems(username, userId) {
  const folderName = String(username || userId || '').trim();
  if (!folderName) return [];
  const userRoot = path.resolve(process.cwd(), 'storage', 'users', folderName);
  if (!fs.existsSync(userRoot)) return [];

  const items = [];
  const walk = (dir, relBase) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        walk(full, rel);
      } else if (ent.isFile()) {
        if (ent.name === 'manifest.json') continue;
        try {
          const st = fs.statSync(full);
          const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
          let mediaUrl = `/storage/users/${encodeURIComponent(folderName)}/${encodedRel}`;
          if (rel.startsWith('generated/')) {
            const sub = rel.slice('generated/'.length).split('/').map(encodeURIComponent).join('/');
            mediaUrl = `/generated/${sub}`;
          } else if (rel.startsWith('uploads/') && userId) {
            const fname = rel.slice('uploads/'.length);
            const pubImg = path.resolve(process.cwd(), 'client', 'public', 'images', String(userId), fname);
            if (fs.existsSync(pubImg)) {
              mediaUrl = `/images/${encodeURIComponent(String(userId))}/${encodeURIComponent(fname)}`;
            }
          }
          items.push({
            id: rel,
            name: ent.name,
            kind: classifyMediaKind(ent.name),
            size: st.size,
            created: st.mtime.toISOString().slice(0, 10),
            mtimeMs: st.mtimeMs,
            url: mediaUrl,
            user: folderName,
          });
        } catch {
          // ignore unreadable file
        }
      }
    }
  };

  walk(userRoot, '');
  items.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  return items;
}

async function resolveOfferUserContext(req) {
  const userId = req.user?.id || req.user?._id?.toString();
  const fullUser = userId
    ? await getUserById(userId, 'tenantId username accountType +satchidaSeatAlias').catch(() => null)
    : null;
  return {
    userId: userId || '',
    username: (fullUser?.username || req.user?.username || '').trim(),
    tenantId: (fullUser?.tenantId || req.user?.tenantId || process.env.ONEAPI_DEFAULT_TENANT || 'satchida-master').trim(),
    seatAlias: (fullUser?.satchidaSeatAlias || req.user?.satchidaSeatAlias || '').trim(),
    tier: (fullUser?.accountType || req.user?.accountType || 'basic').toLowerCase().trim(),
  };
}

const updateUserPreferences = createUserPreferencesHandler({
  updateStatefulCodeEnvironment: updateUserStatefulCodeEnvironment,
});

router.use('/settings', settings);
router.get('/', requireJwtAuth, getUserController);
router.get('/seat-balance', requireJwtAuth, async (req, res) => {
  try {
    const { userId, username, tenantId, seatAlias, tier } = await resolveOfferUserContext(req);
    const storage = computeUserStorage(username, userId, tier);
    let voice = { usedMinutes: 0, usedTokens: 0, sessions: 0 };
    try {
      const mongoose = require('mongoose');
      const Transaction = mongoose.models.Transaction;
      if (Transaction && userId) {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const voiceTxns = await Transaction.find({
          user: userId,
          context: 'live_voice',
          createdAt: { $gte: monthStart },
        })
          .select('rawAmount conversationId')
          .lean();
        let totalSec = 0;
        let totalTok = 0;
        for (const t of voiceTxns) {
          totalTok += Math.abs(Number(t.rawAmount || 0));
          const m = String(t.conversationId || '').match(/^voice:(\d+)s$/);
          if (m) {
            totalSec += Number(m[1] || 0);
          }
        }
        voice = {
          usedMinutes: Number((totalSec / 60).toFixed(1)),
          usedTokens: totalTok,
          sessions: voiceTxns.length,
        };
      }
    } catch {
      // Non-blocking voice usage aggregation
    }
    if (!ONEAPI_ADMIN_TOKEN || !seatAlias) {
      return res.json({ available: false, tier, storage, voice });
    }
    const url = `${ONEAPI_BASE_URL}/api/analytics/seat-limits?tenant_id=${encodeURIComponent(tenantId)}`;
    const resp = await fetch(url, {
      headers: { Authorization: ONEAPI_ADMIN_TOKEN },
    });
    if (!resp.ok) {
      return res.json({ available: false, tier, storage, voice });
    }
    const payload = await resp.json().catch(() => ({}));
    const seats = Array.isArray(payload?.data?.seats) ? payload.data.seats : [];
    const match = seats.find(
      (s) => String(s?.alias_id || '').toLowerCase() === seatAlias.toLowerCase(),
    );
    if (!match) {
      return res.json({ available: false, tier, storage, voice });
    }
    const resolvedTier = match.tier || tier;
    const resolvedStorage = computeUserStorage(username, userId, resolvedTier);
    const inputCeil = Number(match.input_ceiling || 0);
    const outputCeil = Number(match.output_ceiling || 0);
    const inputUsed = Number(match.input_tokens || 0);
    const outputUsed = Number(match.output_tokens || 0);
    const inputRemaining = Math.max(0, inputCeil - inputUsed);
    const outputRemaining = Math.max(0, outputCeil - outputUsed);
    const ceilingTokens = inputCeil + outputCeil;
    const remainingTokens = inputRemaining + outputRemaining;
    return res.json({
      available: true,
      tier: resolvedTier,
      remainingTokens,
      ceilingTokens,
      usedTokens: Math.max(0, inputUsed + outputUsed),
      inputRemaining,
      outputRemaining,
      storage: resolvedStorage,
      voice,
    });
  } catch {
    return res.json({ available: false });
  }
});
router.get('/storage/items', requireJwtAuth, async (req, res) => {
  try {
    const { userId, username, tier } = await resolveOfferUserContext(req);
    const items = listUserStorageItems(username, userId);
    const storage = computeUserStorage(username, userId, tier);
    return res.json({ items, owner: username || userId, tier, storage });
  } catch {
    return res.status(500).json({ error: 'Failed to load user storage library' });
  }
});

router.post('/storage/delete', requireJwtAuth, async (req, res) => {
  try {
    const { userId, username, tier } = await resolveOfferUserContext(req);
    const folderName = String(username || userId || '').trim();
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!folderName || ids.length === 0) {
      return res.status(400).json({ error: 'No files selected for deletion' });
    }
    const userRoot = path.resolve(process.cwd(), 'storage', 'users', folderName);
    const userRootPrefix = userRoot.endsWith(path.sep) ? userRoot : `${userRoot}${path.sep}`;
    let deleted = 0;
    let freedBytes = 0;
    const deletedNames = new Set();

    for (const rawId of ids) {
      if (typeof rawId !== 'string' || !rawId.trim()) continue;
      const normalized = rawId.replace(/\\/g, '/').replace(/^\/+/, '');
      const target = path.resolve(userRoot, normalized);
      if (!target.startsWith(userRootPrefix)) continue;
      if (path.basename(target) === 'manifest.json') continue;
      try {
        if (fs.existsSync(target) && fs.statSync(target).isFile()) {
          const st = fs.statSync(target);
          fs.unlinkSync(target);
          deleted += 1;
          freedBytes += st.size;
          deletedNames.add(path.basename(target));
        }
      } catch {
        // skip locked or missing file
      }
    }

    // Keep generated/manifest.json in sync if present
    if (deletedNames.size > 0) {
      const genManifest = path.join(userRoot, 'generated', 'manifest.json');
      try {
        if (fs.existsSync(genManifest)) {
          const parsed = JSON.parse(fs.readFileSync(genManifest, 'utf8'));
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((e) => !deletedNames.has(e?.name));
            fs.writeFileSync(genManifest, JSON.stringify(filtered, null, 2), 'utf8');
          }
        }
      } catch {
        // non-fatal
      }
    }

    const storage = computeUserStorage(username, userId, tier);
    return res.json({ success: true, deleted, freedBytes, storage });
  } catch {
    return res.status(500).json({ error: 'Failed to delete selected files' });
  }
});

router.get('/token-offers', requireJwtAuth, async (req, res) => {
  try {
    if (!ONEAPI_ADMIN_TOKEN) {
      return res.json({ offers: [] });
    }
    const { tenantId, seatAlias, tier } = await resolveOfferUserContext(req);
    if (!seatAlias) {
      return res.json({ offers: [] });
    }
    const url = `${ONEAPI_BASE_URL}/api/analytics/seat-offers/pending?tenant_id=${encodeURIComponent(tenantId)}&seat_alias=${encodeURIComponent(seatAlias)}&tier=${encodeURIComponent(tier)}`;
    const resp = await fetch(url, {
      headers: { Authorization: ONEAPI_ADMIN_TOKEN },
    });
    if (!resp.ok) {
      return res.json({ offers: [] });
    }
    const payload = await resp.json().catch(() => ({}));
    return res.json({ offers: Array.isArray(payload?.data) ? payload.data : [] });
  } catch {
    return res.json({ offers: [] });
  }
});
router.post('/token-offers/:id/claim', requireJwtAuth, async (req, res) => {
  try {
    if (!ONEAPI_ADMIN_TOKEN) {
      return res.status(503).json({ success: false, message: 'Offer service unavailable' });
    }
    const { tenantId, seatAlias, tier } = await resolveOfferUserContext(req);
    if (!seatAlias) {
      return res.status(400).json({ success: false, message: 'No seat alias assigned to this account' });
    }
    const offerId = encodeURIComponent(req.params.id);
    const resp = await fetch(`${ONEAPI_BASE_URL}/api/analytics/seat-offers/${offerId}/claim`, {
      method: 'POST',
      headers: {
        Authorization: ONEAPI_ADMIN_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        seat_alias: seatAlias,
        tier,
      }),
    });
    const payload = await resp.json().catch(() => ({ success: false }));
    return res.status(resp.status).json(payload);
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to claim bonus offer' });
  }
});
router.patch('/preferences', requireJwtAuth, configMiddleware, updateUserPreferences);
router.get('/terms', requireJwtAuth, getTermsStatusController);
router.post('/terms/accept', requireJwtAuth, acceptTermsController);
router.post('/plugins', requireJwtAuth, updateUserPluginsController);
router.delete('/delete', requireJwtAuth, canDeleteAccount, configMiddleware, deleteUserController);
router.post('/verify', verifyEmailSubmissionLimiter, verifyEmailController);
router.post('/verify/resend', verifyEmailLimiter, resendVerificationController);

module.exports = router;
