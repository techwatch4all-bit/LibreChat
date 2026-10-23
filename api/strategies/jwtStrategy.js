const { AGENT_TRIGGER_SCOPE } = require('@librechat/api');
const { logger, runAsSystem } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { getUserById, updateUser } = require('~/models');

const AGENT_TRIGGER_ADMISSION_PATHS = ['/api/agents/chat/agents', '/api/agents/chat/steer/deliver'];

/** A trigger-scoped bearer is deliberately useless outside the two internal
 * admission routes that the execution host calls. */
function isAgentTriggerAdmissionRequest(req) {
  if (req?.method !== 'POST' || req?.headers?.['x-lc-agent-trigger'] !== '1') {
    return false;
  }
  try {
    const pathname = new URL(req.originalUrl ?? req.url ?? '', 'http://localhost').pathname;
    return AGENT_TRIGGER_ADMISSION_PATHS.some((path) => pathname.endsWith(path));
  } catch {
    return false;
  }
}

// JWT strategy
const jwtLogin = () =>
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
      passReqToCallback: true,
    },
    async (req, payload, done) => {
      try {
        if (payload?.scope === AGENT_TRIGGER_SCOPE && !isAgentTriggerAdmissionRequest(req)) {
          done(null, false, { message: 'Agent trigger token is not valid for this endpoint' });
          return;
        }
        const user = await runAsSystem(() =>
          getUserById(
            payload?.id,
            // `satchidaSeatAlias` and `seatToken` both carry `select: false` on
            // the schema, so they have to be asked for explicitly.
            //
            // The alias is the seat pseudonym that the Privacy path binds a
            // request to. The seat token is the tenant's own bearer credential
            // for the operator's gateway, and it is what the cloud path
            // presents. Without either, the request user has no seat, so the
            // Privacy path cannot mint an assertion and the cloud path falls
            // back to the operator's licence token instead of the tenant's.
            '-password -__v -totpSecret -backupCodes +agentTriggerDeletionStartedAt +satchidaSeatAlias +seatToken',
          ),
        );
        if (user?.agentTriggerDeletionStartedAt != null) {
          done(null, false, {
            message: 'Account deletion is in progress',
            code: 'ACCOUNT_DELETION_IN_PROGRESS',
          });
          return;
        }
        if (user) {
          user.id = user._id.toString();
          /** Absent on the full doc means local user; null skips getUserPrincipals' fallback lookup */
          user.idOnTheSource ??= null;
          if (!user.role) {
            user.role = SystemRoles.USER;
            await runAsSystem(() => updateUser(user.id, { role: user.role }));
          }
          done(null, user);
        } else {
          logger.warn('[jwtLogin] JwtStrategy => no user found: ' + payload?.id);
          done(null, false);
        }
      } catch (err) {
        done(err, false);
      }
    },
  );

module.exports = jwtLogin;
