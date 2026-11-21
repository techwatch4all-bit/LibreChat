import { useQuery } from '@tanstack/react-query';
import { dataService } from 'librechat-data-provider';

export interface TenantModelUsage {
  model: string;
  tokens: number;
  costCredits: number;
  calls: number;
}

export interface TenantDailyTrend {
  date: string;
  tokens: number;
  credits: number;
  count: number;
}

export interface TenantConsumptionRecord {
  tenantId: string;
  name: string;
  totalUsers: number;
  activeUsersCount: number;
  accountTypeDistribution: Record<string, number>;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCostCredits: number;
  transactionCount: number;
  lastActivity: string | null;
  modelsUsed: string[];
  modelBreakdown: TenantModelUsage[];
  dailyTrend: TenantDailyTrend[];
}

export interface TenantConsumptionResponse {
  success: boolean;
  periodDays: number;
  since: string;
  tenants: TenantConsumptionRecord[];
}

export interface FleetTenantNode {
  tenantId: string;
  displayName?: string;
  plan?: string;
  maxSeats?: number;
  status: string;
  lastHeartbeat: string;
  host?: string;
  metrics?: {
    memory?: number;
    cpu?: number;
    uptime?: number;
  };
}

export interface FleetIncident {
  _id?: string;
  fingerprint: string;
  errorType: string;
  message: string;
  count: number;
  status: string;
  affectedTenants: string[];
  tenantDisplayName?: string;
  aiAnalysis?: {
    plainEnglishTitle?: string;
    plainEnglishDescription?: string;
    rootCause?: string;
    affectedFile?: string;
    patchType?: string;
    safetyLevel?: string;
    suggestedPatch?: {
      targetFile?: string;
      replacementString?: string;
    };
  };
}

export interface FleetOpsResponse {
  success: boolean;
  tenants: FleetTenantNode[];
  incidents: FleetIncident[];
  tasks: any[];
}

export function useTenantConsumptionQuery(periodDays = 30) {
  return useQuery<TenantConsumptionResponse>({
    queryKey: ['admin', 'tenants', 'consumption', periodDays],
    queryFn: async () => {
      const res = await dataService.getRequest(
        `/api/admin/tenants/consumption?periodDays=${periodDays}`,
      );
      return res as TenantConsumptionResponse;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

export function useFleetOpsQuery() {
  return useQuery<FleetOpsResponse>({
    queryKey: ['admin', 'tenants', 'fleet-ops'],
    queryFn: async () => {
      const res = await dataService.getRequest('/api/admin/tenants/fleet-ops');
      return res as FleetOpsResponse;
    },
    staleTime: 1000 * 15, // 15 seconds
    refetchInterval: 15000,
  });
}
