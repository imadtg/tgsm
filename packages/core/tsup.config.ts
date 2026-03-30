import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: 'node',
  target: 'node20',
  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      '.wasm': 'file',
    }
  },
})
