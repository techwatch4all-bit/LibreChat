import { createCloudDriveHttpHandlers } from './http';

function mockRes() {
  const res: Record<string, unknown> = { statusCode: 200, body: undefined };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });
  return res as unknown as import('express').Response & { statusCode: number; body: unknown };
}

describe('createCloudDriveHttpHandlers (zero-storage browser-direct)', () => {
  const prevEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it('returns 401 when unauthenticated', async () => {
    const handlers = createCloudDriveHttpHandlers();
    const res = mockRes();
    await handlers.getStatus({} as never, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns entitled=false for free tier and exposes only public client IDs', async () => {
    process.env.GOOGLE_DRIVE_CLIENT_ID = 'pub-google-id';
    process.env.ONEDRIVE_CLIENT_ID = 'pub-onedrive-id';
    process.env.ONEDRIVE_TENANT_ID = 'consumers';

    const handlers = createCloudDriveHttpHandlers();
    const res = mockRes();
    await handlers.getStatus({ user: { id: 'u1', accountType: 'free', role: 'USER' } } as never, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      entitled: false,
      mode: 'browser_direct',
      providers: {
        google_drive: { configured: true, clientId: 'pub-google-id' },
        onedrive: { configured: true, clientId: 'pub-onedrive-id', tenantId: 'consumers' },
      },
    });
  });

  it('returns entitled=true for pro/admin users and configured=false when IDs are absent', async () => {
    delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.ONEDRIVE_CLIENT_ID;
    delete process.env.MICROSOFT_DRIVE_CLIENT_ID;

    const handlers = createCloudDriveHttpHandlers();
    const res = mockRes();
    await handlers.getStatus({ user: { id: 'u2', accountType: 'pro', role: 'USER' } } as never, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      entitled: true,
      mode: 'browser_direct',
      providers: {
        google_drive: { configured: false, clientId: null },
        onedrive: { configured: false, clientId: null, tenantId: 'common' },
      },
    });
  });
});
