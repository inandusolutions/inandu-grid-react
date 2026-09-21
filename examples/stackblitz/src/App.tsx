import { useState } from 'react';
import { InanduGrid, InanduGridColumn, InanduGridRow } from '@inandu-solutions/grid-react';

const columns: InanduGridColumn[] = [
  { field: 'name', headerText: 'Name' },
  { field: 'team', headerText: 'Team' }, // groupable by default — try the "Group by" dropdown
  { field: 'role', headerText: 'Role' },
  { field: 'salary', headerText: 'Salary', type: 'number', format: '1.0-0', aggregate: 'avg' },
  { field: 'joined', headerText: 'Joined', type: 'date', format: 'DD/MM/YYYY' },
  { field: 'active', headerText: 'Active', type: 'boolean', format: 'Yes|No' },
];

const people = buildPeople();

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function App() {
  const [selected, setSelected] = useState<InanduGridRow[]>([]);

  return (
    <div style={{ fontFamily: FONT, color: '#1b1f24', background: '#fbfaf7', minHeight: '100vh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.9rem 1.5rem',
          borderBottom: '1px solid #e4e0d6',
          background: '#fff',
        }}
      >
        <strong style={{ fontSize: '1.05rem' }}>
          <span style={{ color: '#1a8fae' }}>inandu-grid</span>-react
        </strong>
        <nav style={{ display: 'flex', gap: '1.25rem', fontSize: '0.9rem' }}>
          <a href="https://github.com/inandusolutions/inandu-grid-react" style={{ color: '#5c6470' }}>
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/@inandu-solutions/grid-react" style={{ color: '#5c6470' }}>
            npm
          </a>
        </nav>
      </header>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '2rem 1.5rem 3rem' }}>
        <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem' }}>@inandu-solutions/grid-react</h1>
        <p style={{ color: '#3a4048', lineHeight: 1.5, maxWidth: 720 }}>
          Edit <code>src/App.tsx</code> — the grid updates live. Try the search box, the column-filter
          row, sorting (shift-click a header for multi-sort), the "Columns" toggle, the "Group by"
          dropdown, or the export toolbar.
        </p>

        <div
          style={{
            marginTop: '1.5rem',
            background: '#fff',
            border: '1px solid #e4e0d6',
            borderRadius: 8,
            padding: '1rem',
            boxShadow: '0 8px 24px -16px rgba(27, 31, 36, 0.25)',
          }}
        >
          <InanduGrid
            rows={people}
            columns={columns}
            pageSize={8}
            selectable
            exportable
            columnToggle
            lang="en"
            onSelectionChange={setSelected}
          />
        </div>

        <p style={{ color: '#5c6470', fontSize: '0.9rem' }}>{selected.length} row(s) selected.</p>
      </main>
    </div>
  );
}

function buildPeople(): InanduGridRow[] {
  const teams = ['Research', 'Platform', 'Design', 'Sales', 'Support'];
  const roles = ['Engineer', 'Lead', 'Manager', 'Analyst', 'Designer'];
  const first = [
    'Ada', 'Alan', 'Grace', 'Linus', 'Katherine', 'Edsger', 'Barbara', 'Donald', 'Radia', 'Margaret',
    'Ken', 'Hedy', 'Tim', 'Anita', 'Guido', 'Bjarne', 'Vint', 'Frances', 'Dennis', 'Sophie',
  ];
  const last = [
    'Lovelace', 'Turing', 'Hopper', 'Torvalds', 'Johnson', 'Dijkstra', 'Liskov', 'Knuth', 'Perlman', 'Hamilton',
    'Thompson', 'Lamarr', 'Berners-Lee', 'Borg', 'van Rossum', 'Stroustrup', 'Cerf', 'Allen', 'Ritchie', 'Wilson',
  ];

  return first.map((f, i) => ({
    name: `${f} ${last[i]}`,
    team: teams[i % teams.length],
    role: roles[i % roles.length],
    salary: 90000 + ((i * 7919) % 80000),
    joined: new Date(2016 + (i % 9), (i * 5) % 12, 1 + (i % 27)),
    active: i % 4 !== 0,
  }));
}
