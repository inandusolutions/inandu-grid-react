#!/usr/bin/env node
// Copies the stylesheet next to the build, so it ships as `style.css` (`import '@inandu-solutions/grid-react/style.css'`).
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(root, 'dist'), { recursive: true });
copyFileSync(resolve(root, 'src/styles/inandu-grid.css'), resolve(root, 'dist/style.css'));
console.log('dist/style.css written');
