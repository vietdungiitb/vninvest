/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  // Transform ESM modules
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { configFile: './babel.config.json' }],
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/src/components/vninvestcharts/"
  ],
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/test/styleMock.cjs',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.js'],
  testMatch: [
    '**/*.test.{js,jsx}',
  ],
};

export default config;