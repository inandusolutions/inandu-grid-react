# inandu-grid-react

The React port of [`@inandu-solutions/grid-angular`](https://github.com/inandusolutions/inandu-grid) —
a standalone data grid: sorting, filtering, grouping, pagination, virtual scroll, inline editing,
CSV/Excel/PDF export, i18n and theming, with a deliberately small dependency footprint.

**Status: early work in progress, not yet published to npm.** The framework-agnostic core (sorting,
filtering, aggregation, export, i18n) is ported from grid-angular's
[`core/`](https://github.com/inandusolutions/inandu-grid/tree/main/projects/inandu-grid/src/lib/core)
folder and kept in sync by hand across the two repos. The React-specific layer — the `<InanduGrid>`
component and the `useInanduGrid()` headless hook — currently covers sorting, free-text search,
per-column filtering, pagination, single-column grouping with aggregates, row selection, and
CSV/Excel(.xls)/PDF export; virtualization and inline editing are not ported yet.

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
