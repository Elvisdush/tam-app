/**
 * Web dev server + skip Expo dependency validation network fetch (avoids `fetch failed`
 * when Expo API is unreachable on restrictive networks / Node 22 quirks).
 *
 * Extra args pass through, e.g. `npm run expo:start:web -- -c`
 */
const { spawnSync } = require('child_process');
const path = require('path');

process.env.EXPO_NO_DEPENDENCY_VALIDATION = '1';
const cwd = path.join(__dirname, '..');
const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const extra = process.argv.slice(2);
const r = spawnSync(cmd, ['expo', 'start', '--web', ...extra], {
  cwd,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status === null ? 1 : r.status);
