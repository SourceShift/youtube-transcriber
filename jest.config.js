/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/cli-main.ts',
    '!src/**/*.d.ts',
    '!src/settings.ts'
  ]
  // Coverage thresholds removed for initial setup
  // We'll add them back as we increase test coverage
}; 