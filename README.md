# inandu-grid-react

The React port of [`@inandu-solutions/grid-angular`](https://github.com/inandusolutions/inandu-grid) —
a standalone data grid: sorting, filtering, grouping, pagination, virtual scroll, inline editing,
CSV/Excel/PDF export and i18n, with a deliberately small dependency footprint.

[![license](https://img.shields.io/badge/license-MIT-0e7c74.svg)](LICENSE)
![React](https://img.shields.io/badge/React-18%20%7C%2019-61dafb)
[![Open in StackBlitz](https://img.shields.io/badge/StackBlitz-open%20example-1389FD?logo=stackblitz&logoColor=white)](https://stackblitz.com/github/inandusolutions/inandu-grid-react/tree/main/examples/stackblitz)

**Feature-complete with grid-angular — not yet published to npm** (see the "Package" bullet
below). The framework-agnostic core (sorting, filtering, aggregation, export, i18n) is
ported from grid-angular's
[`core/`](https://github.com/inandusolutions/inandu-grid/tree/main/projects/inandu-grid/src/lib/core)
folder and kept in sync by hand across the two repos. The React-specific layer — the `<InanduGrid>`
component and the `useInanduGrid()` headless hook — covers sorting (single- and, via shift-click,
multi-column), free-text search, per-column filtering, pagination, single-column grouping with
aggregates, row selection, CSV/Excel(.xls)/PDF export, print, i18n (the 5 built-in languages, via a
`lang` prop), inline row editing/creation/deletion with validation
(required/min/max/pattern/custom/async), Excel-style Ctrl+C/Ctrl+V clipboard copy/paste, runtime
column show/hide, sticky (pinned left/right) columns, column drag-reorder, column resize (drag a
header's handle) and autosize (double-click it to fit content), row drag-reorder, tree data
(`treeChildrenKey`, display + expand only — no inline editing/drag/clipboard on tree rows, same
restriction as grid-angular), master-detail (`renderDetail`), and row virtualization
(`virtualScroll`) for large datasets.

Two things work slightly differently from grid-angular because they need a real browser layout
engine that a unit-test environment can't provide: virtual scroll's row height isn't
auto-measured — pass `virtualRowHeight` explicitly — and autosize's content measurement itself is
trusted (ported verbatim, same DOM APIs) rather than end-to-end tested; see
[`measureColumn.ts`](src/utils/measureColumn.ts)'s doc comment for exactly what its test suite does
and doesn't cover.

- **Angular version:** [`inandu-grid`](https://github.com/inandusolutions/inandu-grid) — the
  original, feature-complete, MIT-licensed grid. Start there if you need something production-ready
  today.
- **Commercial add-ons for React:** `@inandu-solutions/grid-pro-react` *(private, paid, not released
  yet)* — the React port of `@inandu-solutions/grid-pro`, depends on this package the same way
  grid-pro depends on grid-angular.
- **Package:** will ship as [`@inandu-solutions/grid-react`](https://www.npmjs.com/package/@inandu-solutions/grid-react)
  (MIT) — npm publishing is deferred until the API stabilizes.
- **⚡ StackBlitz:** [a minimal editable example](https://stackblitz.com/github/inandusolutions/inandu-grid-react/tree/main/examples/stackblitz) —
  the grid in a bare React app; edit `src/App.tsx` and it updates live ([source](examples/stackblitz)).
  Imports straight from this repo's source (not npm — the package isn't published yet).

## Development

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest + React Testing Library
npm run build      # library build (dist/)
```

## API shape

```tsx
import { InanduGrid, useInanduGrid } from '@inandu-solutions/grid-react';

// Component: batteries-included table.
<InanduGrid rows={rows} columns={columns} />;

// Hook: headless — bring your own markup.
const { visibleRows, filteredRowCount, sort, setSort, filterValues, setFilterValue, page, setPage, pageCount } =
  useInanduGrid({ rows, columns, pageSize: 25 });
```

## License

MIT © [Inandu SAS](https://inandu.com)
