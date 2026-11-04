import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useInanduGrid } from './useInanduGrid';

const columns = [
  { field: 'name', headerText: 'Name' },
  { field: 'age', headerText: 'Age', type: 'number' as const, width: 60 },
];

const rows = [{ name: 'Ada', age: 30 }];

describe('useInanduGrid: clearAllFilters', () => {
  it('removes every column filter entry at once', () => {
    const { result } = renderHook(() => useInanduGrid({ rows, columns }));
    act(() => result.current.setFilterValue('name', { text: 'a' }));
    act(() => result.current.setFilterValue('age', { min: '10' }));
    expect(result.current.filterValues).toEqual({ name: { text: 'a' }, age: { min: '10' } });

    act(() => result.current.clearAllFilters());
    expect(result.current.filterValues).toEqual({});
  });
});

describe('useInanduGrid: allColumns', () => {
  it('includes hidden columns, unlike visibleColumns', () => {
    const { result } = renderHook(() => useInanduGrid({ rows, columns }));
    act(() => result.current.toggleColumnVisibility('age'));

    expect(result.current.visibleColumns.map(c => c.field)).toEqual(['name']);
    expect(result.current.allColumns.map(c => c.field)).toEqual(['name', 'age']);
  });
});

describe('useInanduGrid: extraRowFilter', () => {
  const people = [
    { name: 'Ada', age: 30 },
    { name: 'Alan', age: 25 },
    { name: 'Grace', age: 40 },
  ];

  it('ANDs onto free-text and column filters', () => {
    const { result } = renderHook(() =>
      useInanduGrid({ rows: people, columns, extraRowFilter: row => (row.age as number) >= 30 }),
    );
    expect(result.current.sortedRows.map(r => r.name)).toEqual(['Ada', 'Grace']);

    act(() => result.current.setFilterQuery('a'));
    expect(result.current.sortedRows.map(r => r.name)).toEqual(['Ada', 'Grace']); // both still contain "a"
  });

  it('unset means no extra filtering', () => {
    const { result } = renderHook(() => useInanduGrid({ rows: people, columns }));
    expect(result.current.sortedRows.length).toBe(3);
  });

  it('also applies in tree mode', () => {
    const treeRows = [
      { name: 'Ada', age: 30, kids: [{ name: 'Kid1', age: 5 }] },
      { name: 'Alan', age: 25, kids: [] },
    ];
    const { result } = renderHook(() =>
      useInanduGrid({
        rows: treeRows,
        columns,
        treeChildrenKey: 'kids',
        treeDefaultExpanded: 'all',
        extraRowFilter: row => (row.age as number) >= 30,
      }),
    );
    const names = result.current.treeRows.map(t => t.row.name);
    expect(names).not.toContain('Alan');
    expect(names).toContain('Ada');
  });
});

describe('useInanduGrid: sortedRows', () => {
  it('includes every filtered/sorted row regardless of pagination, unlike exportRows', () => {
    const manyRows = Array.from({ length: 5 }, (_, i) => ({ name: `Row ${i}`, age: i }));
    const { result } = renderHook(() => useInanduGrid({ rows: manyRows, columns, pageSize: 2 }));

    expect(result.current.exportRows.length).toBe(2);
    expect(result.current.sortedRows.length).toBe(5);
  });

  it('reflects the active filter and sort, same as exportRows would if unpaginated', () => {
    const { result } = renderHook(() => useInanduGrid({ rows, columns }));
    act(() => result.current.setSort([{ field: 'age', direction: 'desc' }]));
    expect(result.current.sortedRows.map(r => r.name)).toEqual(['Ada']);
  });
});

describe('useInanduGrid: locale', () => {
  it('exposes the resolved locale, defaulting to "en"', () => {
    const { result } = renderHook(() => useInanduGrid({ rows, columns }));
    expect(result.current.locale).toBe('en');
  });

  it('reflects an explicit locale option', () => {
    const { result } = renderHook(() => useInanduGrid({ rows, columns, locale: 'es' }));
    expect(result.current.locale).toBe('es');
  });
});

describe('useInanduGrid: runtime column pin/unpin', () => {
  it('columnPinnedSide falls back to the column\'s own declared pinned when no override was set', () => {
    const pinned = [{ ...columns[0], pinned: 'left' as const }, columns[1]];
    const { result } = renderHook(() => useInanduGrid({ rows, columns: pinned }));
    expect(result.current.columnPinnedSide('name')).toBe('left');
    expect(result.current.columnPinnedSide('age')).toBeUndefined();
  });

  it('setColumnPinned pins an otherwise-unpinned column at runtime, independent of its declared config', () => {
    const { result } = renderHook(() => useInanduGrid({ rows, columns, selectable: true }));
    expect(result.current.columnPinnedSide('age')).toBeUndefined();

    act(() => result.current.setColumnPinned('age', 'right'));
    expect(result.current.columnPinnedSide('age')).toBe('right');
    // stickyOffsetRight reflects the runtime override immediately.
    expect(result.current.stickyOffsetRight('name')).toBe(60); // age's own width
  });

  it('setColumnPinned(field, undefined) un-pins a column that declared pinned: "left"', () => {
    const pinned = [{ ...columns[0], pinned: 'left' as const }, columns[1]];
    const { result } = renderHook(() => useInanduGrid({ rows, columns: pinned }));
    expect(result.current.columnPinnedSide('name')).toBe('left');

    act(() => result.current.setColumnPinned('name', undefined));
    expect(result.current.columnPinnedSide('name')).toBeUndefined();
  });
});

