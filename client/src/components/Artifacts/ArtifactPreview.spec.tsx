import React from 'react';
import { render, screen } from '@testing-library/react';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react/unstyled';
import { ArtifactPreview } from './ArtifactPreview';

jest.mock('@codesandbox/sandpack-react/unstyled', () => ({
  SandpackProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sandpack-provider">{children}</div>
  ),
  SandpackPreview: () => <div data-testid="sandpack-preview" />,
}));

describe('ArtifactPreview', () => {
  it('renders static HTML directly in a sandboxed srcDoc iframe without Sandpack', () => {
    const previewRef = {
      current: undefined,
    } as unknown as React.MutableRefObject<SandpackPreviewRef>;
    render(
      <ArtifactPreview
        files={{ '/index.html': '<html><head><title>Test</title></head><body>Hi</body></html>' }}
        fileKey="/index.html"
        template="static"
        sharedProps={{}}
        previewRef={previewRef}
      />,
    );

    const iframe = screen.getByTitle('Artifact Preview') as HTMLIFrameElement;
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-scripts allow-downloads allow-popups allow-forms',
    );
    expect(iframe.getAttribute('srcdoc')).toContain(`<base href="${window.location.origin}/">`);
    expect(screen.queryByTestId('sandpack-provider')).toBeNull();
  });

  it('uses SandpackProvider for non-static templates', () => {
    const previewRef = {
      current: undefined,
    } as unknown as React.MutableRefObject<SandpackPreviewRef>;
    render(
      <ArtifactPreview
        files={{ '/App.tsx': 'export default () => <div />;' }}
        fileKey="/App.tsx"
        template="react-ts"
        sharedProps={{}}
        previewRef={previewRef}
      />,
    );

    expect(screen.getByTestId('sandpack-provider')).toBeInTheDocument();
    expect(screen.queryByTitle('Artifact Preview')).toBeNull();
  });
});
