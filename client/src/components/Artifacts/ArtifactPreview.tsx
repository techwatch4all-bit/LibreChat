import React, { memo, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { SandpackPreview, SandpackProvider } from '@codesandbox/sandpack-react/unstyled';
import type {
  SandpackProviderProps,
  SandpackPreviewRef,
} from '@codesandbox/sandpack-react/unstyled';
import type { SandpackStartupConfig } from '~/utils/artifacts';
import type { ArtifactFiles } from '~/common';
import { sharedFiles, buildSandpackOptions } from '~/utils/artifacts';

function injectBaseHref(html: string, origin: string): string {
  if (!origin || /<base\s/i.test(html)) {
    return html;
  }
  const baseTag = `<base href="${origin}/">`;
  if (/<head(\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${baseTag}`);
  }
  return `${baseTag}${html}`;
}

export const ArtifactPreview = memo(function ({
  files,
  fileKey,
  template,
  sharedProps,
  previewRef,
  currentCode,
  startupConfig,
}: {
  files: ArtifactFiles;
  fileKey: string;
  template: SandpackProviderProps['template'];
  sharedProps: Partial<SandpackProviderProps>;
  previewRef: MutableRefObject<SandpackPreviewRef>;
  currentCode?: string;
  startupConfig?: SandpackStartupConfig;
}) {
  const [staticRefreshKey, setStaticRefreshKey] = useState(0);

  const artifactFiles = useMemo(() => {
    if (Object.keys(files).length === 0) {
      return files;
    }
    const code = currentCode ?? '';
    if (!code) {
      return files;
    }
    return {
      ...files,
      [fileKey]: { code },
    };
  }, [currentCode, files, fileKey]);

  const staticHtml = useMemo(() => {
    if (template !== 'static') {
      return null;
    }
    const entry = artifactFiles['/index.html'] ?? artifactFiles[fileKey];
    const raw = typeof entry === 'string' ? entry : entry?.code;
    if (!raw) {
      return null;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return injectBaseHref(raw, origin);
  }, [artifactFiles, fileKey, template]);

  useEffect(() => {
    if (template !== 'static' || !previewRef) {
      return;
    }
    previewRef.current = {
      getClient: () =>
        ({
          dispatch: (action: { type?: string }) => {
            if (action?.type === 'refresh') {
              setStaticRefreshKey((k) => k + 1);
            }
          },
        }) as ReturnType<SandpackPreviewRef['getClient']>,
    } as SandpackPreviewRef;
  }, [previewRef, template]);

  const options: SandpackProviderProps['options'] = useMemo(
    () => buildSandpackOptions(template, startupConfig),
    [startupConfig, template],
  );

  if (Object.keys(artifactFiles).length === 0) {
    return null;
  }

  if (template === 'static' && staticHtml !== null) {
    return (
      <iframe
        key={staticRefreshKey}
        title="Artifact Preview"
        srcDoc={staticHtml}
        sandbox="allow-scripts allow-downloads allow-popups allow-forms"
        className="h-full w-full border-0 bg-[#07111f]"
      />
    );
  }

  return (
    <SandpackProvider
      files={{ ...artifactFiles, ...sharedFiles }}
      options={options}
      {...sharedProps}
      template={template}
    >
      <SandpackPreview
        showOpenInCodeSandbox={false}
        showRefreshButton={false}
        tabIndex={0}
        ref={previewRef}
      />
    </SandpackProvider>
  );
});
