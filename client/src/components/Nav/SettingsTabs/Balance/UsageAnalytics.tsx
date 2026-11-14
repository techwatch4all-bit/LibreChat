import React, { useState, useMemo } from 'react';
import { Calendar, RefreshCw, BarChart2 } from 'lucide-react';
import { useGetUserUsageStats } from '~/data-provider';
import { useLocalize } from '~/hooks';

type PresetRange = 'today' | 'week' | 'month' | 'quarter' | 'custom';

export default function UsageAnalytics() {
  const localize = useLocalize();

  const [activePreset, setActivePreset] = useState<PresetRange>('month');

  // Compute preset dates
  const { initialStart, initialEnd } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
      initialStart: start.toISOString().split('T')[0],
      initialEnd: end.toISOString().split('T')[0],
    };
  }, []);

  const [startDate, setStartDate] = useState<string>(initialStart);
  const [endDate, setEndDate] = useState<string>(initialEnd);

  const setPreset = (preset: PresetRange) => {
    setActivePreset(preset);
    const now = new Date();
    let start = new Date();

    if (preset === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (preset === 'week') {
      start.setDate(now.getDate() - 7);
    } else if (preset === 'month') {
      start.setDate(now.getDate() - 30);
    } else if (preset === 'quarter') {
      start.setDate(now.getDate() - 90);
    }

    if (preset !== 'custom') {
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  const queryParams = useMemo(() => {
    return {
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : undefined,
    };
  }, [startDate, endDate]);

  const { data: stats, isLoading, refetch, isFetching } = useGetUserUsageStats(queryParams);

  const formatNumber = (num?: number) => {
    if (num == null) return '0';
    return num.toLocaleString();
  };

  return (
    <div className="w-full space-y-4 text-text-primary">
      {/* Top Controls: Presets and Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-light pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPreset('today')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activePreset === 'today'
                ? 'bg-primary text-white'
                : 'bg-surface-tertiary text-text-secondary hover:bg-surface-secondary'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setPreset('week')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activePreset === 'week'
                ? 'bg-primary text-white'
                : 'bg-surface-tertiary text-text-secondary hover:bg-surface-secondary'
            }`}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => setPreset('month')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activePreset === 'month'
                ? 'bg-primary text-white'
                : 'bg-surface-tertiary text-text-secondary hover:bg-surface-secondary'
            }`}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => setPreset('quarter')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activePreset === 'quarter'
                ? 'bg-primary text-white'
                : 'bg-surface-tertiary text-text-secondary hover:bg-surface-secondary'
            }`}
          >
            Last 90 Days
          </button>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-text-secondary hover:bg-surface-tertiary transition-colors"
          title="Refresh statistics"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Date Range Picker (Calendar Input) */}
      <div className="flex flex-wrap items-center gap-3 bg-surface-tertiary/50 p-2.5 rounded-lg border border-border-light">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-text-tertiary" />
          <span className="text-xs font-medium text-text-secondary">Custom Range:</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-tertiary">From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setActivePreset('custom');
              setStartDate(e.target.value);
            }}
            className="rounded border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-tertiary">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setActivePreset('custom');
              setEndDate(e.target.value);
            }}
            className="rounded border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        {/* Total Tokens */}
        <div className="rounded-lg border border-border-light bg-surface-tertiary/40 p-3">
          <div className="text-xs text-text-tertiary font-medium">Total Tokens</div>
          <div className="mt-1 text-lg font-bold text-text-primary">
            {isLoading ? '...' : formatNumber(stats?.totalTokens)}
          </div>
          <div className="mt-1 text-[11px] text-text-secondary">
            {stats?.transactionCount ?? 0} total requests
          </div>
        </div>

        {/* Input Tokens */}
        <div className="rounded-lg border border-border-light bg-surface-tertiary/40 p-3">
          <div className="text-xs text-text-tertiary font-medium">Input (Prompt)</div>
          <div className="mt-1 text-lg font-bold text-blue-500">
            {isLoading ? '...' : formatNumber(stats?.inputTokens)}
          </div>
          <div className="mt-1 text-[11px] text-text-secondary">Sent to model</div>
        </div>

        {/* Output Tokens */}
        <div className="rounded-lg border border-border-light bg-surface-tertiary/40 p-3">
          <div className="text-xs text-text-tertiary font-medium">Output (Response)</div>
          <div className="mt-1 text-lg font-bold text-green-500">
            {isLoading ? '...' : formatNumber(stats?.outputTokens)}
          </div>
          <div className="mt-1 text-[11px] text-text-secondary">Generated reply</div>
        </div>

        {/* Cached Read Tokens */}
        <div className="rounded-lg border border-border-light bg-surface-tertiary/40 p-3">
          <div className="text-xs text-text-tertiary font-medium">Cached Read</div>
          <div className="mt-1 text-lg font-bold text-purple-500">
            {isLoading ? '...' : formatNumber(stats?.cacheRead)}
          </div>
          <div className="mt-1 text-[11px] text-text-secondary">Discounted cache</div>
        </div>
      </div>
    </div>
  );
}
