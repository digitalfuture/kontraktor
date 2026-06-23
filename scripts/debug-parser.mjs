import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const content = fs.readFileSync(path.join(SRC, 'index.ts'), 'utf-8');
console.log('File length:', content.length);

const re = /app\.use\(['"]([^'"]+)['"],?\s*(.*?)\);/g;
let m;
let count = 0;
while ((m = re.exec(content)) !== null) {
  count++;
  const mount = m[1];
  const args = m[2];
  const routerMatch = args.match(/([\w]+Router)/);
  const importLine = content.split('\n').find(l => l.includes('import') && l.includes(routerMatch ? routerMatch[1] : 'NOPE'));
  console.log(`${count}. mount="${mount}"  router="${routerMatch ? routerMatch[1] : 'NONE'}"`);
  console.log(`   import: ${importLine ? importLine.substring(0, 80) : '???'}`);
}
console.log(`Total mounts found: ${count}`);
