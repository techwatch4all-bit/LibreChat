import React, { useId, useMemo, useState, useRef, useCallback, useEffect } from 'react';
import * as Ariakit from '@ariakit/react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, Calendar, Zap, ArrowUpRight, ArrowDownLeft, ShieldCheck, ChevronDown } from 'lucide-react';
import { useGetUserUsageStats, useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { formatTokens, cn } from '~/utils';
import { useAuthContext } from '~/hooks';

const SIZE = 20;
const STROKE_WIDTH = 2.5;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const SHOW_DELAY_MS = 100;
const HIDE_DELAY_MS = 150;

type TimeTab = 'month' | '7days' | '30days';

export default function HeaderBillingGauge() {
  const { isAuthenticated } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const queryClient = useQueryClient();
  const popover = Ariakit.usePopoverStore({ placement: 'bottom' });
  const popoverOpen = Ariakit.useStoreState(popover, 'open');
  const disclosureRef = useRef<HTMLButtonElement>(null);

  const [activeTab, setActiveTab] = useState<TimeTab>('month');

  // Refresh stats whenever popover opens
  useEffect(() => {
    if (popoverOpen) {
      queryClient.invalidateQueries({ queryKey: ['userUsageStats'] });
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
  // 1. Current calendar month (1st of current month 00:00:00 to now)
  // 2. Last 7 days
  // 3. Last 30 days (1 month rolling)
  // Rolling to-date queries should NOT specify an endDate so current session activity is never excluded.
  const dateRanges = useMemo(() => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const last7DaysStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
    const last30DaysStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);

    return {
      month: {
        startDate: currentMonthStart.toISOString(),
      },
      '7days': {
        startDate: last7DaysStart.toISOString(),
      },
      '30days': {
        startDate: last30DaysStart.toISOString(),
      },
    };
  }, []);

  // Fetch token usage stats for each range
  const { data: monthStats, isLoading: loadingMonth } = useGetUserUsageStats(dateRanges.month);
  const { data: stats7d, isLoading: loading7d } = useGetUserUsageStats(dateRanges['7days']);
  const { data: stats30d, isLoading: loading30d } = useGetUserUsageStats(dateRanges['30days']);

  // Fetch user balance / credits if balance enabled
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

  const hasQuota = typeof balanceData?.refillAmount === 'number' && balanceData.refillAmount > 0;

  // Gauge calculation for Current Month:
  // If user has a quota / refillAmount, calculate percentage of monthly quota.
  // Otherwise if tokens have been consumed, show an active status ring in primary color.
  const percent = useMemo(() => {
    if (!monthStats || monthStats.totalTokens === 0) return 0;
    if (hasQuota) {
      return Math.min(100, Math.round((monthStats.totalTokens / (balanceData?.refillAmount ?? 1)) * 100));
    }
    return 100;
  }, [monthStats, balanceData, hasQuota]);

  const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;

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
        data-testid="header-billing-gauge"
        aria-label="Account Billing & Token Usage"
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
          'flex size-theme-control items-center justify-center rounded-theme-control-round transition-colors',
          'hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary',
          'duration-300 animate-in fade-in zoom-in-95',
        )}
      >
        <span
          role="meter"
          aria-label="Monthly Billing Tokens"
          className="relative flex items-center justify-center"
        >
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="-rotate-90"
            aria-hidden="true"
            focusable="false"
          >
            {/* Background Track */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="transparent"
              strokeWidth={STROKE_WIDTH}
              className="stroke-border-heavy"
            />
            {/* Filled Progress */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="transparent"
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={percent === 0 ? CIRCUMFERENCE : offset}
              strokeLinecap="round"
              className={cn(
                'transition-all duration-300',
                hasQuota && percent > 90
                  ? 'stroke-status-error'
                  : hasQuota && percent > 70
                    ? 'stroke-status-warning'
                    : 'stroke-primary',
              )}
            />
          </svg>
        </span>
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
          'z-50 rounded-lg border border-border-light bg-surface-primary p-3.5 shadow-lg outline-none',
          'origin-top translate-y-1 scale-95 opacity-0 transition-[opacity,transform] duration-150 ease-out',
          'data-[enter]:translate-y-0 data-[enter]:scale-100 data-[enter]:opacity-100',
          'data-[leave]:translate-y-1 data-[leave]:scale-95 data-[leave]:opacity-0',
        )}
      >
        <div className="w-80 space-y-3 text-text-primary">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-light pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <span className="text-sm font-semibold text-text-primary">Token Usage & Billing</span>
            </div>
            {balanceData?.tokenCredits !== undefined && (
              <span className="inline-flex items-center gap-1 rounded bg-surface-tertiary px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                <Zap className="size-3 text-amber-500" />
                {balanceData.tokenCredits.toLocaleString()} Credits
              </span>
            )}
          </div>

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
              1 Month
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

          {/* Footer Link / Info */}
          <div className="border-t border-border-light pt-2 flex items-center justify-between text-[11px] text-text-tertiary">
            <span>Synced with Account Settings</span>
            <span className="text-primary font-medium">Live</span>
          </div>
        </div>
      </Ariakit.Popover>
    </>
  );
}
