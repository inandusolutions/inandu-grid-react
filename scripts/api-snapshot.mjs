#!/usr/bin/env node
// Public API snapshot: lists everything the built package exports (names, kinds, and for classes/interfaces/enums their
// public members with types) and compares it with the committed api/public-api.txt.
//
//   npm run api:check     fails when the built declarations differ from the snapshot (run after `npm run build`)
//   npm run api:update    rewrites the snapshot; review the diff, it is the API change of the release
//
// A removed or retyped export/member is a breaking change (semver major); an added one is a minor. The snapshot makes that
// visible in the pull request instead of in a consumer's build. Re-exports from @inandu-solutions/grid-core are included, so
// a core upgrade that changes the surface shows up here too. No dependency beyond `typescript`.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Per-repo settings: the only part that differs between grid-react and grid-vue. `tsPackage` is the package that exposes the
 * TypeScript compiler API (grid-react develops on the native TypeScript 7, which has none, and uses @typescript/typescript6 for it).
 */
const CONFIG = { entry: 'dist/index.d.ts', jsx: true, tsPackage: '@typescript/typescript6' };

const ts = (await import(CONFIG.tsPackage)).default;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dts = join(root, CONFIG.entry);
const snapshotFile = join(root, 'api/public-api.txt');
const update = process.argv.includes('--update');

if (!existsSync(dts)) {
  console.error(`error: ${dts} not found, run \`npm run build\` first.`);
  process.exit(2);
}

const program = ts.createProgram([dts], {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  ...(CONFIG.jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}),
  strict: true,
  skipLibCheck: true,
  noEmit: true,
});
const checker = program.getTypeChecker();
const source = program.getSourceFile(dts);
const moduleSymbol = checker.getSymbolAtLocation(source);

const flags = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
const typeText = (type, node) => checker.typeToString(type, node, flags).replace(/\s+/g, ' ');

function isPublic(symbol) {
  const decl = symbol.declarations?.[0];
  if (!decl) return true;
  const mods = ts.getCombinedModifierFlags(decl);
  return !(mods & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected));
}

/** Public properties of a type, one `name: type` line each. */
function propertyLines(type, node, indent = '  ') {
  return checker
    .getPropertiesOfType(type)
    .filter(isPublic)
    .filter((p) => !p.name.startsWith('ɵ') && !p.name.startsWith('_'))
    .map((p) => {
      const optional = p.flags & ts.SymbolFlags.Optional ? '?' : '';
      const readonly = p.declarations?.[0] && ts.getCombinedModifierFlags(p.declarations[0]) & ts.ModifierFlags.Readonly ? 'readonly ' : '';
      return `${indent}${readonly}${p.name}${optional}: ${typeText(checker.getTypeOfSymbolAtLocation(p, node), node)}`;
    })
    .sort();
}

const members = (symbol, node) => propertyLines(checker.getDeclaredTypeOfSymbol(symbol), node);

/** A value whose type is too big to read (a component type): list its props when it has `$props`, else a digest of the type. */
function describeValue(name, symbol, node) {
  const type = checker.getTypeOfSymbolAtLocation(symbol, node);
  const text = typeText(type, node);
  if (text.length <= 300) return [`const ${name}: ${text}`];
  const props = type.getProperty('$props');
  if (props) {
    const propsType = checker.getTypeOfSymbolAtLocation(props, node);
    const own = propertyLines(propsType, node, '  ').filter((l) => !/^\s+(key|ref|ref_for|ref_key|class|style|on[A-Z]\w+VnodeBefore\w*|onVnode\w+)\??:/.test(l));
    return [`component ${name}`, ...own];
  }
  return [`const ${name}: <type of ${text.length} chars, sha1 ${createHash('sha1').update(text).digest('hex').slice(0, 12)}>`];
}

/**
 * `function name(params): return`. A destructured parameter is printed as `arg0: Type` (its pattern is an implementation detail,
 * the type is the API) and an anonymous object return type, like a hook's result, one member per line.
 */
