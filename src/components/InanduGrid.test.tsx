import { fireEvent, render, screen } from '@testing-library/react';
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

describe('InanduGrid', () => {
  it('renders headers and rows', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByText('Beatriz')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('sorts by a column on header click', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    fireEvent.click(screen.getByRole('columnheader', { name: 'Name' }));
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
    fireEvent.change(screen.getByLabelText('Filter Age min'), { target: { value: '35' } });
    expect(screen.getByText('Beatriz')).toBeInTheDocument();
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
  });

  it('paginates rows and navigates with Prev/Next', () => {
    render(<InanduGrid rows={rows} columns={columns} pageSize={1} />);
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText('Beatriz')).toBeInTheDocument();
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Next ›'));
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Next ›')).toBeDisabled();
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

    const rowCheckboxes = screen.getAllByLabelText('Select row');
    fireEvent.click(rowCheckboxes[0]);

    expect(onSelectionChange).toHaveBeenLastCalledWith([rows[0]]);
  });

  it('selects and deselects all rows with the header checkbox', () => {
    const onSelectionChange = vi.fn();
    render(<InanduGrid rows={rows} columns={columns} selectable onSelectionChange={onSelectionChange} />);

    fireEvent.click(screen.getByLabelText('Select all'));
    expect(onSelectionChange).toHaveBeenLastCalledWith(rows);

    fireEvent.click(screen.getByLabelText('Select all'));
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it('shows an export toolbar only when exportable is set', () => {
    const { rerender } = render(<InanduGrid rows={rows} columns={columns} />);
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();

    rerender(<InanduGrid rows={rows} columns={columns} exportable />);
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Export Excel')).toBeInTheDocument();
    expect(screen.getByText('Export PDF')).toBeInTheDocument();
  });
});
