#!/usr/bin/env node
// Checks the built package the way `npm publish` would ship it (run after `npm run build`):
//   1. `jspdf` is loaded on demand only: no static import or require in either bundle, one dynamic import() in the ESM one.
//   2. Size budgets: both bundles and the packed tarball stay under a ceiling, so growth is a decision, not an accident.
//   3. The tarball has what consumers need (package.json, README, LICENSE, both bundles, declarations, style.css) and no sources or specs.
//   4. Every target in package.json `exports`/`main`/`module`/`types` exists, and only CSS counts as a side effect (tree-shaking).
//
// Raise a budget in CONFIG when growth is intended; the number in the diff is the review.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Per-repo settings: the only part that differs between grid-react and grid-vue. Budgets in KB, about 15% above today's sizes (ESM 54, CJS 42, tarball 48). */
const CONFIG = { name: '@inandu-solutions/grid-react', budgetKB: { esm: 62, cjs: 48, tarball: 55 }, peers: ['react', 'react-dom'] };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const fail = (msg) => failures.push(msg);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (pkg.name !== CONFIG.name) fail(`unexpected package name ${pkg.name}`);
for (const target of [pkg.module, pkg.main, pkg.types]) {
  if (!target || !existsSync(join(root, target))) {
    console.error(`error: ${target} not found, run \`npm run build\` first.`);
    process.exit(2);
  }
}

// 1. jspdf on demand
const esmPath = join(root, pkg.module);
const cjsPath = join(root, pkg.main);
const esm = readFileSync(esmPath, 'utf8');
const cjs = readFileSync(cjsPath, 'utf8');
for (const [label, text] of [['ESM', esm], ['CJS', cjs]]) {
  if (/\bfrom\s*["']jspdf["']/.test(text) || /\brequire\(\s*["']jspdf["']\s*\)/.test(text) || /^\s*import\s+["']jspdf["']/m.test(text)) {
    fail(`${label} bundle imports jspdf statically: it would load with the grid instead of on the first PDF export`);
  }
}
const dynamicEsm = esm.match(/\bimport\(\s*["']jspdf["']\s*\)/g) ?? [];
if (dynamicEsm.length !== 1) fail(`expected exactly one dynamic import("jspdf") in the ESM bundle, found ${dynamicEsm.length}`);
if (pkg.dependencies?.jspdf) fail('jspdf must stay an optional peer dependency, not a dependency');
if (!pkg.peerDependencies?.jspdf || !pkg.peerDependenciesMeta?.jspdf?.optional) fail('jspdf must be an optional peer (peerDependencies + peerDependenciesMeta)');
for (const peer of CONFIG.peers) if (!pkg.peerDependencies?.[peer]) fail(`${peer} must be a peer dependency`);
if (Object.keys(pkg.dependencies ?? {}).join() !== '@inandu-solutions/grid-core') fail(`dependencies should be exactly @inandu-solutions/grid-core, found ${Object.keys(pkg.dependencies ?? {}).join(', ') || 'none'}`);

// 2. size budgets + 3. tarball contents
const npmArgs = ['pack', '--dry-run', '--json'];
const packOutput = process.env.npm_execpath
  ? execFileSync(process.execPath, [process.env.npm_execpath, ...npmArgs], { cwd: root, encoding: 'utf8' })
  : execFileSync('npm', npmArgs, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
const packed = JSON.parse(packOutput)[0];
const sizes = { esm: statSync(esmPath).size, cjs: statSync(cjsPath).size, tarball: packed.size };
for (const [what, size] of Object.entries(sizes)) {
  const budget = CONFIG.budgetKB[what] * 1024;
  if (size > budget) fail(`${what} is ${kb(size)}, budget ${kb(budget)}`);
}

const files = packed.files.map((f) => f.path);
for (const required of ['package.json', 'README.md', 'LICENSE', pkg.module.replace(/^\.\//, ''), pkg.main.replace(/^\.\//, ''), pkg.types.replace(/^\.\//, ''), 'dist/style.css']) {
  if (!files.includes(required)) fail(`tarball is missing ${required}`);
}
const stray = files.filter((f) => /\.(spec|test)\.|(^|\/)(src|e2e|tests?|node_modules|scripts|api)\//.test(f) || (f.endsWith('.ts') && !f.endsWith('.d.ts')) || f.endsWith('.map'));
if (stray.length) fail(`tarball ships files that are not part of the package: ${stray.join(', ')}`);

// 4. every entry point exists; only CSS is a side effect
const targets = (value) => (typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(targets));
for (const t of [...targets(pkg.exports), pkg.main, pkg.module, pkg.types]) {
  if (!existsSync(join(root, t))) fail(`package.json points at ${t}, which does not exist`);
}
if (JSON.stringify(pkg.sideEffects) !== JSON.stringify(['*.css'])) fail('package.json sideEffects must be ["*.css"] so unused exports tree-shake');

console.log(`esm ${kb(sizes.esm)} / ${CONFIG.budgetKB.esm} KB, cjs ${kb(sizes.cjs)} / ${CONFIG.budgetKB.cjs} KB, tarball ${kb(sizes.tarball)} / ${CONFIG.budgetKB.tarball} KB, ${files.length} files, jspdf dynamic imports: ${dynamicEsm.length}`);
if (failures.length) {
  failures.forEach((f) => console.error(`error: ${f}`));
  process.exit(1);
}
console.log('package checks passed');
