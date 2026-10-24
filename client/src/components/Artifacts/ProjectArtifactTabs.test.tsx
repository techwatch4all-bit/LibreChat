import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { render, fireEvent } from '@testing-library/react';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react/unstyled';
import type { Artifact } from '~/common';
import { PROJECT_ARTIFACT_TYPE } from '~/utils/artifacts';
import ProjectArtifactTabs from './ProjectArtifactTabs';

/**
 * Component-level end-to-end smoke test for the VibeCoder multi-file project
 * artifact -> IDE render path.
 *
 * It exercises the real data pipeline -- `useArtifactProps` ->
 * `parseProjectManifest` -> `sharedFiles` merge -> `SandpackProvider` -- while
 * stubbing only the Sandpack pane primitives (which require an iframe host that
 * jsdom cannot provide) and the localized label lookup. Asserting that the
 * manifest file map reaches `SandpackProvider.files` and that the file-tree,
 * code-editor and live-preview panes all mount is the synthetic substitute for
 * a live model call returning a `:::`artifact{type="application/vnd.librechat.project"}`
 * directive, which is how VibeCoder populates the panel in the browser.
 */

/* Captures the `files` map handed to SandpackProvider. */
let capturedFiles: Record<string, string> | null = null;

jest.mock('@codesandbox/sandpack-react/unstyled', () => {
  const ReactModule = jest.requireActual('react');
  const stub = (testId: string) =>
    ReactModule.forwardRef((_props: unknown, _ref: React.Ref<object>) =>
      ReactModule.createElement('div', { 'data-testid': testId }),
    );
  return {
	    SandpackProvider: (props: Record<string, unknown>) => {
	      capturedFiles = (props as { files?: Record<string, string> }).files ?? null;
	      const child = (props as { children?: unknown }).children;
	      return ReactModule.createElement('div', { 'data-testid': 'sandpack-provider' }, child);
	    },
    SandpackFileExplorer: stub('sandpack-file-explorer'),
    SandpackCodeEditor: stub('sandpack-code-editor'),
    SandpackPreview: stub('sandpack-preview'),
  };
});

/* Keep ThemeContext (and the rest of the real barrel) live so the real
 * `useArtifactProps` -> `ThemeContext` path works; only stub `Button`. */
jest.mock('@librechat/client', () => {
  const ReactModule = jest.requireActual('react');
  const actual = jest.requireActual('@librechat/client');
  return {
    ...actual,
    Button: (props) =>
      ReactModule.createElement(
        'button',
        { type: props.type, onClick: props.onClick, 'aria-label': props['aria-label'] },
        props.children,
      ),
  };
});

jest.mock('~/Providers', () => ({
  useShareContext: () => ({ shareId: undefined }),
}));

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({ data: {} }),
  useGetSharedStartupConfig: () => ({ data: {} }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

const manifest = [
  '===FILE: package.json===',
  '{ "name": "quiz-app", "dependencies": { "react": "^18.0.0" } }',
  '===FILE: App.tsx===',
  "import React from 'react'; export default function App() { return <div /> }",
  '===FILE: src/lib/Button.tsx===',
  'export default function Button() { return null }',
].join('\n');

const projectArtifact: Artifact = {
  id: 'vibe-1',
  type: PROJECT_ARTIFACT_TYPE,
  title: 'quiz-app',
  content: manifest,
  lastUpdateTime: 1,
};

describe('ProjectArtifactTabs IDE render (VibeCoder)', () => {
  let dispatch: jest.Mock;
  let previewRef: React.MutableRefObject<SandpackPreviewRef>;

  beforeEach(() => {
    capturedFiles = null;
    dispatch = jest.fn();
    previewRef = {
      current: { getClient: () => ({ dispatch }) },
    } as unknown as React.MutableRefObject<SandpackPreviewRef>;
  });

  function renderProject() {
    return render(
      <Tabs.Root value="preview">
        <ProjectArtifactTabs artifact={projectArtifact} previewRef={previewRef} />
      </Tabs.Root>,
    );
  }

  it('parses the manifest into a file map and mounts the IDE panes', () => {
    const { getByTestId, getByRole } = renderProject();

    /* The manifest was parsed and flowed through to the Sandpack provider. */
    expect(capturedFiles).not.toBeNull();
    expect(capturedFiles!['/package.json']).toContain('"quiz-app"');
    expect(capturedFiles!['/App.tsx']).toContain('export default function App()');
    expect(capturedFiles!['/src/lib/Button.tsx']).toContain('export default function Button()');

    /* All three IDE panes mount: file tree, code editor, live preview. */
    expect(getByTestId('sandpack-file-explorer')).toBeTruthy();
    expect(getByTestId('sandpack-code-editor')).toBeTruthy();
    expect(getByTestId('sandpack-preview')).toBeTruthy();

    /* The Run affordance is surfaced and labelled with the localized key. */
    expect(getByRole('button', { name: 'com_ui_run' })).toBeTruthy();
  });

  it('wires the Run button to the Sandpack preview client refresh', () => {
    const { getByRole } = renderProject();
    fireEvent.click(getByRole('button', { name: 'com_ui_run' }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'refresh' });
  });
});
