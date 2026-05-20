/**
 * Same as repo-root `expo:start:lan`: LAN + skip Expo dependency validation fetch.
 */
const { spawnSync } = require('child_process');
const path = require('path');

process.env.EXPO_NO_DEPENDENCY_VALIDATION = '1';
const cwd = path.join(__dirname, '..');
const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const r = spawnSync(cmd, ['expo', 'start', '--lan'], {
  cwd,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status === null ? 1 : r.status);
