import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  sourcemap: true,
  clean: true,
  platform: 'node',
  target: 'node20',
  banner: {
    js: '#!/usr/bin/env node',
  },
  noExternal: ['@tgsm/core'],
  external: ['@mtcute/node'],
  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      '.wasm': 'file',
    }
  },
})
