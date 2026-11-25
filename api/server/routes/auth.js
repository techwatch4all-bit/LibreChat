const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { logger, runAsSystem } = require('@librechat/data-schemas');
const {
  limiterCache,
  createSetBalanceConfig,
  calculatePasswordSignature,
  createTwoFactorManagementLimiter,
  forceRefreshCloudFrontAuthCookies,
} = require('@librechat/api');
const {
  resetPasswordRequestController,
  resetPasswordController,
  registrationController,
  graphTokenController,
  refreshController,
} = require('~/server/controllers/AuthController');
const {
  regenerateBackupCodes,
  disable2FA,
  confirm2FA,
  enable2FA,
  verify2FA,
} = require('~/server/controllers/TwoFactorController');
const { verify2FAWithTempToken } = require('~/server/controllers/auth/TwoFactorAuthController');
const { logoutController } = require('~/server/controllers/auth/LogoutController');
const { loginController } = require('~/server/controllers/auth/LoginController');
const { findBalanceByUser, upsertBalanceFields, updateUser } = require('~/models');
const { getAppConfig } = require('~/server/services/Config');
const middleware = require('~/server/middleware');

const setBalanceConfig = createSetBalanceConfig({
  getAppConfig,
  findBalanceByUser,
  upsertBalanceFields,
});

const router = express.Router();
const twoFactorManagementLimiter = createTwoFactorManagementLimiter({
  getAppConfig: () => getAppConfig({ baseOnly: true }),
  store: limiterCache('two_factor_management_user_limiter'),
});
const getCloudFrontAuthCookieRefreshResult = (req, res) => {
  const warmedResult = req.cloudFrontAuthCookieRefreshResult;
  if (warmedResult && (warmedResult.attempted || !warmedResult.enabled)) {
    return warmedResult;
  }

  return forceRefreshCloudFrontAuthCookies(req, res, req.user);
};

const ldapAuth = !!process.env.LDAP_URL && !!process.env.LDAP_USER_SEARCH_BASE;
//Local
router.post('/logout', middleware.requireJwtAuth, logoutController);
router.post(
  '/login',
  middleware.logHeaders,
  middleware.requireSameOrigin,
  middleware.loginLimiter,
  middleware.checkBan,
  middleware.validateEmailLogin,
  ldapAuth ? middleware.requireLdapAuth : middleware.requireLocalAuth,
  setBalanceConfig,
  loginController,
);
router.post('/refresh', refreshController);
router.post('/cloudfront/refresh', middleware.requireJwtAuth, (req, res) => {
  const result = getCloudFrontAuthCookieRefreshResult(req, res);
  if (!result.enabled) {
    return res.sendStatus(404);
  }

  const status = result.refreshed ? 200 : 500;
  return res.status(status).json({
    ok: result.refreshed,
    expiresInSec: result.expiresInSec,
    refreshAfterSec: result.refreshAfterSec,
  });
});
router.post(
  '/register',
  middleware.registerLimiter,
  middleware.checkBan,
  middleware.checkInviteUser,
  middleware.validateRegistration,
  registrationController,
);
router.post(
  '/requestPasswordReset',
  middleware.resetPasswordLimiter,
  middleware.checkBan,
  middleware.validatePasswordReset,
  resetPasswordRequestController,
);
router.post(
  '/resetPassword',
  middleware.resetPasswordSubmissionLimiter,
  middleware.checkBan,
  middleware.validatePasswordReset,
  resetPasswordController,
);

router.post('/2fa/enable', middleware.requireJwtAuth, twoFactorManagementLimiter, enable2FA);
router.post('/2fa/verify', middleware.requireJwtAuth, twoFactorManagementLimiter, verify2FA);
router.post(
  '/2fa/verify-temp',
  middleware.requireSameOrigin,
  middleware.setTwoFactorTempUser,
  middleware.twoFactorTempLimiter,
  middleware.checkBan,
  verify2FAWithTempToken,
);
router.post('/2fa/confirm', middleware.requireJwtAuth, twoFactorManagementLimiter, confirm2FA);
router.post('/2fa/disable', middleware.requireJwtAuth, twoFactorManagementLimiter, disable2FA);
router.post(
  '/2fa/backup/regenerate',
  middleware.requireJwtAuth,
  twoFactorManagementLimiter,
  regenerateBackupCodes,
);

