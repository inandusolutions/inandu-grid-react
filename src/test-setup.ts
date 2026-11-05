import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// REACT_STRICT=1 renders every test inside <React.StrictMode>: effects, state initialisers and reducers run twice in development.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
if (env?.['REACT_STRICT']) configure({ reactStrictMode: true });