function describeSignature(name, signature, node) {
  const params = signature.getParameters().map((p, i) => {
    const decl = p.valueDeclaration;
    const label = decl && ts.isParameter(decl) && !ts.isIdentifier(decl.name) ? `arg${i}` : p.name;
    const optional = decl && ts.isParameter(decl) && (decl.questionToken || decl.initializer) ? '?' : '';
    return `${label}${optional}: ${typeText(checker.getTypeOfSymbolAtLocation(p, node), node)}`;
  });
  const head = `function ${name}(${params.join(', ')})`;
  const ret = checker.getReturnTypeOfSignature(signature);
  const anonymous = ret.flags & ts.TypeFlags.Object && !ret.aliasSymbol && ret.symbol?.name === '__type' && checker.getPropertiesOfType(ret).length > 0;
  return anonymous ? [`${head}: {`, ...propertyLines(ret, node, '  '), '}'] : [`${head}: ${typeText(ret, node)}`];
}

const lines = [];
for (const exp of checker.getExportsOfModule(moduleSymbol).sort((a, b) => a.name.localeCompare(b.name))) {
  const symbol = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
  const node = symbol.declarations?.[0] ?? source;
  if (symbol.flags & ts.SymbolFlags.Class) {
    lines.push(`class ${exp.name}`, ...members(symbol, node));
  } else if (symbol.flags & ts.SymbolFlags.Interface) {
    lines.push(`interface ${exp.name}`, ...members(symbol, node));
  } else if (symbol.flags & ts.SymbolFlags.Enum) {
    lines.push(`enum ${exp.name}`, ...[...symbol.exports.keys()].sort().map((k) => `  ${k}`));
  } else if (symbol.flags & ts.SymbolFlags.TypeAlias) {
    // The declaration text, not the resolved type: an alias like `'a' | 'b'` must keep its members visible.
    const rhs = ts.isTypeAliasDeclaration(node) ? node.type.getText().replace(/\s+/g, ' ') : typeText(checker.getDeclaredTypeOfSymbol(symbol), node);
    const params = ts.isTypeAliasDeclaration(node) && node.typeParameters?.length ? `<${node.typeParameters.map((p) => p.getText()).join(', ')}>` : '';
    lines.push(`type ${exp.name}${params} = ${rhs}`);
  } else if (symbol.flags & ts.SymbolFlags.Function) {
    for (const sig of checker.getTypeOfSymbolAtLocation(symbol, node).getCallSignatures()) {
      lines.push(...describeSignature(exp.name, sig, node));
    }
  } else {
    lines.push(...describeValue(exp.name, symbol, node));
  }
}

const actual = `${lines.join('\n')}\n`;

if (update) {
  mkdirSync(dirname(snapshotFile), { recursive: true });
  writeFileSync(snapshotFile, actual);
  console.log(`wrote ${snapshotFile} (${lines.length} lines)`);
  process.exit(0);
}

if (!existsSync(snapshotFile)) {
  console.error(`error: ${snapshotFile} not found, run \`npm run api:update\` and commit it.`);
  process.exit(2);
}

// Git may check the file out with CRLF (autocrlf on Windows): compare content, not line endings.
const expected = readFileSync(snapshotFile, 'utf8').replace(/\r\n/g, '\n');
if (expected === actual) {
  console.log(`public API matches api/public-api.txt (${lines.length} lines)`);
  process.exit(0);
}

const exp = new Set(expected.split('\n'));
const act = new Set(actual.split('\n'));
const removed = [...exp].filter((l) => l && !act.has(l));
const added = [...act].filter((l) => l && !exp.has(l));
console.error('error: the public API changed. If that is intended, run `npm run api:update` and commit api/public-api.txt.');
removed.slice(0, 40).forEach((l) => console.error(`- ${l}`));
added.slice(0, 40).forEach((l) => console.error(`+ ${l}`));
if (removed.length > 40 || added.length > 40) console.error('(output truncated)');
process.exit(1);
