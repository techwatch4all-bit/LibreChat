const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createModels, createMethods, SystemCapabilities } = require('@librechat/data-schemas');
const { PrincipalType, SystemRoles } = require('librechat-data-provider');

/**
 * Integration test for the admin grants routes.
 *
 * Validates the full Express wiring: route registration → middleware →
 * handler → real MongoDB. Auth middleware is injected (matching the repo
 * pattern in keys.spec.js) so we can control the caller identity without
 * a real JWT, while the handler DI deps use real DB methods.
 */

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (_req, _res, next) => next(),
}));

jest.mock('~/server/middleware/roles/capabilities', () => ({
  requireCapability: () => (_req, _res, next) => next(),
}));

let mongoServer;
let db;

const adminUserId = new mongoose.Types.ObjectId();
const adminUser = {
  _id: adminUserId,
  id: adminUserId.toString(),
  role: SystemRoles.ADMIN,
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  createModels(mongoose);
  db = createMethods(mongoose);
  await db.initializeRoles();
  await db.seedDefaultRoles();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.models.SystemGrant.deleteMany({});
  await db.seedSystemGrants();
  /*
   * This deployment deliberately removed upstream's blanket platform-scoped
   * grants on the ADMIN role (see `seedSystemGrants`: "ADMIN is tenant-local").
   * An administrator's authority therefore comes from explicit grants, so this
   * fixture mirrors `bootstrapOperatorCapability` and grants the caller directly.
   * `manage:roles` implies `read:roles`, and `manage:users` implies `read:users`.
   */
  for (const capability of [
    SystemCapabilities.ACCESS_ADMIN,
    SystemCapabilities.MANAGE_ROLES,
    SystemCapabilities.MANAGE_USERS,
  ]) {
    await db.grantCapability({
      principalType: PrincipalType.USER,
      principalId: adminUserId,
      capability,
    });
  }
});

function createApp(user, { isPlatformOperator = true } = {}) {
  const { createAdminGrantsHandlers, getCachedPrincipals } = require('@librechat/api');

  const handlers = createAdminGrantsHandlers({
    listGrants: db.listGrants,
    countGrants: db.countGrants,
    getCapabilitiesForPrincipal: db.getCapabilitiesForPrincipal,
    getCapabilitiesForPrincipals: db.getCapabilitiesForPrincipals,
    grantCapability: db.grantCapability,
    revokeCapability: db.revokeCapability,
    getUserPrincipals: db.getUserPrincipals,
    hasCapabilityForPrincipals: db.hasCapabilityForPrincipals,
    getHeldCapabilities: db.getHeldCapabilities,
    getCachedPrincipals,
    isPlatformOperator: async () => isPlatformOperator,
    seedTenantAdmin: db.seedTenantAdmin,
    /** Type-aware existence check, mirroring the route wiring. */
    checkPrincipalExists: async (principalType, principalId) => {
      if (principalType === PrincipalType.ROLE) {
        return (await db.getRoleByName(principalId)) != null;
      }
      if (principalType === PrincipalType.GROUP) {
        return (await db.findGroupById(principalId)) != null;
      }
      return (await db.getUserById(principalId)) != null;
    },
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });

  const router = express.Router();
  router.get('/', handlers.listGrants);
  router.get('/effective', handlers.getEffectiveCapabilities);
  router.get('/:principalType/:principalId', handlers.getPrincipalGrants);
  router.post('/', handlers.assignGrant);
  router.post('/tenant-admin', handlers.provisionTenantAdmin);
  router.delete('/:principalType/:principalId/:capability', handlers.revokeGrant);
  app.use('/api/admin/grants', router);

  return app;
}

