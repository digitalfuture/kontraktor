import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewsDir = path.resolve(__dirname, '../src/views');

function getEjsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getEjsFiles(filePath));
    } else if (file.endsWith('.ejs')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = getEjsFiles(viewsDir);
let hasErrors = false;

for (const file of files) {
  try {
    execSync(`npx ejs-lint -d "%" "${file}"`, { stdio: 'pipe' });
  } catch (err) {
    const relPath = path.relative(path.resolve(__dirname, '..'), file);
    const msg = err.stderr ? err.stderr.toString().trim() : err.stdout ? err.stdout.toString().trim() : err.message;
    console.error(`[EJS LINT ERROR] ${relPath}:\n${msg}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log(`✅ EJS Lint passed cleanly across ${files.length} template files.`);
}
