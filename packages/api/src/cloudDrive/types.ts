export type CloudDriveProviderId = 'google_drive' | 'onedrive';

export interface CloudDrivePublicProviderConfig {
  configured: boolean;
  clientId: string | null;
  tenantId?: string;
}

export interface CloudDriveStatusPayload {
  entitled: boolean;
  mode: 'browser_direct';
  providers: Record<CloudDriveProviderId, CloudDrivePublicProviderConfig>;
}
