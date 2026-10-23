const mongoose = require('mongoose');
const { createMethods } = require('@librechat/data-schemas');
const { matchModelName, findMatchingPattern, isDeploymentSkillId } = require('@librechat/api');
const getLogStores = require('~/cache/getLogStores');

/**
 * The tenant's Privacy signing key.
 *
 * It lives on the tenant's own LibreChat server, because the tenant's server is
 * the only component that sees a Privacy request. It is read from the
 * environment and never logged. When it is absent no Privacy assertion can be
 * minted and Privacy mode is refused, which is the fail-closed outcome.
 *
 * It is read LAZILY, on every call, rather than captured at module load. The
 * environment is populated by dotenv from `api/db/connect.js`, and this module
 * can be required before that happens; capturing the value at load time then
 * silently produced an undefined key, which refused every Privacy request with
 * the same generic "Privacy mode is unavailable" and no way to tell why.
 */
const getPrivacySigningKey = () => process.env.SATCHIDA_PRIVACY_SIGNING_KEY?.trim();

/**
 * The local Privacy runtime's readiness probe.
 *
 * It answers whether the tenant's own GPU can accept a request right now. The
 * probe is a plain HTTP call to the tenant's Privacy router health endpoint.
 */
const getPrivacyRouterUrl = () =>
  (process.env.SATCHIDA_PRIVACY_ROUTER_URL?.trim() || 'http://127.0.0.1:4099').replace(/\/+$/, '');

const isPrivacyLocalReady = async () => {
  try {
    const response = await fetch(`${getPrivacyRouterUrl()}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
};
const methods = createMethods(mongoose, {
  matchModelName,
  findMatchingPattern,
  isExternalSkillId: isDeploymentSkillId,
  getCache: getLogStores,
  privacyAssertion: {
    getSigningKey: getPrivacySigningKey,
    audience: process.env.SATCHIDA_PRIVACY_AUDIENCE?.trim() || 'satchida-control',
    // The dependency is injected under the name the method reads
    // (deps.isLocalReady); the exported method is isPrivacyLocalReady.
    isLocalReady: isPrivacyLocalReady,
  },
});

const seedDatabase = async () => {
  await methods.initializeRoles();
  await methods.seedDefaultRoles();
  await methods.ensureDefaultCategories();
  await methods.seedSystemGrants();

  /* Full operator authority is never inherited from ADMIN or tenant roles.
   * Bootstrap it only for the explicitly configured, platform-scoped user. */
  const operatorUserId = process.env.SATCHIDA_OPERATOR_USER_ID?.trim();
  await methods.bootstrapOperatorCapability(operatorUserId);
};

module.exports = {
  ...methods,
  seedDatabase,
};
