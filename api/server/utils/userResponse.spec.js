const { sanitizeUserForResponse } = require('./userResponse');

describe('sanitizeUserForResponse', () => {
  it('exposes family role for client disclosure but excludes authorization metadata', () => {
    const user = {
      id: 'minor-id',
      email: 'student@example.com',
      role: 'USER',
      familyRole: 'minor',
      accountType: 'family',
      satchidaSeatAlias: 'opaque-seat-00000001',
      seatToken: 'tk-do-not-return',
      privacyAssertion: 'signed-do-not-return',
      familyAccountId: 'owner-id',
      guardianId: 'guardian-id',
      familyLimits: { imageGenEnabled: false, imageCreditsPerDay: 0 },
      guardianProcessingConsentAt: new Date('2026-10-04T00:00:00.000Z'),
      guardianProcessingConsentVersion: 'processing-v1',
      parentalTranscriptConsentAt: new Date('2026-10-04T00:00:00.000Z'),
      parentalTranscriptConsentVersion: 'transcript-v1',
      imageGenerationConsentAt: new Date('2026-10-04T00:00:00.000Z'),
      imageGenerationConsentVersion: 'image-v1',
      password: 'hashed-password',
      safeLookingRuntimeField: 'internal',
    };

    expect(sanitizeUserForResponse(user)).toEqual({
      id: 'minor-id',
      email: 'student@example.com',
      role: 'USER',
      familyRole: 'minor',
      accountType: 'family',
      satchidaSeatAlias: 'opaque-seat-00000001',
    });
  });

  it('serializes supported public fields from a Mongoose-like document', () => {
    const user = {
      toObject: () => ({
        id: 'user-id',
        name: 'Student',
        familyRole: null,
        accountType: 'family',
        satchidaSeatAlias: 'opaque-seat-00000001',
        seatToken: 'tk-hidden',
        privacyAssertion: 'assertion-hidden',
        familyLimits: { imageGenEnabled: false },
      }),
    };

    expect(sanitizeUserForResponse(user)).toEqual({
      id: 'user-id',
      name: 'Student',
      familyRole: null,
      accountType: 'family',
      satchidaSeatAlias: 'opaque-seat-00000001',
    });
  });
});
