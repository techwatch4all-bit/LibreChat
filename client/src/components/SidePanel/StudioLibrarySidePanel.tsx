/* eslint-disable i18next/no-literal-string */
/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo, useState, useEffect, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { Button } from '@librechat/client';
import { request } from 'librechat-data-provider';
import { useSetRecoilState, useRecoilState } from 'recoil';
import {
  X,
  RefreshCw,
  Copy,
  Check,
  Cloud,
  Film,
  FileText,
  Music,
  Sliders,
  Trash2,
  HardDrive,
} from 'lucide-react';
import type { Artifact } from '~/common';
import { cloudDriveSessionsAtom } from '~/components/Projects/opencode/atoms';
import CloudDriveModal from '~/components/Projects/opencode/CloudDriveModal';
import store from '~/store';

interface MediaItem {
  id?: string;
  name: string;
  kind?: string;
  url: string;
  thumb?: string;
  download?: string;
  created?: string;
  size?: number;
  user?: string;
}

interface StorageInfo {
  usedBytes: number;
  quotaBytes: number;
  availableBytes: number;
  quotaMb: number;
}

function formatBytes(bytes: number): string {
  if (!bytes || Number.isNaN(bytes) || bytes <= 0) return '0 MB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 1 : 2)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 0.1) return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const StudioLibrarySidePanel = memo(function StudioLibrarySidePanel() {
  const setShowStudioLibrary = useSetRecoilState(store.showStudioLibraryPanel);
  const setArtifactsVisibility = useSetRecoilState(store.artifactsVisibility);
  const setCurrentArtifactId = useSetRecoilState(store.currentArtifactId);
  const [artifacts, setArtifacts] = useRecoilState(store.artifactsState);
  const [visibleArtifacts, setVisibleArtifacts] = useRecoilState(store.visibleArtifacts);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'audio' | 'document'>('all');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [showCloudDriveModal, setShowCloudDriveModal] = useState(false);
  const cloudDriveSessions = useAtomValue(cloudDriveSessionsAtom);
  const isDriveConnected = Boolean(
    (cloudDriveSessions.google_drive && cloudDriveSessions.google_drive.expiresAt > Date.now()) ||
      (cloudDriveSessions.onedrive && cloudDriveSessions.onedrive.expiresAt > Date.now()),
  );

  const openInFilmStudio = useCallback((item: MediaItem) => {
    const isVideo = item.kind === 'video' || Boolean(item.url?.match(/\.(mp4|webm)$/i));
    const artifactId = `studio-${item.name.replace(/[^a-zA-Z0-9_-]/g, '') || Date.now()}`;
    const cleanTitle = item.name.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[_-]/g, ' ') || 'Studio Deliverable';

    const contentHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
    ${isVideo ? 'video { max-width: 100%; max-height: 100%; object-fit: contain; }' : 'img { max-width: 100%; max-height: 100%; object-fit: contain; }'}
  </style>
</head>
<body>
  ${
    isVideo
      ? `<video src="${item.url}" ${item.thumb ? `poster="${item.thumb}"` : ''} controls autoplay playsinline loop></video>`
      : `<img src="${item.url}" alt="${item.name}" />`
  }
  <script>
    window.film = {
      duration: 10.0,
      fps: 30,
      width: 1920,
      height: 1080,
      frame: function(t) {},
      setMuted: function(m) {}
    };
  </script>
</body>
</html>`;

    // Stage artifact into LibreChat's native side-panel
    setArtifacts((prev) => ({
      ...(prev || {}),
      [artifactId]: {
        id: artifactId,
        title: cleanTitle,
        type: 'application/vnd.satchida.film',
        content: contentHtml,
        lastUpdateTime: Date.now(),
      },
    }));
    setCurrentArtifactId(artifactId);
    setArtifactsVisibility(true);
    // Dismiss library panel so the editor artifact immediately takes focus in-place
    setShowStudioLibrary(false);
  }, [setArtifacts, setCurrentArtifactId, setArtifactsVisibility, setShowStudioLibrary]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request.get<{ items?: MediaItem[]; storage?: StorageInfo }>(
        '/api/user/storage/items',
      );
      const loaded = Array.isArray(data?.items) ? data.items : [];
      loaded.forEach((it) => {
        it.kind = it.kind || (it.url?.match(/\.(mp4|webm)$/i) ? 'video' : 'image');
      });
      setItems(loaded);
      if (data?.storage) {
        setStorage(data.storage);
      }
      setSelectedIds(new Set());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0 || deleting) return;
    const count = selectedIds.size;
    if (
      !window.confirm(
        `Permanently delete ${count} selected file${count > 1 ? 's' : ''} from your storage library?`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await request.post<{ success?: boolean; storage?: StorageInfo }>(
        '/api/user/storage/delete',
        { ids },
      );
      if (res?.success) {
        const removed = new Set(ids);
        setItems((prev) => prev.filter((it) => !removed.has(it.id || it.name)));
        setSelectedIds(new Set());
        if (res.storage) {
          setStorage(res.storage);
        }
      }
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, deleting]);

  const copyForPrompt = (name: string) => {
    navigator.clipboard.writeText(`"${name}"`);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2000);
  };

  const filtered = items.filter((it) => filter === 'all' || it.kind === filter);

  return (
    <div className="flex h-full w-full flex-col bg-surface-primary text-text-primary">
      {/* Header bar */}
      <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border-light px-3">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Film className="text-primary h-4 w-4" />
          <span className="text-xs font-semibold tracking-wide">Studio Library</span>
          <span className="rounded bg-surface-active px-1.5 py-0.5 text-[10px] text-text-secondary">
            {items.length} items
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1 px-2 text-[11px] ${
              isDriveConnected
                ? 'text-emerald-500 hover:text-emerald-400'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setShowCloudDriveModal(true)}
            title="Sync Studio Library with Cloud Drive"
            aria-label="Cloud Drive"
          >
            <Cloud className="h-3.5 w-3.5" />
            <span>Drive</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-secondary hover:text-text-primary"
            onClick={fetchItems}
            title="Refresh items"
            aria-label="Refresh items"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-secondary hover:text-text-primary"
            onClick={() => setShowStudioLibrary(false)}
            title="Close Panel"
            aria-label="Close Panel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Storage usage bar */}
      {storage && (() => {
        const usedPct =
          storage.quotaBytes > 0
            ? Math.min(100, Math.round((storage.usedBytes / storage.quotaBytes) * 100))
            : 0;
        const textColor =
          usedPct >= 90 ? 'text-red-500' : usedPct >= 70 ? 'text-amber-500' : 'text-emerald-500';
        const barColor =
          usedPct >= 90 ? '#ef4444' : usedPct >= 70 ? '#f59e0b' : '#10b981';
        return (
          <div className="border-b border-border-light bg-surface-secondary/30 px-3 py-2 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 font-medium text-text-secondary">
                <HardDrive className={`h-3 w-3 ${textColor}`} />
                {formatBytes(storage.usedBytes)} /{' '}
                {storage.quotaMb >= 1024
                  ? `${(storage.quotaMb / 1024).toFixed(0)} GB`
                  : `${storage.quotaMb} MB`}{' '}
                ({usedPct}%)
              </span>
              <span className={`font-semibold ${textColor}`}>
                {formatBytes(storage.availableBytes)} free
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-tertiary">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${usedPct}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* Filter tabs + Delete Selected action */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border-light bg-surface-secondary/40 px-3 py-1.5 text-xs">
        <div className="flex flex-wrap gap-1">
          {(['all', 'video', 'image', 'audio', 'document'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                filter === k
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:bg-surface-active hover:text-text-primary'
              }`}
            >
              {k === 'all' && 'All'}
              {k === 'video' && 'Videos'}
              {k === 'image' && 'Images'}
              {k === 'audio' && 'Audio'}
              {k === 'document' && 'Docs'}
            </button>
          ))}
        </div>
        {selectedIds.size > 0 && (
          <button
            type="button"
            disabled={deleting}
            onClick={handleDeleteSelected}
            className="inline-flex items-center gap-1 rounded-md border border-red-500/60 bg-red-500/15 px-2 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/25 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            <span>{deleting ? 'Deleting…' : `Delete (${selectedIds.size})`}</span>
          </button>
        )}
      </div>

      {/* Grid container */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && items.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-text-secondary">
            Loading your creations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-1 text-center text-xs text-text-secondary">
            <span>No {filter === 'all' ? 'creations' : filter + 's'} found.</span>
            <span className="text-[11px] opacity-70">Generate one using Film Studio!</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((it) => {
              const itemId = it.id || it.name;
              const isSelected = selectedIds.has(itemId);
              const isVideo = it.kind === 'video' || Boolean(it.url.match(/\.(mp4|webm)$/i));
              const isAudio = it.kind === 'audio';
              const isDoc = it.kind === 'document';
              const sizeLabel = it.size ? formatBytes(it.size) : '';
              return (
                <div
                  key={itemId}
                  className={`group relative flex flex-col overflow-hidden rounded-lg border bg-surface-secondary/60 transition-all ${
                    isSelected
                      ? 'border-red-400/70 ring-1 ring-red-400/40'
                      : 'border-border-light hover:border-primary/50'
                  }`}
                >
                  {/* Media preview */}
                  <div
                    className="group/media relative aspect-video w-full cursor-pointer bg-black/40"
                    onClick={() => (!isAudio && !isDoc ? openInFilmStudio(it) : toggleSelect(itemId))}
                    title={isAudio || isDoc ? 'Click to select' : 'Click to open in Film Studio Editor'}
                  >
                    {isVideo ? (
                      <video
                        src={it.url}
                        poster={it.thumb}
                        preload="metadata"
                        muted
                        className="h-full w-full object-cover transition-transform group-hover/media:scale-105"
                      />
                    ) : isAudio ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-text-secondary">
                        <Music className="h-6 w-6 text-sky-400" />
                        <audio src={it.url} controls className="h-7 w-full" onClick={(e) => e.stopPropagation()} />
                      </div>
                    ) : isDoc ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-text-secondary">
                        <FileText className="h-6 w-6 text-amber-400" />
                        <span className="max-w-full truncate text-[10px]">{it.name}</span>
                      </div>
                    ) : (
                      <img
                        src={it.thumb || it.url}
                        alt={it.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover/media:scale-105"
                      />
                    )}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(itemId)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${it.name}`}
                      className="absolute right-1.5 top-1.5 z-10 h-4 w-4 cursor-pointer rounded accent-red-500"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                      {it.kind || 'media'}
                    </span>
                  </div>

                  {/* Metadata & Actions */}
                  <div className="flex flex-col gap-1 p-2">
                    <span
                      className="cursor-pointer truncate text-[11px] font-medium text-text-primary hover:text-purple-400"
                      title={it.name}
                      onClick={() => (!isAudio && !isDoc ? openInFilmStudio(it) : toggleSelect(itemId))}
                    >
                      {it.name}
                    </span>
                    <div className="flex items-center justify-between text-[10px] text-text-secondary">
                      <span>{sizeLabel}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openInFilmStudio(it)}
                          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium text-purple-400 hover:bg-purple-950/40 hover:text-purple-300"
                          title="Open Film Studio editor"
                        >
                          <Sliders className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => copyForPrompt(it.name)}
                          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:bg-surface-active hover:text-text-primary"
                          title="Copy file name to reference in chat"
                        >
                          {copiedName === it.name ? (
                            <>
                              <Check className="h-3 w-3 text-green-500" />
                              <span className="text-green-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <a
                          href={it.url}
                          download
                          className="text-primary rounded px-1.5 py-0.5 hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showCloudDriveModal ? (
        <CloudDriveModal
          studioItems={(selectedIds.size > 0
            ? items.filter((it) => selectedIds.has(it.id || it.name))
            : filtered
          ).map((it) => ({
            id: it.id || it.name,
            name: it.name,
            url: it.url,
            kind: it.kind,
          }))}
          localPrivacyActive={false}
          onClose={() => setShowCloudDriveModal(false)}
        />
      ) : null}
    </div>
  );
});

export default StudioLibrarySidePanel;
