import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InanduGridServerQuery } from './useInanduGrid';
import { parseServerResponse, useInanduGridServer } from './useInanduGridServer';

/** What a server can answer that is not `{ data, total }`: it must show up as `error`, never as an empty grid. */
const query: InanduGridServerQuery = { page: 0, pageSize: 25, sortCriteria: [], filterValues: {}, filterQuery: '' };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('parseServerResponse', () => {
  it('accepts { data, total }', () => {
    expect(parseServerResponse({ data: [{ id: 1 }], total: 7 })).toEqual({ data: [{ id: 1 }], total: 7 });
    expect(parseServerResponse({ data: [], total: 0 })).toEqual({ data: [], total: 0 });
  });

  it('takes a missing total to be the number of rows received', () => {
    expect(parseServerResponse({ data: [{ id: 1 }, { id: 2 }] })).toEqual({ data: [{ id: 1 }, { id: 2 }], total: 2 });
    expect(parseServerResponse({ data: [{ id: 1 }], total: null })).toEqual({ data: [{ id: 1 }], total: 1 });
  });

  it('throws with a message that says what was wrong', () => {
    expect(() => parseServerResponse(null)).toThrowError(/got null/);
    expect(() => parseServerResponse([1, 2])).toThrowError(/got an array/);
    expect(() => parseServerResponse('x')).toThrowError(/got string/);
    expect(() => parseServerResponse({})).toThrowError(/`data` to be an array, got nothing/);
    expect(() => parseServerResponse({ data: { a: 1 } })).toThrowError(/`data` to be an array, got object/);
    expect(() => parseServerResponse({ data: [], total: '5' })).toThrowError(/`total`/);
    expect(() => parseServerResponse({ data: [], total: -1 })).toThrowError(/`total`/);
    expect(() => parseServerResponse({ data: [], total: Infinity })).toThrowError(/`total`/);
  });
});

describe('useInanduGridServer: replies of the wrong shape', () => {
  it('sets error and keeps the rows already shown', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ data: [{ id: 1 }], total: 1 }))
      .mockResolvedValueOnce(json({ items: [{ id: 2 }], count: 1 }));
    const { result } = renderHook(() => useInanduGridServer({ url: '/api/p', fetcher, debounceMs: 0 }));

    act(() => result.current.setQuery(query));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.error?.message).toContain('`data`');
    expect(result.current.rows).toEqual([{ id: 1 }]);
    expect(result.current.total).toBe(1);
    expect(result.current.loading).toBe(false);
  });

  it('mapResponse adapts another shape, and its result is checked too', async () => {
    const fetcher = vi.fn(async () => json({ items: [{ id: 5 }], count: 9 }));
    const mapped = renderHook(() =>
      useInanduGridServer({
        url: '/api/p',
        fetcher,
        debounceMs: 0,
        mapResponse: body => {
          const b = body as { items: never[]; count: number };
          return { data: b.items, total: b.count };
        },
      }),
    );
    act(() => mapped.result.current.setQuery(query));
    await waitFor(() => expect(mapped.result.current.total).toBe(9));
    expect(mapped.result.current.rows).toEqual([{ id: 5 }]);

    const bad = renderHook(() => useInanduGridServer({ url: '/api/p', fetcher, debounceMs: 0, mapResponse: () => ({ data: 'nope' as never }) }));
    act(() => bad.result.current.setQuery(query));
    await waitFor(() => expect(bad.result.current.error).toBeDefined());
    expect(bad.result.current.error?.message).toContain('`data`');
  });

  it('an error thrown by mapResponse is shown as error', async () => {
    const fetcher = vi.fn(async () => json({ data: [], total: 0 }));
    const { result } = renderHook(() =>
      useInanduGridServer({
        url: '/api/p',
        fetcher,
        debounceMs: 0,
        mapResponse: () => {
          throw new Error('cannot map');
        },
      }),
    );
    act(() => result.current.setQuery(query));
    await waitFor(() => expect(result.current.error?.message).toBe('cannot map'));
  });
});
