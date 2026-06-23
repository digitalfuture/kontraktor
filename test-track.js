require('ts-node').register({ project: '/root/kontraktor/tsconfig.json' });

let i = 0;
const originalModule = require('module');
const originalRequire = originalModule.prototype.require;
originalModule.prototype.require = function(id) {
  i++;
  if (id.includes('..')) {
    const resolved = require.resolve(id);
    console.log(`  ${i}. require(${JSON.stringify(id)}) -> ${resolved.substring(0, 120)}`);
  }
  return originalRequire.apply(this, arguments);
};

console.log('START require contractors.ts');
const m = require('./src/routes/contractors');
console.log('DONE, exports:', Object.keys(m));
