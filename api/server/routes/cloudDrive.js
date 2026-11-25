const express = require('express');
const { createCloudDriveHttpHandlers } = require('@librechat/api');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');

const router = express.Router();
let handlers;

function getHandlers() {
  if (handlers == null) {
    handlers = createCloudDriveHttpHandlers({});
  }
  return handlers;
}

router.use(requireJwtAuth);
router.get('/status', (req, res) => getHandlers().getStatus(req, res));

module.exports = router;
