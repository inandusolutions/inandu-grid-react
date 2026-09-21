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
