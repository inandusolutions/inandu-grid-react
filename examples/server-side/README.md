# serverSide example

`<InanduGrid serverSide>` + `useInanduGridServer` against the ASP.NET Core playground of
[Inandu.Grid.Extensions](https://github.com/inandusolutions/inandu-grid-extensions), which pages,
sorts and filters 10,000 products with one `ToInanduGrid()` call.

```bash
# 1. the API (needs the .NET 8 SDK) — http://localhost:5238
git clone https://github.com/inandusolutions/inandu-grid-extensions
cd inandu-grid-extensions/playground/Inandu.Grid.Extensions.Playground && dotnet run

# 2. this example (from the root of this repo's clone)
cd examples/server-side
npm install
npm run dev
```

Point it at another endpoint with `VITE_API_URL=https://my-api/api/products npm run dev`. The wire
format is documented in the
[request contract](https://github.com/inandusolutions/inandu-grid-extensions/blob/main/docs/request-contract.md).

Notes: with `serverSide`, grouping, tree data, virtual scroll and column aggregate totals are off
(they would only ever see one page), and a column's Excel-style value checklist lists the values on
the current page.
