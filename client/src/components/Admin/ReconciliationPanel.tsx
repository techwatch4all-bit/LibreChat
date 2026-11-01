import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  CreditCard,
  Building2,
  DollarSign,
} from 'lucide-react';
import {
  useReconciliationLedgerQuery,
  useApprovePaymentMutation,
  useRejectPaymentMutation,
  type ReconciliationItem,
} from '~/data-provider/admin/reconciliation';

export default function ReconciliationPanel(): JSX.Element {
  const [page, setPage] = useState<number>(1);
  const [status, setStatus] = useState<string>('');
  const [plan, setPlan] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');

  // Modals
  const [selectedPayment, setSelectedPayment] = useState<ReconciliationItem | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const { data, isLoading, isError, error, refetch, isFetching } = useReconciliationLedgerQuery({
    page,
    limit: 20,
    status: status || undefined,
    plan: plan || undefined,
    search: search || undefined,
  });

  const approveMutation = useApprovePaymentMutation();
  const rejectMutation = useRejectPaymentMutation();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleConfirmAction = async () => {
    if (!selectedPayment) return;

    if (actionType === 'approve') {
      await approveMutation.mutateAsync(selectedPayment.id);
      setSelectedPayment(null);
      setActionType(null);
    } else if (actionType === 'reject') {
      if (!rejectReason.trim()) return;
      await rejectMutation.mutateAsync({
        paymentId: selectedPayment.id,
        reason: rejectReason.trim(),
      });
      setSelectedPayment(null);
      setActionType(null);
      setRejectReason('');
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (plan) params.set('plan', plan);
    window.open(`/api/admin/reconciliation/export.csv?${params.toString()}`, '_blank');
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-6 md:p-8 bg-surface-primary text-text-primary max-w-7xl mx-auto w-full">
      {/* Top Banner / Controls */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Payment Reconciliation Console</h1>
            <span className="rounded-full bg-surface-secondary border border-border-light px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
              {data?.total ?? 0} Transactions
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Audit UPI/gateway payment intents, match bank references, and trigger automated plan quota provisioning.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-tertiary transition-colors"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-xl bg-surface-submit px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="mb-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by UPI reference, user email, or display name..."
            className="w-full rounded-xl border border-border-light bg-surface-secondary pl-9 pr-4 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
          />
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed / Approved</option>
            <option value="failed">Failed / Rejected</option>
          </select>

          <select
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="">All Plans</option>
            <option value="demo">Demo</option>
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
            <option value="family">Family</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
          Error loading reconciliation ledger: {(error as Error)?.message || 'Unknown error'}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-2xl border border-border-light bg-surface-primary shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border-light bg-surface-secondary/70 font-semibold text-text-secondary uppercase tracking-wider">
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Plan Tier</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">UPI Reference</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Submitted</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-text-secondary">
                  <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-text-tertiary" />
                  Loading transactions...
                </td>
              </tr>
            ) : data?.items?.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-text-secondary">
                  No payment attempts match the active filters.
                </td>
              </tr>
            ) : (
              data?.items?.map((item) => {
                const isPending = item.paymentStatus === 'pending';
                const isApproved = item.paymentStatus === 'completed';

                return (
                  <tr key={item.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-text-primary">{item.userName || 'Unknown'}</div>
                      <div className="text-[11px] font-mono text-text-secondary">{item.userEmail || item.userId}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-surface-secondary text-text-primary border border-border-light uppercase">
                        {item.plan}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-text-primary">
                      {item.currency} {item.amount}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-text-secondary">
                      {item.upiReference || '—'}
                    </td>
                    <td className="py-3 px-4">
                      {isPending && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock size={11} /> Pending
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={11} /> Approved
                        </span>
                      )}
                      {!isPending && !isApproved && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <XCircle size={11} /> {item.paymentStatus}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-text-tertiary">
                      {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isPending ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedPayment(item);
                              setActionType('approve');
                            }}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPayment(item);
                              setActionType('reject');
                            }}
                            className="rounded-lg border border-border-light bg-surface-secondary px-2.5 py-1 text-xs font-semibold text-text-primary hover:bg-surface-tertiary transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-text-tertiary text-xs">Resolved</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-text-secondary">
          <div>
            Showing page {data.page} of {data.totalPages} ({data.total} total)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1}
              className="rounded-lg border border-border-light p-1.5 hover:bg-surface-secondary disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={data.page >= data.totalPages}
              className="rounded-lg border border-border-light p-1.5 hover:bg-surface-secondary disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Action Dialog / Modal */}
      {selectedPayment && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-medium bg-surface-primary p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border-light">
              <h3 className="text-base font-bold text-text-primary">
                {actionType === 'approve' ? 'Approve Payment & Provision Plan' : 'Reject Payment'}
              </h3>
              <button
                onClick={() => {
                  setSelectedPayment(null);
                  setActionType(null);
                  setRejectReason('');
                }}
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-3 text-xs text-text-secondary">
              {actionType === 'approve'
                ? `Approving this payment will upgrade ${selectedPayment.userName || selectedPayment.userEmail} to plan '${selectedPayment.plan.toUpperCase()}' and immediately configure their balance refill interval.`
                : `Are you sure you want to reject the payment intent for ${selectedPayment.userName || selectedPayment.userEmail}?`}
            </p>

            <div className="my-4 rounded-xl bg-surface-secondary p-3 text-xs text-text-primary space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text-secondary">Amount:</span>
                <span className="font-bold">{selectedPayment.currency} {selectedPayment.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">UPI Reference:</span>
                <span className="font-mono">{selectedPayment.upiReference || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">User ID:</span>
                <span className="font-mono">{selectedPayment.userId}</span>
              </div>
            </div>

            {actionType === 'reject' && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Reason for rejection <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Bank slip reference mismatch or amount discrepancy"
                  className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-light">
              <button
                onClick={() => {
                  setSelectedPayment(null);
                  setActionType(null);
                  setRejectReason('');
                }}
                className="rounded-xl border border-border-light bg-surface-secondary px-4 py-2 text-xs font-semibold text-text-primary hover:bg-surface-tertiary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={
                  (actionType === 'reject' && !rejectReason.trim()) ||
                  approveMutation.isPending ||
                  rejectMutation.isPending
                }
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity ${
                  actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                } disabled:opacity-50`}
              >
                {approveMutation.isPending || rejectMutation.isPending
                  ? 'Processing...'
                  : actionType === 'approve'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
