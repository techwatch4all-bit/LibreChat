import type { FleetOverview, TenantSummary } from './types';

/**
 * Demo fixtures for design review only.
 *
 * These are NOT fleet data. They are served exclusively when the console is
 * explicitly built in demo mode (`VITE_CONSOLE_DEMO=1`), and the UI labels the
 * result as demo data so a screenshot can never be mistaken for a live reading.
 */
const HOUR = 3_600_000;

function tenant(overrides: Partial<TenantSummary> & Pick<TenantSummary, 'id' | 'name' | 'subdomain'>): TenantSummary {
  return {
    status: 'ACTIVE',
    plan: 'pro',
    activeSeats: 0,
    allowedSeats: 25,
    licenceExpiresAt: new Date(Date.now() + 30 * 24 * HOUR).toISOString(),
    lastHeartbeatAt: new Date(Date.now() - HOUR).toISOString(),
    nodeIp: '103.21.58.14',
    tokenSpendToday: 0,
    tokenSpendThisMonth: 0,
    ...overrides,
  };
}

const TENANTS: TenantSummary[] = [
  tenant({
    id: 'hgrwa',
    name: 'Hiranandani Gardens RWA',
    subdomain: 'hgrwa.satchida.com',
    plan: 'enterprise',
    activeSeats: 41,
    allowedSeats: 60,
    licenceExpiresAt: new Date(Date.now() + 71 * 24 * HOUR).toISOString(),
    tokenSpendToday: 184_200,
    tokenSpendThisMonth: 4_182_900,
  }),
  tenant({
    id: 'ktech',
    name: 'KT Educare',
    subdomain: 'kt-educare.satchida.com',
    plan: 'family',
    activeSeats: 96,
    allowedSeats: 120,
    licenceExpiresAt: new Date(Date.now() + 12 * 24 * HOUR).toISOString(),
    nodeIp: '45.113.207.88',
    tokenSpendToday: 421_700,
    tokenSpendThisMonth: 9_940_300,
  }),
  tenant({
    id: 'northgate',
    name: 'Northgate International School',
    subdomain: 'northgate.satchida.com',
    plan: 'enterprise',
    activeSeats: 22,
    allowedSeats: 150,
    licenceExpiresAt: new Date(Date.now() + 4 * 24 * HOUR).toISOString(),
    nodeIp: '103.86.14.220',
    tokenSpendToday: 88_450,
    tokenSpendThisMonth: 2_015_700,
  }),
  tenant({
    id: 'sundara',
    name: 'Sundara Textiles',
    subdomain: 'sundara.satchida.com',
    plan: 'pro',
    activeSeats: 18,
    allowedSeats: 20,
    licenceExpiresAt: new Date(Date.now() - 3 * 24 * HOUR).toISOString(),
    status: 'EXPIRED',
    lastHeartbeatAt: new Date(Date.now() - 5 * HOUR).toISOString(),
    tokenSpendToday: 0,
    tokenSpendThisMonth: 640_100,
  }),
  tenant({
    id: 'bloom',
    name: 'Bloom Wellness Studio',
    subdomain: 'bloom.satchida.com',
    plan: 'basic',
    activeSeats: 6,
    allowedSeats: 10,
    licenceExpiresAt: new Date(Date.now() - 51 * 24 * HOUR).toISOString(),
    status: 'BLOCKED',
    lastHeartbeatAt: new Date(Date.now() - 71 * HOUR).toISOString(),
    nodeIp: '157.32.44.9',
    tokenSpendToday: 0,
    tokenSpendThisMonth: 0,
  }),
  tenant({
    id: 'meridian',
    name: 'Meridian Logistics',
    subdomain: 'meridian.satchida.com',
    plan: 'pro',
    activeSeats: 31,
    allowedSeats: 40,
    licenceExpiresAt: new Date(Date.now() + 5 * 24 * HOUR).toISOString(),
    status: 'SUSPENDED',
    lastHeartbeatAt: new Date(Date.now() - 52 * HOUR).toISOString(),
    nodeIp: '5.9.212.44',
    tokenSpendToday: 0,
    tokenSpendThisMonth: 1_205_600,
  }),
  tenant({
    id: 'anand',
    name: 'Anand Library Trust',
    subdomain: 'anand.satchida.com',
    plan: 'family',
    activeSeats: 12,
    allowedSeats: 35,
    licenceExpiresAt: new Date(Date.now() + 120 * 24 * HOUR).toISOString(),
    nodeIp: '77.123.19.6',
    tokenSpendToday: 34_800,
    tokenSpendThisMonth: 890_400,
  }),
  tenant({
    id: 'prism',
    name: 'Prism Design Studio',
    subdomain: 'prism.satchida.com',
    plan: 'basic',
    activeSeats: 4,
    allowedSeats: 8,
    licenceExpiresAt: new Date(Date.now() + 22 * 24 * HOUR).toISOString(),
    lastHeartbeatAt: null,
    nodeIp: null,
    tokenSpendToday: 0,
    tokenSpendThisMonth: 74_200,
  }),
];

export function demoOverview(): FleetOverview {
  const count = (status: TenantSummary['status']): number =>
    TENANTS.filter((t) => t.status === status).length;

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      active: count('ACTIVE'),
      expired: count('EXPIRED'),
      blocked: count('BLOCKED'),
      suspended: count('SUSPENDED'),
      activeSeats: TENANTS.filter((t) => t.status === 'ACTIVE').reduce((sum, t) => sum + t.activeSeats, 0),
      allowedSeats: TENANTS.reduce((sum, t) => sum + t.allowedSeats, 0),
      tokenSpendToday: TENANTS.reduce((sum, t) => sum + t.tokenSpendToday, 0),
      staleHeartbeatCount: TENANTS.filter(
        (t) => t.status !== 'SUSPENDED' && t.lastHeartbeatAt !== null && Date.now() - Date.parse(t.lastHeartbeatAt) > 6 * HOUR,
      ).length,
    },
    tenants: TENANTS,
  };
}
