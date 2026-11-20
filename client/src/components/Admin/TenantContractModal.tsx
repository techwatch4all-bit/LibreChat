import React, { useState } from 'react';
import { Button } from '@librechat/client';
import { FileUp, X } from 'lucide-react';
import { useAuthContext } from '~/hooks';

interface SeatRow {
  accountType: string;
  label: string;
  seatCount: number;
  perSeatCostInr: number;
  enabled: boolean;
}

const DEFAULT_SEAT_ROWS: SeatRow[] = [
  { accountType: 'basic', label: 'Basic', seatCount: 0, perSeatCostInr: 400, enabled: false },
  { accountType: 'standard', label: 'Standard', seatCount: 0, perSeatCostInr: 400, enabled: false },
  { accountType: 'family', label: 'Family', seatCount: 0, perSeatCostInr: 1200, enabled: false },
  { accountType: 'pro', label: 'Pro', seatCount: 0, perSeatCostInr: 1500, enabled: false },
  { accountType: 'pro_family', label: 'Pro Family', seatCount: 0, perSeatCostInr: 0, enabled: false },
  { accountType: 'privacy', label: 'Privacy', seatCount: 0, perSeatCostInr: 2500, enabled: false },
  { accountType: 'enterprise', label: 'Enterprise', seatCount: 0, perSeatCostInr: 0, enabled: false },
];

interface TenantContractModalProps {
  open: boolean;
  onClose: () => void;
  tenants: Array<{ tenantId: string; displayName?: string }>;
  defaultTenantId?: string;
  onApplied?: () => void;
}

