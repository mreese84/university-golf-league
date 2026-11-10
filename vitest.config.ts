import { defineConfig } from 'vitest/config'

// Code tests (npm test): plain logic, on made-up data or the repo's own files. No database and no
// Java, so they run anywhere. The database rules tests have their own config (vitest.rules.config.ts).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'tests/*.test.ts'],
  },
})