describe('useInanduGrid: rowId', () => {
  const cols = [{ field: 'name', headerText: 'Name' }];
  const page1 = () => [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Alan' },
  ];

  it('keeps the selection when a refetch returns new objects for the same rows', () => {
    const { result, rerender } = renderHook(({ data }) => useInanduGrid({ rows: data, columns: cols }), { initialProps: { data: page1() } });
    act(() => result.current.toggleRowSelection(result.current.visibleRows[0]));
    expect(result.current.selectedRows.size).toBe(1);

    const fresh = [
      { id: 1, name: 'Ada (edited)' },
      { id: 2, name: 'Alan' },
    ];
    rerender({ data: fresh });

    expect(result.current.isRowSelected(fresh[0])).toBe(true);
    expect([...result.current.selectedRows][0]).toBe(fresh[0]); // the fresh object, not the stale one
  });

  it('keeps selected rows that are no longer in the current page', () => {
    const { result, rerender } = renderHook(({ data }) => useInanduGrid({ rows: data, columns: cols }), { initialProps: { data: page1() } });
    act(() => result.current.toggleRowSelection(result.current.visibleRows[0]));

    rerender({ data: [{ id: 3, name: 'Grace' }] });

    expect(result.current.selectedRows.size).toBe(1);
    expect([...result.current.selectedRows][0]).toMatchObject({ id: 1 });
  });

  it('uses the field or function given as rowId', () => {
    const data = [{ sku: 'A', name: 'x' }];
    const byField = renderHook(() => useInanduGrid({ rows: data, columns: cols, rowId: 'sku' }));
    act(() => byField.result.current.toggleRowSelection(data[0]));
    expect(byField.result.current.isRowSelected({ sku: 'A', name: 'other object' })).toBe(true);

    const byFn = renderHook(() => useInanduGrid({ rows: data, columns: cols, rowId: r => String(r['sku']) + '!' }));
    act(() => byFn.result.current.toggleRowSelection(data[0]));
    expect(byFn.result.current.isRowSelected({ sku: 'A' })).toBe(true);
    expect(byFn.result.current.isRowSelected({ sku: 'B' })).toBe(false);
  });

  it('falls back to object identity when rows have no id', () => {
    const data = [{ name: 'Ada' }, { name: 'Ada' }];
    const { result } = renderHook(() => useInanduGrid({ rows: data, columns: cols }));
    act(() => result.current.toggleRowSelection(data[0]));

    expect(result.current.isRowSelected(data[0])).toBe(true);
    expect(result.current.isRowSelected(data[1])).toBe(false);
  });

  it('gives unique React keys, even without ids or with an id equal to an index', () => {
    const data = [{ name: 'a' }, { name: 'b' }, { id: 1, name: 'c' }, { id: '1', name: 'd' }];
    const { result } = renderHook(() => useInanduGrid({ rows: data, columns: cols }));

    const keys = data.map(r => result.current.rowReactKey(r));
    expect(new Set(keys).size).toBe(4);
    expect(result.current.rowReactKey(data[0])).toBe(keys[0]); // stable for the same object
  });

  it('does not undo the user’s tree expand/collapse when the parent passes a new derived array', () => {
    const make = () => [
      { id: 1, name: 'root', kids: [{ id: 2, name: 'child' }] },
      { id: 3, name: 'root2', kids: [{ id: 4, name: 'child2' }] },
    ];
    const { result, rerender } = renderHook(({ data }) => useInanduGrid({ rows: data, columns: cols, treeChildrenKey: 'kids', treeDefaultExpanded: 'all' }), {
      initialProps: { data: make() },
    });
    expect(result.current.visibleRows.length).toBe(4);

    act(() => result.current.toggleTreeRow(result.current.visibleRows[0])); // collapse root
    expect(result.current.visibleRows.length).toBe(3);

    rerender({ data: make() }); // same ids, brand new objects (a derived array)

    expect(result.current.visibleRows.length).toBe(3); // still collapsed
  });

  it('expands newly arrived tree nodes by the default, leaving the others alone', () => {
    const { result, rerender } = renderHook(({ data }) => useInanduGrid({ rows: data, columns: cols, treeChildrenKey: 'kids', treeDefaultExpanded: 'all' }), {
      initialProps: { data: [{ id: 1, name: 'root', kids: [{ id: 2, name: 'child' }] }] },
    });
    act(() => result.current.toggleTreeRow(result.current.visibleRows[0])); // collapse 1
    expect(result.current.visibleRows.length).toBe(1);

    rerender({
      data: [
        { id: 1, name: 'root', kids: [{ id: 2, name: 'child' }] },
        { id: 5, name: 'new', kids: [{ id: 6, name: 'new child' }] },
      ],
    });

    expect(result.current.visibleRows.length).toBe(3); // root collapsed (1) + new root + its child
  });
});
