const fs = require('fs');
const path = require('path');
const SRC = path.join(process.cwd(), 'src');
const lines = fs.readFileSync(path.join(SRC, 'index.ts'), 'utf-8').split('\n');
const re = /app\.use\(['"]([^'"]+)['"],?\s*(.*?)\);/g;
const text = lines.join('\n');
let m;
while ((m = re.exec(text)) !== null) {
  console.log('mount=' + m[1] + '  args=' + m[2]);
}
