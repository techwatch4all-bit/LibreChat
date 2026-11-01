import { useState } from 'react';
import { Spinner } from '@librechat/client';
import {
  Search,
  Download,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertTriangle,
  CheckCircle,
  X,
  History,
  Lock,
  RefreshCw,
  FileText,
  Key,
} from 'lucide-react';
import { useLocalize } from '~/hooks';
import {
  useAuditLogQuery,
  verifyAuditChain,
  type AuditLogEntry,
  type AuditVerificationResult,
} from '~/data-provider/admin/audit';

const PAGE_SIZE = 25;

export default function AuditLogPanel() {
  const localize = useLocalize();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [verification, setVerification] = useState<AuditVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const auditQuery = useAuditLogQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search.trim() || undefined,
  });

  const entries = auditQuery.data?.entries ?? [];
  const total = auditQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await verifyAuditChain();
      setVerification(res);
    } catch (err) {
      alert(`Verification failed: ${(err as Error).message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleExportCsv = () => {
    const a = document.createElement('a');
    a.href = '/api/admin/audit-log/export.csv';
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-6 md:p-8 bg-surface-primary text-text-primary max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Audit Trail & Security Logs
            </h1>
            <span className="rounded-full bg-surface-secondary border border-border-light px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
              {total} Events
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Tamper-evident cryptographically chained event log of operator mutations, authentication attempts, and policy changes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            className="flex items-center gap-1.5 rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-tertiary transition-colors"
            onClick={handleVerify}
            disabled={verifying}
            title="Verify cryptographic hash chain"
          >
            {verifying ? <Spinner /> : <ShieldCheck size={14} className="text-emerald-500" />}
            Verify Chain Integrity
          </button>
          <button
            className="flex items-center gap-1.5 rounded-xl bg-surface-submit px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            onClick={handleExportCsv}
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Verification Banner */}
      {verification && (
        <div
          className={`mb-5 flex items-center justify-between rounded-2xl border p-4 text-xs transition-all ${
            verification.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {verification.ok ? (
              <CheckCircle size={18} className="text-emerald-500" />
            ) : (
              <AlertTriangle size={18} className="text-rose-500" />
            )}
            <div>
              <span className="font-bold">
                {verification.ok ? 'Audit Hash Chain Verified' : 'Cryptographic Chain Verification Failed'}
              </span>
              <p className="text-[11px] opacity-90 mt-0.5">
                {verification.ok
                  ? `Successfully validated ${verification.checked} contiguous event blocks. No tamper detected.`
                  : `Integrity broken at block #${verification.brokenAt}: ${verification.reason || 'Hash mismatch'}`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setVerification(null)}
            className="rounded-lg p-1 hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
        <input
          className="w-full rounded-xl border border-border-light bg-surface-secondary pl-9 pr-4 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by action, category, actor, or target ID..."
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-2xl border border-border-light bg-surface-primary shadow-sm">
        {auditQuery.isLoading && entries.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-text-secondary">
            <p className="text-xs">No audit events found.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-light bg-surface-secondary/70 font-semibold text-text-secondary uppercase tracking-wider">
                <th className="py-3 px-4 w-16">Seq</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light font-mono text-[11px]">
              {entries.map((entry) => (
                <tr key={entry._id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="py-3 px-4 text-text-tertiary">#{entry.seq}</td>
                  <td className="py-3 px-4 font-semibold text-text-primary font-sans">{entry.action}</td>
                  <td className="py-3 px-4 text-text-secondary capitalize">{entry.category}</td>
                  <td className="py-3 px-4 text-text-primary font-sans">
                    <div>{entry.actor?.name || 'System'}</div>
                    <div className="text-[10px] text-text-tertiary font-mono">{entry.actor?.type}</div>
                  </td>
                  <td className="py-3 px-4 text-text-secondary font-sans">
                    <div>{entry.target?.name || entry.target?.id || '—'}</div>
                    <div className="text-[10px] text-text-tertiary font-mono">{entry.target?.type}</div>
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        entry.outcome === 'success'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : entry.outcome === 'denied'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {entry.outcome}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-text-tertiary">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-sans">
                    <button
                      className="p-1 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-secondary"
                      onClick={() => setSelectedEntry(entry)}
                      title="Inspect event details"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-text-secondary">
        <div>
          Showing {entries.length} of {total} total event{total === 1 ? '' : 's'}
        </div>
        <div className="flex items-center gap-2">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="rounded-lg border border-border-light p-1.5 hover:bg-surface-secondary disabled:opacity-40 transition-colors"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            title="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="rounded-lg border border-border-light p-1.5 hover:bg-surface-secondary disabled:opacity-40 transition-colors"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            title="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Entry Details Inspection Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border-medium bg-surface-primary p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border-light">
              <div>
                <h3 className="text-base font-bold text-text-primary">
                  Audit Event #{selectedEntry.seq}: {selectedEntry.action}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Recorded at {new Date(selectedEntry.createdAt).toISOString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-4 max-h-96 overflow-y-auto space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border-light bg-surface-secondary p-3">
                <div>
                  <span className="font-semibold text-text-secondary">Outcome:</span>{' '}
                  <span className="font-bold capitalize">{selectedEntry.outcome}</span>
                </div>
                <div>
                  <span className="font-semibold text-text-secondary">Severity:</span>{' '}
                  <span className="font-bold uppercase">{selectedEntry.severity}</span>
                </div>
                <div>
                  <span className="font-semibold text-text-secondary">Actor:</span>{' '}
                  <span>{selectedEntry.actor?.name} ({selectedEntry.actor?.type})</span>
                </div>
                <div>
                  <span className="font-semibold text-text-secondary">IP Address:</span>{' '}
                  <span className="font-mono">{selectedEntry.context?.ip || 'Internal'}</span>
                </div>
              </div>

              {selectedEntry.metadata && (
                <div>
                  <div className="font-semibold text-text-secondary mb-1">Event Metadata</div>
                  <pre className="rounded-xl border border-border-light bg-surface-secondary p-3 font-mono text-[11px] overflow-x-auto text-text-primary">
                    {JSON.stringify(selectedEntry.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border-light">
              <button
                onClick={() => setSelectedEntry(null)}
                className="rounded-xl border border-border-light bg-surface-secondary px-4 py-2 text-xs font-semibold text-text-primary hover:bg-surface-tertiary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
