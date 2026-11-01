const express = require('express');
const axios = require('axios');
const { SystemCapabilities, logger } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

const requireAdminSurface = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const requireReadUsers = requireCapability(SystemCapabilities.READ_USERS);

const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || 'http://127.0.0.1:3012/api/v1';
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || '1C4Q14C-8BVMC35-KRZJSSV-ESDMPHH';

router.use(requireJwtAuth, requireAdminSurface);

/**
 * GET /api/admin/vaults
 * Fetches the active AnythingLLM knowledge vaults / workspaces for policy assignment in Groups & Users.
 */
router.get('/', requireReadUsers, async (req, res) => {
  try {
    const response = await axios.get(`${ANYTHINGLLM_URL}/workspaces`, {
      headers: {
        Authorization: `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    const workspaces = (response.data?.workspaces || []).map((ws) => ({
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      documentCount: Array.isArray(ws.documents) ? ws.documents.length : 0,
      createdAt: ws.createdAt,
    }));

    return res.status(200).json({ vaults: workspaces, total: workspaces.length });
  } catch (error) {
    logger.error('[admin/vaults] Failed to fetch AnythingLLM workspaces:', error.message);
    // Return empty list gracefully if AnythingLLM is offline or initializing
    return res.status(200).json({ vaults: [], total: 0, error: 'Vault service unreachable' });
  }
});

module.exports = router;
