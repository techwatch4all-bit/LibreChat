import React, { memo, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { SandpackPreview, SandpackProvider } from '@codesandbox/sandpack-react/unstyled';
import type {
  SandpackProviderProps,
  SandpackPreviewRef,
} from '@codesandbox/sandpack-react/unstyled';
import type { SandpackStartupConfig } from '~/utils/artifacts';
import type { ArtifactFiles } from '~/common';
import { sharedFiles, buildSandpackOptions } from '~/utils/artifacts';

const VENDOR_SCRIPT_RE =
  /<script\b[^>]*\bsrc=["'](\/assets\/vendor\/[^"']+)["'][^>]*>\s*<\/script>/gi;
const vendorScriptCache = new Map<string, string>();

async function loadVendorScript(path: string): Promise<string | null> {
  const cleanPath = path.split('?')[0];
  const cached = vendorScriptCache.get(cleanPath);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const res = await fetch(cleanPath, { credentials: 'same-origin' });
    if (!res.ok) {
      return null;
    }
    const text = await res.text();
    vendorScriptCache.set(cleanPath, text);
    return text;
  } catch {
    return null;
  }
}

function injectBaseHref(html: string, origin: string): string {
  const cleaned = html
    .replace(/:\s*\[PERSON_NAME\]/g, ': 0.0')
    .replace(/"\[PERSON_NAME\]"/g, '"Zen Minimalist"')
    .replace(/\[PERSON_NAME\]/g, '0.0');

  const patchScript = '<script>window.PERSON_NAME = 0; var PERSON_NAME = 0;</script>';
  const baseTag = origin && !/<base\s/i.test(cleaned) ? `<base href="${origin}/">` : '';
  const injection = `${baseTag}${patchScript}`;

  if (/<head(\s[^>]*)?>/i.test(cleaned)) {
    return cleaned.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${injection}`);
  }
  return `${injection}${cleaned}`;
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
  const [resolvedStaticHtml, setResolvedStaticHtml] = useState<string | null>(null);

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

  const rawStaticHtml = useMemo(() => {
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
    if (rawStaticHtml === null) {
      setResolvedStaticHtml(null);
      return;
    }

    const matches = [...rawStaticHtml.matchAll(VENDOR_SCRIPT_RE)];
    if (matches.length === 0 || typeof fetch !== 'function') {
      setResolvedStaticHtml(rawStaticHtml);
      return;
    }

    let cancelled = false;
    const paths = [...new Set(matches.map((m) => m[1]))];
    Promise.all(paths.map(async (p) => [p, await loadVendorScript(p)] as const)).then((entries) => {
      if (cancelled) {
        return;
      }
      const map = new Map(entries);
      const inlined = rawStaticHtml.replace(VENDOR_SCRIPT_RE, (full, src: string) => {
        const code = map.get(src);
        if (!code) {
          return full;
        }
        return `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`;
      });
      setResolvedStaticHtml(inlined);
    });

    return () => {
      cancelled = true;
    };
  }, [rawStaticHtml]);

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

  if (template === 'static') {
    const htmlToRender = resolvedStaticHtml ?? rawStaticHtml;
    if (!htmlToRender) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#07111f] text-sm text-slate-400">
          <span>Loading preview...</span>
        </div>
      );
    }
    return (
      <iframe
        key={staticRefreshKey}
        title="Artifact Preview"
        srcDoc={htmlToRender}
        sandbox="allow-scripts allow-downloads allow-popups allow-forms allow-same-origin"
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
