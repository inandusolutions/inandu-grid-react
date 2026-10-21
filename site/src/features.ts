export type DemoTab = 'basics' | 'editing' | 'tree' | 'virtual' | 'slots';
export type Tone = 'teal' | 'green' | 'amber' | 'violet' | 'rose' | 'blue';

export interface Feature {
  id: string;
  title: string;
  blurb: string;
  tone: Tone;
  /** Key into the ICONS map in FeatureExplorer.tsx. */
  icon: string;
  code: string;
  /** Demo tab that shows this feature running, when there is one. */
  demo?: DemoTab;
  /** README anchor on GitHub. */
  doc: string;
}

export const readme = (anchor: string) => `https://github.com/inandusolutions/inandu-grid-react#${anchor}`;

// Snippets are the real prop / callback names — keep them in sync with src/components/InanduGrid.tsx.
export const FEATURES: Feature[] = [
  {
    id: 'sort-filter',
    title: 'Sorting & filtering',
    blurb:
      'Click a header to sort, shift-click for a second column. Free-text search covers every column, and each column gets a filter control that matches its type. Need your own rule? Layer a predicate on top.',
    tone: 'teal',
    icon: 'sort',
    demo: 'basics',
    doc: 'features',
    code: `<InanduGrid
  rows={rows}
  columns={columns}
  pageSize={25}
  extraRowFilter={row => row.active === true}
/>`,
  },
  {
    id: 'grouping',
    title: 'Grouping & aggregates',
    blurb:
      'Group by any column and get live sum / avg / min / max / count per group, plus grand totals. Declare the aggregate once on the column — no extra wiring.',
    tone: 'green',
    icon: 'layers',
    demo: 'basics',
    doc: 'features',
    code: `const columns: InanduGridColumn[] = [
  { field: 'team', headerText: 'Team' },
  { field: 'salary', headerText: 'Salary', type: 'number',
    format: '1.0-0', aggregate: 'avg' },
];
// then pick "Team" in the grid's group-by control`,
  },
  {
    id: 'export',
    title: 'CSV / Excel / PDF export',
    blurb:
      'One flag adds a toolbar that exports exactly the rows you are looking at. jspdf is lazy-loaded, so the PDF path costs nothing until someone clicks it.',
    tone: 'amber',
    icon: 'download',
    demo: 'basics',
    doc: 'features',
    code: `<InanduGrid
  rows={rows}
  columns={columns}
  exportable  // CSV, Excel (.xls), PDF and Print
/>`,
  },
  {
    id: 'editing',
    title: 'Inline editing & validation',
    blurb:
      'Mark columns editable and the grid handles edit, create and delete. Required / min / max / pattern, a custom validator and async validators all run at save time. The grid never mutates your rows — callbacks hand you the change.',
    tone: 'violet',
    icon: 'pencil',
    demo: 'editing',
    doc: 'api-shape',
    code: `const columns: InanduGridColumn[] = [
  { field: 'name', editable: true, required: true },
  { field: 'salary', type: 'number', editable: true, min: 0 },
];

<InanduGrid rows={rows} columns={columns} creatable deletable
  onRowSave={({ row, values }) => update(row, values)} />`,
  },
  {
    id: 'columns',
    title: 'Columns, your way',
    blurb:
      'Resize by dragging, autosize with a double-click, drag headers to reorder, pin columns left or right, and let users show or hide columns at runtime.',
    tone: 'blue',
    icon: 'columns',
    demo: 'basics',
    doc: 'features',
    code: `const columns: InanduGridColumn[] = [
  { field: 'name', pinned: 'left', width: 180 },
  { field: 'team', hideable: false },
  { field: 'salary', reorder: false },
];

<InanduGrid columns={columns} columnToggle autosize />`,
  },
  {
    id: 'range',
    title: 'Range selection & clipboard',
    blurb:
      'Click and drag across cells to select a block, hold Ctrl or shift for more ranges, and copy the whole selection as TSV straight into Excel. Paste works too.',
    tone: 'rose',
    icon: 'grid',
    doc: 'features',
    code: `<InanduGrid
  rows={rows}
  columns={columns}
  cellRangeSelection
  multiRange
  clipboard
  onCellRangeChange={onRange}
/>`,
  },
  {
    id: 'virtual',
    title: 'Virtual scroll',
    blurb:
      'Render only the rows in view, so ten thousand rows scroll as smoothly as ten. Give it a fixed row height and a viewport height and you are done.',
    tone: 'green',
    icon: 'zap',
    demo: 'virtual',
    doc: 'features',
    code: `<InanduGrid
  rows={tenThousandRows}
  columns={columns}
  virtualScroll
  virtualRowHeight={40}
  height={400}
/>`,
  },
  {
    id: 'server',
    title: 'Server-side data',
    blurb:
      'Let the backend sort, filter and page. The hook turns grid state into a query string, aborts superseded requests, debounces typing and keeps the previous page on screen while the next one loads.',
    tone: 'amber',
    icon: 'server',
    doc: 'server-side-data',
    code: `const server = useInanduGridServer({ url: '/api/products' });

<InanduGrid
  rows={server.rows}
  columns={columns}
  pageSize={25}
  serverSide={{ totalItems: server.total }}
  onQueryChange={server.setQuery}
/>`,
  },
  {
    id: 'slots',
    title: 'Custom cells & master-detail',
    blurb:
      'Replace any cell, header or editor with your own component through render props — sorting, resizing and validation keep working. Add an expandable detail row with one more prop.',
    tone: 'violet',
    icon: 'puzzle',
    demo: 'slots',
    doc: 'api-shape',
    code: `const columns: InanduGridColumn[] = [
  { field: 'status',
    renderCell: ({ value }) => <StatusBadge status={value} /> },
];

<InanduGrid rows={rows} columns={columns}
  renderDetail={row => <OrderLines order={row} />} />`,
  },
  {
    id: 'tree',
    title: 'Tree data',
    blurb:
      'Point the grid at the key that holds each row’s children and it renders an expandable tree. Start collapsed, or expand everything with one value.',
    tone: 'teal',
    icon: 'tree',
    demo: 'tree',
    doc: 'features',
    code: `const rows = [
  { name: 'Grace Hopper', reports: [
    { name: 'Ada Lovelace', reports: [/* … */] },
  ] },
];

<InanduGrid rows={rows} columns={columns}
  treeChildrenKey="reports" treeDefaultExpanded="all" />`,
  },
  {
    id: 'i18n',
    title: 'i18n',
    blurb:
      'English, Spanish, French, Italian and Chinese are bundled. Switch with one prop — labels, filter placeholders, export buttons and validation messages all follow.',
    tone: 'blue',
    icon: 'globe',
    doc: 'features',
    code: `<InanduGrid rows={rows} columns={columns} lang="es" />

// en · es · fr · it · zh`,
  },
  {
    id: 'headless',
    title: 'Headless hook',
    blurb:
      'Want your own markup? useInanduGrid() gives you the whole engine — sorted, filtered, grouped, paged rows and every action — as state, with no DOM attached.',
    tone: 'rose',
    icon: 'code',
    doc: 'api-shape',
    code: `const { visibleRows, toggleSort, page, setPage, pageCount } =
  useInanduGrid({ rows, columns, pageSize: 25 });

// render visibleRows however you like
<button onClick={() => toggleSort('name')}>Sort by name</button>`,
  },
];
