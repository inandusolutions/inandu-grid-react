import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import corpus from './contract/diff-corpus.json';
import { useInanduGrid } from './useInanduGrid';
import type { InanduColumnType, InanduGridColumnFilterValue } from '../core';

/**
 * The differential corpus: the same rows and requests are run through grid-core, grid-angular, grid-react, grid-vue and
 * Inandu.Grid.Extensions, and each must return `expectedIds`, in order. This is the grid-react half; the file is a copy of
 * the canonical one in inandu-grid-extensions (CI compares them).
 */
interface Case {
  name: string;
  client: { filters?: Record<string, InanduGridColumnFilterValue>; query?: string; sort?: Array<[string, 'asc' | 'desc']> };
  expectedIds: number[];
}

const columns = Object.entries(corpus.columns).map(([field, type]) => ({ field, headerText: field, type: type as InanduColumnType }));

describe('differential corpus (grid-react)', () => {
  it.each((corpus.cases as unknown as Case[]).map(c => [c.name, c] as const))('%s', (_name, c) => {
    const { result } = renderHook(() => useInanduGrid({ rows: corpus.rows, columns, locale: 'en' }));

    act(() => {
      for (const [field, value] of Object.entries(c.client.filters ?? {})) result.current.setFilterValue(field, value);
      if (c.client.query) result.current.setFilterQuery(c.client.query);
      result.current.setSort((c.client.sort ?? []).map(([field, direction]) => ({ field, direction })));
    });

    expect(result.current.sortedRows.map(row => row['id'])).toEqual(c.expectedIds);
  });
});
