# Changelog

All notable changes to **@inandu-solutions/grid-react** are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases up to 0.2.1 are listed on the [GitHub Releases](https://github.com/inandusolutions/inandu-grid-react/releases) page;
entries below start from the next release.

## [Unreleased]

### Fixed

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

[Unreleased]: https://github.com/inandusolutions/inandu-grid-react/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/inandusolutions/inandu-grid-react/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/inandusolutions/inandu-grid-react/compare/v0.2.1...v0.2.2
