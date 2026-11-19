#!/usr/bin/env node
// Release smoke test: installs the *packed tarball* (what `npm publish` would upload, not the source tree) into an empty
// project and checks that a consumer can use it:
//   1. `npm install` resolves the package with only its declared peers (React and TypeScript at the repo's versions).
//   2. A component using <InanduGrid> type-checks under strict TypeScript with the react-jsx transform, once with the usual
//      settings (skipLibCheck on, no jspdf installed) and once strict (skipLibCheck off, jspdf installed).
//   3. The ESM entry (import) and the CJS entry (require) both load in Node and expose the grid, and `style.css` resolves.
// Run after `npm run build`:  npm run smoke:package
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Per-repo settings: the only part that differs between grid-react and grid-vue. */
const CONFIG = { name: '@inandu-solutions/grid-react', exportName: 'InanduGrid' };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(join(root, 'dist/index.d.ts'))) {
  console.error('error: dist/ not found, run `npm run build` first.');
  process.exit(2);
}

const version = (name) => JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
const work = mkdtempSync(join(tmpdir(), 'grid-smoke-'));
const npmCli = process.env.npm_execpath;
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const npm = (args, cwd) => (npmCli ? run(process.execPath, [npmCli, ...args], cwd) : run('npm', args, cwd));

try {
  // pack the built package, exactly as published
  const packDir = join(work, 'pack');
  mkdirSync(packDir);
  const packName = JSON.parse(npm(['pack', '--pack-destination', packDir, '--json'], root))[0].filename;
  const tarball = join(packDir, packName);
  console.log(`packed ${packName}`);

  // empty consumer project: React and TypeScript at the versions this repo develops against
  const app = join(work, 'consumer');
  mkdirSync(join(app, 'src'), { recursive: true });
  writeFileSync(
    join(app, 'package.json'),
    JSON.stringify(
      {
        name: 'grid-smoke-consumer',
        private: true,
        type: 'module',
        dependencies: { react: version('react'), 'react-dom': version('react-dom'), [CONFIG.name]: `file:${tarball.replaceAll('\\', '/')}` },
        devDependencies: { '@types/react': version('@types/react'), '@types/react-dom': version('@types/react-dom'), typescript: version('typescript') },
      },
      null,
      2,
    ),
  );
  // Two consumers: the common setup (skipLibCheck on, no jspdf installed) and a strict one (skipLibCheck off, jspdf installed
  // because the declarations of grid-core reference its types until grid-core drops that import).
  const tsconfig = (skipLibCheck) =>
    JSON.stringify(
      { compilerOptions: { target: 'ES2022', module: 'ES2022', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck, lib: ['ES2022', 'dom'] }, files: ['src/main.tsx', 'src/css.d.ts'] },
      null,
      2,
    );
  writeFileSync(join(app, 'tsconfig.json'), tsconfig(true));
  writeFileSync(join(app, 'tsconfig.strict.json'), tsconfig(false));
  writeFileSync(
    join(app, 'src/main.tsx'),
    `import { InanduGrid, type InanduGridColumn, type InanduGridRow } from '${CONFIG.name}';
import '${CONFIG.name}/style.css';

const rows: InanduGridRow[] = [{ name: 'Alice', units: 1 }];
const columns: InanduGridColumn[] = [
  { field: 'name', headerText: 'Name' },
  { field: 'units', headerText: 'Units', type: 'number', aggregate: 'sum' },
];

export function App() {
  return <InanduGrid rows={rows} columns={columns} pageSize={10} exportable selectable />;
}
`,
  );
  writeFileSync(join(app, 'src/css.d.ts'), `declare module '*.css';\n`);

  console.log('npm install (consumer)...');
  npm(['install', '--no-audit', '--no-fund', '--ignore-scripts', '--loglevel=error'], app);

  const tsc = (project) => run(process.execPath, [join(app, 'node_modules/typescript/bin/tsc'), '-p', project], app);
  console.log('tsc (strict, skipLibCheck on, no jspdf)...');
  tsc('tsconfig.json');

  console.log('tsc (strict, skipLibCheck off, jspdf installed)...');
  npm(['install', '--no-save', '--no-audit', '--no-fund', '--ignore-scripts', '--loglevel=error', `jspdf@${version('jspdf')}`], app);
  tsc('tsconfig.strict.json');

  console.log('node import + require...');
  const esm = `const m = await import('${CONFIG.name}'); if (typeof m.${CONFIG.exportName} !== 'function') throw new Error('${CONFIG.exportName} is not exported by the ESM entry'); console.log('esm exports: ' + Object.keys(m).length);`;
  process.stdout.write(run(process.execPath, ['--input-type=module', '-e', esm], app));
  const cjs = `const m = require('${CONFIG.name}'); if (typeof m.${CONFIG.exportName} !== 'function') throw new Error('${CONFIG.exportName} is not exported by the CJS entry'); console.log('cjs exports: ' + Object.keys(m).length);`;
  process.stdout.write(run(process.execPath, ['--input-type=commonjs', '-e', cjs], app));
  const css = `import { createRequire } from 'node:module'; const p = createRequire(import.meta.url).resolve('${CONFIG.name}/style.css'); console.log('style.css: ' + p.split('node_modules')[1]);`;
  process.stdout.write(run(process.execPath, ['--input-type=module', '-e', css], app));

  console.log('smoke test passed');
} finally {
  rmSync(work, { recursive: true, force: true });
}
