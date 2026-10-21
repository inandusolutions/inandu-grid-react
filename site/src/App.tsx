import { useState } from 'react';
import { InanduGrid } from '@inandu-solutions/grid-react';
import type { InanduGridColumn, InanduGridRow } from '@inandu-solutions/grid-react';
import { FeatureExplorer } from './FeatureExplorer';
import { highlight } from './highlight';
import type { DemoTab } from './features';

const NPM_INSTALL = 'npm install @inandu-solutions/grid-react';

const USE_IT_SNIPPET = `import { InanduGrid } from '@inandu-solutions/grid-react';

<InanduGrid
  rows={rows}
  columns={[
    { field: 'company', headerText: 'Company', sortable: true, filterable: true },
    { field: 'revenue', headerText: 'Revenue', type: 'number', aggregate: 'sum' },
  ]}
  selectable
  exportable
  pageSize={25}
/>;`;

export function App() {
  const [tab, setTab] = useState<DemoTab>('basics');
  const [copied, setCopied] = useState(false);

  const openDemo = (t: DemoTab) => {
    setTab(t);
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  const copyInstall = () => {
    navigator.clipboard?.writeText(NPM_INSTALL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      <nav className="nav">
        <a className="nav-brand" href="#top">
          <span style={{ color: 'var(--accent)' }}>inandu-grid</span>-react
        </a>
        <div className="nav-links">
          <a href="#demo">Demo</a>
          <a href="#features">Features</a>
          <a href="#start">Get started</a>
          <a
            className="nav-icon"
            href="https://www.npmjs.com/package/@inandu-solutions/grid-react"
            aria-label="npm"
          >
            npm
          </a>
          <a className="nav-icon" href="https://github.com/inandusolutions/inandu-grid-react" aria-label="GitHub">
            GitHub
          </a>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap">
          <span className="badge">
            <i className="dot" aria-hidden="true" />
            MIT licensed &middot; React 18 / 19 &middot; no enterprise tier</span>
          <h1>
            The React data grid with <span className="hl">nothing behind a paywall</span>.
          </h1>
          <p className="lede">
            Sorting, filtering, grouping, virtual scroll, inline editing and CSV / Excel / PDF export — every
            feature on this page is free and open source. A component and a headless hook, both from day one.
          </p>
          <div className="cta-row">
            <a className="btn solid" href="#demo">
              Try the live demo
            </a>
            <a className="btn" href="https://stackblitz.com/github/inandusolutions/inandu-grid-react/tree/main/examples/stackblitz">
              Open in StackBlitz
            </a>
          </div>
          <div className="install-snippet">
            <span className="prompt">$</span>
            <code>{NPM_INSTALL}</code>
            <button className="copy-btn" onClick={copyInstall} type="button">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </header>

      <section id="demo">
        <div className="wrap">
          <span className="eyebrow">Live demo</span>
          <h2>See it working</h2>
          <p className="demo-note">Not screenshots — the real component, running here.</p>

          <div className="tabs">
            <button className={`tab ${tab === 'basics' ? 'active' : ''}`} onClick={() => setTab('basics')} type="button">
              Grid basics
            </button>
            <button className={`tab ${tab === 'editing' ? 'active' : ''}`} onClick={() => setTab('editing')} type="button">
              Inline editing
            </button>
            <button className={`tab ${tab === 'tree' ? 'active' : ''}`} onClick={() => setTab('tree')} type="button">
              Tree data
            </button>
            <button className={`tab ${tab === 'virtual' ? 'active' : ''}`} onClick={() => setTab('virtual')} type="button">
              10,000 rows
            </button>
            <button className={`tab ${tab === 'slots' ? 'active' : ''}`} onClick={() => setTab('slots')} type="button">
              Custom cells &amp; detail
            </button>
          </div>

          <div className="demo-panel">
            {tab === 'basics' && <BasicsDemo />}
            {tab === 'editing' && <EditingDemo />}
            {tab === 'tree' && <TreeDemo />}
            {tab === 'virtual' && <VirtualDemo />}
            {tab === 'slots' && <SlotsDemo />}
          </div>
        </div>
      </section>

      <section id="features" className="band">
        <div className="wrap">
          <span className="eyebrow">Features</span>
          <h2>Everything on the list, free</h2>
          <p className="section-lede">
            Pick a feature to see the code that turns it on. The real prop and callback names — copy, paste, done.
          </p>
          <FeatureExplorer onOpenDemo={openDemo} />
        </div>
      </section>

      <section id="start">
        <div className="wrap">
          <span className="eyebrow">Get started</span>
          <h2>Two steps and a grid</h2>
          <div className="start-grid">
            <div>
              <h3>1 &middot; Install</h3>
              <pre className="code-block">{NPM_INSTALL}</pre>
            </div>
            <div>
              <h3>2 &middot; Use it</h3>
              <pre className="code-block" dangerouslySetInnerHTML={{ __html: highlight(USE_IT_SNIPPET) }} />
            </div>
          </div>
          <div className="start-buttons">
            <a className="btn solid" href="https://github.com/inandusolutions/inandu-grid-react">
              Source on GitHub
            </a>
            <a className="btn" href="https://stackblitz.com/github/inandusolutions/inandu-grid-react/tree/main/examples/stackblitz">
              Open in StackBlitz
            </a>
            <a className="btn" href="https://github.com/inandusolutions/inandu-grid">
              Angular version
            </a>
            <a className="btn" href="https://github.com/inandusolutions/inandu-grid-vue">
              Vue version
            </a>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap footer-row">
          <div>
            <strong>inandu-grid-react</strong> &mdash; MIT &copy; <a href="https://www.inandu.com/">Inandu SAS</a>
          </div>
          <div className="footer-links">
            <a href="https://github.com/inandusolutions/inandu-grid-react">GitHub</a>
            <a href="https://www.npmjs.com/package/@inandu-solutions/grid-react">npm</a>
            <a href="https://github.com/inandusolutions/inandu-grid">Angular version</a>
            <a href="https://github.com/inandusolutions/inandu-grid-vue">Vue version</a>
          </div>
        </div>
      </footer>
    </>
  );
}

const TEAMS = ['Research', 'Platform', 'Design', 'Sales', 'Support'];
const ROLES = ['Engineer', 'Lead', 'Manager', 'Analyst', 'Designer'];
const FIRST = [
  'Ada', 'Alan', 'Grace', 'Linus', 'Katherine', 'Edsger', 'Barbara', 'Donald', 'Radia', 'Margaret',
  'Ken', 'Hedy', 'Tim', 'Anita', 'Guido', 'Bjarne', 'Vint', 'Frances', 'Dennis', 'Sophie',
];
const LAST = [
  'Lovelace', 'Turing', 'Hopper', 'Torvalds', 'Johnson', 'Dijkstra', 'Liskov', 'Knuth', 'Perlman', 'Hamilton',
  'Thompson', 'Lamarr', 'Berners-Lee', 'Borg', 'van Rossum', 'Stroustrup', 'Cerf', 'Allen', 'Ritchie', 'Wilson',
];

function buildPeople(): InanduGridRow[] {
  return FIRST.map((f, i) => ({
    id: i + 1,
    name: `${f} ${LAST[i]}`,
    team: TEAMS[i % TEAMS.length],
    role: ROLES[i % ROLES.length],
    salary: 90000 + ((i * 7919) % 80000),
    joined: new Date(2016 + (i % 9), (i * 5) % 12, 1 + (i % 27)),
    active: i % 4 !== 0,
  }));
}

const basicsColumns: InanduGridColumn[] = [
  { field: 'name', headerText: 'Name' },
  { field: 'team', headerText: 'Team' },
  { field: 'role', headerText: 'Role' },
  { field: 'salary', headerText: 'Salary', type: 'number', format: '1.0-0', aggregate: 'avg' },
  { field: 'joined', headerText: 'Joined', type: 'date', format: 'DD/MM/YYYY' },
  { field: 'active', headerText: 'Active', type: 'boolean', format: 'Yes|No' },
];

function BasicsDemo() {
  const [rows] = useState(buildPeople);
  return (
    <>
      <p className="demo-note" style={{ marginBottom: '1rem' }}>
        Click a header to sort (shift-click for a second column) &middot; use the search box &middot; the toolbar
        exports CSV, Excel and PDF.
      </p>
      <InanduGrid rows={rows} columns={basicsColumns} pageSize={8} selectable exportable columnToggle lang="en" />
    </>
  );
}

const editingColumns: InanduGridColumn[] = [
  { field: 'name', headerText: 'Name', editable: true, required: true },
  { field: 'team', headerText: 'Team' },
  { field: 'role', headerText: 'Role', editable: true },
  { field: 'salary', headerText: 'Salary', type: 'number', format: '1.0-0', editable: true, min: 0 },
];

function EditingDemo() {
  const [rows, setRows] = useState(() => buildPeople().slice(0, 8));
  return (
    <>
      <p className="demo-note" style={{ marginBottom: '1rem' }}>
        Click the pencil to edit a row &middot; required / min / max are validated at save time.
      </p>
      <InanduGrid
        rows={rows}
        columns={editingColumns}
        deletable
        creatable
        onRowSave={({ row, values }) => setRows(rs => rs.map(r => (r === row ? { ...r, ...values } : r)))}
        onRowCreate={values => setRows(rs => [...rs, { id: Math.max(0, ...rs.map(r => Number(r.id))) + 1, ...values }])}
        onRowDelete={row => setRows(rs => rs.filter(r => r !== row))}
        lang="en"
      />
    </>
  );
}

function buildOrgChart(): InanduGridRow[] {
  const reports = (n: number, prefix: string) =>
    Array.from({ length: n }, (_, i) => ({ name: `${prefix} ${i + 1}`, role: 'Engineer', team: 'Platform' }));
  return [
    { name: 'Grace Hopper', role: 'VP Engineering', team: 'Leadership', reports: [
      { name: 'Ada Lovelace', role: 'Eng Manager', team: 'Research', reports: reports(3, 'Researcher') },
      { name: 'Alan Turing', role: 'Eng Manager', team: 'Platform', reports: reports(2, 'Platform Eng') },
    ] },
    { name: 'Linus Torvalds', role: 'VP Infrastructure', team: 'Leadership', reports: [
      { name: 'Katherine Johnson', role: 'Eng Manager', team: 'Support', reports: reports(2, 'Support Eng') },
    ] },
  ];
}

const treeColumns: InanduGridColumn[] = [
  { field: 'name', headerText: 'Name' },
  { field: 'role', headerText: 'Role' },
  { field: 'team', headerText: 'Team' },
];

function TreeDemo() {
  const [rows] = useState(buildOrgChart);
  return (
    <>
      <p className="demo-note" style={{ marginBottom: '1rem' }}>
        Nested rows via <code>treeChildrenKey</code> &middot; click a row to expand/collapse it.
      </p>
      <InanduGrid rows={rows} columns={treeColumns} treeChildrenKey="reports" treeDefaultExpanded="all" lang="en" />
    </>
  );
}

function buildOrders(n: number): InanduGridRow[] {
  const status = ['Paid', 'Pending', 'Shipped', 'Refunded'];
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    customer: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
    status: status[(i * 13) % status.length],
    total: 20 + ((i * 7919) % 48000) / 100,
    placed: new Date(2024, i % 12, 1 + (i % 27)),
  }));
}

