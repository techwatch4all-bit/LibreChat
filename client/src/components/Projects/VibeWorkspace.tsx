import React, { useEffect, useRef, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Button, Spinner } from '@librechat/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MutationKeys, QueryKeys, dataService } from 'librechat-data-provider';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Code2,
  Columns,
  Download,
  FileCode,
  FileDiff,
  Folder,
  GitBranch,
  Globe,
  Map as MapIcon,
  MessageSquareCode,
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeft,
  RotateCw,
  Rows,
  Save,
  Search,
  Sparkles,
  Terminal as TerminalIcon,
  X,
} from 'lucide-react';
import type { OpenCodeDirTreeEntry } from 'librechat-data-provider';
import {
  activeOpenCodeSessionIdAtom,
  openCodeDiffsAtom,
  openCodePendingAutoPromptAtom,
} from './opencode/atoms';
import OpenCodeChangesPanel from './opencode/OpenCodeChangesPanel';
import OpenCodePreviewPanel from './opencode/OpenCodePreviewPanel';
import { useOpenCodeEvents } from './opencode/useOpenCodeEvents';
import OpenCodeChatPanel from './opencode/OpenCodeChatPanel';
import OpenCodeDiffPanel from './opencode/OpenCodeDiffPanel';
import { useAuthContext, useLocalize } from '~/hooks';
import OpenCodeTerminal from './OpenCodeTerminal';

interface VibeWorkspaceProps {
  projectId: string;
  projectName: string;
  localPath?: string;
}

type WorkbenchTab = 'editor' | 'terminal' | 'preview' | 'changes' | 'diffs';

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'py':
      return 'python';
    case 'md':
      return 'markdown';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'plaintext';
  }
}

