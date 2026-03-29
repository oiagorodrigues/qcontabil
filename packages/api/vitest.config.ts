import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

const swcPlugin = swc.vite({
  module: { type: 'es6' },
  jsc: { transform: { decoratorMetadata: true } },
})

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
        plugins: [swcPlugin],
      },
      {
        test: {
          name: 'integration',
          include: ['test/**/*.integration.ts'],
          globalSetup: ['test/helpers/global-setup.ts'],
          setupFiles: ['test/helpers/int-setup.ts'],
        },
        plugins: [swcPlugin],
      },
      {
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e.ts'],
          globalSetup: ['test/helpers/global-setup.ts'],
          setupFiles: ['test/helpers/int-setup.ts'],
        },
        plugins: [swcPlugin],
      },
    ],
  },
})
