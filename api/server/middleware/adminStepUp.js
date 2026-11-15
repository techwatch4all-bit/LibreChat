const jwt = require('jsonwebtoken');

const STEPUP_EXPIRY = '10m';

/**
 * Mint a step-up token valid for 10 minutes for this user.
 */
function signStepUpToken(userId) {
  return jwt.sign(
    {
      sub: userId.toString(),
      purpose: 'admin:step-up',
    },
    process.env.JWT_SECRET,
    { expiresIn: STEPUP_EXPIRY },
  );
}

/**
 * Middleware that strictly enforces TOTP step-up authentication.
 * Looks for `X-Admin-StepUp-Token` header.
 * If missing, invalid, or expired, returns 403 with `stepUpRequired: true`.
 */
async function requireAdminStepUp(req, res, next) {
  const token = req.headers['x-admin-stepup-token'];
  if (!token) {
    return res.status(403).json({
      error: 'Step-up authentication required for sensitive administrative access.',
      code: 'STEP_UP_REQUIRED',
      stepUpRequired: true,
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== 'admin:step-up') {
      return res.status(403).json({
        error: 'Invalid step-up token purpose.',
        code: 'STEP_UP_INVALID',
        stepUpRequired: true,
      });
    }

    const currentUserId = req.user?.id || req.user?._id?.toString();
    if (decoded.sub !== currentUserId) {
      return res.status(403).json({
        error: 'Step-up token does not match authenticated user.',
        code: 'STEP_UP_MISMATCH',
        stepUpRequired: true,
      });
    }

    req.stepUpAuthenticated = true;
    next();
  } catch (_err) {
    return res.status(403).json({
      error: 'Step-up session has expired or is invalid. Please re-authenticate.',
      code: 'STEP_UP_EXPIRED',
      stepUpRequired: true,
    });
  }
}

module.exports = {
  signStepUpToken,
  requireAdminStepUp,
};
