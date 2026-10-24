import { useMemo, useState } from 'react';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@librechat/client';
import {
  SandpackProvider,
  SandpackFileExplorer,
  SandpackCodeEditor,
  SandpackPreview,
} from '@codesandbox/sandpack-react/unstyled';
import * as Tabs from '@radix-ui/react-tabs';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react/unstyled';
import type { Artifact } from '~/common';
import { useGetSharedStartupConfig, useGetStartupConfig } from '~/data-provider';
import { useShareContext } from '~/Providers';
import { useLocalize } from '~/hooks';
import useArtifactProps from '~/hooks/Artifacts/useArtifactProps';
import {
  buildSandpackOptions,
  sharedFiles,
  standardDependencies,
  isProjectArtifact,
} from '~/utils/artifacts';

/** Width of the collapsible file-panel in the IDE. */
const EXPLORER_WIDTH = 232;

export default function ProjectArtifactTabs({
  artifact,
  previewRef,
  isSharedConvo,
}: {
  artifact: Artifact;
  previewRef: React.MutableRefObject<SandpackPreviewRef>;
  isSharedConvo?: boolean;
}) {
  const localize = useLocalize();
  const { shareId } = useShareContext();
  const shouldUseSharedConfig =
    isSharedConvo === true && typeof shareId === 'string' && shareId.length > 0;
  const { data: startupConfig } = useGetStartupConfig({ enabled: !shouldUseSharedConfig });
  const { data: sharedStartupConfig } = useGetSharedStartupConfig(shareId, {
    enabled: shouldUseSharedConfig,
  });
  const resolvedStartupConfig = shouldUseSharedConfig ? sharedStartupConfig : startupConfig;

  const { files, template, sharedProps } = useArtifactProps({ artifact });
  const [explorerOpen, setExplorerOpen] = useState(true);

  /* Merge the model-authored package.json dependency list with the shadcn
   * runtime baseline (`standardDependencies`) so the shared UI components
   * injected by `sharedFiles` (`/components/ui/*`, `/lib/utils.ts`) always
   * resolve — even when an author's package.json omits them. The manifest's
   * own versions win on conflict; the baseline fills the gaps. */
  const customSetupDependencies = useMemo(() => {
    const pkg = files['/package.json'];
    let manifestDeps: Record<string, string> = {};
    if (typeof pkg === 'string' && pkg.trim().length > 0) {
      try {
        const parsed = JSON.parse(pkg);
        manifestDeps = {
          ...(parsed.dependencies ?? {}),
          ...(parsed.devDependencies ?? {}),
        };
      } catch {
        /* Non-JSON package.json: fall back to the baseline only. The
         * sandbox will still boot; the author's deps simply won't be
         * present until they ship a valid manifest. */
      }
    }
    return { ...standardDependencies, ...manifestDeps };
  }, [files]);

  const customSetup = useMemo(
    () => ({ customSetup: { dependencies: customSetupDependencies } }),
    [customSetupDependencies],
  );

  const options = useMemo(
    () => buildSandpackOptions(template, resolvedStartupConfig),
    [template, resolvedStartupConfig],
  );

  /* `sharedFiles` provides the Tailwind CDN shell, shadcn components and
   * `/lib/utils.ts` helper. Manifest files take precedence over the
   * shared defaults (e.g. an author-provided index.html wins), while the
   * shared scaffolding fills any gaps the manifest left open. */
  const mergedFiles = useMemo(() => {
    const base: Record<string, string> = { ...sharedFiles };
    for (const [key, value] of Object.entries(files)) {
      if (value != null) {
        base[key] = value;
      }
    }
    return base;
  }, [files]);

  const readOnly = isSharedConvo === true;

  const handleRun = () => {
    const client = previewRef.current?.getClient();
    if (client) {
      client.dispatch({ type: 'refresh' });
    }
  };

  if (!isProjectArtifact(artifact.type) || Object.keys(files).length === 0) {
    return null;
  }

  return (
    <Tabs.Content
      value="preview"
      id="artifacts-project"
      className="h-full w-full flex-grow overflow-hidden"
      tabIndex={-1}
    >
        <SandpackProvider
          files={mergedFiles}
          template={template}
          options={options}
          {...sharedProps}
          {...customSetup}
        >
        <div className="flex h-full w-full flex-col">
          <div className="flex h-11 flex-shrink-0 items-center justify-between gap-2 border-b border-border-light bg-surface-primary-alt px-2">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-1"
                onClick={() => setExplorerOpen((o) => !o)}
                aria-label={explorerOpen ? localize('com_ui_collapse') : localize('com_ui_expand')}
              >
                {explorerOpen ? (
                  <ChevronLeft className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </Button>
              <span className="text-sm font-medium text-text-secondary">
                {localize('com_ui_artifact_format_project')} IDE
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-7 gap-1"
              onClick={handleRun}
              aria-label={localize('com_ui_run')}
            >
              <Play className="size-4" />
              {localize('com_ui_run')}
            </Button>
          </div>
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div
              className="border-r border-border-light min-h-0 overflow-y-auto bg-surface-primary-alt"
              style={{ width: explorerOpen ? EXPLORER_WIDTH : 0 }}
            >
              {explorerOpen && (
                <SandpackFileExplorer
                  autoHiddenFiles
                  initialCollapsedFolder={[]}
                  className="h-full"
                />
              )}
            </div>
            <SandpackCodeEditor
              readOnly={readOnly}
              showInlineErrors
              showLineNumbers
              className="h-full min-w-0 flex-1"
            />
            <SandpackPreview
              ref={previewRef}
              showOpenInCodeSandbox={false}
              showRefreshButton={false}
              showOpenNewtab={false}
              className="h-full min-w-0 flex-1"
              tabIndex={0}
            />
          </div>
        </div>
      </SandpackProvider>
    </Tabs.Content>
  );
}
