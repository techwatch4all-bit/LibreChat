import mongoose from 'mongoose';
import type { IUser } from '~/types';
import userSchema from './user';

let FamilyUser: mongoose.Model<IUser>;

function makeTenantUserSchema() {
  const isolatedSchema = userSchema.clone();
  isolatedSchema.add({ tenantId: { type: String, default: 'tenant-a' } });
  return isolatedSchema;
}

beforeAll(() => {
  FamilyUser = mongoose.model<IUser>('FamilyUserValidation', makeTenantUserSchema());
});

afterAll(() => {
  delete mongoose.models.FamilyUserValidation;
});

describe('family user schema validation', () => {
  test('keeps existing users unlinked with parental permissions disabled', async () => {
    const user = new FamilyUser({ email: 'legacy@example.com', provider: 'local' });
    await expect(user.validate()).resolves.toBeUndefined();

    expect(user.familyAccountId).toBeNull();
    expect(user.guardianId).toBeNull();
    expect(user.familyRole).toBeNull();
    expect(user.familyLimits).toBeNull();
    expect(user.guardianProcessingConsentAt).toBeNull();
    expect(user.parentalTranscriptConsentAt).toBeNull();
    expect(user.imageGenerationConsentAt).toBeNull();
  });

  test('accepts a linked minor with image generation disabled and no transcript consent', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const user = new FamilyUser({
      email: 'minor@example.com',
      provider: 'local',
      familyAccountId: ownerId,
      guardianId: ownerId,
      familyRole: 'minor',
      familyLimits: { imageGenEnabled: false, imageCreditsPerDay: 0 },
      guardianProcessingConsentAt: new Date('2026-10-04T00:00:00.000Z'),
      guardianProcessingConsentVersion: 'child-processing-v1',
    });

    await expect(user.validate()).resolves.toBeUndefined();
    expect(user.toObject().familyRole).toBe('minor');
    expect(user.familyAccountId?.toString()).toBe(ownerId.toString());
    expect(user.guardianId?.toString()).toBe(ownerId.toString());
    expect(user.familyLimits?.imageGenEnabled).toBe(false);
    expect(user.guardianProcessingConsentVersion).toBe('child-processing-v1');
    expect(user.parentalTranscriptConsentAt).toBeNull();
    expect(user.imageGenerationConsentAt).toBeNull();
  });

  test.each(['24:00', '7:30', '12:60'])('rejects invalid family schedule time %s', async (time) => {
    const user = new FamilyUser({
      email: `invalid-${time.replace(':', '-')}-time@example.com`,
      provider: 'local',
      familyRole: 'minor',
      familyLimits: { imageGenEnabled: false, allowedHoursFrom: time },
    });

    await expect(user.validate()).rejects.toThrow();
  });

  test('rejects negative per-day family credit limits', async () => {
    const user = new FamilyUser({
      email: 'negative-limit@example.com',
      provider: 'local',
      familyRole: 'minor',
      familyLimits: { imageGenEnabled: false, imageCreditsPerDay: -1 },
    });

    await expect(user.validate()).rejects.toThrow();
  });
});
