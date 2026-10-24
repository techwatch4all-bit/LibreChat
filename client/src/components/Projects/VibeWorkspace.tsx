import React, { useEffect, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import {
  Folder,
  FileCode,
  ChevronRight,
  ChevronDown,
  Save,
  RotateCw,
  Terminal as TerminalIcon,
  Code2,
} from 'lucide-react';
import { Button, Spinner } from '@librechat/client';
import OpenCodeTerminal from './OpenCodeTerminal';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
}

interface VibeWorkspaceProps {
  projectId: string;
  projectName: string;
  localPath?: string;
}

export default function VibeWorkspace({
  projectId,
  projectName,
  localPath,
}: VibeWorkspaceProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [rootPath, setRootPath] = useState<string>(localPath || '');
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'editor' | 'terminal' | 'split'>('split');

  const fetchTree = async () => {
    setIsLoadingTree(true);
    try {
      const res = await fetch(`/api/opencode/${encodeURIComponent(projectId)}/tree`);
      if (res.ok) {
        const data = await res.json();
        setTree(data.tree || []);
        setRootPath(data.rootPath || '');
      }
    } catch (err) {
      console.error('Failed to load project tree:', err);
    } finally {
      setIsLoadingTree(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, [projectId]);

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const handleSelectFile = async (filePath: string) => {
    setSelectedFile(filePath);
    try {
      const res = await fetch(
        `/api/opencode/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(filePath)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content);
      }
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      await fetch(`/api/opencode/${encodeURIComponent(projectId)}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile, content: fileContent }),
      });
    } catch (err) {
      console.error('Failed to save file:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
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
      case 'yml':
      case 'yaml':
        return 'yaml';
      default:
        return 'plaintext';
    }
  };

  const renderTree = (nodes: FileNode[]) => {
    return nodes.map((node) => {
      const isDir = node.type === 'directory';
      const isExpanded = !!expandedDirs[node.path];
      const isSelected = selectedFile === node.path;

      return (
        <div key={node.path} className="text-xs font-mono">
          <div
            onClick={() => (isDir ? toggleDir(node.path) : handleSelectFile(node.path))}
            className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded select-none ${
              isSelected
                ? 'bg-surface-tertiary text-text-primary font-semibold'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            {isDir ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0 text-text-tertiary" />
                )}
                <Folder className="size-3.5 shrink-0 text-amber-400" />
              </>
            ) : (
              <>
                <span className="w-3.5" />
                <FileCode className="size-3.5 shrink-0 text-sky-400" />
              </>
            )}
            <span className="truncate">{node.name}</span>
          </div>
          {isDir && isExpanded && node.children && (
            <div className="pl-3.5 border-l border-border-light ml-2">
              {renderTree(node.children)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex h-full w-full rounded-2xl border border-border-light bg-surface-secondary overflow-hidden shadow-sm">
      {/* Left: Project Directory Explorer Tree */}
      <div className="w-64 border-r border-border-light flex flex-col bg-surface-primary shrink-0">
        <div className="flex items-center justify-between p-3 border-b border-border-light">
          <div className="flex items-center gap-1.5 truncate">
            <Folder className="size-4 text-amber-500 shrink-0" />
            <span className="font-semibold text-xs text-text-primary truncate" title={rootPath}>
              {projectName}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={fetchTree}
            className="size-6 text-text-secondary hover:text-text-primary"
            title="Refresh Explorer"
          >
            <RotateCw className="size-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingTree ? (
            <div className="flex justify-center p-4">
              <Spinner className="size-4 text-text-secondary" />
            </div>
          ) : tree.length > 0 ? (
            renderTree(tree)
          ) : (
            <div className="p-3 text-center text-xs text-text-secondary">
              No files found in mapped folder.
            </div>
          )}
        </div>

        {rootPath && (
          <div className="p-2 border-t border-border-light text-[10px] text-text-secondary truncate font-mono" title={rootPath}>
            {rootPath}
          </div>
        )}
      </div>

      {/* Right: Code Viewer / Editor & OpenCode Terminal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Workspace Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-light bg-surface-primary">
          <div className="flex items-center gap-2 truncate">
            {selectedFile ? (
              <>
                <FileCode className="size-4 text-sky-400 shrink-0" />
                <span className="text-xs font-mono font-medium text-text-primary truncate">
                  {selectedFile.split(/[\\/]/).pop()}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveFile}
                  disabled={isSaving}
                  className="h-7 text-xs px-2 gap-1 ml-2"
                >
                  <Save className="size-3" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <span className="text-xs text-text-secondary">Select a file to inspect or edit</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={activeTab === 'editor' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('editor')}
              className="h-7 text-xs px-2 gap-1"
            >
              <Code2 className="size-3" />
              Editor
            </Button>
            <Button
              type="button"
              variant={activeTab === 'terminal' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('terminal')}
              className="h-7 text-xs px-2 gap-1"
            >
              <TerminalIcon className="size-3" />
              Terminal
            </Button>
            <Button
              type="button"
              variant={activeTab === 'split' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('split')}
              className="h-7 text-xs px-2 gap-1"
            >
              Split View
            </Button>
          </div>
        </div>

        {/* Content View Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
          {(activeTab === 'editor' || activeTab === 'split') && (
            <div className={activeTab === 'split' ? 'h-1/2 min-h-0 border-b border-border-light' : 'h-full min-h-0'}>
              {selectedFile ? (
                <MonacoEditor
                  height="100%"
                  language={getLanguage(selectedFile)}
                  value={fileContent}
                  onChange={(val) => setFileContent(val || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-text-tertiary text-xs">
                  Choose a file from the explorer to view and edit code
                </div>
              )}
            </div>
          )}

          {(activeTab === 'terminal' || activeTab === 'split') && (
            <div className={activeTab === 'split' ? 'h-1/2 min-h-0 p-2 bg-surface-secondary' : 'h-full min-h-0 p-2 bg-surface-secondary'}>
              <OpenCodeTerminal
                projectId={projectId}
                projectPath={rootPath}
                className="h-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
