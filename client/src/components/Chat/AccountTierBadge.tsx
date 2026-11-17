import React, { memo } from 'react';
import { Crown, Shield, Zap, Sparkles, Building2, Users } from 'lucide-react';
import { useAuthContext } from '~/hooks';
import { cn } from '~/utils';

interface TierBadgeConfig {
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  containerClasses: string;
  badgeGlow: string;
  iconClasses: string;
  textClasses: string;
}

const TIER_CONFIG: Record<string, TierBadgeConfig> = {
  pro: {
    label: 'PRO',
    sublabel: 'Seat',
    icon: Crown,
    containerClasses:
      'border-purple-500/40 bg-gradient-to-r from-purple-950/50 via-indigo-950/40 to-fuchsia-950/40 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.25)] hover:border-purple-400/60 hover:shadow-[0_0_16px_rgba(168,85,247,0.4)]',
    badgeGlow: 'bg-purple-500/20',
    iconClasses: 'text-purple-300 drop-shadow-[0_0_6px_rgba(192,132,252,0.8)]',
    textClasses: 'from-purple-200 via-pink-200 to-indigo-200',
  },
  pro_family: {
    label: 'PRO',
    sublabel: 'Family',
    icon: Crown,
    containerClasses:
      'border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-950/50 via-purple-950/40 to-pink-950/40 text-fuchsia-200 shadow-[0_0_12px_rgba(217,70,239,0.25)] hover:border-fuchsia-400/60 hover:shadow-[0_0_16px_rgba(217,70,239,0.4)]',
    badgeGlow: 'bg-fuchsia-500/20',
    iconClasses: 'text-fuchsia-300 drop-shadow-[0_0_6px_rgba(232,121,249,0.8)]',
    textClasses: 'from-fuchsia-200 via-purple-200 to-pink-200',
  },
  enterprise: {
    label: 'ENTERPRISE',
    icon: Building2,
    containerClasses:
      'border-cyan-500/40 bg-gradient-to-r from-cyan-950/50 via-blue-950/40 to-indigo-950/40 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)] hover:border-cyan-400/60 hover:shadow-[0_0_16px_rgba(6,182,212,0.4)]',
    badgeGlow: 'bg-cyan-500/20',
    iconClasses: 'text-cyan-300 drop-shadow-[0_0_6px_rgba(103,232,249,0.8)]',
    textClasses: 'from-cyan-200 via-sky-200 to-blue-200',
  },
  privacy: {
    label: 'PRIVACY',
    sublabel: 'Sovereign',
    icon: Shield,
    containerClasses:
      'border-emerald-500/40 bg-gradient-to-r from-emerald-950/50 via-teal-950/40 to-slate-950/40 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:border-emerald-400/60 hover:shadow-[0_0_16px_rgba(16,185,129,0.4)]',
    badgeGlow: 'bg-emerald-500/20',
    iconClasses: 'text-emerald-300 drop-shadow-[0_0_6px_rgba(110,231,183,0.8)]',
    textClasses: 'from-emerald-200 via-teal-200 to-emerald-100',
  },
  family: {
    label: 'FAMILY',
    icon: Users,
    containerClasses:
      'border-amber-500/40 bg-gradient-to-r from-amber-950/50 via-orange-950/40 to-yellow-950/40 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.2)] hover:border-amber-400/60 hover:shadow-[0_0_14px_rgba(245,158,11,0.35)]',
    badgeGlow: 'bg-amber-500/20',
    iconClasses: 'text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.7)]',
    textClasses: 'from-amber-200 via-orange-200 to-yellow-200',
  },
  standard: {
    label: 'STANDARD',
    icon: Sparkles,
    containerClasses:
      'border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-950/40 text-blue-200 shadow-sm hover:border-blue-400/50',
    badgeGlow: 'bg-blue-500/15',
    iconClasses: 'text-blue-300',
    textClasses: 'from-blue-200 via-indigo-200 to-slate-200',
  },
  basic: {
    label: 'BASIC',
    icon: Zap,
    containerClasses:
      'border-border-light/60 bg-surface-tertiary/70 text-text-secondary hover:border-border-medium hover:text-text-primary',
    badgeGlow: 'bg-transparent',
    iconClasses: 'text-text-tertiary',
    textClasses: 'text-text-secondary',
  },
};

export const AccountTierBadge = memo(function AccountTierBadge({
  className,
}: {
  className?: string;
}) {
  const { user, isAuthenticated } = useAuthContext();

  if (!isAuthenticated || !user) {
    return null;
  }

  const rawType = (user.accountType || 'basic').toLowerCase();
  const config = TIER_CONFIG[rawType] || TIER_CONFIG.basic;
  const Icon = config.icon;

  return (
    <div
      data-testid="account-tier-badge"
      title={`Current Account Tier: ${config.label}${config.sublabel ? ` (${config.sublabel})` : ''}`}
      className={cn(
        'group relative inline-flex h-8 cursor-default select-none items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md transition-all duration-200',
        config.containerClasses,
        className,
      )}
    >
      {/* Micro glow aura */}
      <span
        className={cn(
          'absolute -inset-0.5 rounded-full opacity-30 blur-sm transition-opacity duration-300 group-hover:opacity-60',
          config.badgeGlow,
        )}
        aria-hidden="true"
      />

      <span className="relative flex items-center justify-center">
        <Icon
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110',
            config.iconClasses,
          )}
        />
      </span>

      <span className="relative flex items-baseline gap-1 text-[10px] font-bold uppercase tracking-wider">
        <span className={cn('bg-gradient-to-r bg-clip-text', config.textClasses)}>
          {config.label}
        </span>
        {config.sublabel && (
          <span className="text-[9px] font-medium lowercase tracking-normal opacity-75">
            {config.sublabel}
          </span>
        )}
      </span>
    </div>
  );
});

export default AccountTierBadge;
