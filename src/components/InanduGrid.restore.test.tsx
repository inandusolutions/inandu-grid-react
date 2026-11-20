import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InanduGrid } from './InanduGrid';

/**
 * Putting the saved state back (`stateKey`): the first draw already has it, a server-mode grid asks for its data once, with the
 * saved query, and what is restored is not reported as something the user did.
 */
const columns = [
  { field: 'name', headerText: 'Name' },
  { field: 'age', headerText: 'Age', type: 'number' as const },
];
const rows = [
  { name: 'Beatriz', age: 41 },
  { name: 'Ana', age: 30 },
];
const KEY = 'inandu-grid-state:restore-test';
const saved = { v: 1, sortCriteria: [{ field: 'name', direction: 'asc' }], filterQuery: 'a' };
const nameHeader = () => screen.getByRole('columnheader', { name: 'Sort by Name' });

beforeEach(() => localStorage.setItem(KEY, JSON.stringify(saved)));
afterEach(() => {
  localStorage.removeItem(KEY);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('InanduGrid: restoring the saved state', () => {
  it('the very first draw already has the saved sort and search', () => {
    render(<InanduGrid rows={rows} columns={columns} stateKey="restore-test" />);
    // No waiting: nothing has happened after the first render.
    expect(nameHeader()).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByLabelText('Search')).toHaveValue('a');
  });

  it('does not overwrite what is saved when it mounts', () => {
    render(<InanduGrid rows={rows} columns={columns} stateKey="restore-test" />);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ sortCriteria: saved.sortCriteria, filterQuery: 'a' });
  });

  it('server mode: one query, the saved one, instead of the default one followed by the saved one', () => {
    const onQueryChange = vi.fn();
    render(<InanduGrid rows={rows} columns={columns} stateKey="restore-test" pageSize={10} serverSide={{ totalItems: 2 }} onQueryChange={onQueryChange} />);

    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ sortCriteria: saved.sortCriteria, filterQuery: 'a' }));
  });

  it('does not report the restore as sort, filter, page or selection changes', () => {
    const onSortChange = vi.fn();
    const onFilterChange = vi.fn();
    const onPageChange = vi.fn();
    const onSelectionChange = vi.fn();
    render(
      <InanduGrid rows={rows} columns={columns} stateKey="restore-test" onSortChange={onSortChange} onFilterChange={onFilterChange} onPageChange={onPageChange} onSelectionChange={onSelectionChange} />,
    );

    expect(onSortChange).not.toHaveBeenCalled();
    expect(onFilterChange).not.toHaveBeenCalled();
    expect(onPageChange).not.toHaveBeenCalled();
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('initialState is used instead of storage, on the first draw, and what changes after is saved', async () => {
    localStorage.removeItem(KEY);
    const getSpy = vi.spyOn(Storage.prototype, 'getItem');
    render(<InanduGrid rows={rows} columns={columns} stateKey="restore-test" initialState={{ sortCriteria: [{ field: 'age', direction: 'desc' }] }} />);

    expect(screen.getByRole('columnheader', { name: 'Sort by Age' })).toHaveAttribute('aria-sort', 'descending');
    expect(getSpy).not.toHaveBeenCalled();
    fireEvent.click(nameHeader());
    await waitFor(() => expect(JSON.parse(localStorage.getItem(KEY)!).sortCriteria).toEqual([{ field: 'name', direction: 'asc' }]));
  });

  it('initialState is checked like storage: a part with the wrong shape is ignored', () => {
    render(<InanduGrid rows={rows} columns={columns} initialState={{ sortCriteria: 'x', hiddenFields: { a: 1 } } as never} />);
    expect(nameHeader()).toHaveAttribute('aria-sort', 'none');
  });
});

describe('InanduGrid: selection notifications', () => {
  it('nothing on mount, one report per change of the selection, and not again when the parent passes a new callback each render', () => {
    const onSelectionChange = vi.fn();
    const { rerender } = render(<InanduGrid rows={rows} columns={columns} selectable onSelectionChange={selected => onSelectionChange(selected)} />);
    expect(onSelectionChange).not.toHaveBeenCalled();

    rerender(<InanduGrid rows={rows} columns={columns} selectable onSelectionChange={selected => onSelectionChange(selected)} />);
    rerender(<InanduGrid rows={rows} columns={columns} selectable onSelectionChange={selected => onSelectionChange(selected)} />);
    expect(onSelectionChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('checkbox', { name: /select row/i })[0]);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenLastCalledWith([rows[0]]);

    rerender(<InanduGrid rows={rows} columns={columns} selectable onSelectionChange={selected => onSelectionChange(selected)} />);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  });
});

describe('InanduGrid: a server-rendered page being hydrated', () => {
  it('draws the same markup as the server, then restores right after without reporting it', async () => {
    // The server has no storage: it draws the defaults.
    vi.stubGlobal('localStorage', undefined);
    const html = renderToString(<InanduGrid rows={rows} columns={columns} stateKey="restore-test" />);
    vi.unstubAllGlobals();
    expect(html).toContain('aria-sort="none"');

    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onSortChange = vi.fn();
    const onFilterChange = vi.fn();
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, <InanduGrid rows={rows} columns={columns} stateKey="restore-test" onSortChange={onSortChange} onFilterChange={onFilterChange} />, {
        onRecoverableError: error => errors(error),
      });
    });

    // No hydration mismatch, and the saved state shows once the page is hydrated.
    expect(errors).not.toHaveBeenCalled();
    await waitFor(() => expect(container.querySelector('th[aria-sort="ascending"]')).not.toBeNull());
    expect(onSortChange).not.toHaveBeenCalled();
    expect(onFilterChange).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
