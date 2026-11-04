import type { InanduGridRow } from '../core';

/**
 * How the grid identifies a row across renders and data refreshes: the name of a field (`'sku'`) or a
 * function that returns the row's key. Without it, the row's `id` field is used when it is present
 * (not null / undefined), and the row object itself otherwise (identity, the pre-`rowId` behaviour).
 */
export type InanduGridRowId = string | ((row: InanduGridRow) => string | number);

const identityKeys = new WeakMap<object, number>();
let identitySeq = 0;

/** The stable key for `row`: the id value when there is one, otherwise the row object itself. */
export function createRowKey(rowId: InanduGridRowId | undefined): (row: InanduGridRow) => unknown {
  if (typeof rowId === 'function') {
    return row => {
      const key = rowId(row);
      return key ?? row;
    };
  }
  const field = rowId ?? 'id';
  return row => {
    const value = row[field];
    return value ?? row;
  };
}

/**
 * A React `key` for `row`. An id is namespaced by its type (the string `"1"` and the number `1` are
 * different rows, as they are in a `Set`), and a row without an id gets a per-object counter, so keys
 * stay unique and follow the row through sorting, filtering and drag-reorder.
 */
export function toReactKey(key: unknown): string {
  if (key !== null && typeof key === 'object') {
    let n = identityKeys.get(key);
    if (n === undefined) {
      n = ++identitySeq;
      identityKeys.set(key, n);
    }
    return `o${n}`;
  }
  return `${typeof key}:${String(key)}`;
}
