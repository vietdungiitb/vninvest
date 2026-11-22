import { execSync } from 'node:child_process';

// Verify from OUTSIDE the container that the deployed bundle is the expected
// clean-tree commit. Container status alone is not proof of the deployed build.
const args = process.argv.slice(2);
const urlIndex = args.indexOf('--url');
const base = urlIndex >= 0 ? args[urlIndex + 1] : 'https://docker.edusuccess.vn';
const commitIndex = args.indexOf('--commit');
const expected = commitIndex >= 0
  ? args[commitIndex + 1]
  : execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();

try {
  const response = await fetch(`${base}/health.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.ok !== true) throw new Error('health.ok !== true');
  if (body.dirty !== false) throw new Error('build is DIRTY');
  if (body.commit !== expected) throw new Error(`commit ${body.commit} != ${expected}`);
  console.log(`STAGING_OK commit=${body.commit} dirty=${body.dirty}`);
} catch (error) {
  console.error(`STAGING_FAIL ${error.message}`);
  process.exitCode = 1;
}
