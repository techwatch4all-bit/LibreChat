import { defineConfig } from 'vite';

/**
 * The operator console is a standalone SPA served by the control service on
 * :8443. It is deliberately its own build root — it must never inherit the
 * LibreChat client bundle, its router, or its localization runtime.
 *
 * No React plugin: JSX is transformed by esbuild against the `jsx` setting in
 * tsconfig.json, which is all this app needs. Fast Refresh is a dev nicety and
 * not worth a plugin whose peer range does not cover Vite 8.
 */
export default defineConfig({
  base: './',
  server: {
    port: 8444,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    cssTarget: 'chrome111',
  },
});