describe('Admin Grants Routes — Integration', () => {
  it('GET / exposes no platform-scoped ADMIN role grants', async () => {
    const app = createApp(adminUser);
    const res = await request(app).get('/api/admin/grants').expect(200);

    expect(res.body).toHaveProperty('grants');
    expect(res.body).toHaveProperty('total');
    /* The fork removed the blanket ADMIN role grants: `seedSystemGrants` only
     * deletes them, it does not create any. */
    expect(
      res.body.grants.some(
        (g) => g.principalType === PrincipalType.ROLE && g.principalId === SystemRoles.ADMIN,
      ),
    ).toBe(false);
    // The caller's own direct grants are listed.
    expect(res.body.grants.some((g) => g.principalType === PrincipalType.USER)).toBe(true);
  });

  it('GET /effective returns the caller grants plus their implications', async () => {
    const app = createApp(adminUser);
    const res = await request(app).get('/api/admin/grants/effective').expect(200);

    expect(res.body).toHaveProperty('capabilities');
    expect(res.body.capabilities).toContain(SystemCapabilities.ACCESS_ADMIN);
    expect(res.body.capabilities).toContain(SystemCapabilities.MANAGE_ROLES);
    // manage:users implies read:users
    expect(res.body.capabilities).toContain(SystemCapabilities.READ_USERS);
  });

  it('POST / assigns a grant and DELETE / revokes it', async () => {
    const app = createApp(adminUser);

    // Assign
    const assignRes = await request(app)
      .post('/api/admin/grants')
      .send({
        principalType: PrincipalType.ROLE,
        principalId: SystemRoles.USER,
        capability: 'read:users',
      })
      .expect(201);

    expect(assignRes.body.grant).toMatchObject({
      principalType: PrincipalType.ROLE,
      principalId: SystemRoles.USER,
      capability: 'read:users',
    });

    // Verify via GET
    const getRes = await request(app)
      .get(`/api/admin/grants/${PrincipalType.ROLE}/${SystemRoles.USER}`)
      .expect(200);

    expect(getRes.body.grants.some((g) => g.capability === 'read:users')).toBe(true);

    // Revoke
    await request(app)
      .delete(`/api/admin/grants/${PrincipalType.ROLE}/${SystemRoles.USER}/read:users`)
      .expect(200);

    // Verify revoked
    const afterRes = await request(app)
      .get(`/api/admin/grants/${PrincipalType.ROLE}/${SystemRoles.USER}`)
      .expect(200);

    expect(afterRes.body.grants.some((g) => g.capability === 'read:users')).toBe(false);
  });

  it('POST / refuses a GROUP principal without manage:groups', async () => {
    const app = createApp(adminUser);

    const res = await request(app)
      .post('/api/admin/grants')
      .send({
        principalType: PrincipalType.GROUP,
        principalId: new mongoose.Types.ObjectId().toString(),
        capability: SystemCapabilities.MANAGE_GROUPS,
      })
      .expect(403);

    /* The caller holds manage:roles + manage:users, not manage:groups, so a
     * GROUP grant is refused — authority over one principal kind does not imply
     * authority over another. */
    expect(res.body.error).toBe('Insufficient permissions');
  });

  it('POST / returns 400 for a non-existent principal when the check is wired', async () => {
    const app = createApp(adminUser);

    const res = await request(app)
      .post('/api/admin/grants')
      .send({
        principalType: PrincipalType.ROLE,
        principalId: 'nonexistent-role',
        capability: 'read:users',
      })
      .expect(400);

    expect(res.body.error).toBe('Target principal not found');
  });

  it('POST / refuses a body tenantId from a non-operator', async () => {
    const tenantAdmin = {
      _id: adminUserId,
      id: adminUserId.toString(),
      role: SystemRoles.ADMIN,
      tenantId: 'tenant-a',
    };
    const app = createApp(tenantAdmin, { isPlatformOperator: false });

    const res = await request(app)
      .post('/api/admin/grants')
      .send({
        principalType: PrincipalType.ROLE,
        principalId: SystemRoles.USER,
        capability: 'read:users',
        tenantId: 'tenant-b',
      })
      .expect(403);

    expect(res.body.error).toBe('Only a platform operator may target another tenant');
  });

  it('POST /tenant-admin seeds the tenant-scoped administrator capability set', async () => {
    const app = createApp(adminUser);

    const res = await request(app)
      .post('/api/admin/grants/tenant-admin')
      .send({ tenantId: 'tenant-a', roleName: SystemRoles.ADMIN })
      .expect(200);

    expect(res.body).toMatchObject({ success: true, tenantId: 'tenant-a' });

    const seeded = await db.getCapabilitiesForPrincipal({
      principalType: PrincipalType.ROLE,
      principalId: SystemRoles.ADMIN,
      tenantId: 'tenant-a',
    });
    const capabilities = seeded.map((g) => g.capability);
    expect(capabilities).toContain(SystemCapabilities.ACCESS_ADMIN);
    expect(capabilities).toContain(SystemCapabilities.MANAGE_USERS);
    /* Never a platform grant, and never operator control. */
    expect(capabilities).not.toContain(SystemCapabilities.OPERATOR_CONTROL);
    expect(seeded.every((g) => g.tenantId === 'tenant-a')).toBe(true);

    /* The tenant grant must not leak into a platform-level check. */
    const asPlatform = await db.hasCapabilityForPrincipals({
      principals: [{ principalType: PrincipalType.ROLE, principalId: SystemRoles.ADMIN }],
      capability: SystemCapabilities.MANAGE_USERS,
    });
    expect(asPlatform).toBe(false);
  });

  it('POST / returns 401 without authenticated user', async () => {
    const app = createApp(undefined);

    const res = await request(app)
      .post('/api/admin/grants')
      .send({
        principalType: PrincipalType.ROLE,
        principalId: SystemRoles.USER,
        capability: 'read:users',
      })
      .expect(401);

    expect(res.body).toHaveProperty('error', 'Authentication required');
  });
});
