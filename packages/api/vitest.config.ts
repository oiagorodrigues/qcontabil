import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: './',
    globals: true,
    testTimeout: 30000,
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
        },
        plugins: [swc.vite({ module: { type: 'commonjs' } })],
      },
      {
        test: {
          name: 'int',
          include: ['src/**/*.int-spec.ts'],
        },
        plugins: [swc.vite({ module: { type: 'commonjs' } })],
      },
      {
        test: {
          name: 'e2e',
          include: ['src/**/*.e2e-spec.ts'],
        },
        plugins: [swc.vite({ module: { type: 'commonjs' } })],
      },
    ],
  },
})