const orderColumns: InanduGridColumn[] = [
  { field: 'id', headerText: '#', type: 'number', width: 90 },
  { field: 'customer', headerText: 'Customer' },
  { field: 'status', headerText: 'Status' },
  { field: 'total', headerText: 'Total', type: 'number', format: '1.2-2' },
  { field: 'placed', headerText: 'Placed', type: 'date', format: 'DD/MM/YYYY' },
];

function VirtualDemo() {
  const [rows] = useState(() => buildOrders(10000));
  return (
    <>
      <p className="demo-note" style={{ marginBottom: '1rem' }}>
        10,000 rows with <code>virtualScroll</code> &middot; only the visible ones are in the DOM &middot; sort, search and
        filter still work.
      </p>
      <InanduGrid rows={rows} columns={orderColumns} virtualScroll virtualRowHeight={40} height={380} lang="en" />
    </>
  );
}

const slotColumns: InanduGridColumn[] = orderColumns.map(c =>
  c.field === 'status'
    ? { ...c, renderCell: ({ value }) => <span className={`pill pill-${String(value).toLowerCase()}`}>{String(value)}</span> }
    : c,
);

function SlotsDemo() {
  const [rows] = useState(() => buildOrders(40));
  return (
    <>
      <p className="demo-note" style={{ marginBottom: '1rem' }}>
        A column&apos;s <code>renderCell</code> swaps the plain text for a badge &middot; <code>renderDetail</code> adds an
        expandable row.
      </p>
      <InanduGrid
        rows={rows}
        columns={slotColumns}
        pageSize={8}
        lang="en"
        renderDetail={row => (
          <div className="detail-card">
            <strong>Order #{String(row.id)}</strong> for {String(row.customer)} &mdash; ${Number(row.total).toFixed(2)}, currently{' '}
            <em>{String(row.status).toLowerCase()}</em>.
          </div>
        )}
      />
    </>
  );
}
