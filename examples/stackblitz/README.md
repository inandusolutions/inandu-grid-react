# StackBlitz example

A minimal React app rendering `<InanduGrid>` with sorting, per-column filters, grouping, selection,
the column-toggle popup, aggregates/totals, and the export toolbar.

**`@inandu-solutions/grid-react` isn't published to npm yet**, so unlike the Angular example this
one imports straight from the library's own source (`../../../src`) instead of installing a
package — it always tracks whatever's currently in this repo. Once the package ships, this will
switch to a normal npm dependency like the Angular example already has.

**Open it live (no account needed):**
<https://stackblitz.com/github/inandusolutions/inandu-grid-react/tree/main/examples/stackblitz>

Run it locally:

```bash
cd examples/stackblitz
npm install
npm run dev        # http://localhost:5173
```

The whole example is `src/App.tsx` — edit it and the grid updates live.
