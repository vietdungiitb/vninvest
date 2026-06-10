/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  // No transform — run JS files as native ESM (package.json "type":"module")
  transform: {},
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/src/components/vnstockcharts/"
  ],
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/test/styleMock.cjs',
  },
};

export default config;