export default function TenantContractModal({
  open,
  onClose,
  tenants,
  defaultTenantId,
  onApplied,
}: TenantContractModalProps) {
  const { token } = useAuthContext();
  const [tenantId, setTenantId] = useState(defaultTenantId || tenants[0]?.tenantId || '');
  const [contractRef, setContractRef] = useState('');
  const [fileName, setFileName] = useState('');
  const [termMonths, setTermMonths] = useState<number>(12);
  const [autoRenew, setAutoRenew] = useState<boolean>(true);
  const [seats, setSeats] = useState<SeatRow[]>(DEFAULT_SEAT_ROWS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const effectiveTenantId = tenantId || defaultTenantId || tenants[0]?.tenantId || '';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    if (!contractRef) {
      setContractRef(file.name.replace(/\.[^.]+$/, ''));
    }
    if (file.name.toLowerCase().endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}')) as {
            termMonths?: number;
            contractRef?: string;
            autoRenew?: boolean;
            seats?: Array<{ accountType?: string; seatCount?: number; perSeatCostInr?: number }>;
          };
          if (parsed.termMonths && [1, 3, 6, 12].includes(parsed.termMonths)) {
            setTermMonths(parsed.termMonths);
          }
          if (typeof parsed.contractRef === 'string') {
            setContractRef(parsed.contractRef);
          }
          if (typeof parsed.autoRenew === 'boolean') {
            setAutoRenew(parsed.autoRenew);
          }
          if (Array.isArray(parsed.seats)) {
            setSeats((prev) =>
              prev.map((row) => {
                const match = parsed.seats?.find(
                  (s) => s.accountType?.toLowerCase() === row.accountType,
                );
                if (!match) {
                  return row;
                }
                const count = Number(match.seatCount ?? row.seatCount);
                return {
                  ...row,
                  seatCount: count,
                  perSeatCostInr: Number(match.perSeatCostInr ?? row.perSeatCostInr),
                  enabled: count > 0,
                };
              }),
            );
          }
        } catch {
          setError('Uploaded JSON could not be parsed; you can still fill in the seat table manually.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) {
      setError('Select a tenant first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/admin/tenants/${encodeURIComponent(effectiveTenantId)}/contract`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            contractRef,
            fileName,
            termMonths,
            autoRenew,
            seats: seats.map(({ accountType, seatCount, perSeatCostInr, enabled }) => ({
              accountType,
              seatCount,
              perSeatCostInr,
              enabled,
            })),
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || `Failed to apply contract (HTTP ${res.status})`);
        return;
      }
      setSuccess(
        `Applied signed contract (${termMonths} mo) for ${effectiveTenantId} and recalculated token ceilings.`,
      );
      onApplied?.();
    } catch {
      setError('Network error while applying contract.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upload Signed Tenant Contract"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border-medium bg-surface-primary p-5 text-text-primary shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b border-border-light pb-3">
          <div className="flex items-center gap-2">
            <FileUp className="size-4 text-text-secondary" aria-hidden="true" />
            <h2 className="text-base font-semibold">Upload Signed Tenant Contract</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-text-secondary">Tenant</span>
              <select
                value={effectiveTenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="rounded-md border border-border-light bg-surface-secondary px-2.5 py-1.5 text-text-primary"
              >
                {tenants.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.displayName ? `${t.displayName} (${t.tenantId})` : t.tenantId}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium text-text-secondary">License Duration</span>
              <select
                value={termMonths}
                onChange={(e) => setTermMonths(Number(e.target.value))}
                className="rounded-md border border-border-light bg-surface-secondary px-2.5 py-1.5 text-text-primary"
              >
                <option value={1}>Monthly (1 Month)</option>
                <option value={3}>Quarterly (3 Months)</option>
                <option value={6}>Semi-Annual (6 Months)</option>
                <option value={12}>Annual (12 Months)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium text-text-secondary">Signed Contract File (.json / .pdf / .docx)</span>
              <input
                type="file"
                accept=".json,.pdf,.docx,.txt"
                onChange={handleFileChange}
                className="rounded-md border border-border-light bg-surface-secondary px-2 py-1 text-text-primary"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium text-text-secondary">Contract Reference / ID</span>
              <input
                type="text"
                value={contractRef}
                onChange={(e) => setContractRef(e.target.value)}
                placeholder="e.g. SATCHIDA-2026-001"
                className="rounded-md border border-border-light bg-surface-secondary px-2.5 py-1.5 text-text-primary"
              />
            </label>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border-light">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border-light bg-surface-secondary text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Seat Tier</th>
                  <th className="px-3 py-2">Enabled</th>
                  <th className="px-3 py-2">Contracted Seats</th>
                  <th className="px-3 py-2">Price / Seat (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {seats.map((row, idx) => (
                  <tr key={row.accountType}>
                    <td className="px-3 py-1.5 font-medium">{row.label}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) =>
                          setSeats((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, enabled: e.target.checked } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={row.seatCount}
                        onChange={(e) => {
                          const count = Math.max(0, Number(e.target.value) || 0);
                          setSeats((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, seatCount: count, enabled: count > 0 } : r,
                            ),
                          );
                        }}
                        className="w-24 rounded border border-border-light bg-surface-secondary px-2 py-1 text-text-primary"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={row.perSeatCostInr}
                        onChange={(e) => {
                          const price = Math.max(0, Number(e.target.value) || 0);
                          setSeats((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, perSeatCostInr: price } : r)),
                          );
                        }}
                        className="w-28 rounded border border-border-light bg-surface-secondary px-2 py-1 text-text-primary"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="flex items-center gap-2 text-text-secondary">
            <input
              type="checkbox"
              checked={autoRenew}
              onChange={(e) => setAutoRenew(e.target.checked)}
            />
            <span>Auto-renew contract at end of term</span>
          </label>

          {error ? (
            <div role="alert" className="rounded-md bg-surface-destructive/10 px-3 py-2 text-text-destructive">
              {error}
            </div>
          ) : null}
          {success ? (
            <div role="status" className="rounded-md bg-surface-secondary px-3 py-2 text-text-primary">
              {success}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default" size="sm" disabled={submitting}>
              {submitting ? 'Applying Contract…' : 'Apply Contract & Recalculate Tokens'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
