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
          name: 'int',
          include: ['src/**/*.int-spec.ts'],
          globalSetup: ['src/auth/__tests__/helpers/global-setup.ts'],
          setupFiles: ['src/auth/__tests__/helpers/int-setup.ts'],
        },
        plugins: [swcPlugin],
      },
      {
        test: {
          name: 'e2e',
          include: ['src/**/*.e2e-spec.ts'],
          globalSetup: ['src/auth/__tests__/helpers/global-setup.ts'],
          setupFiles: ['src/auth/__tests__/helpers/int-setup.ts'],
        },
        plugins: [swcPlugin],
      },
    ],
  },
})
