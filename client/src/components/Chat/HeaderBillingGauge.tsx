import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import * as Ariakit from '@ariakit/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRecoilValue } from 'recoil';
import { QueryKeys } from 'librechat-data-provider';
import {
  Zap,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  ChevronDown,
  RefreshCw,
  Settings as SettingsIcon,
  Coins,
  Cpu,
  Cloud,
} from 'lucide-react';
import { useGetUserUsageStats, useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { formatTokens, cn } from '~/utils';
import { useAuthContext } from '~/hooks';
import Settings from '~/components/Nav/Settings';
import store from '~/store';

const SHOW_DELAY_MS = 100;
const HIDE_DELAY_MS = 150;

type TimeTab = 'month' | '7days' | '30days';

export default function HeaderBillingGauge() {
  const { user, isAuthenticated } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const queryClient = useQueryClient();
  const isSubmitting = useRecoilValue(store.isSubmittingFamily(0));

  const popover = Ariakit.usePopoverStore({ placement: 'bottom-end' });
  const popoverOpen = Ariakit.useStoreState(popover, 'open');
  const disclosureRef = useRef<HTMLButtonElement>(null);

  const [activeTab, setActiveTab] = useState<TimeTab>('month');
  const [showSettings, setShowSettings] = useState(false);

  // Invalidate queries when prompt completion occurs in real-time
  const prevIsSubmitting = useRef(isSubmitting);
  useEffect(() => {
    if (prevIsSubmitting.current && !isSubmitting) {
      queryClient.invalidateQueries({ queryKey: ['userUsageStats'] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.balance] });
    }
    prevIsSubmitting.current = isSubmitting;
  }, [isSubmitting, queryClient]);

  // Invalidate when popover opens to ensure live accuracy
  useEffect(() => {
    if (popoverOpen) {
      queryClient.invalidateQueries({ queryKey: ['userUsageStats'] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.balance] });
    }
  }, [popoverOpen, queryClient]);

  // Hover & pin mechanics matching LibreChat standards
  const pinnedRef = useRef(false);
  const pinAtPointerDownRef = useRef(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimers = useCallback(() => {
    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const openByPointer = useCallback(() => {
    if (showTimerRef.current != null) return;
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      if (!popover.getState().open) {
        popover.show();
      }
    }, SHOW_DELAY_MS);
  }, [popover]);

  const scheduleHide = useCallback(() => {
    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (pinnedRef.current) return;
    if (hideTimerRef.current != null) return;
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      if (!pinnedRef.current) {
        popover.hide();
      }
    }, HIDE_DELAY_MS);
  }, [popover]);

  useEffect(() => {
    if (!popoverOpen) {
      pinnedRef.current = false;
    }
  }, [popoverOpen]);

  useEffect(() => cancelTimers, [cancelTimers]);

  // Date boundaries for tracking:
  // 1. Current calendar month (1st of month 00:00:00 to now)
  // 2. Last 7 days
  // 3. Last 30 days (rolling 1 month, aligned with chat breakdown)
  // No endDate so live session activity is never excluded.
  const dateRanges = useMemo(() => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
    const last7DaysStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0).toISOString();
    const last30DaysStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0).toISOString();

    return {
      month: { startDate: currentMonthStart },
      '7days': { startDate: last7DaysStart },
      '30days': { startDate: last30DaysStart },
    };
  }, []);

  // Fetch token usage stats for each range
  const { data: monthStats, isLoading: loadingMonth } = useGetUserUsageStats(dateRanges.month);
  const { data: stats7d, isLoading: loading7d } = useGetUserUsageStats(dateRanges['7days']);
  const { data: stats30d, isLoading: loading30d } = useGetUserUsageStats(dateRanges['30days']);

  // Fetch user balance / credits
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && !!startupConfig?.balance?.enabled,
  });
  const balanceData = balanceQuery.data;

  // Active tab selection data
  const currentStats = useMemo(() => {
    if (activeTab === '7days') return stats7d;
    if (activeTab === '30days') return stats30d;
    return monthStats;
  }, [activeTab, stats7d, stats30d, monthStats]);

  const isLoading =
    activeTab === '7days' ? loading7d : activeTab === '30days' ? loading30d : loadingMonth;

  const hasCredits = typeof balanceData?.tokenCredits === 'number';
  const hasQuota = typeof balanceData?.refillAmount === 'number' && balanceData.refillAmount > 0;

  // Dynamic pill display
  let pillValue: string;
  let pillLabel: string;
  let iconColor = 'text-amber-500 fill-amber-500';

  if (hasCredits) {
    pillValue = formatTokens(balanceData!.tokenCredits);
    pillLabel = 'Credits';
  } else if (hasQuota) {
    const remaining = Math.max(0, (balanceData!.refillAmount ?? 0) - (monthStats?.totalTokens ?? 0));
    pillValue = formatTokens(remaining);
    pillLabel = 'Left';
    if (remaining <= 0) {
      iconColor = 'text-rose-500 fill-rose-500';
    }
  } else {
    pillValue = loadingMonth ? '...' : formatTokens(monthStats?.totalTokens ?? 0);
    pillLabel = 'Month';
    iconColor = 'text-emerald-500 fill-emerald-500';
  }

  // Quota percentage for progress bar
  const quotaPercent = useMemo(() => {
    if (!monthStats || monthStats.totalTokens === 0) return 0;
    if (hasQuota) {
      return Math.min(100, Math.round((monthStats.totalTokens / (balanceData?.refillAmount ?? 1)) * 100));
    }
    return 100;
  }, [monthStats, balanceData, hasQuota]);

  // Current month label (e.g. "November 2026")
  const currentMonthName = useMemo(() => {
    return new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, []);

  return (
    <>
      <Ariakit.PopoverDisclosure
        ref={disclosureRef}
        store={popover}
        type="button"
        data-testid="header-balance-pill"
        aria-label="Account Balance & Token Usage"
        aria-haspopup="dialog"
        onPointerDown={() => {
          pinAtPointerDownRef.current = pinnedRef.current;
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'touch') openByPointer();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') scheduleHide();
        }}
        onClick={(e) => {
          cancelTimers();
          e.preventDefault();
          const wasPinned = e.detail > 0 ? pinAtPointerDownRef.current : pinnedRef.current;
          if (wasPinned) {
            pinnedRef.current = false;
            popover.hide();
            return;
          }
          pinnedRef.current = true;
          popover.show();
        }}
        className={cn(
          'group flex h-9 items-center gap-1.5 rounded-full border border-border-light bg-surface-primary px-3 py-1 text-xs font-medium text-text-primary transition-all duration-200',
          'hover:border-border-medium hover:bg-surface-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          'shadow-sm',
        )}
      >
        <span className="flex items-center justify-center">
          <Zap className={cn('size-3.5 transition-transform group-hover:scale-110', iconColor)} />
        </span>
        <span className="font-semibold text-text-primary">
          {pillValue}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          {pillLabel}
        </span>
        <ChevronDown className="size-3 text-text-tertiary transition-transform duration-200 group-data-[open]:rotate-180" />
      </Ariakit.PopoverDisclosure>

      <Ariakit.Popover
        store={popover}
        gutter={8}
        portal
        unmountOnHide
        autoFocusOnShow={false}
        finalFocus={disclosureRef}
        aria-label="Billing Usage Overview"
        onPointerEnter={cancelTimers}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') scheduleHide();
        }}
        className={cn(
          'z-50 rounded-xl border border-border-light bg-surface-primary p-4 shadow-xl outline-none',
          'origin-top-right translate-y-1 scale-95 opacity-0 transition-[opacity,transform] duration-150 ease-out',
          'data-[enter]:translate-y-0 data-[enter]:scale-100 data-[enter]:opacity-100',
          'data-[leave]:translate-y-1 data-[leave]:scale-95 data-[leave]:opacity-0',
        )}
      >
        <div className="w-84 space-y-3.5 text-text-primary">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-light pb-2.5">
            <div className="flex items-center gap-2">
              <Coins className="size-4 text-amber-500" />
              <span className="text-sm font-semibold text-text-primary">Balance & Token Usage</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Synced
            </span>
          </div>

          {/* Balance / Entitlement Card */}
          {hasCredits ? (
            <div className="rounded-lg border border-border-light bg-surface-secondary/50 p-3 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Available Token Balance
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-text-primary">
                  {balanceData!.tokenCredits.toLocaleString()}
                </span>
                <span className="text-xs text-text-tertiary font-medium">Credits</span>
              </div>
              {balanceData?.autoRefillEnabled && (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary pt-1 border-t border-border-light/60">
                  <RefreshCw className="size-3 text-primary shrink-0" />
                  <span>
                    Refills {balanceData.refillAmount?.toLocaleString()} every {balanceData.refillIntervalValue}{' '}
                    {balanceData.refillIntervalUnit}
                  </span>
                </div>
              )}
            </div>
          ) : hasQuota ? (
            <div className="rounded-lg border border-border-light bg-surface-secondary/50 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold uppercase tracking-wider text-text-tertiary">
                  Monthly Quota Usage
                </span>
                <span className="font-semibold text-text-primary">
                  {quotaPercent}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-tertiary">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    quotaPercent > 90
                      ? 'bg-status-error'
                      : quotaPercent > 70
                        ? 'bg-status-warning'
                        : 'bg-emerald-500',
                  )}
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>Used: {formatTokens(monthStats?.totalTokens ?? 0)}</span>
                <span>Quota: {formatTokens(balanceData!.refillAmount!)}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-500" />
                <span className="text-xs font-semibold text-text-primary">
                  {user?.accountType ? `${user.accountType.toUpperCase()} Plan` : 'Standard Tier'}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-text-secondary">
                Unlimited AI token access. No hard quota cutoffs applied.
              </div>
            </div>
          )}

          {/* Timeframe Selector Tabs */}
          <div className="flex rounded-md bg-surface-secondary p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('month')}
              className={cn(
                'flex-1 rounded py-1 font-medium transition-colors',
                activeTab === 'month'
                  ? 'bg-surface-primary text-text-primary shadow-sm font-semibold'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              Current Month
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('7days')}
              className={cn(
                'flex-1 rounded py-1 font-medium transition-colors',
                activeTab === '7days'
                  ? 'bg-surface-primary text-text-primary shadow-sm font-semibold'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('30days')}
              className={cn(
                'flex-1 rounded py-1 font-medium transition-colors',
                activeTab === '30days'
                  ? 'bg-surface-primary text-text-primary shadow-sm font-semibold'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              30 Days
            </button>
          </div>

          {/* Time Period Subtitle */}
          <div className="flex items-center justify-between text-[11px] text-text-tertiary">
            <span className="flex items-center gap-1">
              <Calendar className="size-3 text-text-tertiary" />
              {activeTab === 'month'
                ? `${currentMonthName} (to date)`
                : activeTab === '7days'
                  ? 'Past 7 consecutive days'
                  : 'Past 30 consecutive days'}
            </span>
            <span>{currentStats?.transactionCount ?? 0} requests</span>
          </div>

          {/* Highlight Stat: Total Tokens */}
          <div className="rounded-lg border border-border-light bg-surface-secondary/60 p-2.5">
            <div className="text-[11px] font-medium text-text-secondary">Total Consumed Tokens</div>
            <div className="mt-0.5 flex items-baseline justify-between">
              <span className="text-xl font-bold text-text-primary">
                {isLoading ? '...' : formatTokens(currentStats?.totalTokens ?? 0)}
              </span>
              {currentStats?.totalTokens != null && currentStats.totalTokens >= 1000 && (
                <span className="text-xs text-text-tertiary font-mono">
                  {currentStats.totalTokens.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Breakdown Rows */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between py-0.5">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <ArrowUpRight className="size-3.5 text-blue-500" />
                Input (Prompt)
              </span>
              <span className="font-semibold text-text-primary">
                {isLoading ? '...' : formatTokens(currentStats?.inputTokens ?? 0)}
              </span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <ArrowDownLeft className="size-3.5 text-green-500" />
                Output (Response)
              </span>
              <span className="font-semibold text-text-primary">
                {isLoading ? '...' : formatTokens(currentStats?.outputTokens ?? 0)}
              </span>
            </div>

            {currentStats != null && currentStats.cacheRead > 0 && (
              <div className="flex items-center justify-between py-0.5">
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <ShieldCheck className="size-3.5 text-purple-500" />
                  Cached Read
                </span>
                <span className="font-semibold text-text-primary">
                  {formatTokens(currentStats.cacheRead)}
                </span>
              </div>
            )}
          </div>

          {/* Local LLM vs Cloud LLM In/Out Section */}
          <div className="space-y-2 border-t border-border-light/70 pt-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              <span>Compute Distribution</span>
              <span className="text-[10px] lowercase font-normal text-text-tertiary">in / out tokens</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Local LLM */}
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                    <Cpu className="size-3 text-emerald-500" />
                    Local LLM
                  </span>
                  <span className="text-[9px] rounded bg-emerald-500/15 px-1 py-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    Privacy GPU
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border-light/50 text-[11px]">
                  <span className="text-text-secondary">In:</span>
                  <span className="font-semibold text-text-primary">
                    {isLoading ? '...' : formatTokens(currentStats?.local?.inputTokens ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-text-secondary">Out:</span>
                  <span className="font-semibold text-text-primary">
                    {isLoading ? '...' : formatTokens(currentStats?.local?.outputTokens ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-0.5 border-t border-border-light/40 text-[11px] font-medium text-text-primary">
                  <span>Total:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {isLoading ? '...' : formatTokens(currentStats?.local?.totalTokens ?? 0)}
                  </span>
                </div>
              </div>

              {/* Cloud LLM */}
              <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 text-[11px]">
                    <Cloud className="size-3 text-blue-500" />
                    Cloud LLM
                  </span>
                  <span className="text-[9px] rounded bg-blue-500/15 px-1 py-0.5 text-blue-600 dark:text-blue-400 font-medium">
                    Frontier API
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border-light/50 text-[11px]">
                  <span className="text-text-secondary">In:</span>
                  <span className="font-semibold text-text-primary">
                    {isLoading ? '...' : formatTokens(currentStats?.cloud?.inputTokens ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-text-secondary">Out:</span>
                  <span className="font-semibold text-text-primary">
                    {isLoading ? '...' : formatTokens(currentStats?.cloud?.outputTokens ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-0.5 border-t border-border-light/40 text-[11px] font-medium text-text-primary">
                  <span>Total:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {isLoading ? '...' : formatTokens(currentStats?.cloud?.totalTokens ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Explanatory Helper: clarifying Context window vs Account tokens */}
          <div className="rounded-md border border-border-light/60 bg-surface-secondary/30 p-2 text-[11px] leading-relaxed text-text-tertiary">
            💡 The composer circle monitors in-memory context for this chat, while this badge monitors account-wide token consumption.
          </div>

          {/* Footer Action */}
          <div className="border-t border-border-light pt-2 flex items-center justify-between text-xs text-text-secondary">
            <span className="text-[11px] text-text-tertiary">Realtime Sync Active</span>
            <button
              type="button"
              onClick={() => {
                popover.hide();
                setShowSettings(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <SettingsIcon className="size-3.5" />
              Settings
            </button>
          </div>
        </div>
      </Ariakit.Popover>

      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
    </>
  );
}
