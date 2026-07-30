import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// ── Run locale validator before build ──
const validatorPath = path.join(__dirname, 'validate-locale-keys.mjs');
const result = spawnSync('node', [validatorPath], { cwd: rootDir, stdio: 'inherit' });
if (result.status !== 0) {
  console.error('❌ Locale validation failed. Fix missing keys before deploying.');
  process.exit(1);
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDirSync(path.join(rootDir, 'src', 'views'), path.join(distDir, 'views'));
copyDirSync(path.join(rootDir, 'src', 'locales'), path.join(distDir, 'locales'));
copyDirSync(path.join(rootDir, 'src', 'data'), path.join(distDir, 'data'));
fs.rmSync(path.join(distDir, 'data', 'views'), { recursive: true, force: true });
fs.rmSync(path.join(distDir, 'data', 'locales'), { recursive: true, force: true });
copyDirSync(path.join(rootDir, 'docs'), path.join(distDir, 'docs'));

console.log('✅ Dist assets copied successfully');
