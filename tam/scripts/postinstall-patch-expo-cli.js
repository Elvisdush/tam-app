/**
 * Re-apply frontend/patches after npm install (fixes @expo/cli cached-fetch body tee bug).
 */
const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const root = join(__dirname, '..');
const frontend = join(root, 'frontend');
const patchesDir = join(frontend, 'patches');

if (!existsSync(patchesDir)) {
  process.exit(0);
}

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const r = spawnSync(cmd, ['patch-package'], {
  cwd: frontend,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (r.status !== 0) {
  console.warn(
    '[postinstall] patch-package exited',
    r.status,
    '(safe to ignore if frontend deps are not installed yet)'
  );
}
