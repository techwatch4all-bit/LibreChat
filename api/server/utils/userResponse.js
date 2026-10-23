const PUBLIC_USER_RESPONSE_FIELDS = [
  '_id',
  'id',
  'name',
  'username',
  'email',
  'emailVerified',
  'avatar',
  'provider',
  'role',
  'plugins',
  'twoFactorEnabled',
  'termsAccepted',
  'personalization',
  'favorites',
  'skillStates',
  'createdAt',
  'updatedAt',
  'tenantId',
  'familyRole',
  'accountType',
  'satchidaSeatAlias',
  'mustChangePassword',
  'challengeQuestion',
];

function sanitizeUserForResponse(user) {
  const source = user.toObject != null ? user.toObject() : user;
  return PUBLIC_USER_RESPONSE_FIELDS.reduce((userData, field) => {
    if (source[field] !== undefined) {
      userData[field] = source[field];
    }
    return userData;
  }, {});
}

module.exports = { sanitizeUserForResponse };
