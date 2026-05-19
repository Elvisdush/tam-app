#!/usr/bin/env node
/**
 * Flatten Kustomize output to a single YAML file.
 * Use this when IaC scanners (e.g. Checkov) hit WinError 32 on Windows while
 * renaming temp files in the kustomize runner — scan the rendered file with
 * `--framework kubernetes` instead.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const overlayName = process.argv[2] || 'local';
const overlayDir = path.join(root, 'k8s', 'overlays', overlayName);

if (!fs.existsSync(overlayDir)) {
  console.error(`Overlay not found: ${overlayDir}`);
  process.exit(1);
}

const outDir = path.join(root, 'k8s', 'rendered');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${overlayName}.yaml`);

try {
  const yaml = execSync(`kubectl kustomize "${overlayDir}"`, {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  fs.writeFileSync(outFile, yaml, 'utf8');
  console.log(`Wrote ${outFile}`);
} catch (e) {
  const stderr = e.stderr?.toString?.() || '';
  console.error('kubectl kustomize failed. Install kubectl and ensure the overlay is valid.');
  if (stderr) console.error(stderr);
  console.error(e.message);
  process.exit(1);
}
