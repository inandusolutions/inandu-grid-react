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
npm run api:check    # after build: the exported API matches api/public-api.txt
npm run api:update   # rewrite that snapshot (review the diff: it is the API change of the release)
npm run check:package    # after build: jspdf on demand, size budgets, tarball contents, entry points
npm run smoke:package    # after build: install the packed tarball in an empty project and type-check a consumer
```

A pull request that changes the public API (a prop, an export, a type) has to include the updated `api/public-api.txt`; CI fails
otherwise. The snapshot also lists what is re-exported from `@inandu-solutions/grid-core`, so a core upgrade that changes the
surface needs `npm run api:update` too. Size budgets live in `scripts/check-package.mjs`: raise one there when the growth is intended.

## Before you open a PR

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Added/updated unit tests for the change (real component behavior — this repo tests with
  `vitest` + `@testing-library/react`, not shallow rendering)
- [ ] Updated the README's Features list if the public API changed
- [ ] If you touched core logic (sorting, filtering, aggregation, export, i18n), check whether the
  same change applies to the [Angular](https://github.com/inandusolutions/inandu-grid) and
  [Vue](https://github.com/inandusolutions/inandu-grid-vue) versions — the core is shared through
  [`@inandu-solutions/grid-core`](https://github.com/inandusolutions/inandu-grid-core), so a change to it
  belongs in that repository

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `chore:`,
etc. Keep the subject line under ~72 characters; explain the *why* in the body when it's not obvious.

## Pull requests

Fill in the PR template. Small, focused PRs are easier to review than one that bundles several
unrelated changes — split them if you can.

## Dependency updates

Dependabot opens its pull requests on Mondays: one run for npm and one for GitHub Actions. Packages that peer-pin each other are grouped, so they move together in one pull request instead of breaking each other in separate ones:

- **react**: `react`, `react-dom` and their `@types`. `react-dom` peer-pins `react`.
- **vite**: `vite`, `vitest`, `@vitejs/*` and `vite-plugin-dts`. They peer-depend on Vite.

Every other development dependency gets one grouped pull request for minor and patch updates. Major updates are never grouped: each one is its own pull request, read and decided on its own.

Rules for these pull requests:

- They need the same green checks as any other pull request, and nothing is merged with a failing or skipped check.
- A group is merged as a whole. If one package in it breaks the build, fix or hold the whole group; do not split it by hand, because the packages are grouped exactly because they cannot move apart.
- The GitHub Pages site (`site/`) and the StackBlitz example (`examples/stackblitz/`) are consumer apps, not the library: they get one grouped pull request per directory for minor and patch updates.
- Runtime dependencies are few on purpose. A pull request that adds one needs a reason in its description.
