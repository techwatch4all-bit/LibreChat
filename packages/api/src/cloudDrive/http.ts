import type { Request, Response } from 'express';
import type { CloudDriveStatusPayload } from './types';

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    _id?: { toString(): string };
    role?: string;
    accountType?: string;
  };
}

const ENTITLED_TIERS = new Set(['pro', 'pro_family', 'privacy', 'enterprise']);

function getUserId(req: AuthenticatedRequest): string | null {
  const id = req.user?.id ?? req.user?._id?.toString();
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function isEntitledForCloudDrive(req: AuthenticatedRequest): boolean {
  const role = (req.user?.role ?? '').toUpperCase();
  if (role === 'ADMIN') {
    return true;
  }
  const tier = (req.user?.accountType ?? '').toLowerCase().trim();
  return ENTITLED_TIERS.has(tier);
}

function getPublicGoogleClientId(): string | null {
  const raw = (
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    ''
  ).trim();
  return raw.length > 0 ? raw : null;
}

function getPublicOneDriveConfig(): { clientId: string | null; tenantId: string } {
  const clientId = (
    process.env.ONEDRIVE_CLIENT_ID ||
    process.env.MICROSOFT_DRIVE_CLIENT_ID ||
    ''
  ).trim();
  const tenantId = (process.env.ONEDRIVE_TENANT_ID || 'common').trim() || 'common';
  return {
    clientId: clientId.length > 0 ? clientId : null,
    tenantId,
  };
}

/**
 * Zero-storage Cloud Drive HTTP handlers.
 *
 * By design, neither tenant nodes nor the operator control plane ever store
 * OAuth client secrets, end-user cloud identities, or access/refresh tokens.
 * This handler exposes only entitlement and public OAuth App IDs so the user's
 * browser can authenticate directly via GIS / OAuth 2.0 PKCE in memory.
 */
export interface CloudDriveHttpHandlers {
  getStatus: (req: Request, res: Response) => Promise<void>;
}

export function createCloudDriveHttpHandlers(): CloudDriveHttpHandlers {
  async function getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const entitled = isEntitledForCloudDrive(req);
    const googleClientId = getPublicGoogleClientId();
    const oneDrive = getPublicOneDriveConfig();

    const payload: CloudDriveStatusPayload = {
      entitled,
      mode: 'browser_direct',
      providers: {
        google_drive: {
          configured: googleClientId !== null,
          clientId: googleClientId,
        },
        onedrive: {
          configured: oneDrive.clientId !== null,
          clientId: oneDrive.clientId,
          tenantId: oneDrive.tenantId,
        },
      },
    };

    res.json(payload);
  }

  return {
    getStatus,
  };
}
