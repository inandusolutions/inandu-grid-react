# Accessibility

What is checked automatically, how the grid works with the keyboard, and the checklist to run by hand before a release.

## What is checked automatically

`e2e/accessibility.e2e.ts` runs axe-core over the demo grid with the structural and ARIA rules the grid is responsible for (roles,
required parents and children, attribute validity, button and label names, table headers, duplicate ids). Colour contrast is left out on
purpose: it depends on the theme the application picks, not on the grid's markup. The selection and column-toggle checkboxes are also
asserted to be at least 24 x 24 CSS pixels (WCAG 2.2, 2.5.8). Sorting exposes `aria-sort` and a selected row exposes `aria-selected`.

`e2e/virtualization.e2e.ts` checks the keyboard on a 10,000-row virtual grid (below).

What axe does not prove: whether a keyboard user can operate the grid, or what a screen reader says. That is the checklist at the end.

## Keyboard

The grid is one tab stop (roving tabindex): Tab enters on the first column header and the arrow keys move inside.

| Key | Does |
| --- | --- |
| Arrow keys | Move one cell |
| Home / End | First / last cell of the row |
| Ctrl+Home / Ctrl+End | First cell of the grid (the header) / last cell of the last row |
| PageUp / PageDown | Ten rows up / down |
| Enter or Space on a header | Sort by that column; with Shift, add it as a secondary sort |
| Ctrl+C / Ctrl+V on a cell | Copy / paste, when `clipboard` is on |

### With `virtualScroll`

Only the rows near the viewport are in the DOM, so the keyboard works on the row **index**, not on what happens to be mounted:

- A move to a row that is not mounted yet scrolls it into view and focuses the cell once it has rendered. A fast run of ArrowDown or
  PageDown never loses a key, and Ctrl+End goes to the real last row, not the last mounted one.
- If the focused cell's row scrolls out of the window (mouse wheel, scrollbar, code), focus waits on the grid's scrollable area instead
  of falling to `<body>`, where Tab would restart from the top of the page. When the row is mounted again, focus returns to that cell.
- ArrowUp or PageUp from the first data row goes to the header, as in a grid without virtualization.

## Manual checklist before a release

Keyboard only (no mouse), in a real browser, with the application's own styling:

- [ ] Tab reaches the grid once, and Shift+Tab leaves it; the focused cell has a visible focus indicator.
- [ ] Arrow keys, Home, End, PageUp and PageDown move as in the table above, also with `virtualScroll` on a long list.
- [ ] Enter or Space on a header sorts; the sort direction is announced (`aria-sort`).
- [ ] The column filters, the search box and the pager can be reached and used, in a sensible order.
- [ ] Grouping: the group header rows are read with their count of rows (a grouped grid is not virtualized).
- [ ] Editing: Edit puts focus in the first editor, Save and Cancel are reachable, a validation message is announced and the invalid field is identified, and after Save or Cancel focus is somewhere sensible.
- [ ] Selection: the row checkboxes and "select all" can be operated; the selection count is announced.
- [ ] The export buttons have names (icons alone are not enough) and the download or print dialog does not trap focus.
- [ ] With a screen reader (NVDA or VoiceOver): the table is announced with its row and column counts, header cells are read with each data cell, and a virtual grid reports the full `aria-rowcount`.
