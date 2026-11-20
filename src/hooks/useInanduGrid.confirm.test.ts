import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InanduGridRow } from '@inandu-solutions/grid-core';
import { useInanduGrid } from './useInanduGrid';

/** `confirmDelete`: a delete gated by the app's own (sync or async) answer instead of `window.confirm()`. */
const rows: InanduGridRow[] = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Alan' },
];
const columns = [{ field: 'name', headerText: 'Name' }];

function setup(confirmDelete?: (rows: InanduGridRow[]) => boolean | Promise<boolean>, extra: Record<string, unknown> = {}) {
  const onRowDelete = vi.fn();
  const onRowsDelete = vi.fn();
  const hook = renderHook(() => useInanduGrid({ rows, columns, selectable: true, confirmDelete, onRowDelete, onRowsDelete, ...extra }));
  return { hook, onRowDelete, onRowsDelete };
}
const tick = () => new Promise(r => setTimeout(r, 0));

afterEach(() => vi.restoreAllMocks());

describe('confirmDelete', () => {
  it('never calls window.confirm when it is set; a sync true deletes at once', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const confirmDelete = vi.fn(() => true);
    const { hook, onRowDelete } = setup(confirmDelete, { deleteConfirmMessage: 'ignored' });

    act(() => hook.result.current.deleteRow(rows[0]));

    expect(confirmDelete).toHaveBeenCalledWith([rows[0]]);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onRowDelete).toHaveBeenCalledWith(rows[0]);
  });

  it('a sync false does not delete', () => {
    const { hook, onRowDelete } = setup(() => false);
    act(() => hook.result.current.deleteRow(rows[0]));
    expect(onRowDelete).not.toHaveBeenCalled();
  });

  it('waits for a promise and deletes only when it resolves to true', async () => {
    let resolve!: (value: boolean) => void;
    const { hook, onRowDelete } = setup(() => new Promise<boolean>(r => (resolve = r)));

    act(() => hook.result.current.deleteRow(rows[1]));
    expect(onRowDelete).not.toHaveBeenCalled();
    await act(async () => {
      resolve(true);
      await tick();
    });
    expect(onRowDelete).toHaveBeenCalledWith(rows[1]);
  });

  it('a promise that resolves to false, rejects, or a function that throws, does not delete (the last two are logged)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const confirmDelete of [() => Promise.resolve(false), () => Promise.reject(new Error('closed')), () => { throw new Error('boom'); }]) {
      const { hook, onRowDelete } = setup(confirmDelete);
      await act(async () => {
        hook.result.current.deleteRow(rows[0]);
        await tick();
      });
      expect(onRowDelete).not.toHaveBeenCalled();
    }
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('a second click while the first confirmation is pending does not ask again, and asks again once it is answered', async () => {
    const answers: ((value: boolean) => void)[] = [];
    const confirmDelete = vi.fn(() => new Promise<boolean>(r => answers.push(r)));
    const { hook } = setup(confirmDelete);

    act(() => {
      hook.result.current.deleteRow(rows[0]);
      hook.result.current.deleteRow(rows[1]);
    });
    expect(confirmDelete).toHaveBeenCalledTimes(1);

    await act(async () => {
      answers[0](false);
      await tick();
    });
    act(() => hook.result.current.deleteRow(rows[1]));
    expect(confirmDelete).toHaveBeenCalledTimes(2);
  });

  it('the bulk delete gets every selected row and clears the selection only after the confirmation', async () => {
    let resolve!: (value: boolean) => void;
    const confirmDelete = vi.fn(() => new Promise<boolean>(r => (resolve = r)));
    const { hook, onRowsDelete } = setup(confirmDelete);
    act(() => hook.result.current.toggleRowSelection(rows[0]));
    act(() => hook.result.current.toggleRowSelection(rows[1]));

    act(() => hook.result.current.deleteSelectedRows());
    expect(confirmDelete).toHaveBeenCalledWith(rows);
    expect(onRowsDelete).not.toHaveBeenCalled();
    expect(hook.result.current.selectedRows.size).toBe(2);

    await act(async () => {
      resolve(true);
      await tick();
    });
    expect(onRowsDelete).toHaveBeenCalledWith(rows);
    expect(hook.result.current.selectedRows.size).toBe(0);
  });

  it('without confirmDelete the confirm messages still use window.confirm', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { hook, onRowDelete } = setup(undefined, { deleteConfirmMessage: 'Sure?' });

    act(() => hook.result.current.deleteRow(rows[0]));
    expect(onRowDelete).not.toHaveBeenCalled();
    act(() => hook.result.current.deleteRow(rows[0]));
    expect(confirmSpy).toHaveBeenCalledWith('Sure?');
    expect(onRowDelete).toHaveBeenCalledTimes(1);
  });
});
