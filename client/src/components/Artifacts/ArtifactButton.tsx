import { useEffect, useRef } from 'react';
import debounce from 'lodash/debounce';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useSetRecoilState, useResetRecoilState } from 'recoil';
import { Film, Play, Sliders, ExternalLink, Sparkles } from 'lucide-react';
import type { Artifact } from '~/common';
import ArtifactRow from '~/components/Chat/Messages/Content/Parts/ArtifactRow';
import { artifactRowKind } from '~/utils/artifacts';
import { logger, isArtifactRoute } from '~/utils';
import { isFilmArtifact } from './OpenFilm';
import store from '~/store';

const ArtifactButton = ({ artifact }: { artifact: Artifact | null }) => {
  const location = useLocation();
  const setVisible = useSetRecoilState(store.artifactsVisibility);
  const [artifacts, setArtifacts] = useRecoilState(store.artifactsState);
  const [currentArtifactId, setCurrentArtifactId] = useRecoilState(store.currentArtifactId);
  const resetCurrentArtifactId = useResetRecoilState(store.currentArtifactId);
  const isSelected = artifact?.id === currentArtifactId;
  const [visibleArtifacts, setVisibleArtifacts] = useRecoilState(store.visibleArtifacts);

  const debouncedSetVisibleRef = useRef(
    debounce((artifactToSet: Artifact) => {
      logger.log(
        'artifacts_visibility',
        'Setting artifact to visible state from Artifact button',
        artifactToSet,
      );
      setVisibleArtifacts((prev) => ({
        ...prev,
        [artifactToSet.id]: artifactToSet,
      }));
    }, 750),
  );

  useEffect(() => {
    if (artifact == null || artifact?.id == null || artifact.id === '') {
      return;
    }

    if (!isArtifactRoute(location.pathname)) {
      return;
    }

    const debouncedSetVisible = debouncedSetVisibleRef.current;
    debouncedSetVisible(artifact);
    return () => {
      debouncedSetVisible.cancel();
    };
  }, [artifact, location.pathname]);

  if (artifact === null || artifact === undefined) {
    return null;
  }

  const handleOpen = () => {
    if (isSelected) {
      resetCurrentArtifactId();
      setVisible(false);
      return;
    }

    setCurrentArtifactId(artifact.id);
    setVisible(true);

    const merged = { ...(visibleArtifacts ?? {}), ...(artifacts ?? {}), [artifact.id]: artifact };
    setArtifacts(merged);
    setVisibleArtifacts(merged);
  };

  const isFilm = isFilmArtifact(artifact.type, artifact.content);

  // If this is an OpenFilm / Motion Studio project, render a prominent, unmissable interactive Studio Card
  if (isFilm) {
    return (
      <div className="my-3 w-full max-w-2xl overflow-hidden rounded-xl border border-purple-500/40 bg-gradient-to-br from-slate-950 via-[#0e1326] to-[#150d2a] p-4 shadow-xl ring-1 ring-purple-500/20 transition-all hover:border-purple-400/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-purple-400/30 bg-purple-600/20 text-purple-300 shadow-inner">
              <Film className="size-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-purple-300 uppercase border border-purple-500/30">
                  OpenFilm 4-Editor Suite
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ready to Edit
                </span>
              </div>
              <h4 className="mt-1 font-semibold text-sm text-slate-100 line-clamp-1">
                {artifact.title || 'Dawn Valley — A Living Landscape'}
              </h4>
              <p className="text-xs text-slate-400 line-clamp-1">
                Full Screening, Timeline Edit, Planning Canvas, Color Wheel & Shared Library
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handleOpen}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-xs transition-all shadow-md active:scale-95 ${
                isSelected
                  ? 'bg-purple-700 text-white ring-2 ring-purple-400'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 hover:shadow-purple-500/25 ring-1 ring-purple-400/40'
              }`}
            >
              {isSelected ? (
                <>
                  <Sliders className="size-3.5" />
                  <span>Viewing Studio</span>
                </>
              ) : (
                <>
                  <Play className="size-3.5 fill-current" />
                  <span>Launch Studio & Edit</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* Model-authored artifacts have no file behind them — the panel's own
   * `DownloadArtifact` serializes the (possibly edited) content, which
   * needs the editor context this row doesn't sit in. */
  return (
    <ArtifactRow
      title={artifact.title ?? ''}
      kind={artifactRowKind(artifact)}
      isSelected={isSelected}
      onOpen={handleOpen}
      artifactId={artifact.id}
    />
  );
};

export default ArtifactButton;
