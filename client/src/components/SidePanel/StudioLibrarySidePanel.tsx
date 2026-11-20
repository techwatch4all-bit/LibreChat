/* eslint-disable i18next/no-literal-string */
/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo, useState, useEffect, useCallback } from 'react';
import { Button } from '@librechat/client';
import { useSetRecoilState, useRecoilState } from 'recoil';
import {
  X,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Film,
  Image as ImageIcon,
  FileText,
  Sliders,
} from 'lucide-react';
import type { Artifact } from '~/common';
import store from '~/store';

interface MediaItem {
  name: string;
  kind?: string;
  url: string;
  thumb?: string;
  download?: string;
  created?: string;
  size?: number;
  user?: string;
}

const StudioLibrarySidePanel = memo(function StudioLibrarySidePanel() {
  const setShowStudioLibrary = useSetRecoilState(store.showStudioLibraryPanel);
  const setArtifactsVisibility = useSetRecoilState(store.artifactsVisibility);
  const setCurrentArtifactId = useSetRecoilState(store.currentArtifactId);
  const [artifacts, setArtifacts] = useRecoilState(store.artifactsState);
  const [visibleArtifacts, setVisibleArtifacts] = useRecoilState(store.visibleArtifacts);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'document'>('all');
  const [loading, setLoading] = useState(true);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const openInFilmStudio = useCallback(async (item: MediaItem) => {
    const cleanName = item.name.replace(/[^a-zA-Z0-9_-]/g, '') || 'StudioProject';
    try {
      const res = await fetch(
        `/api/openfilm/project-sync?name=${encodeURIComponent(cleanName)}&media=${encodeURIComponent(item.url)}`,
      );
      const data = await res.json();
      if (data.studioUrl) {
        window.open(data.studioUrl, '_blank');
        return;
      }
    } catch (e) {
      console.warn('Direct project-sync redirect failed, opening default studio', e);
    }
    window.open('/projects/DawnValley', '_blank');
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let data: { items?: MediaItem[] } = {};
      const r = await fetch('/api/studio/library', { credentials: 'include' });
      if (r.ok) {
        data = await r.json();
      } else {
        const fallback = await fetch('/generated/manifest.json');
        if (fallback.ok) {
          const raw = await fallback.json();
          data = { items: raw };
        }
      }
      const loaded = data.items || [];
      loaded.forEach((it) => {
        it.kind = it.kind || (it.url?.match(/\.(mp4|webm)$/i) ? 'video' : 'image');
      });
      setItems(loaded);
    } catch {
      try {
        const fallback = await fetch('/generated/manifest.json');
        if (fallback.ok) {
          const raw = await fallback.json();
          setItems(raw || []);
        }
      } catch {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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
            onClick={() => window.open('/studio-library.html', '_blank')}
            title="Open Fullscreen Gallery"
            aria-label="Open Fullscreen Gallery"
          >
            <ExternalLink className="h-3.5 w-3.5" />
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

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border-light bg-surface-secondary/40 px-3 py-1.5 text-xs">
        {(['all', 'video', 'image', 'document'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              filter === k
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:bg-surface-active hover:text-text-primary'
            }`}
          >
            {k === 'all' && 'All'}
            {k === 'video' && 'Videos'}
            {k === 'image' && 'Images'}
            {k === 'document' && 'Docs'}
          </button>
        ))}
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
              const isVideo = it.kind === 'video' || it.url.match(/\.(mp4|webm)$/i);
              const sizeMB = it.size ? (it.size / (1024 * 1024)).toFixed(1) + ' MB' : '';
              return (
                <div
                  key={it.name}
                  className="hover:border-primary/50 group relative flex flex-col overflow-hidden rounded-lg border border-border-light bg-surface-secondary/60 transition-all"
                >
                  {/* Media preview */}
                  <div
                    className="group/media relative aspect-video w-full cursor-pointer bg-black/40"
                    onClick={() => openInFilmStudio(it)}
                    title="Click to open in Film Studio Editor"
                  >
                    {isVideo ? (
                      <video
                        src={it.url}
                        poster={it.thumb}
                        preload="metadata"
                        muted
                        className="h-full w-full object-cover transition-transform group-hover/media:scale-105"
                      />
                    ) : (
                      <img
                        src={it.thumb || it.url}
                        alt={it.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover/media:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/media:opacity-100">
                      <div className="backdrop-blur-xs flex items-center gap-1.5 rounded-full bg-purple-600/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                        <Film className="h-3.5 w-3.5" />
                        <span>Open in Studio</span>
                      </div>
                    </div>
                    <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                      {it.kind || 'media'}
                    </span>
                  </div>

                  {/* Metadata & Actions */}
                  <div className="flex flex-col gap-1 p-2">
                    <span
                      className="cursor-pointer truncate text-[11px] font-medium text-text-primary hover:text-purple-400"
                      title={it.name}
                      onClick={() => openInFilmStudio(it)}
                    >
                      {it.name}
                    </span>
                    <div className="flex items-center justify-between text-[10px] text-text-secondary">
                      <span>{sizeMB}</span>
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
    </div>
  );
});

export default StudioLibrarySidePanel;