router.get('/graph-token', middleware.requireJwtAuth, graphTokenController);

/**
 * Authentication middleware for first-login-claim.
 * Supports standard Bearer Authorization header and gracefully falls back to
 * session cookies (token / refreshToken) when fetch is used with credentials: 'include'.
 */
const claimAuthMiddleware = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return middleware.requireJwtAuth(req, res, next);
  }

  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.id) {
        req.user = decoded;
        return next();
      }
    } catch {
      // ignore invalid token and fall back
    }
  }

  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      if (decoded?.id) {
        req.user = decoded;
        return next();
      }
    } catch {
      // ignore invalid refresh token and fall back
    }
  }

  return middleware.requireJwtAuth(req, res, next);
};

/**
 * POST /api/auth/first-login-claim
 * Allows a user provisioned with mustChangePassword: true to submit their new permanent
 * password and challenge question/answer, unlocking their account.
 */
router.post('/first-login-claim', claimAuthMiddleware, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { currentPassword, newPassword, challengeQuestion, challengeAnswer } = req.body ?? {};
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Unauthorized',
        error_code: 'UNAUTHORIZED',
      });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters long',
        message: 'New password must be at least 8 characters long',
        error_code: 'WEAK_PASSWORD',
      });
    }

    if (!challengeQuestion || typeof challengeQuestion !== 'string' || !challengeQuestion.trim()) {
      return res.status(400).json({
        error: 'Security challenge question is required',
        message: 'Security challenge question is required',
        error_code: 'MISSING_CHALLENGE',
      });
    }

    if (!challengeAnswer || typeof challengeAnswer !== 'string' || !challengeAnswer.trim()) {
      return res.status(400).json({
        error: 'Security challenge answer is required',
        message: 'Security challenge answer is required',
        error_code: 'MISSING_CHALLENGE_ANSWER',
      });
    }

    // Load full user with password
    const user = await runAsSystem(() => mongoose.models.User.findById(userId).select('+password'));
    if (!user) {
      return res
        .status(404)
        .json({ error: 'User not found', message: 'User not found', error_code: 'USER_NOT_FOUND' });
    }

    // If currentPassword is provided by the user, verify it against their existing hash.
    // However, if omitted or if user is already authenticated via valid session token,
    // do not block them if mustChangePassword is true.
    if (currentPassword && currentPassword.trim()) {
      const match = await bcrypt.compare(currentPassword.trim(), user.password);
      if (!match) {
        return res.status(401).json({
          error: 'Current temporary password does not match.',
          message: 'Current temporary password does not match.',
          error_code: 'INVALID_CREDENTIALS',
        });
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);
    const newPasswordSig = calculatePasswordSignature(newHash);
    const answerHash = bcrypt.hashSync(challengeAnswer.trim().toLowerCase(), salt);

    // Use direct Mongoose update with runValidators: false to avoid schema validators
    // firing on fields we're not changing (e.g. email required, provider required).
    const updateResult = await runAsSystem(() =>
      mongoose.models.User.findByIdAndUpdate(
        userId.toString(),
        {
          $set: {
            password: newHash,
            passwordSig: newPasswordSig,
            mustChangePassword: false,
            challengeQuestion: challengeQuestion.trim(),
            challengeAnswerHash: answerHash,
            passwordChangedAt: new Date(),
            provider: 'local',
          },
          $unset: { expiresAt: '' },
        },
        { new: true, runValidators: false },
      ).lean(),
    );

    if (!updateResult) {
      logger.error(`[auth/first-login-claim] User not found after update [Id: ${userId}]`);
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found',
        error_code: 'USER_NOT_FOUND',
      });
    }

    logger.info(
      `[auth/first-login-claim] User completed first-login security claim [Id: ${user._id}] [Email: ${user.email}]`,
    );

    return res.status(200).json({
      ok: true,
      message: 'Password and security challenge set successfully. Account fully unlocked.',
    });
  } catch (err) {
    logger.error('[auth/first-login-claim] Error:', err);
    return res.status(500).json({
      error: 'Failed to process first-login claim',
      message: 'Failed to process first-login claim',
      error_code: 'INTERNAL_ERROR',
    });
  }
});

module.exports = router;
