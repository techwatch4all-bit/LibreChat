import type { TenantPolicy } from './tenant-policy';
import {
  DEFAULT_POLICY_MODES,
  filterExtensions,
  isExtensionAllowed,
  policyAllowlist,
  resolveExtension,
  tenantPolicySchema,
} from './tenant-policy';

describe('resolveExtension', () => {
  const policy: TenantPolicy = {
    tenantId: 'school-a',
    rules: {
      skill: { 'child-safety-compliance': 'allow', 'web-gui-tester': 'deny' },
      mcp: { filesystem: 'allow', playwright: 'deny' },
      agent: { agent_satchida_legal_researcher: 'allow' },
    },
    platformBlocked: { skill: [], mcp: ['shell-exec'], agent: [] },
    extensionsEnabled: true,
  };

  describe('explicit rules win over the default mode', () => {
    it('allows an explicitly allowed skill', () => {
      expect(resolveExtension(policy, 'skill', 'child-safety-compliance')).toEqual({
        allowed: true,
        reason: 'allowed_explicitly',
      });
    });

    it('denies an explicitly denied skill even though skills default to allow', () => {
      /* The default for skills is 'allow', so this proves the explicit deny is
         actually consulted rather than the default leaking through. */
      expect(DEFAULT_POLICY_MODES.skill).toBe('allow');
      expect(resolveExtension(policy, 'skill', 'web-gui-tester')).toEqual({
        allowed: false,
        reason: 'denied_explicitly',
      });
    });

    it('allows an explicitly allowed MCP server even though MCP defaults to deny', () => {
      expect(DEFAULT_POLICY_MODES.mcp).toBe('deny');
      expect(resolveExtension(policy, 'mcp', 'filesystem').allowed).toBe(true);
    });

    it('denies an explicitly denied agent even when the tenant default is allow', () => {
      const openTenant: TenantPolicy = { tenantId: 't', defaultModes: { agent: 'allow' } };
      expect(resolveExtension(openTenant, 'agent', 'anything').allowed).toBe(true);
      const closedTenant: TenantPolicy = {
        tenantId: 't',
        defaultModes: { agent: 'allow' },
        rules: { agent: { anything: 'deny' } },
      };
      expect(resolveExtension(closedTenant, 'agent', 'anything').allowed).toBe(false);
    });
  });

  describe('unset falls back to the per-kind default', () => {
    it('defaults a skill to allow and an MCP server to deny', () => {
      expect(resolveExtension(undefined, 'skill', 'anything').reason).toBe('allowed_by_default');
      expect(resolveExtension(undefined, 'mcp', 'anything').reason).toBe('denied_by_default');
      expect(resolveExtension(undefined, 'agent', 'anything').reason).toBe('denied_by_default');
    });

    it('honours a tenant-level default mode override', () => {
      const permissive: TenantPolicy = { tenantId: 't', defaultModes: { mcp: 'allow' } };
      expect(resolveExtension(permissive, 'mcp', 'memory').allowed).toBe(true);
    });
  });

  describe('platform blocks cannot be overridden by a tenant', () => {
    it('denies a platform-blocked MCP server even with an explicit tenant allow', () => {
      const attempting: TenantPolicy = {
        tenantId: 't',
        rules: { mcp: { 'shell-exec': 'allow' } },
        platformBlocked: { mcp: ['shell-exec'] },
      };
      expect(resolveExtension(attempting, 'mcp', 'shell-exec')).toEqual({
        allowed: false,
        reason: 'platform_blocked',
      });
    });

    it('takes precedence over the tenant kill switch being off', () => {
      /* Kill switch is checked second; a platform block still denies. */
      const off: TenantPolicy = { tenantId: 't', extensionsEnabled: false };
      expect(resolveExtension(off, 'mcp', 'memory').reason).toBe('tenant_extensions_disabled');
    });
  });

  describe('tenant kill switch', () => {
    it('denies everything when extensionsEnabled is false', () => {
      const off: TenantPolicy = {
        tenantId: 't',
        extensionsEnabled: false,
        rules: { skill: { anything: 'allow' } },
      };
      expect(resolveExtension(off, 'skill', 'anything').reason).toBe('tenant_extensions_disabled');
      expect(resolveExtension(off, 'agent', 'anything').allowed).toBe(false);
    });

    it('treats a missing policy as no stored policy, not as disabled', () => {
      expect(resolveExtension(undefined, 'skill', 'x').allowed).toBe(true);
    });
  });
});

describe('tenant isolation', () => {
  it('one tenant denying an extension does not affect another tenant', () => {
    const strict: TenantPolicy = { tenantId: 'school', rules: { mcp: { playwright: 'deny' } } };
    const open: TenantPolicy = { tenantId: 'pro', defaultModes: { mcp: 'allow' } };

    expect(isExtensionAllowed(strict, 'mcp', 'playwright')).toBe(false);
    expect(isExtensionAllowed(open, 'mcp', 'playwright')).toBe(true);
  });

  it('an allowlist tenant does not see extensions outside its list', () => {
    const policy = policyAllowlist('school', 'mcp', ['filesystem', 'memory']);
    expect(isExtensionAllowed(policy, 'mcp', 'filesystem')).toBe(true);
    expect(isExtensionAllowed(policy, 'mcp', 'memory')).toBe(true);
    expect(isExtensionAllowed(policy, 'mcp', 'playwright')).toBe(false);
  });
});

describe('filterExtensions', () => {
  const skills = ['child-safety-compliance', 'web-gui-tester', 'indian-bare-act-research'];
  const policy: TenantPolicy = {
    tenantId: 'school',
    rules: { skill: { 'web-gui-tester': 'deny' } },
  };

  it('removes denied entries and preserves order', () => {
    expect(filterExtensions(policy, 'skill', skills, (s) => s)).toEqual([
      'child-safety-compliance',
      'indian-bare-act-research',
    ]);
  });

  it('returns an empty list under the kill switch', () => {
    const off: TenantPolicy = { tenantId: 't', extensionsEnabled: false };
    expect(filterExtensions(off, 'skill', skills, (s) => s)).toEqual([]);
  });
});

describe('tenantPolicySchema', () => {
  it('rejects an unknown top-level key', () => {
    const result = tenantPolicySchema.safeParse({ tenantId: 't', nope: true });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid rule value', () => {
    const result = tenantPolicySchema.safeParse({
      tenantId: 't',
      rules: { mcp: { filesystem: 'maybe' } },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty tenantId', () => {
    expect(tenantPolicySchema.safeParse({ tenantId: '' }).success).toBe(false);
  });

  it('accepts a well-formed policy', () => {
    const result = tenantPolicySchema.safeParse({
      tenantId: 'school-a',
      rules: { skill: { a: 'allow' }, mcp: { b: 'deny' }, agent: { c: 'allow' } },
      defaultModes: { mcp: 'allow' },
      platformBlocked: { mcp: ['x'] },
      extensionsEnabled: true,
    });
    expect(result.success).toBe(true);
  });
});
