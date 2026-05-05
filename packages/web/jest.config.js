/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  // No transform — run JS files as native ESM (package.json "type":"module")
  transform: {},
};

export default config;
