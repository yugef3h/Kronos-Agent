module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.cjs'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  roots: ['<rootDir>/apps/server/src', '<rootDir>/apps/web/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  collectCoverageFrom: [
    'apps/server/src/**/*.ts',
    '!apps/server/src/**/*.test.ts',
    'apps/web/src/**/*.ts',
    '!apps/web/src/**/*.test.ts',
  ],
};
