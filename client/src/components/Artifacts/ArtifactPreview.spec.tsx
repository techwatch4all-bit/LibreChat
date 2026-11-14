import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
    /** `allow-same-origin` stays: the vendored WebGL/canvas scripts in the 3D
     *  floor-plan artifact need a same-origin document to run against. */
    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-scripts allow-downloads allow-popups allow-forms allow-same-origin',
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

  it('inlines /assets/vendor/ scripts with same-origin credentials for Cloudflare Access compatibility', async () => {
    const previewRef = {
      current: undefined,
    } as unknown as React.MutableRefObject<SandpackPreviewRef>;
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => 'window.THREE = { ok: true };',
    }) as unknown as typeof fetch;

    try {
      render(
        <ArtifactPreview
          files={{
            '/index.html':
              '<html><head><script src="/assets/vendor/three/three.min.js"></script></head><body></body></html>',
          }}
          fileKey="/index.html"
          template="static"
          sharedProps={{}}
          previewRef={previewRef}
        />,
      );

      const iframe = (await screen.findByTitle('Artifact Preview')) as HTMLIFrameElement;
      expect(global.fetch).toHaveBeenCalledWith('/assets/vendor/three/three.min.js', {
        credentials: 'same-origin',
      });
      await waitFor(() =>
        expect(iframe.getAttribute('srcdoc')).toContain('window.THREE = { ok: true };'),
      );
      expect(iframe.getAttribute('srcdoc')).toContain(
        '<script>window.THREE = { ok: true };</script>',
      );
      expect(iframe.getAttribute('srcdoc')).not.toContain(
        'src="/assets/vendor/three/three.min.js"',
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
