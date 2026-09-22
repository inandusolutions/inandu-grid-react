# Contributing to inandu-grid-react

## Ground rules

- Search existing [issues](https://github.com/inandusolutions/inandu-grid-react/issues) and
  [discussions](https://github.com/inandusolutions/inandu-grid-react/discussions) before opening a
  new one.
- Questions and usage help go in [Discussions](https://github.com/inandusolutions/inandu-grid-react/discussions),
  not issues — see [SUPPORT.md](.github/SUPPORT.md).
- Security issues: **do not** open a public issue — see [SECURITY.md](.github/SECURITY.md).
- Be kind — see the [Code of Conduct](.github/CODE_OF_CONDUCT.md).

## Project layout

| Path | What it is |
| --- | --- |
| `src/` | The library — published to npm as `@inandu-solutions/grid-react`. |
| `site/` | The GitHub Pages demo/landing site. A separate npm project, not part of the library build. |
| `examples/stackblitz/` | The minimal StackBlitz example. Also a separate npm project — it installs `@inandu-solutions/grid-react` from npm, not from local source. |
| `docs/` | Static assets (GIFs, screenshots, social preview) referenced by the README and `site/`. |

## Setup

```bash
npm install
```

`site/` and `examples/stackblitz/` each need their own `npm install` if you're working on them —
they're independent npm projects, not npm workspaces.

## Commands

```bash
npm run dev          # Vite dev server, hot-reloads the library
npm run typecheck    # tsc --noEmit
npm test             # vitest run (jsdom + React Testing Library)
npm run test:watch   # vitest, watch mode
npm run build        # library build -> dist/ (also copies dist/style.css)
```

## Before you open a PR

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Added/updated unit tests for the change (real component behavior — this repo tests with
  `vitest` + `@testing-library/react`, not shallow rendering)
- [ ] Updated the README's Features list if the public API changed
- [ ] If you touched core logic (sorting, filtering, aggregation, export, i18n), check whether the
  same change applies to the [Angular version](https://github.com/inandusolutions/inandu-grid) —
  the two cores are kept in sync by hand, not shared via a package

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `chore:`,
etc. Keep the subject line under ~72 characters; explain the *why* in the body when it's not obvious.

## Pull requests

Fill in the PR template. Small, focused PRs are easier to review than one that bundles several
unrelated changes — split them if you can.
