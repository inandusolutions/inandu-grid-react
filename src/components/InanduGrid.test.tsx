import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InanduGrid } from './InanduGrid';

const columns = [
  { field: 'name', headerText: 'Name' },
  { field: 'age', headerText: 'Age', type: 'number' as const },
];

const rows = [
  { name: 'Beatriz', age: 41 },
  { name: 'Ana', age: 30 },
];

describe('InanduGrid', () => {
  it('renders headers and rows', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Beatriz')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('sorts by a column on header click', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    fireEvent.click(screen.getByText('Name'));
    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Ana');
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
});
