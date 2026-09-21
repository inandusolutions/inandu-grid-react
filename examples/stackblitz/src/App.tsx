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

export function App() {
  const [selected, setSelected] = useState<InanduGridRow[]>([]);

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h1>@inandu-solutions/grid-react</h1>
      <p>
        Edit <code>src/App.tsx</code> — the grid updates live. Try the search box, the column-filter
        row, sorting (shift-click a header for multi-sort), the "Columns" toggle, the "Group by"
        dropdown, or the export toolbar.
      </p>

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

      <p>{selected.length} row(s) selected.</p>
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
