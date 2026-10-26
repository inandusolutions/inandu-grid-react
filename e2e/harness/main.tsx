import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { InanduGrid } from '../../src';
import type { InanduGridColumn, InanduGridRow } from '../../src';
import '../../src/styles/inandu-grid.css';

/**
 * One scenario per hash route (#basics, #editing, ...), so each spec loads exactly the grid it
 * drives. Data is deterministic: assertions can name concrete rows.
 */

const TEAMS = ['Research', 'Platform', 'Design', 'Sales', 'Support'];
const ROLES = ['Engineer', 'Lead', 'Manager', 'Analyst', 'Designer'];
const FIRST = ['Ada', 'Alan', 'Grace', 'Linus', 'Katherine', 'Edsger', 'Barbara', 'Donald', 'Radia', 'Margaret',
  'Ken', 'Hedy', 'Tim', 'Anita', 'Guido', 'Bjarne', 'Vint', 'Frances', 'Dennis', 'Sophie'];
const LAST = ['Lovelace', 'Turing', 'Hopper', 'Torvalds', 'Johnson', 'Dijkstra', 'Liskov', 'Knuth', 'Perlman', 'Hamilton',
  'Thompson', 'Lamarr', 'Berners-Lee', 'Borg', 'van Rossum', 'Stroustrup', 'Cerf', 'Allen', 'Ritchie', 'Wilson'];

function people(): InanduGridRow[] {
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

const personColumns: InanduGridColumn[] = [
  { field: 'name', headerText: 'Name' },
  { field: 'team', headerText: 'Team' },
  { field: 'role', headerText: 'Role' },
  { field: 'salary', headerText: 'Salary', type: 'number', format: '1.0-0', aggregate: 'avg' },
  { field: 'joined', headerText: 'Joined', type: 'date', format: 'DD/MM/YYYY' },
  { field: 'active', headerText: 'Active', type: 'boolean', format: 'Yes|No' },
];

function Basics() {
  const [rows] = useState(people);
  return <InanduGrid rows={rows} columns={personColumns} pageSize={8} selectable exportable columnToggle lang="en" />;
}

const editColumns: InanduGridColumn[] = [
  { field: 'name', headerText: 'Name', editable: true, required: true },
  { field: 'team', headerText: 'Team' },
  { field: 'role', headerText: 'Role', editable: true },
  { field: 'salary', headerText: 'Salary', type: 'number', format: '1.0-0', editable: true, min: 0 },
];

function Editing() {
  const [rows, setRows] = useState(() => people().slice(0, 8));
  const [log, setLog] = useState('');
  return (
    <>
      <InanduGrid
        rows={rows}
        columns={editColumns}
        deletable
        creatable
        onRowSave={({ row, values }) => {
          setRows(rs => rs.map(r => (r === row ? { ...r, ...values } : r)));
          setLog(`saved:${String(values['name'] ?? row['name'])}`);
        }}
        onRowCreate={values => {
          setRows(rs => [...rs, { id: Math.max(0, ...rs.map(r => Number(r['id']))) + 1, ...values }]);
          setLog(`created:${String(values['name'])}`);
        }}
        onRowDelete={row => {
          setRows(rs => rs.filter(r => r !== row));
          setLog(`deleted:${String(row['name'])}`);
        }}
        lang="en"
      />
      <output data-testid="log">{log}</output>
    </>
  );
}

function Tree() {
  const kids = (n: number, p: string) =>
    Array.from({ length: n }, (_, i) => ({ name: `${p} ${i + 1}`, role: 'Engineer', team: 'Platform' }));
  const [rows] = useState<InanduGridRow[]>(() => [
    { name: 'Grace Hopper', role: 'VP Engineering', team: 'Leadership', reports: [
      { name: 'Ada Lovelace', role: 'Eng Manager', team: 'Research', reports: kids(3, 'Researcher') },
      { name: 'Alan Turing', role: 'Eng Manager', team: 'Platform', reports: kids(2, 'Platform Eng') },
    ] },
    { name: 'Linus Torvalds', role: 'VP Infrastructure', team: 'Leadership', reports: [
      { name: 'Katherine Johnson', role: 'Eng Manager', team: 'Support', reports: kids(2, 'Support Eng') },
    ] },
  ]);
  const cols: InanduGridColumn[] = [
    { field: 'name', headerText: 'Name' }, { field: 'role', headerText: 'Role' }, { field: 'team', headerText: 'Team' },
  ];
  return <InanduGrid rows={rows} columns={cols} treeChildrenKey="reports" lang="en" />;
}

function orders(n: number): InanduGridRow[] {
  const status = ['Paid', 'Pending', 'Shipped', 'Refunded'];
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    customer: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
    status: status[(i * 13) % status.length],
    total: 20 + ((i * 7919) % 48000) / 100,
  }));
}

