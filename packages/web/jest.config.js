/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  // Transform ESM modules
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.json' }],
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/src/components/vninvestcharts/"
  ],
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/test/styleMock.cjs',
    '^(\\.\\./)+adapters/coreApiAdapter\\.js$': '<rootDir>/src/adapters/coreApiAdapter.js',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.js'],
  testMatch: [
    '**/*.test.{js,jsx,ts,tsx}',
  ],
  extensionsToTreatAsEsm: ['.jsx', '.ts', '.tsx'],
};

export default config;