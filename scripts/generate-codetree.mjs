#!/usr/bin/env node
/**
 * generate-codetree.mjs
 * Walks src/ and generates a JSON tree of the codebase structure.
 * Used by the admin Codebase Tree viewer.
 *
 * Output: docs/codebase-tree.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// Files/folders to exclude
const IGNORE = new Set([
  'node_modules', '.git', 'dist', 'public', 'docs', '.codegraph',
  '__pycache__', '.gitkeep', '.DS_Store',
]);

const IGNORE_EXT = new Set([
  '.map', '.log',
]);

function shouldIgnore(name) {
  if (IGNORE.has(name)) return true;
  if (name.startsWith('.')) return true;
  if (IGNORE_EXT.has(path.extname(name))) return true;
  return false;
}

function buildTree(dirPath, maxDepth = 6, depth = 0) {
  if (depth > maxDepth) {
    return { name: '…', value: 1, leaf: true, truncated: true };
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(e => !shouldIgnore(e.name))
    .sort((a, b) => {
      // Directories first, then alphabetical
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const children = [];
  let totalFiles = 0;

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const subtree = buildTree(fullPath, maxDepth, depth + 1);
      totalFiles += subtree.totalFiles || 0;
      const node = {
        name: entry.name,
        type: 'dir',
        children: subtree.children || [],
        value: subtree.totalFiles || subtree.children?.length || 1,
      };
      if (subtree.truncated) node.truncated = true;
      children.push(node);
    } else {
      totalFiles++;
      const ext = path.extname(entry.name).slice(1);
      children.push({
        name: entry.name,
        type: 'file',
        value: 1,
        leaf: true,
        ext: ext || '?',
      });
    }
  }

  return { name: path.basename(dirPath), type: 'dir', children, totalFiles };
}

// ── Main ────────────────────────────────────────────────────────────────────

try {
  const tree = buildTree(SRC);
  tree.name = '📁 Kontraktor Codebase';

  const outDir = path.join(ROOT, 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'codebase-tree.json');
  fs.writeFileSync(outPath, JSON.stringify(tree, null, 2), 'utf-8');

  console.log(`✅ Codebase tree generated: ${outPath}`);
  console.log(`   ${tree.children.length} top-level dirs, ${tree.totalFiles} files total`);
} catch (err) {
  console.error('❌ Error generating codebase tree:', err.message);
  process.exit(1);
}
