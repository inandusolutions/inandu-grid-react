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
