import { defineConfig } from 'vitest/config'

// Database rules tests (npm run test:rules), run inside Firebase's local emulator, which needs
// Java 21+. GitHub runs them on every pull request; locally, only where Java is installed.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    fileParallelism: false, // the tests share one emulator
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
})
