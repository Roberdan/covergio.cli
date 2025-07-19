/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    reporters: ['default', 'junit'],
    silent: false,
    setupFiles: ['./test-setup.ts'],
    include: ['test/universal/**/*.test.ts', 'test/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 120000, // 2 minute timeout for all tests
    hookTimeout: 60000,  // 1 minute timeout for hooks
    teardownTimeout: 60000, // 1 minute for teardown
    outputFile: {
      junit: 'junit.xml',
    },
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*'],
      exclude: [
        '**/*.test.ts',
        '**/test/**',
        '**/__mocks__/**',
        '**/types/**',
      ],
      reporter: [
        ['text', { file: 'full-text-summary.txt' }],
        'html',
        'json',
        'lcov',
        'cobertura',
        ['json-summary', { outputFile: 'coverage-summary.json' }],
      ],
    },
  },
});
