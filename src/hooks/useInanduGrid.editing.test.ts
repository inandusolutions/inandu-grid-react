import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useInanduGrid } from './useInanduGrid';
import type { InanduGridColumn } from './useInanduGrid';

/**
 * Row editing as a state machine (review point C3): start, change, save, cancel, and what happens when an async validator is still
 * running while the user cancels, edits another row, or presses Save twice.
 */
const people = [
  { id: 1, name: 'Ada', age: 30 },
  { id: 2, name: 'Alan', age: 25 },
];

const baseColumns: InanduGridColumn[] = [
  { field: 'name', headerText: 'Name', editable: true, required: true },
  { field: 'age', headerText: 'Age', type: 'number', editable: true, min: 0, max: 120 },
];

/** A promise the test resolves by hand, to hold an async validator open. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(columns: InanduGridColumn[] = baseColumns) {
  const onRowSave = vi.fn();
  const onRowCreate = vi.fn();
  const hook = renderHook(() => useInanduGrid({ rows: people, columns, onRowSave, onRowCreate }));
  return { ...hook, onRowSave, onRowCreate };
}

describe('row editing', () => {
  it('seeds the draft from the row and reports no errors', () => {
    const { result } = setup();
    act(() => result.current.startEditingRow(people[0]));
    expect(result.current.rowDraft).toEqual({ name: 'Ada', age: '30' });
    expect(result.current.fieldErrors).toEqual({});
  });

  it('saves the parsed values, leaves edit mode and clears the draft', async () => {
    const { result, onRowSave } = setup();
    act(() => result.current.startEditingRow(people[0]));
    act(() => result.current.setRowDraftValue('age', '31'));
    await act(() => result.current.saveRow(people[0]));
    expect(onRowSave).toHaveBeenCalledWith({ row: people[0], values: { name: 'Ada', age: 31 } });
    expect(result.current.editingRow).toBeUndefined();
    expect(result.current.rowDraft).toEqual({});
  });

  it('cancelling discards the draft and never calls onRowSave', async () => {
    const { result, onRowSave } = setup();
    act(() => result.current.startEditingRow(people[0]));
    act(() => result.current.setRowDraftValue('name', 'Changed'));
    act(() => result.current.cancelRowEdit());
    expect(result.current.editingRow).toBeUndefined();
    expect(result.current.rowDraft).toEqual({});
    await act(() => result.current.saveRow(people[0])); // nothing is being edited: nothing happens
    expect(onRowSave).not.toHaveBeenCalled();
  });

  it('a failed validation keeps the row in edit mode with the typed draft, and a later valid value saves', async () => {
    const { result, onRowSave } = setup();
    act(() => result.current.startEditingRow(people[0]));
    act(() => result.current.setRowDraftValue('name', ''));
    await act(() => result.current.saveRow(people[0]));
    expect(onRowSave).not.toHaveBeenCalled();
    expect(result.current.editingRow).toBe(people[0]);
    expect(result.current.fieldErrors['name']).toBeTruthy();
    act(() => result.current.setRowDraftValue('name', 'Ada L.'));
    await act(() => result.current.saveRow(people[0]));
    expect(onRowSave).toHaveBeenCalledTimes(1);
    expect(result.current.fieldErrors).toEqual({});
  });

  it('starting another row replaces the draft: the first row is not saved', async () => {
    const { result, onRowSave } = setup();
    act(() => result.current.startEditingRow(people[0]));
    act(() => result.current.setRowDraftValue('name', 'Edited Ada'));
    act(() => result.current.startEditingRow(people[1]));
    expect(result.current.rowDraft).toEqual({ name: 'Alan', age: '25' });
    await act(() => result.current.saveRow(people[0])); // no longer the row being edited
    expect(onRowSave).not.toHaveBeenCalled();
  });
});

describe('row editing with an async validator', () => {
  const withAsync = (check: (value: unknown) => Promise<string | null>): InanduGridColumn[] => [
    { ...baseColumns[0], asyncValidator: check },
    baseColumns[1],
  ];

  it('reports isValidating while it runs, then saves when it passes', async () => {
    const gate = deferred<string | null>();
    const { result, onRowSave } = setup(withAsync(() => gate.promise));
    act(() => result.current.startEditingRow(people[0]));
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.saveRow(people[0]);
    });
    expect(result.current.isValidating).toBe(true);
    await act(async () => {
      gate.resolve(null);
      await saving;
    });
    expect(result.current.isValidating).toBe(false);
    expect(onRowSave).toHaveBeenCalledTimes(1);
  });

  it('a message from the validator keeps the row in edit mode and shows under the field', async () => {
    const { result, onRowSave } = setup(withAsync(async () => 'Name taken'));
    act(() => result.current.startEditingRow(people[0]));
    await act(() => result.current.saveRow(people[0]));
    expect(onRowSave).not.toHaveBeenCalled();
    expect(result.current.fieldErrors['name']).toBe('Name taken');
    expect(result.current.editingRow).toBe(people[0]);
  });

  it('cancelling while the validator is still running means the row is never saved', async () => {
    const gate = deferred<string | null>();
    const { result, onRowSave } = setup(withAsync(() => gate.promise));
    act(() => result.current.startEditingRow(people[0]));
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.saveRow(people[0]);
    });
    act(() => result.current.cancelRowEdit());
    await act(async () => {
      gate.resolve(null);
      await saving;
    });
    expect(onRowSave).not.toHaveBeenCalled();
    expect(result.current.editingRow).toBeUndefined();
  });

  it('starting another row while the validator runs means the first row is never saved', async () => {
    const gate = deferred<string | null>();
    const { result, onRowSave } = setup(withAsync(() => gate.promise));
    act(() => result.current.startEditingRow(people[0]));
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.saveRow(people[0]);
    });
    act(() => result.current.startEditingRow(people[1]));
    await act(async () => {
      gate.resolve(null);
      await saving;
    });
    expect(onRowSave).not.toHaveBeenCalled();
    expect(result.current.editingRow).toBe(people[1]);
  });

  it('pressing Save twice while the validator runs saves once', async () => {
    const gate = deferred<string | null>();
    const { result, onRowSave } = setup(withAsync(() => gate.promise));
    act(() => result.current.startEditingRow(people[0]));
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.saveRow(people[0]);
      second = result.current.saveRow(people[0]);
    });
    await act(async () => {
      gate.resolve(null);
      await Promise.all([first, second]);
    });
    expect(onRowSave).toHaveBeenCalledTimes(1);
  });

  it('a validator that throws does not strand the row: it stays in edit mode, stops validating and does not save', async () => {
    const { result, onRowSave } = setup(
      withAsync(async () => {
        throw new Error('network down');
      }),
    );
    act(() => result.current.startEditingRow(people[0]));
    await act(async () => {
      await result.current.saveRow(people[0]).catch(() => undefined);
    });
    expect(onRowSave).not.toHaveBeenCalled();
    expect(result.current.isValidating).toBe(false);
    expect(result.current.editingRow).toBe(people[0]);
  });

  it('a validator that throws is reported under its field, and does not leave an unhandled rejection', async () => {
    const { result } = setup(
      withAsync(async () => {
        throw new Error('network down');
      }),
    );
    act(() => result.current.startEditingRow(people[0]));
    let outcome: unknown = 'resolved';
    await act(async () => {
      await result.current.saveRow(people[0]).catch(error => {
        outcome = error;
      });
    });
    expect(outcome).toBe('resolved'); // saveRow settles normally; the failure is shown, not thrown at the click handler
    expect(result.current.fieldErrors['name']).toContain('network down');
  });
});

describe('adding a row', () => {
  it('cancelling while the async validator runs means the row is never created', async () => {
    const gate = deferred<string | null>();
    const { result, onRowCreate } = setup([{ ...baseColumns[0], asyncValidator: () => gate.promise }, baseColumns[1]]);
    act(() => result.current.startAddingRow());
    act(() => result.current.setRowDraftValue('name', 'Grace'));
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.saveNewRow();
    });
    act(() => result.current.cancelAddRow());
    await act(async () => {
      gate.resolve(null);
      await saving;
    });
    expect(onRowCreate).not.toHaveBeenCalled();
    expect(result.current.isAddingRow).toBe(false);
  });

  it('creates the row with the parsed values and leaves add mode', async () => {
    const { result, onRowCreate } = setup();
    act(() => result.current.startAddingRow());
    act(() => result.current.setRowDraftValue('name', 'Grace'));
    act(() => result.current.setRowDraftValue('age', '40'));
    await act(() => result.current.saveNewRow());
    expect(onRowCreate).toHaveBeenCalledWith({ name: 'Grace', age: 40 });
    expect(result.current.isAddingRow).toBe(false);
  });
});
