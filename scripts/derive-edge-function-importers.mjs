#!/usr/bin/env node
/**
 * List the Edge Functions that must be redeployed when a shared module changes.
 *
 * Supabase deploys each Edge Function as a self-contained bundle, so editing
 * supabase/functions/_shared/* only takes effect in functions that import it.
 * Deleting a legacy secret before every (transitive) importer is redeployed
 * leaves a deployed bundle that still reads the old name.
 *
 * Usage (from the repo root):
 *   node scripts/derive-edge-function-importers.mjs \
 *     _shared/service-role.ts _shared/api-auth.ts _shared/site-url.ts
 *
 * Prints one function directory per line, sorted. Add any function changed
 * directly (e.g. generate-thumbnails) to the redeploy list yourself.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../supabase/functions/', import.meta.url));

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const files = collect(root).map((p) => relative(root, p).split(sep).join('/'));
const fileSet = new Set(files);
const dependencies = new Map();

for (const file of files) {
  const source = readFileSync(join(root, file), 'utf8');
  const deps = new Set();
  // Static imports/exports (`from '...'`, bare `import '...'`) and dynamic
  // `import('...')`. Only relative specifiers are part of the local graph.
  for (const match of source.matchAll(/(?:from|import)\s*(?:\(\s*)?['"]([^'"]+)['"]/g)) {
    const spec = match[1];
    if (!spec.startsWith('.')) continue;
    const base = normalize(join(dirname(file), spec)).split(sep).join('/');
    for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
      if (fileSet.has(candidate)) {
        deps.add(candidate);
        break;
      }
    }
  }
  dependencies.set(file, deps);
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('usage: node scripts/derive-edge-function-importers.mjs <_shared/module.ts> ...');
  process.exit(2);
}
for (const target of targets) {
  if (!fileSet.has(target)) {
    console.error(`unknown module: ${target}`);
    process.exit(2);
  }
}

// Reverse walk: every module that transitively depends on one of the targets.
const reached = new Set(targets);
const queue = [...targets];
while (queue.length) {
  const current = queue.shift();
  for (const [file, deps] of dependencies) {
    if (deps.has(current) && !reached.has(file)) {
      reached.add(file);
      queue.push(file);
    }
  }
}

const functions = [...new Set([...reached]
  .filter((f) => !f.startsWith('_') && f.includes('/'))
  .map((f) => f.split('/')[0]))].sort();
console.log(functions.join('\n'));
