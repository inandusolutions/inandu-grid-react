import { fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InanduGrid } from './InanduGrid';

const columns = [
  { field: 'name', headerText: 'Name' },
  { field: 'age', headerText: 'Age', type: 'number' as const },
];

const rows = [
  { name: 'Beatriz', age: 41 },
  { name: 'Ana', age: 30 },
];

const salesColumns = [
  { field: 'region', headerText: 'Region' },
  { field: 'amount', headerText: 'Amount', type: 'number' as const, aggregate: 'sum' as const },
];

const salesRows = [
  { region: 'North', amount: 10 },
  { region: 'South', amount: 5 },
  { region: 'North', amount: 20 },
];

const editableColumns = [
  { field: 'name', headerText: 'Name', editable: true, required: true },
  { field: 'age', headerText: 'Age', type: 'number' as const, editable: true, min: 0, max: 120 },
];

describe('InanduGrid', () => {
  it('renders headers and rows', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    expect(screen.getByRole('columnheader', { name: 'Sort by Name' })).toBeInTheDocument();
    expect(screen.getByText('Beatriz')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('sorts by a column on header click', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    fireEvent.click(screen.getByRole('columnheader', { name: 'Sort by Name' }));
    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Ana');
  });

  it('matches the free-text search against any column', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '41' } });
    expect(screen.getByText('Beatriz')).toBeInTheDocument();
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
  });

  it('filters a string column by its text filter', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    fireEvent.change(screen.getByLabelText('Filter Name'), { target: { value: 'ana' } });
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByText('Beatriz')).not.toBeInTheDocument();
  });

  it('filters a number column by its min/max range', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    fireEvent.change(screen.getByLabelText('Filter Age Min'), { target: { value: '35' } });
    expect(screen.getByText('Beatriz')).toBeInTheDocument();
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
  });

  it('shift-clicking a second header builds a multi-column sort', () => {
    const tiedRows = [
      { name: 'Carla', age: 30 },
      { name: 'Ana', age: 30 },
      { name: 'Beto', age: 20 },
    ];
    render(<InanduGrid rows={tiedRows} columns={columns} />);

    fireEvent.click(screen.getByRole('columnheader', { name: 'Sort by Age' })); // primary: age asc
    fireEvent.click(screen.getByRole('columnheader', { name: 'Sort by Name' }), { shiftKey: true }); // secondary: name asc, ties broken

    const cells = screen.getAllByRole('cell').map(cell => cell.textContent);
    // Beto(20) first, then the age-30 tie broken by name: Ana, Carla.
    expect(cells.slice(0, 6)).toEqual(['Beto', '20', 'Ana', '30', 'Carla', '30']);
    // Both sorted columns show their multi-sort priority badge.
    expect(screen.getByRole('columnheader', { name: 'Sort by Age' })).toHaveTextContent('1');
    expect(screen.getByRole('columnheader', { name: 'Sort by Name' })).toHaveTextContent('2');
  });

  it('paginates rows and navigates with Prev/Next', () => {
    render(<InanduGrid rows={rows} columns={columns} pageSize={1} />);
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText('Beatriz')).toBeInTheDocument();
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Next page ›'));
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Next page ›')).toBeDisabled();
  });

  it('groups rows by a column with per-group and grand-total aggregates', () => {
    render(<InanduGrid rows={salesRows} columns={salesColumns} />);
    fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'region' } });

    // "North"/"South" render both in the group header and in each row's own region cell.
    expect(screen.getAllByText('North').length).toBeGreaterThan(0);
    expect(screen.getAllByText('South').length).toBeGreaterThan(0);
    expect(screen.getByText(/Amount Σ: 30/)).toBeInTheDocument(); // North's subtotal: 10 + 20
    expect(screen.getByText(/Amount Σ: 35/)).toBeInTheDocument(); // grand total: 10 + 5 + 20
  });

  it('bypasses pagination while grouped', () => {
    render(<InanduGrid rows={salesRows} columns={salesColumns} pageSize={1} />);
    fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'region' } });
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
    expect(screen.getAllByText('North').length).toBeGreaterThan(0);
    expect(screen.getAllByText('South').length).toBeGreaterThan(0);
  });

  it('selects individual rows and reports the selection', () => {
    const onSelectionChange = vi.fn();
    render(<InanduGrid rows={rows} columns={columns} selectable onSelectionChange={onSelectionChange} />);

    const rowCheckboxes = screen.getAllByLabelText(/Select row/);
    fireEvent.click(rowCheckboxes[0]);

    expect(onSelectionChange).toHaveBeenLastCalledWith([rows[0]]);
  });

  it('selects and deselects all rows with the header checkbox', () => {
    const onSelectionChange = vi.fn();
    render(<InanduGrid rows={rows} columns={columns} selectable onSelectionChange={onSelectionChange} />);

    fireEvent.click(screen.getByLabelText('Select all rows'));
    expect(onSelectionChange).toHaveBeenLastCalledWith(rows);

    fireEvent.click(screen.getByLabelText('Select all rows'));
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it('shows the MsgNoData message when there are no rows to show', () => {
    render(<InanduGrid rows={[]} columns={columns} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('translates built-in UI strings via the lang prop', () => {
    render(<InanduGrid rows={[]} columns={columns} lang="es" exportable />);
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
    expect(screen.getByText('Exportar CSV')).toBeInTheDocument();
  });

  // saveRow()/saveNewRow() are async (they always await validateAndParseDraft(), even with no
  // asyncValidator involved), so their state updates land a microtask after the click — these use
  // RTL's `findBy*` (which polls) rather than `getBy*` to observe the result.

  it('edits a row and saves valid values', async () => {
    const onRowSave = vi.fn();
    render(<InanduGrid rows={rows} columns={editableColumns} onRowSave={onRowSave} />);

    fireEvent.click(screen.getAllByText('Edit')[0]);
    fireEvent.change(screen.getByLabelText('Edit Age'), { target: { value: '42' } });
    fireEvent.click(screen.getByText('Save'));
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Edit Age'));

    // Edit mode exits — "Edit"/"Delete" buttons come back for every row.
    expect(screen.getAllByText('Edit')).toHaveLength(2);
    expect(onRowSave).toHaveBeenCalledWith({ row: rows[0], values: { name: 'Beatriz', age: 42 } });
  });

  it('blocks the save and shows an inline error when a required field is cleared', async () => {
    const onRowSave = vi.fn();
    render(<InanduGrid rows={rows} columns={editableColumns} onRowSave={onRowSave} />);

    fireEvent.click(screen.getAllByText('Edit')[0]);
    fireEvent.change(screen.getByLabelText('Edit Name'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(onRowSave).not.toHaveBeenCalled();
  });

  it('rejects a value outside min/max with the interpolated message', async () => {
    render(<InanduGrid rows={rows} columns={editableColumns} />);

    fireEvent.click(screen.getAllByText('Edit')[0]);
    fireEvent.change(screen.getByLabelText('Edit Age'), { target: { value: '200' } });
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Must be at most 120')).toBeInTheDocument();
  });

  it('adds a new row via the Add row trigger', async () => {
    const onRowCreate = vi.fn();
    render(<InanduGrid rows={rows} columns={editableColumns} creatable onRowCreate={onRowCreate} />);

    fireEvent.click(screen.getByText('Add row'));
    fireEvent.change(screen.getByLabelText('Edit Name'), { target: { value: 'Carla' } });
    fireEvent.change(screen.getByLabelText('Edit Age'), { target: { value: '25' } });
    fireEvent.click(screen.getByText('Save'));

    // The "Add row" trigger comes back once the draft is dismissed after a successful save.
    expect(await screen.findByText('Add row')).toBeInTheDocument();
    expect(onRowCreate).toHaveBeenCalledWith({ name: 'Carla', age: 25 });
  });

  it('deletes a row, confirming via window.confirm when deleteConfirmMessage is set', () => {
    const onRowDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<InanduGrid rows={rows} columns={columns} deletable deleteConfirmMessage="Sure?" onRowDelete={onRowDelete} />);

    fireEvent.click(screen.getAllByText('Delete')[0]);

    expect(confirmSpy).toHaveBeenCalledWith('Sure?');
    expect(onRowDelete).toHaveBeenCalledWith(rows[0]);
    confirmSpy.mockRestore();
  });

  it('does not delete when window.confirm is cancelled', () => {
    const onRowDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<InanduGrid rows={rows} columns={columns} deletable deleteConfirmMessage="Sure?" onRowDelete={onRowDelete} />);

    fireEvent.click(screen.getAllByText('Delete')[0]);

    expect(onRowDelete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('bulk-deletes every selected row and clears the selection', () => {
    const onRowsDelete = vi.fn();
    render(<InanduGrid rows={rows} columns={columns} selectable deletable onRowsDelete={onRowsDelete} />);

    fireEvent.click(screen.getByLabelText('Select all rows'));
    fireEvent.click(screen.getByText(/Delete selected/));

    expect(onRowsDelete).toHaveBeenCalledWith(rows);
    expect(screen.getByLabelText('Select all rows')).not.toBeChecked();
  });

  it('shows an export toolbar only when exportable is set', () => {
    const { rerender } = render(<InanduGrid rows={rows} columns={columns} />);
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();

    rerender(<InanduGrid rows={rows} columns={columns} exportable />);
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Export Excel')).toBeInTheDocument();
    expect(screen.getByText('Export PDF')).toBeInTheDocument();
    expect(screen.getByText('Print')).toBeInTheDocument();
  });

  it('prints via a new window with a plain table, and triggers the print dialog on it', () => {
    const printWindow = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window);
    vi.useFakeTimers();

    render(<InanduGrid rows={rows} columns={columns} exportable />);
    fireEvent.click(screen.getByText('Print'));
    vi.runAllTimers();

    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(printWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('Beatriz'));
    expect(printWindow.print).toHaveBeenCalled();

    vi.useRealTimers();
    openSpy.mockRestore();
  });
});