export default function VibeWorkspace({ projectId, projectName, localPath }: VibeWorkspaceProps) {
  const localize = useLocalize();
  const { token } = useAuthContext();
  const queryClient = useQueryClient();

  const activeSessionId = useAtomValue(activeOpenCodeSessionIdAtom);
  const diffs = useAtomValue(openCodeDiffsAtom);
  const setPendingAutoPrompt = useSetAtom(openCodePendingAutoPromptAtom);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [dirtyFiles, setDirtyFiles] = useState<Record<string, boolean>>({});
  const [editorContent, setEditorContent] = useState<string>('');
  const [fileSearchQuery, setFileSearchQuery] = useState<string>('');
  const [sidebarView, setSidebarView] = useState<'files' | 'search'>('files');
  const [terminalSplit, setTerminalSplit] = useState<'horizontal' | 'vertical'>('horizontal');
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [provisionedPath, setProvisionedPath] = useState<string | null>(null);
  const autoProvisionedRef = useRef<string | null>(null);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>('editor');
  const [uiMode, setUiMode] = useState<'normal' | 'developer'>('normal');
  const [showFiles, setShowFiles] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showProblems, setShowProblems] = useState(false);
  const [diagnostics, setDiagnostics] = useState<
    Array<{ message: string; startLineNumber: number; severity: number }>
  >([]);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const updateTheme = () => {
      setIsDarkTheme(document.documentElement.classList.contains('dark'));
    };
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const statusQuery = useQuery([QueryKeys.opencodeStatus], () => dataService.getOpenCodeStatus(), {
    refetchOnWindowFocus: false,
  });

  const isEnabled = statusQuery.data?.enabled === true;
  const isReachable = statusQuery.data?.reachable === true;
  const isPlatformAdmin = statusQuery.data?.isPlatformAdmin === true;

  useOpenCodeEvents({
    projectId,
    sessionId: activeSessionId,
    token,
    enabled: isEnabled && isReachable,
  });

  const treeQuery = useQuery(
    [QueryKeys.opencodeTree, projectId, localPath ?? ''],
    () => dataService.getOpenCodeTree(projectId),
    { enabled: isEnabled && Boolean(projectId), retry: false, refetchOnWindowFocus: false },
  );

  const provisionWorkspaceMutation = useMutation(
    () => dataService.provisionOpenCodeWorkspace(projectId),
    {
      onSuccess: (res) => {
        setProvisionedPath(res.localPath);
        queryClient.invalidateQueries([QueryKeys.opencodeTree, projectId]);
        queryClient.invalidateQueries([QueryKeys.project, projectId]);
      },
    },
  );

  const handleOpenFile = (filePath: string) => {
    setSelectedFile(filePath);
    setOpenFiles((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
    setWorkbenchTab('editor');
  };

  const handleCloseFile = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenFiles((prev) => {
      const filtered = prev.filter((f) => f !== filePath);
      if (selectedFile === filePath) {
        setSelectedFile(filtered.length > 0 ? filtered[filtered.length - 1] : null);
      }
      return filtered;
    });
    setDirtyFiles((prev) => {
      const next = { ...prev };
      delete next[filePath];
      return next;
    });
  };

  useEffect(() => {
    setSelectedFile(null);
    setOpenFiles([]);
    setDirtyFiles({});
    setEditorContent('');
    setExpandedDirs({});
    setProvisionedPath(null);
    autoProvisionedRef.current = null;
  }, [projectId, localPath]);

  useEffect(() => {
    const entries = treeQuery.data?.tree ?? [];
    if (entries.length === 0) {
      return;
    }
    if (!selectedFile) {
      const preferredNames = ['README.md', 'index.html', 'server.mjs', 'package.json'];
      const topFiles = entries.filter((entry) => entry.type === 'file');
      const match =
        preferredNames
          .map((pref) => topFiles.find((f) => f.name.toLowerCase() === pref.toLowerCase()))
          .find(Boolean) ?? topFiles[0];
      if (match) {
        handleOpenFile(match.path);
      }
    }
  }, [selectedFile, treeQuery.data?.tree]);

  const handleExportZip = async () => {
    if (!projectId || isExportingZip) {
      return;
    }
    setIsExportingZip(true);
    try {
      const res = await fetch(`/api/opencode/${encodeURIComponent(projectId)}/export-zip`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(projectName || 'project').toLowerCase().replace(/[^a-z0-9_-]+/g, '-')}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsExportingZip(false);
    }
  };

  useEffect(() => {
    if (!isEnabled || !isReachable || !projectId) {
      return;
    }
    const needsWorkspace = !localPath || treeQuery.isError;
    if (
      needsWorkspace &&
      autoProvisionedRef.current !== projectId &&
      !provisionWorkspaceMutation.isLoading
    ) {
      autoProvisionedRef.current = projectId;
      provisionWorkspaceMutation.mutate();
    }
  }, [isEnabled, isReachable, localPath, projectId, treeQuery.isError, provisionWorkspaceMutation]);

  const fileQuery = useQuery(
    [QueryKeys.opencodeFile, projectId, selectedFile],
    () => dataService.readOpenCodeFile(projectId, selectedFile ?? ''),
    {
      enabled: isEnabled && Boolean(projectId) && Boolean(selectedFile),
      refetchOnWindowFocus: false,
      onSuccess: (data) => {
        setEditorContent(data.content);
        if (selectedFile) {
          setDirtyFiles((prev) => ({ ...prev, [selectedFile]: false }));
        }
      },
    },
  );

  const saveFileMutation = useMutation(
    [MutationKeys.opencodeWriteFile, projectId],
    () =>
      dataService.writeOpenCodeFile(projectId, {
        path: selectedFile ?? '',
        content: editorContent,
      }),
    {
      onSuccess: () => {
        if (selectedFile) {
          setDirtyFiles((prev) => ({ ...prev, [selectedFile]: false }));
        }
        queryClient.invalidateQueries([QueryKeys.opencodeTree, projectId]);
        queryClient.invalidateQueries([QueryKeys.opencodeVcs, projectId]);
      },
    },
  );

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const renderTree = (nodes: OpenCodeDirTreeEntry[], depth = 0) =>
    nodes.map((node) => {
      const isExpanded = Boolean(expandedDirs[node.path]);
      const isSelected = selectedFile === node.path;

      if (node.type === 'directory') {
        return (
          <div key={node.path}>
            <button
              type="button"
              onClick={() => toggleDir(node.path)}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
              )}
              <Folder className="size-3.5 shrink-0 text-text-secondary" aria-hidden="true" />
              <span className="truncate">{node.name}</span>
            </button>
            {isExpanded && node.children && node.children.length > 0 ? (
              <div>{renderTree(node.children, depth + 1)}</div>
            ) : null}
          </div>
        );
      }

      return (
        <button
          key={node.path}
          type="button"
          onClick={() => handleOpenFile(node.path)}
          className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs ${
            isSelected
              ? 'bg-surface-active font-medium text-text-primary'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`}
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
        >
          <FileCode className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
          <span className="truncate">{node.name}</span>
          {dirtyFiles[node.path] ? (
            <span className="ml-auto size-1.5 rounded-full bg-amber-400" title="Unsaved changes" />
          ) : null}
        </button>
      );
    });

  // Flatten tree for fast workspace-wide file search
  const flattenFiles = (nodes: OpenCodeDirTreeEntry[]): OpenCodeDirTreeEntry[] => {
    const list: OpenCodeDirTreeEntry[] = [];
    for (const node of nodes) {
      if (node.type === 'file') {
        list.push(node);
      } else if (node.children) {
        list.push(...flattenFiles(node.children));
      }
    }
    return list;
  };

  const allFiles = flattenFiles(treeQuery.data?.tree ?? []);
  const matchingFiles = fileSearchQuery.trim()
    ? allFiles.filter(
        (f) =>
          f.name.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
          f.path.toLowerCase().includes(fileSearchQuery.toLowerCase()),
      )
    : [];

  if (statusQuery.isLoading) {
    return (
      <div className="flex h-[560px] items-center justify-center rounded-xl border border-border-light bg-surface-primary">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  if (statusQuery.isError || !isEnabled || !isReachable) {
    const message = !isEnabled
      ? localize('com_opencode_status_disabled')
      : localize('com_opencode_status_unreachable');
    return (
      <div
        role="alert"
        className="flex h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-border-light bg-surface-primary p-6 text-center"
      >
        <AlertCircle className="size-8 text-text-secondary" aria-hidden="true" />
        <p className="text-sm text-text-primary">{message}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => statusQuery.refetch()}>
          <RotateCw className="mr-1.5 size-3.5" aria-hidden="true" />
          {localize('com_opencode_retry')}
        </Button>
      </div>
    );
  }

  const rootPath = treeQuery.data?.rootPath || provisionedPath || localPath || '';
  const hasRunnableApp = (treeQuery.data?.tree ?? []).some(
    (entry) =>
      entry.type === 'file' &&
      (entry.name === 'package.json' ||
        entry.name === 'server.mjs' ||
        entry.name === 'server.js' ||
        entry.name === 'app.py' ||
        entry.name === 'main.py' ||
        entry.name === 'manage.py' ||
        /\.(?:html|htm)$/i.test(entry.name)),
  );
  const isNormalMode = uiMode === 'normal';
  const isFullTerminal = workbenchTab === 'terminal';

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface-primary">
      {/* Sleek IDE Workbench Bar */}
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border-light bg-surface-secondary px-2.5">
        <div className="flex items-center gap-1 overflow-x-auto">
          <div className="flex items-center rounded-md border border-border-light bg-surface-primary p-0.5">
            <button
              type="button"
              onClick={() => setUiMode('normal')}
              className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
                isNormalMode
                  ? 'bg-surface-active text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {localize('com_opencode_mode_normal')}
            </button>
            <button
              type="button"
              onClick={() => setUiMode('developer')}
              className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
                !isNormalMode
                  ? 'bg-surface-active text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {localize('com_opencode_mode_developer')}
            </button>
          </div>

          {!isNormalMode ? (
            <>
              <span className="mx-1 h-4 w-px bg-border-light" aria-hidden="true" />
              <Button
                type="button"
                variant={showFiles ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowFiles((v) => !v)}
                className="h-7 gap-1.5 px-2 text-xs"
                aria-label={localize('com_opencode_view_editor')}
              >
                <PanelLeft className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{localize('com_opencode_files_label')}</span>
              </Button>

              <span className="mx-1 h-4 w-px bg-border-light" aria-hidden="true" />

              <div className="flex items-center gap-1" role="tablist">
                {(
                  [
                    ['editor', localize('com_opencode_view_editor'), Code2],
                    ...(isPlatformAdmin
                      ? ([
                          ['terminal', localize('com_opencode_terminal_mode_tui'), TerminalIcon],
                        ] as const)
                      : []),
                    ['preview', localize('com_opencode_view_preview'), Globe],
                    ['changes', localize('com_opencode_view_changes'), GitBranch],
                    ['diffs', `${localize('com_opencode_view_diffs')} (${diffs.length})`, FileDiff],
                  ] as const
                ).map(([tabKey, label, Icon]) => (
                  <Button
                    key={tabKey}
                    type="button"
                    role="tab"
                    aria-selected={workbenchTab === tabKey}
                    variant={workbenchTab === tabKey ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setWorkbenchTab(tabKey)}
                    className="h-7 gap-1.5 px-2.5 text-xs"
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {label}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isExportingZip}
            onClick={() => void handleExportZip()}
            className="h-7 gap-1 px-2 text-xs"
            title={localize('com_opencode_export_zip')}
          >
            <Download className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">
              {isExportingZip
                ? localize('com_opencode_exporting_zip')
                : localize('com_opencode_export_zip')}
            </span>
          </Button>

          {!isNormalMode && statusQuery.data?.version ? (
            <span className="hidden rounded bg-surface-tertiary px-1.5 py-0.5 font-mono text-[10px] text-text-secondary md:inline">
              {`v${statusQuery.data.version}`}
            </span>
          ) : null}

          {!isNormalMode && isPlatformAdmin && !isFullTerminal ? (
            <Button
              type="button"
              variant={showTerminal ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowTerminal((v) => !v)}
              className="h-7 gap-1 px-2 text-xs"
            >
              {showTerminal ? (
                <PanelBottomClose className="size-3.5" aria-hidden="true" />
              ) : (
                <PanelBottomOpen className="size-3.5" aria-hidden="true" />
              )}
              {localize('com_opencode_view_terminal')}
            </Button>
          ) : null}

          {!isNormalMode ? (
            <Button
              type="button"
              variant={showChat ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowChat((v) => !v)}
              className="h-7 gap-1.5 px-2.5 text-xs"
            >
              <MessageSquareCode className="size-3.5" aria-hidden="true" />
              {localize('com_opencode_view_chat')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Main Body: Normal Mode (2-pane Live App Preview + Simple AI Chat) vs Developer Mode (Full 3-Pane IDE) */}
      {isNormalMode ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <OpenCodePreviewPanel
              projectId={projectId}
              simpleMode={true}
              hasRunnableApp={hasRunnableApp}
            />
          </div>
          <div className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-border-light xl:w-[420px]">
            <OpenCodeChatPanel projectId={projectId} reachable={isReachable} simpleMode={true} />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left File Explorer & Search Sidebar */}
          {showFiles ? (
            <aside className="flex w-60 shrink-0 flex-col border-r border-border-light bg-surface-secondary">
              <div className="flex h-8 shrink-0 items-center justify-between border-b border-border-light px-2 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSidebarView('files')}
                    className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                      sidebarView === 'files'
                        ? 'bg-surface-active text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {localize('com_opencode_files_label') || 'Files'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarView('search')}
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                      sidebarView === 'search'
                        ? 'bg-surface-active text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Search className="size-3" aria-hidden="true" />
                    <span>{localize('com_ui_search') || 'Search'}</span>
                  </button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => treeQuery.refetch()}
                  className="size-6 shrink-0"
                  aria-label={localize('com_opencode_refresh')}
                >
                  <RotateCw className="size-3" aria-hidden="true" />
                </Button>
              </div>

              {sidebarView === 'search' ? (
                <div className="flex flex-1 flex-col overflow-hidden p-2">
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-2 top-2 size-3.5 text-text-secondary" />
                    <input
                      type="text"
                      value={fileSearchQuery}
                      onChange={(e) => setFileSearchQuery(e.target.value)}
                      placeholder={localize('com_ui_search') || 'Find files in project...'}
                      className="w-full rounded border border-border-light bg-surface-primary py-1 pl-7 pr-2 text-xs text-text-primary placeholder:text-text-secondary focus:border-border-medium focus:outline-none"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {(() => {
                      if (fileSearchQuery.trim() === '') {
                        return (
                          <p className="p-2 text-center text-xs text-text-secondary">
                            {localize('com_ui_search') || 'Type to search files...'}
                          </p>
                        );
                      }
                      if (matchingFiles.length === 0) {
                        return (
                          <p className="p-2 text-center text-xs text-text-secondary">
                            {localize('com_ui_no_results') || 'No files match'}
                          </p>
                        );
                      }
                      return (
                        <div className="space-y-0.5">
                          {matchingFiles.map((file) => (
                            <button
                              key={file.path}
                              type="button"
                              onClick={() => handleOpenFile(file.path)}
                              className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs ${
                                selectedFile === file.path
                                  ? 'bg-surface-active font-medium text-text-primary'
                                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                              }`}
                            >
                              <FileCode className="size-3.5 shrink-0 opacity-75" />
                              <div className="truncate">
                                <span className="font-medium text-text-primary">{file.name}</span>
                                <span className="ml-1 text-[10px] text-text-secondary">
                                  {file.path}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-1.5">
                  {treeQuery.isLoading ? (
                    <div className="flex items-center justify-center p-4 text-xs text-text-secondary">
                      <Spinner className="mr-1.5 size-3.5" />
                      {localize('com_opencode_loading_tree')}
                    </div>
                  ) : null}
                  {!treeQuery.isLoading && treeQuery.isError ? (
                    <div className="p-3 text-xs text-text-destructive">
                      {localize('com_opencode_error_generic')}
                    </div>
                  ) : null}
                  {!treeQuery.isLoading &&
                  !treeQuery.isError &&
                  (treeQuery.data?.tree ?? []).length === 0 ? (
                    <div className="p-3 text-xs text-text-secondary">
                      {localize('com_opencode_empty_tree')}
                    </div>
                  ) : null}
                  {!treeQuery.isLoading &&
                  !treeQuery.isError &&
                  (treeQuery.data?.tree ?? []).length > 0
                    ? renderTree(treeQuery.data?.tree ?? [])
                    : null}
                </div>
              )}
            </aside>
          ) : null}

          {/* Center Workbench Stage */}
          <div
            className={`flex min-h-0 min-w-0 flex-1 overflow-hidden ${
              showTerminal && !isFullTerminal && terminalSplit === 'vertical'
                ? 'flex-row'
                : 'flex-col'
            }`}
          >
            {!isFullTerminal ? (
              <div
                className={`flex min-h-0 flex-1 overflow-hidden ${
                  showTerminal && terminalSplit === 'vertical' ? 'w-1/2 flex-row' : 'flex-col'
                }`}
              >
                {workbenchTab === 'changes' ? (
                  <div className="flex-1 overflow-hidden">
                    <OpenCodeChangesPanel projectId={projectId} />
                  </div>
                ) : null}
                {workbenchTab === 'preview' ? (
                  <div className="flex-1 overflow-hidden">
                    <OpenCodePreviewPanel projectId={projectId} hasRunnableApp={hasRunnableApp} />
                  </div>
                ) : null}
                {workbenchTab === 'diffs' ? (
                  <div className="flex-1 overflow-hidden">
                    <OpenCodeDiffPanel diffs={diffs} isLoading={false} />
                  </div>
                ) : null}
                {workbenchTab === 'editor' ? (
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    {/* Multi-Tab File Buffer Header */}
                    <div className="flex h-8 shrink-0 items-center justify-between border-b border-border-light bg-surface-secondary px-2 text-xs">
                      {/* Open File Tabs */}
                      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                        {openFiles.length === 0 && selectedFile ? (
                          <div className="border-primary flex items-center gap-1.5 rounded-t border-b-2 bg-surface-primary px-2.5 py-1 text-text-primary">
                            <span className="font-mono text-xs">
                              {selectedFile.split('/').pop()}
                            </span>
                          </div>
                        ) : null}
                        {openFiles.map((file) => {
                          const fileName = file.split('/').pop() || file;
                          const isActive = selectedFile === file;
                          const isDirty = dirtyFiles[file];
                          return (
                            <div
                              key={file}
                              onClick={() => {
                                setSelectedFile(file);
                                setWorkbenchTab('editor');
                              }}
                              className={`group flex cursor-pointer items-center gap-1.5 rounded-t px-2.5 py-1 text-xs transition-colors ${
                                isActive
                                  ? 'border-primary border-b-2 bg-surface-primary font-medium text-text-primary'
                                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                              }`}
                              title={file}
                            >
                              <FileCode className="size-3 opacity-70" />
                              <span className="max-w-[120px] truncate font-mono">{fileName}</span>
                              {isDirty ? (
                                <span
                                  className="size-1.5 rounded-full bg-amber-400"
                                  title="Unsaved changes"
                                />
                              ) : null}
                              <button
                                type="button"
                                onClick={(e) => handleCloseFile(file, e)}
                                className="ml-1 rounded p-0.5 opacity-0 hover:bg-surface-active group-hover:opacity-100"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Editor Controls & Diagnostic Actions */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        {selectedFile && diagnostics.length > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={showProblems ? 'secondary' : 'outline'}
                            onClick={() => setShowProblems((v) => !v)}
                            className="h-6 gap-1 px-2 text-[11px] text-amber-400"
                          >
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            {`${localize('com_opencode_problems_label')} (${diagnostics.length})`}
                          </Button>
                        ) : null}
                        {selectedFile ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowMinimap((v) => !v)}
                            className="h-6 gap-1 px-2 text-[11px]"
                            title={localize('com_opencode_minimap')}
                          >
                            <MapIcon className="size-3" aria-hidden="true" />
                            {localize('com_opencode_minimap')}
                          </Button>
                        ) : null}
                        {isPlatformAdmin && showTerminal && !isFullTerminal ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setTerminalSplit((prev) =>
                                prev === 'horizontal' ? 'vertical' : 'horizontal',
                              )
                            }
                            className="h-6 gap-1 px-2 text-[11px]"
                            title={
                              terminalSplit === 'horizontal'
                                ? 'Split Side-by-Side'
                                : 'Split Stacked'
                            }
                          >
                            {terminalSplit === 'horizontal' ? (
                              <Columns className="size-3" />
                            ) : (
                              <Rows className="size-3" />
                            )}
                            <span className="hidden sm:inline">
                              {terminalSplit === 'horizontal' ? 'Split Vertical' : 'Split Stacked'}
                            </span>
                          </Button>
                        ) : null}
                        {selectedFile ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const diagSummary =
                                diagnostics.length > 0
                                  ? `\nDetected Editor Diagnostics:\n${diagnostics
                                      .slice(0, 8)
                                      .map((d) => `- Line ${d.startLineNumber}: ${d.message}`)
                                      .join('\n')}`
                                  : '';
                              setPendingAutoPrompt(
                                `Please review and fix any issues or improve the code in "${selectedFile}".${diagSummary}`,
                              );
                            }}
                            className="h-6 gap-1 px-2 text-[11px]"
                          >
                            <Sparkles className="size-3" aria-hidden="true" />
                            {localize('com_opencode_ai_fix_file')}
                          </Button>
                        ) : null}
                        {selectedFile ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            disabled={saveFileMutation.isLoading}
                            onClick={() => saveFileMutation.mutate()}
                            className="h-6 gap-1 px-2.5 text-xs"
                          >
                            <Save className="size-3" aria-hidden="true" />
                            {saveFileMutation.isLoading
                              ? localize('com_opencode_saving')
                              : localize('com_opencode_save')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="min-h-0 flex-1">
                      {selectedFile && fileQuery.isLoading ? (
                        <div className="flex h-full items-center justify-center">
                          <Spinner className="text-text-primary" />
                        </div>
                      ) : null}
                      {selectedFile && !fileQuery.isLoading ? (
                        <MonacoEditor
                          height="100%"
                          theme={isDarkTheme ? 'vs-dark' : 'light'}
                          language={getLanguageFromPath(selectedFile)}
                          value={editorContent}
                          onChange={(value) => {
                            setEditorContent(value ?? '');
                            if (selectedFile) {
                              setDirtyFiles((prev) => ({ ...prev, [selectedFile]: true }));
                            }
                          }}
                          onValidate={(markers) =>
                            setDiagnostics(
                              markers.map((m) => ({
                                message: m.message,
                                startLineNumber: m.startLineNumber,
                                severity: m.severity,
                              })),
                            )
                          }
                          options={{
                            minimap: { enabled: showMinimap },
                            fontSize: 13.5,
                            wordWrap: 'on',
                            automaticLayout: true,
                            bracketPairColorization: {
                              enabled: true,
                              independentColorPoolPerBracketType: true,
                            },
                            guides: {
                              bracketPairs: true,
                              indentation: true,
                            },
                            smoothScrolling: true,
                            formatOnPaste: true,
                            formatOnType: true,
                            renderLineHighlight: 'all',
                          }}
                        />
                      ) : null}
                      {!selectedFile ? (
                        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-text-secondary">
                          {localize('com_opencode_select_file_prompt')}
                        </div>
                      ) : null}
                    </div>
                    {showProblems && diagnostics.length > 0 ? (
                      <div className="max-h-36 shrink-0 overflow-y-auto border-t border-border-medium bg-surface-secondary p-2 text-xs">
                        <div className="mb-1 flex items-center justify-between font-medium text-text-secondary">
                          <span>
                            {`${localize('com_opencode_editor_diagnostics')} (${diagnostics.length})`}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const diagSummary = diagnostics
                                .slice(0, 10)
                                .map((d) => `- Line ${d.startLineNumber}: ${d.message}`)
                                .join('\n');
                              setPendingAutoPrompt(
                                `Fix the following diagnostics in "${selectedFile}":\n${diagSummary}`,
                              );
                            }}
                            className="h-6 gap-1 px-2 text-[11px]"
                          >
                            <Sparkles className="size-3" aria-hidden="true" />
                            {localize('com_opencode_fix_all_ai')}
                          </Button>
                        </div>
                        <ul className="space-y-1 font-mono text-[11px]">
                          {diagnostics.map((d, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-amber-400">
                              <span className="shrink-0 text-text-secondary">
                                {`Ln ${d.startLineNumber}:`}
                              </span>
                              <span>{d.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Persistent Live Satchida Code TUI / Terminal (restricted to Platform Admin / platform admin group) */}
            {(() => {
              if (!isPlatformAdmin || (!isFullTerminal && !showTerminal)) {
                return null;
              }
              let terminalContainerClass =
                'flex h-[48%] min-h-[260px] shrink-0 flex-col overflow-hidden border-t border-border-medium';
              if (isFullTerminal) {
                terminalContainerClass = 'flex min-h-0 flex-1 flex-col overflow-hidden';
              } else if (terminalSplit === 'vertical') {
                terminalContainerClass =
                  'flex min-h-0 w-1/2 flex-1 flex-col overflow-hidden border-l border-border-medium';
              }
              return (
                <div className={terminalContainerClass}>
                  <OpenCodeTerminal
                    projectId={projectId}
                    projectPath={rootPath}
                    className="h-full rounded-none border-0"
                  />
                </div>
              );
            })()}
          </div>

          {/* Right AI Agent Chat Panel (Cursor-style, collapsible) */}
          {showChat ? (
            <div className="flex min-h-0 w-[360px] shrink-0 flex-col border-l border-border-light xl:w-[400px]">
              <OpenCodeChatPanel projectId={projectId} reachable={isReachable} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
