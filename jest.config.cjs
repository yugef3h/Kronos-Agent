module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages/core/src', '<rootDir>/apps/server/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'packages/core/src/**/*.ts',
    '!packages/core/src/**/*.test.ts',
    'apps/server/src/**/*.ts',
    '!apps/server/src/**/*.test.ts',
  ],
};
