import { InanduGrid, useInanduGridServer, type InanduGridColumn } from '@inandu-solutions/grid-react';

// The Inandu.Grid.Extensions playground: `cd playground/Inandu.Grid.Extensions.Playground && dotnet run`
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5238/api/products';

const columns: InanduGridColumn[] = [
  { field: 'id', headerText: 'Id', type: 'number', width: 70 },
  { field: 'name', headerText: 'Name', width: 220 },
  { field: 'category', headerText: 'Category', width: 140 },
  { field: 'price', headerText: 'Price', type: 'number', format: '1.2-2', width: 100 },
  { field: 'stock', headerText: 'Stock', type: 'number', width: 90 },
  { field: 'discontinued', headerText: 'Discontinued', type: 'boolean', width: 120 },
];

export function App() {
  // The hook turns the grid's sort / search / filter / page state into the request and keeps the
  // previous page on screen while the next one loads.
  const server = useInanduGridServer({ url: API });

  return (
    <main style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h1>grid-react · serverSide</h1>
      <p>
        {server.loading ? 'Loading…' : `${server.total.toLocaleString()} rows`}
        {server.error ? <strong style={{ color: 'crimson' }}> — {server.error.message} (is the API running?)</strong> : null}
      </p>
      <InanduGrid
        rows={server.rows}
        columns={columns}
        pageSize={25}
        serverSide={{ totalItems: server.total }}
        onQueryChange={server.setQuery}
      />
    </main>
  );
}
