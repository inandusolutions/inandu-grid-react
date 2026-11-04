# Changelog

All notable changes to **@inandu-solutions/grid-react** are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases up to 0.2.1 are listed on the [GitHub Releases](https://github.com/inandusolutions/inandu-grid-react/releases) page;
entries below start from the next release.

## [Unreleased]

## [0.3.0] - 2026-11-04

### Changed

- The framework-agnostic core is now the `@inandu-solutions/grid-core` package (a dependency) instead of a copy in
  `src/core`, shared with the Angular and Vue grids. With it come the fixes made there: a bare `yyyy-mm-dd` cell is
  read as a local calendar day (it showed the previous day west of UTC), CSV cells that start with `=`, `+`, `-`,
  `@`, a tab or a carriage return are prefixed with a quote so a spreadsheet does not run them as formulas, the
  Excel export drops characters XML cannot carry, `downloadBlob` revokes its URL a second after the click, and tree
  flattening terminates on cyclic data.
- `extraParams` still replace a parameter of the same name that the grid sends (`page`, `pageSize`, `sort`, a column
  filter), as before, but now log a one-time console warning for that key so an accidental collision is not silent.

### Documentation

- `extraRowFilter` now says that its identity must be stable (declare it outside the component or use `useCallback`):
  a new function on every render re-filters and re-sorts all rows each time.

### Added

- `rowId` (a field name or a function) on `<InanduGrid>` and `useInanduGrid`: selection, tree expansion and
  master-detail expansion are remembered by that key instead of by the row object. Without it the row's `id`
  field is used when present, otherwise the row object, as before. See the README.

### Fixed

- Selection and expanded rows were lost whenever `rows` held new objects for the same rows (a server-side page
  change, `reload()`, a refetch). They are now kept by key, and the selected rows from other pages stay selected.
- With tree data, a parent that passed a new derived `rows` array on each render undid the user's expand and
  collapse. Default expansion now applies once per node, when its key first appears.
- Row React keys fell back to the row index when `id` was missing, so sorting, filtering or drag-reorder could attach
  edit state to the wrong row, and the string id `"1"` collided with index 1. Keys are now unique and stable per row.
- Server-side set filter: a value that contains a comma (`Smith, John`) no longer turns into two values. When any set-filter
  value has a comma, is empty or has leading/trailing spaces, the request sends every `{field}_in` once per value and adds
  `inEncoding=repeat`; otherwise the comma form is unchanged, so older servers keep working.
- Server-side set filter: unticking every value (an empty set) now sends `{field}_none=1` and matches no rows, as it does
  client-side. Before, the empty set was dropped and every row came back. Needs `Inandu.Grid.Extensions` 0.7.0 or later;
  an older server ignores the parameter and behaves as before.

## [0.2.3] - 2026-11-04

### Accessibility

- Column headers expose `aria-sort` (`ascending` / `descending` / `none`).
- Data rows expose `aria-selected` when the grid is `selectable`.
- With `pageSize`, `virtualScroll` or `serverSide`, the table exposes `aria-rowcount` (both header rows
  included), so assistive technology can say "row 3 of 240" although only a page is in the DOM.
- A visually hidden polite live region (`role="status"`) announces an empty result. The message now appears
  twice in the DOM (the visible cell and the live region): in your own tests, query it inside the table
  (`within(screen.getByRole('table'))`).

The table keeps its native `table` role on purpose: `role="grid"` promises arrow-key cell navigation, which this
grid does not implement.

## [0.2.2] - 2026-11-03

### Fixed

- `package.json` now declares `sideEffects: ["*.css"]` instead of `false`, so bundlers (webpack, Rollup, Vite production builds) no longer tree-shake away `style.css` when it is imported for its side effects.

### Documentation

- `InanduEditRenderContext`: document that `renderEditor` receives the raw control shape, so arrays and objects arrive as text, and how to handle them.

[Unreleased]: https://github.com/inandusolutions/inandu-grid-react/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/inandusolutions/inandu-grid-react/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/inandusolutions/inandu-grid-react/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/inandusolutions/inandu-grid-react/compare/v0.2.1...v0.2.2
