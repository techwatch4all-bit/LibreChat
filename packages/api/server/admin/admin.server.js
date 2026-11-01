const express = require('express');
const path = require('path');
const adminRouter = require('./index.js');

const router = express.Router();
router.use('/admin', adminRouter);

module.exports = router;