# sandpack-runtime vendored bundler

Mirrored from https://2-19-8-sandpack.codesandbox.io/ on 2026-11-10 (matches the
default bundler URL of the installed @codesandbox/sandpack-client 2.19.x, whose
BUNDLER_URL embeds version "2.19.8").

Patches applied on top of the upstream build:
1. Removed 3 `<link href="https://fonts.googleapis.com/...">` tags baked into the
   bundler's loading-screen templates (raw-loader string constants in
   static/js/sandbox.8a7d01a44.js) — loading screens fall back to system fonts,
   no third-party request fires.
2. webpack publicPath "/"" -> "/assets/vendor/sandpack-runtime/" in sandbox-startup.a0ea8d1cb.js and
   sandbox.8a7d01a44.js so lazy chunks (static/js/4.a87895b63.chunk.js,
   static/js/5.029c574e1.chunk.js) resolve under this prefix.
3. index.html asset URLs (src/href) rewritten from root-absolute to the same prefix.

Unchanged and inert on this origin: the devtools bridges
(codesandbox.io/p/preview-protocol.js, chrome-devtool protocol) are gated behind
host.endsWith("csb.app")/"csb.dev" and never fire; portal/auth/links to
codesandbox.io are unused string constants.

Residual inert string: static/js/sandbox.8a7d01a44.js retains one
`fonts.googleapis` mention inside the bundler's own external-resource
classifier (link-vs-script decision); it never fetches anything unless a
sandbox declares such a URL in externalResources, which this app never does
(it passes the vendored Tailwind runtime).
