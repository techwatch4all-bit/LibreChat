const express = require('express');
const { createSetBalanceConfig } = require('@librechat/api');
const router = express.Router();
const controller = require('../controllers/Balance');
const { requireJwtAuth } = require('../middleware/');
const { findBalanceByUser, upsertBalanceFields } = require('~/models');
const { getAppConfig } = require('~/server/services/Config');

const setBalanceConfig = createSetBalanceConfig({
  getAppConfig,
  findBalanceByUser,
  upsertBalanceFields,
});

router.get('/', requireJwtAuth, setBalanceConfig, controller);

router.get('/usage', requireJwtAuth, async (req, res) => {
  try {
    const { getUserUsageStats } = require('~/models');
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    if (start && isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Invalid startDate format' });
    }
    if (end && isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid endDate format' });
    }

    const stats = await getUserUsageStats(req.user.id, start, end);
    return res.status(200).json(stats);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve usage statistics' });
  }
});

module.exports = router;
