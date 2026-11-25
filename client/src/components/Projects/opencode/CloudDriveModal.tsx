import React, { useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { Button, Spinner } from '@librechat/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import {
  Check,
  ChevronRight,
  Cloud,
  CloudDownload,
  CloudUpload,
  File,
  Folder,
  FolderPlus,
  FolderUp,
  HardDrive,
  Link2,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { CloudDriveEntryDto, CloudDriveProviderId } from 'librechat-data-provider';
import { cloudDriveSessionsAtom } from './atoms';
import {
  connectCloudDriveProvider,
  createCloudDriveFolder,
  disconnectCloudDriveProvider,
  downloadCloudDriveEntry,
  listCloudDriveFolder,
  uploadBlobToCloudDriveFolder,
  uploadToCloudDriveFolder,
} from './cloudDriveClient';

export interface StudioDriveAsset {
  id: string;
  name: string;
  url: string;
  kind?: string;
}

interface CloudDriveModalProps {
  projectId?: string;
  projectName?: string;
  selectedFile?: string | null;
  studioItems?: StudioDriveAsset[];
  localPrivacyActive: boolean;
  onClose: () => void;
  onImportedFiles?: (paths: string[]) => void;
  onNativeFilesSelected?: (files: FileList) => void;
}

const PROVIDER_META: Record<CloudDriveProviderId, { label: string; subtitle: string }> = {
  google_drive: {
    label: 'Google Drive',
    subtitle: 'Docs, Sheets, code & project assets',
  },
  onedrive: {
    label: 'Microsoft OneDrive',
    subtitle: 'Personal & Microsoft 365 files',
  },
};

export default function CloudDriveModal({
  projectId,
  projectName,
  selectedFile,
  studioItems,
  localPrivacyActive,
  onClose,
  onImportedFiles,
  onNativeFilesSelected,
}: CloudDriveModalProps) {
  const queryClient = useQueryClient();
  const [sessions, setSessions] = useAtom(cloudDriveSessionsAtom);
  const [activeProvider, setActiveProvider] = useState<CloudDriveProviderId>('google_drive');
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [selectedEntries, setSelectedEntries] = useState<Record<string, CloudDriveEntryDto>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const nativeFileInputRef = useRef<HTMLInputElement | null>(null);

  const currentFolder = folderStack[folderStack.length - 1] ?? { id: 'root', name: 'My Drive' };

  const statusQuery = useQuery(
    [QueryKeys.cloudDriveStatus],
    () => dataService.getCloudDriveStatus(),
    { refetchOnWindowFocus: false },
  );

  const providerConfig = statusQuery.data?.providers?.[activeProvider];
  const activeSession = sessions[activeProvider];
  const isConnected = Boolean(activeSession && activeSession.expiresAt > Date.now());

  const filesQuery = useQuery(
    [QueryKeys.cloudDriveFiles, activeProvider, currentFolder.id, activeSession?.accessToken],
    () =>
      listCloudDriveFolder(activeProvider, activeSession?.accessToken ?? '', currentFolder.id),
    {
      enabled: Boolean(statusQuery.data?.entitled && isConnected && activeSession?.accessToken),
      refetchOnWindowFocus: false,
    },
  );

  const handleConnect = async (provider: CloudDriveProviderId) => {
    const cfg = statusQuery.data?.providers?.[provider];
    if (!cfg?.clientId) {
      setErrorMessage(
        `Public OAuth App ID for ${PROVIDER_META[provider].label} is not configured on this instance.`,
      );
      return;
    }
    setErrorMessage(null);
    setStatusMessage(null);
    setIsConnecting(true);
    try {
      const session = await connectCloudDriveProvider(provider, {
        clientId: cfg.clientId,
        tenantId: cfg.tenantId,
      });
      setSessions((prev) => ({ ...prev, [provider]: session }));
      setStatusMessage(
        `Connected ${PROVIDER_META[provider].label} in this browser tab (zero server storage).`,
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect Cloud Drive.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = (provider: CloudDriveProviderId) => {
    disconnectCloudDriveProvider(provider, sessions[provider]);
    setSessions((prev) => ({ ...prev, [provider]: null }));
    setSelectedEntries({});
    setFolderStack([{ id: 'root', name: 'My Drive' }]);
    setStatusMessage(`Disconnected ${PROVIDER_META[provider].label}.`);
    setErrorMessage(null);
  };

  const importMutation = useMutation(
    async (entries: CloudDriveEntryDto[]) => {
      if (!activeSession?.accessToken) {
        throw new Error('Not signed in.');
      }
      const payloadFiles: Array<{ path: string; contentBase64: string }> = [];
      for (const entry of entries) {
        const downloaded = await downloadCloudDriveEntry(
          activeProvider,
          activeSession.accessToken,
          entry,
        );
        payloadFiles.push({
          path: downloaded.filename,
          contentBase64: downloaded.contentBase64,
        });
      }
      if (!projectId) {
        throw new Error('Open a Vibe project to import files into a workspace.');
      }
      await dataService.uploadOpenCodeFiles(projectId, { files: payloadFiles });
      return payloadFiles.map((f) => f.path);
    },
    {
      onSuccess: (importedPaths) => {
        setSelectedEntries({});
        void queryClient.invalidateQueries([QueryKeys.opencodeTree, projectId]);
        onImportedFiles?.(importedPaths);
        setStatusMessage(`Imported ${importedPaths.length} file(s) directly into workspace.`);
        setErrorMessage(null);
      },
      onError: (err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to import files.');
      },
    },
  );

  const exportMutation = useMutation(
    async () => {
      if (!activeSession?.accessToken || !selectedFile || !projectId) {
        throw new Error('Select a workspace file to save.');
      }
      const fileData = await dataService.readOpenCodeFile(projectId, selectedFile);
      const filename = selectedFile.split(/[/\\]/).pop() || selectedFile;
      return uploadToCloudDriveFolder(activeProvider, activeSession.accessToken, {
        folderId: currentFolder.id,
        filename,
        content: fileData.content,
      });
    },
    {
      onSuccess: (res) => {
        setStatusMessage(
          `Saved "${res.name}" directly to ${PROVIDER_META[activeProvider].label}.`,
        );
        setErrorMessage(null);
        void filesQuery.refetch();
      },
      onError: (err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to export file.');
      },
    },
  );

  const createFolderMutation = useMutation(
    async (name: string) => {
      if (!activeSession?.accessToken) {
        throw new Error('Not signed in.');
      }
      return createCloudDriveFolder(activeProvider, activeSession.accessToken, {
        parentFolderId: currentFolder.id,
        name,
      });
    },
    {
      onSuccess: (created) => {
        setStatusMessage(`Created folder "${created.name}".`);
        setErrorMessage(null);
        void filesQuery.refetch();
      },
      onError: (err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to create folder.');
      },
    },
  );

  const exportProjectMutation = useMutation(
    async () => {
      if (!activeSession?.accessToken || !projectId) {
        throw new Error('Not signed in or no active project.');
      }
      const token = activeSession.accessToken;
      const rootFolderName = (projectName || 'Satchida-Project').trim();
      const rootDriveFolder = await createCloudDriveFolder(activeProvider, token, {
        parentFolderId: currentFolder.id,
        name: rootFolderName,
      });

      const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__']);
      let uploadedCount = 0;
      const MAX_FILES = 100;

      const uploadDir = async (localDirPath: string, driveParentId: string) => {
        const treeRes = await dataService.getOpenCodeTree(projectId, localDirPath);
        const entries = treeRes?.entries ?? [];
        for (const item of entries) {
          if (uploadedCount >= MAX_FILES) {
            break;
          }
          const baseName = item.name.split(/[/\\]/).pop() || item.name;
          if (item.type === 'directory') {
            if (SKIP_DIRS.has(baseName)) {
              continue;
            }
            const subFolder = await createCloudDriveFolder(activeProvider, token, {
              parentFolderId: driveParentId,
              name: baseName,
            });
            await uploadDir(item.path, subFolder.id);
          } else if (item.type === 'file') {
            const fileData = await dataService.readOpenCodeFile(projectId, item.path);
            await uploadToCloudDriveFolder(activeProvider, token, {
              folderId: driveParentId,
              filename: baseName,
              content: fileData.content,
            });
            uploadedCount += 1;
          }
        }
      };

      await uploadDir('', rootDriveFolder.id);
      return { folderName: rootDriveFolder.name, count: uploadedCount };
    },
    {
      onSuccess: (res) => {
        setStatusMessage(
          `Saved project folder "${res.folderName}" (${res.count} file${res.count === 1 ? '' : 's'}) to ${PROVIDER_META[activeProvider].label}.`,
        );
        setErrorMessage(null);
        void filesQuery.refetch();
      },
      onError: (err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to save project folder.');
      },
    },
  );

  const exportStudioMutation = useMutation(
    async () => {
      if (!activeSession?.accessToken || !studioItems?.length) {
        throw new Error('No Studio Library items selected.');
      }
      let uploadedCount = 0;
      for (const item of studioItems) {
        const res = await fetch(item.url);
        if (!res.ok) {
          throw new Error(`Failed to fetch "${item.name}" from Studio Library.`);
        }
        const blob = await res.blob();
        const filename = item.name.split(/[/\\]/).pop() || item.name;
        await uploadBlobToCloudDriveFolder(activeProvider, activeSession.accessToken, {
          folderId: currentFolder.id,
          filename,
          blob,
        });
        uploadedCount += 1;
      }
      return uploadedCount;
    },
    {
      onSuccess: (count) => {
        setStatusMessage(
          `Saved ${count} Studio Library item${count === 1 ? '' : 's'} to ${PROVIDER_META[activeProvider].label}.`,
        );
        setErrorMessage(null);
        void filesQuery.refetch();
      },
      onError: (err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to save Studio Library items.');
      },
    },
  );

  const handleNewFolder = () => {
    const name = window.prompt('New folder name:');
    if (name && name.trim()) {
      createFolderMutation.mutate(name.trim());
    }
  };

  const handleExportProject = () => {
    if (localPrivacyActive) {
      const confirmed = window.confirm(
        `Local Privacy Mode is active. Are you sure you want to upload the entire "${projectName || 'project'}" folder to ${PROVIDER_META[activeProvider].label}?`,
      );
      if (!confirmed) {
        return;
      }
    }
    exportProjectMutation.mutate();
  };

  const handleExportCurrentFile = () => {
    if (!selectedFile) {
      return;
    }
    if (localPrivacyActive) {
      const confirmed = window.confirm(
        `Local Privacy Mode is active. Are you sure you want to upload "${selectedFile}" to ${PROVIDER_META[activeProvider].label}?`,
      );
      if (!confirmed) {
        return;
      }
    }
    exportMutation.mutate();
  };

  const toggleSelect = (entry: CloudDriveEntryDto) => {
    if (entry.type === 'folder') {
      setFolderStack((prev) => [...prev, { id: entry.id, name: entry.name }]);
      setSelectedEntries({});
      return;
    }
    setSelectedEntries((prev) => {
      const next = { ...prev };
      if (next[entry.id]) {
        delete next[entry.id];
      } else {
        next[entry.id] = entry;
      }
      return next;
    });
  };

  const selectedList = Object.values(selectedEntries);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[540px] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border-medium bg-surface-primary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light bg-surface-secondary px-4 py-3">
          <div className="flex items-center gap-2">
            <Cloud className="size-4 text-text-primary" />
            <h2 className="text-sm font-semibold text-text-primary">Cloud Drive Workspace Sync</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            aria-label="Close Cloud Drive modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          {/* Left Provider Sidebar */}
          <aside className="flex w-52 shrink-0 flex-col justify-between border-r border-border-light bg-surface-secondary/50 p-3">
            <div className="space-y-1.5">
              <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Cloud Providers
              </div>
              {(['google_drive', 'onedrive'] as CloudDriveProviderId[]).map((providerId) => {
                const cfg = statusQuery.data?.providers?.[providerId];
                const session = sessions[providerId];
                const connected = Boolean(session && session.expiresAt > Date.now());
                const active = activeProvider === providerId;
                return (
                  <button
                    key={providerId}
                    type="button"
                    onClick={() => {
                      setActiveProvider(providerId);
                      setFolderStack([{ id: 'root', name: 'My Drive' }]);
                      setSelectedEntries({});
                      setStatusMessage(null);
                      setErrorMessage(null);
                    }}
                    className={`flex w-full flex-col rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      active
                        ? 'border-border-heavy bg-surface-primary text-text-primary shadow-xs'
                        : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{PROVIDER_META[providerId].label}</span>
                      {connected ? (
                        <span className="size-2 rounded-full bg-emerald-500" title="Connected" />
                      ) : null}
                    </div>
                    <span className="mt-0.5 truncate text-[10px] text-text-secondary">
                      {connected
                        ? 'Connected (this tab)'
                        : cfg?.configured === false
                          ? 'Needs App ID'
                          : 'Not connected'}
                    </span>
                  </button>
                );
              })}

              {/* Native OS / iCloud Drive Picker */}
              <div className="pt-3">
                <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  Device & iCloud Drive
                </div>
                <input
                  ref={nativeFileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      onNativeFilesSelected?.(e.target.files);
                      setStatusMessage(`Uploaded ${e.target.files.length} file(s) from device/iCloud.`);
                    }
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => nativeFileInputRef.current?.click()}
                  className="mt-1.5 flex w-full items-center gap-2 rounded-lg border border-border-light bg-surface-primary px-2.5 py-2 text-left text-xs text-text-primary hover:bg-surface-hover"
                >
                  <HardDrive className="size-3.5 shrink-0 text-text-secondary" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">iCloud / Device Files</div>
                    <div className="truncate text-[10px] text-text-secondary">
                      Native OS Files picker
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-[10px] text-emerald-700 dark:text-emerald-400">
                <div className="flex items-center gap-1 font-semibold">
                  <ShieldCheck className="size-3 shrink-0" />
                  Zero Server Storage
                </div>
                <p className="mt-0.5 leading-tight">
                  Sign-in stays only in this browser tab. No credentials or identity are stored on
                  any server.
                </p>
              </div>

              {localPrivacyActive ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-600 dark:text-amber-400">
                  <div className="flex items-center gap-1 font-semibold">
                    <ShieldAlert className="size-3 shrink-0" />
                    Local Privacy ON
                  </div>
                  <p className="mt-0.5 leading-tight">
                    Outbound uploads to Cloud Drive require explicit confirmation.
                  </p>
                </div>
              ) : null}
            </div>
          </aside>

          {/* Right Browser Pane */}
          <div className="flex min-w-0 flex-1 flex-col">
            {statusQuery.isLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Spinner className="text-text-primary" />
              </div>
            ) : !statusQuery.data?.entitled ? (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <Cloud className="size-8 text-text-secondary opacity-50" />
                <p className="mt-2 text-sm font-medium text-text-primary">
                  Cloud Drive Sync is available on Pro, Pro Family, Privacy & Enterprise tiers.
                </p>
              </div>
            ) : !isConnected ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <Cloud className="size-9 text-text-secondary opacity-60" />
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {`Connect ${PROVIDER_META[activeProvider].label}`}
                  </h3>
                  <p className="mt-1 max-w-sm text-xs text-text-secondary">
                    {PROVIDER_META[activeProvider].subtitle}. Connects directly from your browser —
                    your account and tokens are never stored on the server.
                  </p>
                </div>
                {providerConfig?.configured ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={isConnecting}
                    onClick={() => void handleConnect(activeProvider)}
                    className="gap-1.5"
                  >
                    <Link2 className="size-3.5" />
                    {isConnecting
                      ? 'Connecting...'
                      : `Sign in with ${PROVIDER_META[activeProvider].label}`}
                  </Button>
                ) : (
                  <div className="rounded-lg border border-border-medium bg-surface-secondary px-3 py-2 text-xs text-text-secondary">
                    Public OAuth App ID for {PROVIDER_META[activeProvider].label} is not yet
                    configured on this instance.
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Breadcrumb & Disconnect Bar */}
                <div className="flex items-center justify-between border-b border-border-light px-3 py-2 text-xs">
                  <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
                    {folderStack.map((folder, idx) => (
                      <React.Fragment key={folder.id}>
                        {idx > 0 ? (
                          <ChevronRight className="size-3 shrink-0 text-text-secondary" />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setFolderStack((prev) => prev.slice(0, idx + 1));
                            setSelectedEntries({});
                          }}
                          className="truncate rounded px-1 py-0.5 text-text-primary hover:bg-surface-hover"
                        >
                          {folder.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={createFolderMutation.isLoading}
                      onClick={handleNewFolder}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                      title="Create new folder"
                    >
                      <FolderPlus className="size-3.5" />
                      New Folder
                    </button>
                    <button
                      type="button"
                      onClick={() => void filesQuery.refetch()}
                      className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                      title="Refresh folder"
                    >
                      <RefreshCw className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisconnect(activeProvider)}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-surface-hover hover:text-red-500"
                      title="Disconnect"
                    >
                      <LogOut className="size-3" />
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* File List */}
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {filesQuery.isLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <Spinner className="text-text-primary" />
                    </div>
                  ) : filesQuery.error ? (
                    <div className="p-4 text-center text-xs text-red-500">
                      {filesQuery.error instanceof Error
                        ? filesQuery.error.message
                        : 'Failed to load files.'}
                    </div>
                  ) : (filesQuery.data?.length ?? 0) === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-text-secondary">
                      This folder is empty.
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {(filesQuery.data ?? []).map((entry) => {
                        const isSelected = Boolean(selectedEntries[entry.id]);
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => toggleSelect(entry)}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                              isSelected
                                ? 'bg-surface-active text-text-primary'
                                : 'text-text-primary hover:bg-surface-hover'
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {entry.type === 'folder' ? (
                                <Folder className="size-3.5 shrink-0 text-amber-500" />
                              ) : (
                                <File className="size-3.5 shrink-0 text-text-secondary" />
                              )}
                              <span className="truncate">{entry.name}</span>
                            </div>
                            {entry.type === 'file' && isSelected ? (
                              <Check className="size-3.5 shrink-0 text-emerald-500" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between border-t border-border-light bg-surface-secondary/50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {projectId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        disabled={selectedList.length === 0 || importMutation.isLoading}
                        onClick={() => importMutation.mutate(selectedList)}
                        className="gap-1.5 text-xs"
                      >
                        <CloudDownload className="size-3.5" />
                        {importMutation.isLoading
                          ? 'Importing...'
                          : `Import Selected (${selectedList.length})`}
                      </Button>
                    ) : null}
                    {projectId && selectedFile ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={exportMutation.isLoading}
                        onClick={handleExportCurrentFile}
                        className="gap-1.5 text-xs"
                      >
                        <CloudUpload className="size-3.5" />
                        {exportMutation.isLoading ? 'Saving...' : `Save "${selectedFile.split(/[/\\]/).pop()}"`}
                      </Button>
                    ) : null}
                    {projectId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={exportProjectMutation.isLoading}
                        onClick={handleExportProject}
                        className="gap-1.5 text-xs"
                      >
                        <FolderUp className="size-3.5" />
                        {exportProjectMutation.isLoading ? 'Saving Project...' : 'Save Entire Project'}
                      </Button>
                    ) : null}
                    {studioItems && studioItems.length > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        disabled={exportStudioMutation.isLoading}
                        onClick={() => exportStudioMutation.mutate()}
                        className="gap-1.5 text-xs"
                      >
                        <CloudUpload className="size-3.5" />
                        {exportStudioMutation.isLoading
                          ? 'Saving to Drive...'
                          : `Save Studio Items (${studioItems.length})`}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </>
            )}

            {/* Status / Error Banner */}
            {statusMessage || errorMessage ? (
              <div
                className={`border-t px-3 py-1.5 text-xs ${
                  errorMessage
                    ? 'border-red-500/30 bg-red-500/10 text-red-500'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {errorMessage || statusMessage}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
