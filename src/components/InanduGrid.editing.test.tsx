import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InanduGrid } from './InanduGrid';

/** Inline editing through the rendered grid (review point C3): grouped rows, async validation and cancelling, focus. */
const columns = [
  { field: 'region', headerText: 'Region' },
  { field: 'name', headerText: 'Name', editable: true, required: true },
];
const rows = [
  { region: 'North', name: 'Ada' },
  { region: 'South', name: 'Alan' },
  { region: 'North', name: 'Grace' },
];

const group = () => fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'region' } });

describe('inline editing in a grouped grid', () => {
  it('the group header rows have no Edit or Delete, only the data rows do', () => {
    render(<InanduGrid rows={rows} columns={columns} deletable />);
    group();
    expect(screen.getAllByText('Edit')).toHaveLength(rows.length);
    for (const header of document.querySelectorAll('.inandu-group-row, tr.inandu-grid-group-row')) {
      expect(within(header as HTMLElement).queryByText('Edit')).toBeNull();
    }
  });

  it('a row inside a group can be edited and saved, and keeps its group afterwards', async () => {
    const onRowSave = vi.fn();
    render(<InanduGrid rows={rows} columns={columns} onRowSave={onRowSave} />);
    group();
    fireEvent.click(screen.getAllByText('Edit')[0]);
    fireEvent.change(screen.getByLabelText('Edit Name'), { target: { value: 'Ada L.' } });
    fireEvent.click(screen.getByText('Save'));
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Edit Name'));
    expect(onRowSave).toHaveBeenCalledWith({ row: rows[0], values: { name: 'Ada L.' } });
    expect(screen.getAllByText('North').length).toBeGreaterThan(0); // still grouped
  });

  it('only one row at a time is editable inside the groups too', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    group();
    fireEvent.click(screen.getAllByText('Edit')[0]);
    for (const other of screen.getAllByText('Edit')) expect(other.closest('button')).toBeDisabled();
  });

  it('cancelling an edit inside a group restores the original text', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    group();
    fireEvent.click(screen.getAllByText('Edit')[0]);
    fireEvent.change(screen.getByLabelText('Edit Name'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByLabelText('Edit Name')).toBeNull();
    expect(screen.queryByText('Changed')).toBeNull();
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });
});

describe('inline editing with an async validator, through the UI', () => {
  it('Save and Cancel are disabled while the check runs, so the row cannot be saved twice or cancelled halfway', async () => {
    let finish!: (message: string | null) => void;
    const asyncValidator = () => new Promise<string | null>(resolve => (finish = resolve));
    const onRowSave = vi.fn();
    render(<InanduGrid rows={rows} columns={[columns[0], { ...columns[1], asyncValidator }]} onRowSave={onRowSave} />);
    fireEvent.click(screen.getAllByText('Edit')[0]);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.getByText('Save').closest('button')).toBeDisabled());
    expect(screen.getByText('Cancel').closest('button')).toBeDisabled();
    fireEvent.click(screen.getByText('Save'));
    finish(null);
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Edit Name'));
    expect(onRowSave).toHaveBeenCalledTimes(1);
  });

  it('a failing check leaves the editor open with the message shown', async () => {
    render(<InanduGrid rows={rows} columns={[columns[0], { ...columns[1], asyncValidator: async () => 'Already used' }]} />);
    fireEvent.click(screen.getAllByText('Edit')[0]);
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText('Already used')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit Name')).toBeInTheDocument();
  });

  it('a check that throws shows its message instead of leaving the click with an unhandled rejection', async () => {
    const rejections: unknown[] = [];
    const onRejection = (event: PromiseRejectionEvent) => rejections.push(event.reason);
    window.addEventListener('unhandledrejection', onRejection);
    render(
      <InanduGrid
        rows={rows}
        columns={[
          columns[0],
          {
            ...columns[1],
            asyncValidator: async () => {
              throw new Error('Service unavailable');
            },
          },
        ]}
      />,
    );
    fireEvent.click(screen.getAllByText('Edit')[0]);
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 10));
    window.removeEventListener('unhandledrejection', onRejection);
    expect(rejections).toEqual([]);
  });
});
