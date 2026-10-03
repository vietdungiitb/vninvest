import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeBuildTarget } from '../src/config/buildTarget.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, '..');
const workspaceRoot = resolve(packageRoot, '..', '..');
const frontendRoot = resolve(workspaceRoot, 'frontend');
const frontendBuildDir = resolve(frontendRoot, 'build');
const reactScriptsPath = resolve(frontendRoot, 'node_modules', 'react-scripts', 'bin', 'react-scripts.js');
const distRoot = resolve(packageRoot, 'dist');
const communityDistDir = resolve(distRoot, 'community');
const buildTarget = normalizeBuildTarget('community');

if (!existsSync(reactScriptsPath)) {
  throw new Error(`React Scripts build entry not found at ${reactScriptsPath}`);
}

const buildResult = spawnSync(
  process.execPath,
  [reactScriptsPath, 'build'],
  {
    cwd: frontendRoot,
    env: {
      ...process.env,
      REACT_APP_BUILD_TARGET: buildTarget,
    },
    stdio: 'inherit',
  },
);

if (buildResult.error) {
  throw buildResult.error;
}

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

if (!existsSync(frontendBuildDir)) {
  throw new Error(`Frontend build output not found at ${frontendBuildDir}`);
}

rmSync(communityDistDir, { recursive: true, force: true });
mkdirSync(distRoot, { recursive: true });
cpSync(frontendBuildDir, communityDistDir, { recursive: true });

writeFileSync(
  resolve(communityDistDir, 'build-manifest.json'),
  `${JSON.stringify(
    {
      package_name: '@vninvest/web',
      build_target: buildTarget,
      source_frontend: 'frontend',
      source_build_dir: frontendBuildDir,
      output_dir: communityDistDir,
      generated_at: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`Community build artifact written to ${communityDistDir}`);