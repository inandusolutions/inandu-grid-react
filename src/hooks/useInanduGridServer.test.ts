import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import contract from './contract/server-queries.json';
import { useInanduGrid, type InanduGridServerQuery } from './useInanduGrid';
import { buildInanduGridQuery, useInanduGridServer } from './useInanduGridServer';

describe('buildInanduGridQuery: shared contract fixture', () => {
  // The same fixture is parsed by Inandu.Grid.Extensions' own tests, so a change on either side
  // that breaks the wire contract fails a test in the repo that made it.
  for (const c of contract.cases) {
    it(c.name, () => {
      expect(buildInanduGridQuery(c.query as InanduGridServerQuery).toString()).toBe(c.queryString);
    });
  }

  it('appends extra params last', () => {
    const query: InanduGridServerQuery = { page: 0, pageSize: 25, sortCriteria: [], filterValues: {}, filterQuery: '' };
    expect(buildInanduGridQuery(query, { extraParams: { tenant: 'acme' } }).toString()).toBe('page=1&pageSize=25&tenant=acme');
  });
});

const query = (page: number, filterQuery = ''): InanduGridServerQuery => ({ page, pageSize: 25, sortCriteria: [], filterValues: {}, filterQuery });
const ok = (data: unknown[], total: number) => new Response(JSON.stringify({ data, total }), { status: 200 });

describe('useInanduGridServer', () => {
  it('requests with the contract query string and exposes data + total', async () => {
    const fetcher = vi.fn(async () => ok([{ id: 1 }], 41));
    const { result } = renderHook(() => useInanduGridServer({ url: '/api/p', fetcher }));
    act(() => result.current.setQuery(query(2)));

    await waitFor(() => expect(result.current.total).toBe(41));
    expect(fetcher).toHaveBeenCalledWith('/api/p?page=3&pageSize=25', expect.objectContaining({ signal: expect.anything() }));
    expect(result.current.rows).toEqual([{ id: 1 }]);
    expect(result.current.loading).toBe(false);
  });

  it('keeps the previous page while the next one loads', async () => {
    let release!: (r: Response) => void;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(ok([{ id: 1 }], 50))
      .mockImplementationOnce(() => new Promise<Response>(resolve => (release = resolve)));
    const { result } = renderHook(() => useInanduGridServer({ url: '/api/p', fetcher, debounceMs: 0 }));
    act(() => result.current.setQuery(query(0)));
    await waitFor(() => expect(result.current.rows).toEqual([{ id: 1 }]));

    act(() => result.current.setQuery(query(1)));
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.rows).toEqual([{ id: 1 }]);
    expect(result.current.total).toBe(50);

    await act(async () => release(ok([{ id: 2 }], 50)));
    await waitFor(() => expect(result.current.rows).toEqual([{ id: 2 }]));
  });

  it('ignores a late response from a superseded request', async () => {
    const abortedByLabel: Record<string, boolean> = {};
    const fetcher = vi.fn((url: string, init: RequestInit) => {
      const slow = url.includes('page=1&');
      return new Promise<Response>(resolve => {
        setTimeout(() => {
          abortedByLabel[slow ? 'old' : 'new'] = !!init.signal?.aborted;
          resolve(ok([{ from: slow ? 'old' : 'new' }], 1));
        }, slow ? 400 : 5);
      });
    });
    const { result } = renderHook(() => useInanduGridServer({ url: '/api/p', fetcher, debounceMs: 0 }));
    act(() => result.current.setQuery(query(0)));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    act(() => result.current.setQuery(query(1)));

    await waitFor(() => expect(result.current.rows).toEqual([{ from: 'new' }]));
    await new Promise(r => setTimeout(r, 500));
    expect(result.current.rows).toEqual([{ from: 'new' }]);
    expect(abortedByLabel.old).toBe(true);
    expect(abortedByLabel.new).toBe(false);
  });

  it('surfaces HTTP errors', async () => {
    const fetcher = vi.fn(async () => new Response('nope', { status: 500, statusText: 'Boom' }));
    const { result } = renderHook(() => useInanduGridServer({ url: '/api/p', fetcher }));
    act(() => result.current.setQuery(query(0)));
    await waitFor(() => expect(result.current.error?.message).toContain('500'));
    expect(result.current.loading).toBe(false);
  });
});

describe('useInanduGrid: serverSide', () => {
  const columns = [
    { field: 'name', headerText: 'Name' },
    { field: 'age', headerText: 'Age', type: 'number' as const },
  ];
  // Deliberately unsorted and not matching any filter: the hook must not touch it.
  const pageRows = [
    { name: 'Zed', age: 1 },
    { name: 'Ada', age: 99 },
  ];

  it('does not sort, filter or slice rows; reads page count from totalItems', () => {
    const { result } = renderHook(() => useInanduGrid({ rows: pageRows, columns, pageSize: 2, serverSide: { totalItems: 7 } }));
    act(() => result.current.toggleSort('name'));
    act(() => result.current.setFilterQuery('nomatch'));

    expect(result.current.visibleRows).toEqual(pageRows);
    expect(result.current.pageCount).toBe(4);
    expect(result.current.filteredRowCount).toBe(7);
  });

  it('emits onQueryChange on mount and when sort, search or page change', () => {
    const onQueryChange = vi.fn();
    const { result } = renderHook(() => useInanduGrid({ rows: pageRows, columns, pageSize: 2, serverSide: { totalItems: 7 }, onQueryChange }));
    expect(onQueryChange).toHaveBeenLastCalledWith({ page: 0, pageSize: 2, sortCriteria: [], filterValues: {}, filterQuery: '' });

    act(() => result.current.setPage(2));
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    act(() => result.current.toggleSort('age'));
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, sortCriteria: [{ field: 'age', direction: 'asc' }] }));
    act(() => result.current.setFilterQuery('ada'));
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ filterQuery: 'ada' }));
  });

  it('does not clamp the page while totalItems is still 0 (a request in flight)', () => {
    const { result } = renderHook(() => useInanduGrid({ rows: [], columns, pageSize: 2, serverSide: { totalItems: 0 } }));
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
  });

  it('turns grouping off', () => {
    const { result } = renderHook(() => useInanduGrid({ rows: pageRows, columns, pageSize: 2, serverSide: { totalItems: 2 } }));
    act(() => result.current.setGroupByField('name'));
    expect(result.current.groups).toBeNull();
  });

  it('stays client-side when serverSide is unset', () => {
    const { result } = renderHook(() => useInanduGrid({ rows: pageRows, columns, pageSize: 1 }));
    expect(result.current.pageCount).toBe(2);
    expect(result.current.visibleRows).toEqual([pageRows[0]]);
  });
});