const orderColumns: InanduGridColumn[] = [
  { field: 'id', headerText: '#', type: 'number', width: 90 },
  { field: 'customer', headerText: 'Customer' },
  { field: 'status', headerText: 'Status' },
  { field: 'total', headerText: 'Total', type: 'number', format: '1.2-2' },
];

function Virtual() {
  const [rows] = useState(() => orders(10000));
  return <InanduGrid rows={rows} columns={orderColumns} virtualScroll virtualRowHeight={40} height={380} lang="en" />;
}

function Detail() {
  const [rows] = useState(() => orders(40));
  const cols: InanduGridColumn[] = orderColumns.map(c =>
    c.field === 'status'
      ? { ...c, renderCell: ({ value }) => <span data-testid="pill">{String(value)}</span> }
      : c,
  );
  return (
    <InanduGrid
      rows={rows}
      columns={cols}
      pageSize={8}
      lang="en"
      renderDetail={row => <div data-testid="detail">Order #{String(row['id'])} for {String(row['customer'])}</div>}
    />
  );
}


const interactionColumns: InanduGridColumn[] = [
  { field: 'name', headerText: 'Name', pinned: 'left', width: 200, editable: true },
  { field: 'team', headerText: 'Team', width: 320 },
  { field: 'role', headerText: 'Role', width: 320 },
  { field: 'salary', headerText: 'Salary', type: 'number', format: '1.0-0', width: 320 },
  { field: 'joined', headerText: 'Joined', type: 'date', format: 'DD/MM/YYYY', width: 320 },
];

function Interactions() {
  const [rows, setRows] = useState(() => people().slice(0, 6));
  const [log, setLog] = useState('');
  return (
    <>
      <InanduGrid
        rows={rows}
        columns={interactionColumns}
        clipboard
        cellRangeSelection
        rowReorder
        autosize
        lang="en"
        onRowOrderChange={next => {
          setRows(next);
          setLog(`order:${next.map(r => String(r['id'])).join(',')}`);
        }}
        onCellsPaste={updates => {
          setRows(rs => rs.map(r => {
            const mine = updates.filter(u => u.row === r);
            return mine.length ? { ...r, ...Object.fromEntries(mine.map(u => [u.field, u.value])) } : r;
          }));
          setLog(`paste:${updates.length}`);
        }}
      />
      <output data-testid="log">{log}</output>
    </>
  );
}

function Spanish() {
  const [rows] = useState(() => people().slice(0, 8));
  return <InanduGrid rows={rows} columns={editColumns} exportable creatable deletable lang="es" />;
}

const SCENARIOS: Record<string, () => ReactElement> = {
  basics: Basics,
  editing: Editing,
  tree: Tree,
  virtual: Virtual,
  detail: Detail,
  interactions: Interactions,
  es: Spanish,
};

function App() {
  const key = location.hash.replace(/^#\/?/, '') || 'basics';
  const Scenario = SCENARIOS[key] ?? Basics;
  return (
    <main data-scenario={key}>
      <Scenario />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
