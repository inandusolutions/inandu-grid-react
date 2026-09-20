# inandu-grid-react

The React port of [`@inandu-solutions/grid-angular`](https://github.com/inandusolutions/inandu-grid) —
a standalone data grid: sorting, filtering, grouping, pagination, virtual scroll, inline editing,
CSV/Excel/PDF export, i18n and theming, with a deliberately small dependency footprint.

**Status: early work in progress, not yet published to npm.** The framework-agnostic core (sorting,
filtering, aggregation, export, i18n) is ported from grid-angular's
[`core/`](https://github.com/inandusolutions/inandu-grid/tree/main/projects/inandu-grid/src/lib/core)
folder and kept in sync by hand across the two repos. The React-specific layer — the `<InanduGrid>`
component and the `useInanduGrid()` headless hook — currently covers sorting (single- and, via
shift-click, multi-column), free-text search,
per-column filtering, pagination, single-column grouping with aggregates, row selection,
CSV/Excel(.xls)/PDF export, print, i18n (the 5 built-in languages, via a `lang` prop), inline row
editing/creation/deletion with validation (required/min/max/pattern/custom/async), Excel-style
Ctrl+C/Ctrl+V clipboard copy/paste, runtime column show/hide, sticky (pinned left/right) columns,
and column drag-reorder. Virtualization, column resize, row drag-reorder, and tree/master-detail
data are not ported yet.

- **Angular version:** [`inandu-grid`](https://github.com/inandusolutions/inandu-grid) — the
  original, feature-complete, MIT-licensed grid. Start there if you need something production-ready
  today.
- **Commercial add-ons for React:** `@inandu-solutions/grid-pro-react` *(private, paid, not released
  yet)* — the React port of [`@inandu-solutions/grid-pro`](https://github.com/inandusolutions/inandu-grid#readme),
  depends on this package the same way grid-pro depends on grid-angular.
- **Package:** will ship as [`@inandu-solutions/grid-react`](https://www.npmjs.com/package/@inandu-solutions/grid-react)
  (MIT) — npm publishing is deferred until the API stabilizes.

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
