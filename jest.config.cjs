module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  roots: ['<rootDir>/packages/core/src', '<rootDir>/apps/server/src', '<rootDir>/apps/web/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'packages/core/src/**/*.ts',
    '!packages/core/src/**/*.test.ts',
    'apps/server/src/**/*.ts',
    '!apps/server/src/**/*.test.ts',
    'apps/web/src/**/*.ts',
    '!apps/web/src/**/*.test.ts',
  ],
};
