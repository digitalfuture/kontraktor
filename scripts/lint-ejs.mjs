import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ejsLintModule = await import('ejs-lint');
const ejsLint = ejsLintModule.default || ejsLintModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewsDir = path.resolve(__dirname, '../src/views');

function getEjsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getEjsFiles(filePath));
    } else if (file.endsWith('.ejs')) {
      results.push(filePath);
    }
  }
  return results;
}

const files = getEjsFiles(viewsDir);
let hasErrors = false;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const err = ejsLint(content, { delimiter: '%' });
  if (err) {
    const relPath = path.relative(path.resolve(__dirname, '..'), file);
    console.error(`[EJS LINT ERROR] ${relPath}:${err.line}:${err.column} - ${err.message}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log(`✅ EJS Lint passed cleanly across ${files.length} template files.`);
}
