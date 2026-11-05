import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    const cells = screen.getAllByRole('gridcell');
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

    const cells = screen.getAllByRole('gridcell').map(cell => cell.textContent);
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
    // The live region repeats the message for screen readers, so look inside the table.
    expect(within(screen.getByRole('grid')).getByText('No data')).toBeInTheDocument();
  });

  it('translates built-in UI strings via the lang prop', () => {
    render(<InanduGrid rows={[]} columns={columns} lang="es" exportable />);
    expect(within(screen.getByRole('grid')).getByText('Sin datos')).toBeInTheDocument();
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

  it('prints through a noopener blob page with a plain table that prints itself', async () => {
    let page: Blob | undefined;
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        page = blob;
        return 'blob:print';
      }),
      revokeObjectURL: vi.fn(),
    });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    render(<InanduGrid rows={rows} columns={columns} exportable />);
    fireEvent.click(screen.getByText('Print'));

    expect(openSpy).toHaveBeenCalledWith('blob:print', '_blank', 'noopener');
    const html = await page!.text();
    expect(html).toContain('Beatriz');
    expect(html).toContain('print()');

    openSpy.mockRestore();
  });

  it('copies the focused cell text with Ctrl+C', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<InanduGrid rows={rows} columns={columns} clipboard />);
    fireEvent.keyDown(screen.getByText('Beatriz'), { key: 'c', ctrlKey: true });

    expect(writeText).toHaveBeenCalledWith('Beatriz');
  });

  it('pastes TSV text onto editable cells anchored at the focused cell with Ctrl+V', async () => {
    const readText = vi.fn().mockResolvedValue('Carla\t50');
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true });
    const onCellsPaste = vi.fn();

    render(<InanduGrid rows={rows} columns={editableColumns} clipboard onCellsPaste={onCellsPaste} />);
    fireEvent.keyDown(screen.getByText('Beatriz'), { key: 'v', ctrlKey: true });

    await waitFor(() =>
      expect(onCellsPaste).toHaveBeenCalledWith([
        { row: rows[0], field: 'name', value: 'Carla' },
        { row: rows[0], field: 'age', value: 50 },
      ]),
    );
  });

  it('ignores Ctrl+C/Ctrl+V when clipboard is not enabled', () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<InanduGrid rows={rows} columns={columns} />);
    fireEvent.keyDown(screen.getByText('Beatriz'), { key: 'c', ctrlKey: true });

    expect(writeText).not.toHaveBeenCalled();
  });

  it('hides and re-shows a column via the columns toggle popup', () => {
    render(<InanduGrid rows={rows} columns={columns} columnToggle />);

    expect(screen.getByRole('columnheader', { name: 'Sort by Age' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Toggle Age'));
    expect(screen.queryByRole('columnheader', { name: 'Sort by Age' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Toggle Age'));
    expect(screen.getByRole('columnheader', { name: 'Sort by Age' })).toBeInTheDocument();
  });

  it('refuses to hide the only remaining visible column', () => {
    render(<InanduGrid rows={rows} columns={columns} columnToggle />);

    fireEvent.click(screen.getByLabelText('Toggle Age'));
    fireEvent.click(screen.getByLabelText('Toggle Name'));

    // Still just Age hidden — Name (the last one standing) refused to hide.
    expect(screen.getByRole('columnheader', { name: 'Sort by Name' })).toBeInTheDocument();
  });

  it('stacks left-pinned columns, offset by each other\'s width plus the select column', () => {
    const pinnedColumns = [
      { field: 'name', headerText: 'Name', pinned: 'left' as const, width: 100 },
      { field: 'age', headerText: 'Age', type: 'number' as const, pinned: 'left' as const, width: 60 },
    ];
    render(<InanduGrid rows={rows} columns={pinnedColumns} selectable />);

    const nameHeader = screen.getByRole('columnheader', { name: 'Sort by Name' });
    const ageHeader = screen.getByRole('columnheader', { name: 'Sort by Age' });
    expect(nameHeader.style.position).toBe('sticky');
    expect(nameHeader.style.left).toBe('36px'); // SELECT_COLUMN_WIDTH
    expect(ageHeader.style.left).toBe('136px'); // 36 + name's own 100px width
  });

  it('stacks right-pinned columns from the table edge inward', () => {
    const pinnedColumns = [
      { field: 'name', headerText: 'Name' },
      { field: 'age', headerText: 'Age', type: 'number' as const, pinned: 'right' as const, width: 60 },
      { field: 'note', headerText: 'Note', pinned: 'right' as const, width: 90 },
    ];
    render(<InanduGrid rows={[{ name: 'Beatriz', age: 41, note: 'x' }]} columns={pinnedColumns} />);

    expect(screen.getByRole('columnheader', { name: 'Sort by Age' }).style.right).toBe('90px'); // note's width, which renders after it
    expect(screen.getByRole('columnheader', { name: 'Sort by Note' }).style.right).toBe('0px');
  });

  it('reorders columns by dragging a header and dropping it onto another', () => {
    const threeColumns = [
      { field: 'name', headerText: 'Name' },
      { field: 'age', headerText: 'Age', type: 'number' as const },
      { field: 'note', headerText: 'Note' },
    ];
    render(<InanduGrid rows={[{ name: 'Beatriz', age: 41, note: 'x' }]} columns={threeColumns} />);

    const nameHeader = screen.getByRole('columnheader', { name: 'Sort by Name' });
    const noteHeader = screen.getByRole('columnheader', { name: 'Sort by Note' });
    const dataTransfer = { setData: vi.fn() };
    fireEvent.dragStart(nameHeader, { dataTransfer });
    fireEvent.dragOver(noteHeader, { dataTransfer });
    fireEvent.drop(noteHeader, { dataTransfer });

    const headerTexts = screen.getAllByRole('columnheader').map(header => header.textContent).filter(Boolean);
    expect(headerTexts).toEqual(['Age', 'Name', 'Note']);
  });

  it('does not reorder a column whose reorder is disabled', () => {
    const threeColumns = [
      { field: 'name', headerText: 'Name', reorder: false },
      { field: 'age', headerText: 'Age', type: 'number' as const },
      { field: 'note', headerText: 'Note' },
    ];
    render(<InanduGrid rows={[{ name: 'Beatriz', age: 41, note: 'x' }]} columns={threeColumns} />);

    const nameHeader = screen.getByRole('columnheader', { name: 'Sort by Name' });
    const noteHeader = screen.getByRole('columnheader', { name: 'Sort by Note' });
    const dataTransfer = { setData: vi.fn() };
    fireEvent.dragStart(nameHeader, { dataTransfer });
    fireEvent.drop(noteHeader, { dataTransfer });

    const headerTexts = screen.getAllByRole('columnheader').map(header => header.textContent).filter(Boolean);
    expect(headerTexts).toEqual(['Name', 'Age', 'Note']);
  });

  it('resizes a column by dragging its resize handle', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    const nameHeader = screen.getByRole('columnheader', { name: 'Sort by Name' });
    const handle = nameHeader.querySelector('.inandu-grid-resize-handle')!;

    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 150 });
    fireEvent.mouseUp(window);

    expect(nameHeader.style.width).toBe('130px'); // no declared width -> 80 default, +50px dragged
  });

  it('clamps a resize to MIN_COLUMN_WIDTH', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    const nameHeader = screen.getByRole('columnheader', { name: 'Sort by Name' });
    const handle = nameHeader.querySelector('.inandu-grid-resize-handle')!;

    fireEvent.mouseDown(handle, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: -1000 });
    fireEvent.mouseUp(window);

    expect(nameHeader.style.width).toBe('30px');
  });

  describe('autosize', () => {
    // See src/utils/measureColumn.test.ts's own comment: this stubs offsetWidth (jsdom has no real
    // layout engine to measure against) so the surrounding logic — double-click wiring, the
    // autosize on/off gate, MAX_COLUMN_WIDTH clamping — is verified without pretending the actual
    // pixel measurement is meaningful here.
    let originalOffsetWidth: PropertyDescriptor | undefined;

    beforeEach(() => {
      originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get(this: HTMLElement) {
          return (this.textContent ?? '').length * 10;
        },
      });
    });

    afterEach(() => {
      if (originalOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
    });

    it('fits a column to its content on double-click when autosize is set', () => {
      const wideRows = [{ name: 'A Genuinely Very Long Name Indeed' }];
      render(<InanduGrid rows={wideRows} columns={columns} autosize />);

      const nameHeader = screen.getByRole('columnheader', { name: 'Sort by Name' });
      const handle = nameHeader.querySelector('.inandu-grid-resize-handle')!;
      fireEvent.doubleClick(handle);

      // "A Genuinely Very Long Name Indeed" (33 chars) * 10 = 330, +4 padding = 334 (< MAX_COLUMN_WIDTH).
      expect(nameHeader.style.width).toBe('334px');
    });

    it('clamps autosize to MAX_COLUMN_WIDTH', () => {
      const wideRows = [{ name: 'X'.repeat(200) }];
      render(<InanduGrid rows={wideRows} columns={columns} autosize />);

      const nameHeader = screen.getByRole('columnheader', { name: 'Sort by Name' });
      fireEvent.doubleClick(nameHeader.querySelector('.inandu-grid-resize-handle')!);

      expect(nameHeader.style.width).toBe('600px'); // MAX_COLUMN_WIDTH
    });

    it('is a no-op when autosize is not set', () => {
      const wideRows = [{ name: 'A Genuinely Very Long Name Indeed' }];
      render(<InanduGrid rows={wideRows} columns={columns} />);

      const nameHeader = screen.getByRole('columnheader', { name: 'Sort by Name' });
      fireEvent.doubleClick(nameHeader.querySelector('.inandu-grid-resize-handle')!);

      expect(nameHeader.style.width).toBe('');
    });
  });

  it('reorders rows by dragging a row handle and dropping it onto another row', () => {
    const onRowOrderChange = vi.fn();
    render(<InanduGrid rows={rows} columns={columns} rowReorder onRowOrderChange={onRowOrderChange} />);

    const handles = screen.getAllByLabelText('Drag to reorder row');
    const beatrizRow = screen.getByText('Beatriz').closest('tr')!;
    const dataTransfer = { setData: vi.fn() };
    fireEvent.dragStart(handles[1], { dataTransfer }); // Ana's handle (row 1)
    fireEvent.drop(beatrizRow, { dataTransfer }); // dropped before Beatriz (row 0)

    expect(onRowOrderChange).toHaveBeenCalledWith([rows[1], rows[0]]); // Ana, then Beatriz
  });

  it('has no row drag handle while grouped', () => {
    render(<InanduGrid rows={salesRows} columns={salesColumns} rowReorder />);
    fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'region' } });

    expect(screen.queryAllByLabelText('Drag to reorder row')).toHaveLength(0);
  });

  it('renders tree data collapsed by default and expands on toggle click', () => {
    const treeRows = [
      { name: 'Fruits', kids: [{ name: 'Apple' }, { name: 'Banana' }] },
      { name: 'Vegetables', kids: [{ name: 'Carrot' }] },
    ];
    render(<InanduGrid rows={treeRows} columns={[{ field: 'name', headerText: 'Name' }]} treeChildrenKey="kids" />);

    expect(screen.getByText('Fruits')).toBeInTheDocument();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText('Expand row details')[0]);
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.queryByText('Carrot')).not.toBeInTheDocument(); // Vegetables still collapsed
  });

  it('starts fully expanded with treeDefaultExpanded="all"', () => {
    const treeRows = [{ name: 'Fruits', kids: [{ name: 'Apple' }] }];
    render(
      <InanduGrid
        rows={treeRows}
        columns={[{ field: 'name', headerText: 'Name' }]}
        treeChildrenKey="kids"
        treeDefaultExpanded="all"
      />,
    );

    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('keeps a matching descendant visible (and its ancestor auto-expanded) under free-text search', () => {
    const treeRows = [
      { name: 'Fruits', kids: [{ name: 'Apple' }, { name: 'Banana' }] },
      { name: 'Vegetables', kids: [{ name: 'Carrot' }] },
    ];
    render(<InanduGrid rows={treeRows} columns={[{ field: 'name', headerText: 'Name' }]} treeChildrenKey="kids" />);

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'apple' } });

    expect(screen.getByText('Fruits')).toBeInTheDocument(); // ancestor of the match, auto-expanded
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.queryByText('Banana')).not.toBeInTheDocument(); // sibling, doesn't match
    expect(screen.queryByText('Vegetables')).not.toBeInTheDocument(); // no matching descendant
  });

  it('expands a row to show its detail content and collapses it back', () => {
    render(<InanduGrid rows={rows} columns={columns} renderDetail={row => <span>Detail for {row.name as string}</span>} />);

    expect(screen.queryByText('Detail for Beatriz')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText('Expand row details')[0]);
    expect(screen.getByText('Detail for Beatriz')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Collapse row details'));
    expect(screen.queryByText('Detail for Beatriz')).not.toBeInTheDocument();
  });

  it('collapses any other expanded row when singleDetailExpand is set', () => {
    render(
      <InanduGrid
        rows={rows}
        columns={columns}
        renderDetail={row => <span>Detail for {row.name as string}</span>}
        singleDetailExpand
      />,
    );

    const toggles = screen.getAllByLabelText('Expand row details');
    fireEvent.click(toggles[0]);
    expect(screen.getByText('Detail for Beatriz')).toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText('Expand row details')[0]); // now Ana's row (the only one left collapsed)
    expect(screen.queryByText('Detail for Beatriz')).not.toBeInTheDocument();
    expect(screen.getByText('Detail for Ana')).toBeInTheDocument();
  });

  it('has no master-detail toggle while grouped', () => {
    render(<InanduGrid rows={salesRows} columns={salesColumns} renderDetail={() => <span>x</span>} />);
    fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'region' } });

    expect(screen.queryAllByLabelText('Expand row details')).toHaveLength(0);
  });

  describe('virtualScroll', () => {
    const manyRows = Array.from({ length: 50 }, (_, i) => ({ name: `Row${i}` }));
    const nameColumn = [{ field: 'name', headerText: 'Name' }];

    it('mounts only the rows in view (plus overscan), not the full dataset', () => {
      const { container } = render(
        <InanduGrid rows={manyRows} columns={nameColumn} virtualScroll height={100} virtualRowHeight={20} overscan={1} />,
      );

      // height/rowHeight = 5 visible rows, +1 overscan => rows 0..5 (index 6 exclusive).
      expect(screen.getByText('Row0')).toBeInTheDocument();
      expect(screen.getByText('Row5')).toBeInTheDocument();
      expect(screen.queryByText('Row6')).not.toBeInTheDocument();
      expect(screen.queryByText('Row49')).not.toBeInTheDocument();

      // A real scrollbar-sized bottom spacer stands in for the unmounted rows.
      const viewport = container.querySelector('.inandu-grid-viewport')!;
      const bottomSpacer = viewport.querySelector('tr[aria-hidden="true"]:last-of-type td') as HTMLElement;
      expect(bottomSpacer.style.height).toBe(`${(50 - 6) * 20}px`);
    });

    it('shifts the mounted window when the viewport scrolls', () => {
      const { container } = render(
        <InanduGrid rows={manyRows} columns={nameColumn} virtualScroll height={100} virtualRowHeight={20} overscan={1} />,
      );

      const viewport = container.querySelector('.inandu-grid-viewport')!;
      fireEvent.scroll(viewport, { target: { scrollTop: 200 } });

      // floor(200/20)-1=9 .. ceil(300/20)+1=16 (exclusive) => rows 9..15.
      expect(screen.queryByText('Row0')).not.toBeInTheDocument();
      expect(screen.getByText('Row9')).toBeInTheDocument();
      expect(screen.getByText('Row15')).toBeInTheDocument();
      expect(screen.queryByText('Row16')).not.toBeInTheDocument();
    });

    it('bypasses pagination and disables the totals row, master-detail, and row drag-reorder', () => {
      render(
        <InanduGrid
          rows={salesRows}
          columns={salesColumns}
          virtualScroll
          pageSize={1}
          renderDetail={() => <span>detail</span>}
          rowReorder
        />,
      );

      expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Amount Σ/)).not.toBeInTheDocument();
      expect(screen.queryAllByLabelText('Expand row details')).toHaveLength(0);
      expect(screen.queryAllByLabelText('Drag to reorder row')).toHaveLength(0);
      // All 3 rows still present (unfiltered dataset, no virtualization-window edge case at this size).
      expect(screen.getAllByRole('row')).toHaveLength(1 + 1 + salesRows.length); // header + filter-row + data rows
    });
  });
});

describe('InanduGrid: custom render slots', () => {
  it('renderCell replaces the formatted display value', () => {
    const columnsWithRenderCell = [
      columns[0],
      { ...columns[1], renderCell: ({ value }: { value: unknown }) => <strong>{`Age: ${value}`}</strong> },
    ];
    render(<InanduGrid rows={rows} columns={columnsWithRenderCell} />);
    expect(screen.getByText('Age: 41')).toBeInTheDocument();
    expect(screen.queryByText('41')).not.toBeInTheDocument();
  });

  it('renderCell receives the row and field too', () => {
    const columnsWithRenderCell = [
      { ...columns[0], renderCell: ({ row, field }: { row: Record<string, unknown>; field: string }) => <em>{`${field}=${row.name}`}</em> },
      columns[1],
    ];
    render(<InanduGrid rows={rows} columns={columnsWithRenderCell} />);
    expect(screen.getByText('name=Beatriz')).toBeInTheDocument();
  });

  it('renderHeader replaces the header label; sort arrow/priority/resize handle are unaffected', () => {
    const columnsWithRenderHeader = [
      { ...columns[0], renderHeader: ({ title }: { title: string }) => <span>{`★ ${title}`}</span> },
      columns[1],
    ];
    render(<InanduGrid rows={rows} columns={columnsWithRenderHeader} />);
    const header = screen.getByRole('columnheader', { name: 'Sort by Name' });
    expect(header).toHaveTextContent('★ Name');
    fireEvent.click(header);
    expect(header).toHaveTextContent('★ Name ▲');
  });

  it('renderEditor replaces the built-in input while editing an existing row', async () => {
    const columnsWithRenderEditor = [
      {
        ...editableColumns[0],
        renderEditor: ({ value, setValue }: { value: unknown; setValue: (v: unknown) => void }) => (
          <input aria-label="Custom name editor" value={value as string} onChange={e => setValue(e.target.value)} />
        ),
      },
      editableColumns[1],
    ];
    const onRowSave = vi.fn();
    render(<InanduGrid rows={rows} columns={columnsWithRenderEditor} onRowSave={onRowSave} />);

    fireEvent.click(screen.getAllByText('Edit')[0]);
    expect(screen.queryByLabelText('Edit Name')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Custom name editor'), { target: { value: 'Zoe' } });
    fireEvent.click(screen.getByText('Save'));
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Custom name editor'));
    expect(onRowSave).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ name: 'Zoe' }) }));
  });

  it('renderEditor also replaces the built-in input in the new-row draft', () => {
    const columnsWithRenderEditor = [
      {
        ...editableColumns[0],
        renderEditor: ({ value, setValue }: { value: unknown; setValue: (v: unknown) => void }) => (
          <input aria-label="Custom name editor" value={(value as string) ?? ''} onChange={e => setValue(e.target.value)} />
        ),
      },
      editableColumns[1],
    ];
    render(<InanduGrid rows={rows} columns={columnsWithRenderEditor} creatable />);
    fireEvent.click(screen.getByText('Add row'));
    expect(screen.getByLabelText('Custom name editor')).toBeInTheDocument();
    expect(screen.queryByLabelText('Edit Name')).not.toBeInTheDocument();
  });
});

describe('InanduGrid: cell range selection', () => {
  it('does not mark any cell selected without cellRangeSelection', () => {
    const { container } = render(<InanduGrid rows={rows} columns={columns} />);
    fireEvent.mouseDown(screen.getByText('Beatriz'), { button: 0 });
    expect(container.querySelector('.inandu-cell-range-selected')).not.toBeInTheDocument();
  });

  it('selects a single cell on mousedown', () => {
    const { container } = render(<InanduGrid rows={rows} columns={columns} cellRangeSelection />);
    fireEvent.mouseDown(screen.getByText('Beatriz'), { button: 0 });
    const selected = container.querySelectorAll('.inandu-cell-range-selected');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('Beatriz');
  });

  it('extends the rectangle across a mousedown + mouseenter drag', () => {
    const { container } = render(<InanduGrid rows={rows} columns={columns} cellRangeSelection />);
    fireEvent.mouseDown(screen.getByText('Beatriz'), { button: 0 }); // row 0, col 0
    fireEvent.mouseEnter(screen.getByText('30')); // row 1, col 1 (Ana's age)
    // The 2x2 rectangle between (0,0) and (1,1) is every cell in this 2-row/2-column grid.
    expect(container.querySelectorAll('.inandu-cell-range-selected')).toHaveLength(4);
  });

  it('reports the selected range via onCellRangeChange', () => {
    const onCellRangeChange = vi.fn();
    render(<InanduGrid rows={rows} columns={columns} cellRangeSelection onCellRangeChange={onCellRangeChange} />);
    fireEvent.mouseDown(screen.getByText('Beatriz'), { button: 0 });
    fireEvent.mouseEnter(screen.getByText('Ana'));
    expect(onCellRangeChange).toHaveBeenLastCalledWith({ rows: [rows[0], rows[1]], fields: ['name'] });
  });

  it('reports undefined once the selection has nothing (initial render)', () => {
    const onCellRangeChange = vi.fn();
    render(<InanduGrid rows={rows} columns={columns} cellRangeSelection onCellRangeChange={onCellRangeChange} />);
    expect(onCellRangeChange).toHaveBeenCalledWith(undefined);
  });

  it('shift-click extends the existing anchor without a drag', () => {
    const { container } = render(<InanduGrid rows={rows} columns={columns} cellRangeSelection />);
    fireEvent.mouseDown(screen.getByText('Beatriz'), { button: 0 }); // anchor: row 0, col 0
    fireEvent.mouseUp(document); // ends the drag gesture — the anchor itself must survive this
    fireEvent.mouseDown(screen.getByText('30'), { button: 0, shiftKey: true }); // row 1, col 1
    // Shift-click extends the original anchor (0,0) rather than resetting it to (1,1) alone.
    expect(container.querySelectorAll('.inandu-cell-range-selected')).toHaveLength(4);
  });

  it('a plain click resets the selection to the new cell', () => {
    const { container } = render(<InanduGrid rows={rows} columns={columns} cellRangeSelection />);
    fireEvent.mouseDown(screen.getByText('Beatriz'), { button: 0 });
    fireEvent.mouseEnter(screen.getByText('Ana'));
    fireEvent.mouseUp(document);
    fireEvent.mouseDown(screen.getByText('41'), { button: 0 });
    const selected = container.querySelectorAll('.inandu-cell-range-selected');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('41');
  });

  it('hovering cells without a drag in progress does not start a selection', () => {
    const { container } = render(<InanduGrid rows={rows} columns={columns} cellRangeSelection />);
    fireEvent.mouseEnter(screen.getByText('Beatriz'));
    expect(container.querySelector('.inandu-cell-range-selected')).not.toBeInTheDocument();
  });

  it('Ctrl+C copies the whole selected range as TSV when clipboard is also on', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<InanduGrid rows={rows} columns={columns} clipboard cellRangeSelection />);
    fireEvent.mouseDown(screen.getByText('Beatriz'), { button: 0 });
    fireEvent.mouseEnter(screen.getByText('30'));
    fireEvent.keyDown(screen.getByText('Beatriz'), { key: 'c', ctrlKey: true });
    expect(writeText).toHaveBeenCalledWith('Beatriz\t41\nAna\t30');
  });

  it('Ctrl+C still copies just the focused cell when only one cell is selected', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<InanduGrid rows={rows} columns={columns} clipboard cellRangeSelection />);
    fireEvent.mouseDown(screen.getByText('Beatriz'), { button: 0 });
    fireEvent.keyDown(screen.getByText('Beatriz'), { key: 'c', ctrlKey: true });
    expect(writeText).toHaveBeenCalledWith('Beatriz');
  });

  it('is disabled while the grid is grouped', () => {
    const { container } = render(<InanduGrid rows={rows} columns={columns} cellRangeSelection />);
    fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'name' } });
    // Grouped rows render through RowGroup, which never wires the range mousedown/mouseenter handlers.
    fireEvent.mouseDown(container.querySelector('td[data-field="name"]')!, { button: 0 });
    expect(container.querySelector('.inandu-cell-range-selected')).not.toBeInTheDocument();
  });
});

describe('<InanduGrid serverSide>', () => {
  it('shows the rows it was given untouched, the server total in the pager, and no group-by control', () => {
    render(<InanduGrid rows={rows} columns={columns} pageSize={2} serverSide={{ totalItems: 7 }} />);

    expect(screen.getAllByText(/Beatriz|Ana/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Page 1 of 4 \(7\)/)).toBeTruthy();
    expect(screen.queryByLabelText('Group by')).toBeNull();
  });
});

describe('InanduGrid accessibility', () => {
  it('exposes the sort state on every column header', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    const name = screen.getByRole('columnheader', { name: 'Sort by Name' });
    const age = screen.getByRole('columnheader', { name: 'Sort by Age' });
    expect(name).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(name);
    expect(name).toHaveAttribute('aria-sort', 'ascending');
    expect(age).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(name);
    expect(name).toHaveAttribute('aria-sort', 'descending');
  });

  it('marks data rows as selected or not once the grid is selectable', () => {
    render(<InanduGrid rows={rows} columns={columns} selectable />);
    const dataRows = () => screen.getAllByRole('row').filter(r => r.hasAttribute('aria-selected'));
    expect(dataRows().map(r => r.getAttribute('aria-selected'))).toEqual(['false', 'false']);

    fireEvent.click(screen.getAllByLabelText(/Select row/)[0]);
    expect(dataRows().map(r => r.getAttribute('aria-selected')).sort()).toEqual(['false', 'true']);
  });

  it('does not set aria-selected when rows cannot be selected', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    expect(screen.getAllByRole('row').some(r => r.hasAttribute('aria-selected'))).toBe(false);
  });

  it('reports the full row count (two header rows included) only when the DOM holds part of the data', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ name: `N${i}`, age: i }));
    const { container, rerender } = render(<InanduGrid rows={many} columns={columns} pageSize={3} />);
    expect(container.querySelector('table')).toHaveAttribute('aria-rowcount', '9');

    rerender(<InanduGrid rows={many} columns={columns} />);
    expect(container.querySelector('table')).not.toHaveAttribute('aria-rowcount');

    rerender(<InanduGrid rows={many.slice(0, 3)} columns={columns} pageSize={3} serverSide={{ totalItems: 120 }} />);
    expect(container.querySelector('table')).toHaveAttribute('aria-rowcount', '122');
  });

  it('announces an empty result in a polite live region', () => {
    const { rerender } = render(<InanduGrid rows={rows} columns={columns} />);
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('');

    rerender(<InanduGrid rows={[]} columns={columns} />);
    expect(screen.getByRole('status')).not.toHaveTextContent('');
  });
});

describe('InanduGrid: keyboard and assistive technology', () => {
  it('is an ARIA grid whose rows and cells carry their roles', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('gridcell').length).toBeGreaterThan(0);
  });

  it('has a single tab stop: the first header cell', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    const stops = screen.getByRole('grid').querySelectorAll('[tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveTextContent('Name');
  });

  it('moves between cells with the arrow keys, Home and End', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    const name = screen.getByRole('columnheader', { name: 'Sort by Name' });
    name.focus();

    fireEvent.keyDown(name, { key: 'ArrowRight' });
    expect(document.activeElement).toHaveTextContent('Age');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' }); // the filter row is skipped
    expect(document.activeElement).toHaveTextContent('41');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toHaveTextContent('Beatriz');
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toHaveTextContent('41');
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toHaveTextContent('Beatriz');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveTextContent('Ana');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toHaveTextContent('Beatriz');
  });

  it('sorts with Enter on a header cell, and keeps typing in a filter box out of the navigation', () => {
    render(<InanduGrid rows={rows} columns={columns} />);
    const name = screen.getByRole('columnheader', { name: 'Sort by Name' });
    name.focus();
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(name).toHaveAttribute('aria-sort', 'ascending');

    const filter = screen.getAllByRole('textbox')[1];
    filter.focus();
    fireEvent.keyDown(filter, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(filter);
  });

  it('announces loading and an error in the live region, and shows them in place of the rows', () => {
    const { rerender } = render(<InanduGrid rows={rows} columns={columns} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText('Beatriz')).not.toBeInTheDocument();

    rerender(<InanduGrid rows={rows} columns={columns} loading error="Could not load" />);
    expect(screen.getByRole('status')).toHaveTextContent('Could not load');
    expect(within(screen.getByRole('grid')).getByText('Could not load')).toBeInTheDocument();
  });
});

describe('InanduGrid: API shared with grid-angular', () => {
  it('sets id, dir, theme and width on the root', () => {
    const { container } = render(<InanduGrid rows={rows} columns={columns} id="people" dir="rtl" theme="material" width={600} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('id', 'people');
    expect(root).toHaveAttribute('dir', 'rtl');
    expect(root).toHaveClass('inandu-theme-material');
    expect(root.style.width).toBe('600px');
  });

  it('hides the search box with filter={false} and uses filterPlaceholder', () => {
    const { rerender } = render(<InanduGrid rows={rows} columns={columns} filterPlaceholder="Find…" />);
    expect(screen.getByPlaceholderText('Find…')).toBeInTheDocument();
    rerender(<InanduGrid rows={rows} columns={columns} filter={false} />);
    expect(screen.queryByPlaceholderText('Find…')).not.toBeInTheDocument();
  });

  it('merges customTranslations over the built-in texts', () => {
    render(<InanduGrid rows={[]} columns={columns} customTranslations={{ en: { MsgNoData: 'Nothing here' } }} />);
    expect(within(screen.getByRole('grid')).getByText('Nothing here')).toBeInTheDocument();
  });

  it('hides the totals footer with showTotals={false}', () => {
    const { container, rerender } = render(<InanduGrid rows={salesRows} columns={salesColumns} />);
    expect(container.querySelector('tfoot')).not.toBeNull();
    rerender(<InanduGrid rows={salesRows} columns={salesColumns} showTotals={false} />);
    expect(container.querySelector('tfoot')).toBeNull();
  });

  it('shows pinned rows above and below the data, outside of sorting and totals', () => {
    const { container } = render(
      <InanduGrid rows={rows} columns={columns} pinnedTopRows={[{ name: 'TOP', age: 1 }]} pinnedBottomRows={[{ name: 'BOTTOM', age: 2 }]} />,
    );
    const bodies = container.querySelectorAll('tbody');
    expect(bodies).toHaveLength(3);
    expect(bodies[0]).toHaveTextContent('TOP');
    expect(bodies[1]).toHaveTextContent('Beatriz');
    expect(bodies[2]).toHaveTextContent('BOTTOM');
  });

  it('reports sort and filter changes, but not the initial state', () => {
    const onSortChange = vi.fn();
    const onFilterChange = vi.fn();
    render(<InanduGrid rows={rows} columns={columns} onSortChange={onSortChange} onFilterChange={onFilterChange} />);
    expect(onSortChange).not.toHaveBeenCalled();
    expect(onFilterChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('columnheader', { name: 'Sort by Name' }));
    expect(onSortChange).toHaveBeenCalledWith([{ field: 'name', direction: 'asc' }]);

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'ana' } });
    expect(onFilterChange).toHaveBeenLastCalledWith({ query: 'ana', columnFilters: {} });
  });
});

describe('InanduGrid: stateKey', () => {
  const KEY = 'inandu-grid-state:react-test';
  afterEach(() => localStorage.removeItem(KEY));

  it('saves the sort and restores it in a new grid with the same key', () => {
    const first = render(<InanduGrid rows={rows} columns={columns} stateKey="react-test" />);
    fireEvent.click(screen.getByRole('columnheader', { name: 'Sort by Name' }));
    expect(JSON.parse(localStorage.getItem(KEY)!).sortCriteria).toEqual([{ field: 'name', direction: 'asc' }]);
    first.unmount();

    render(<InanduGrid rows={rows} columns={columns} stateKey="react-test" />);
    expect(screen.getByRole('columnheader', { name: 'Sort by Name' })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('ignores a stored blob with the wrong shape', () => {
    localStorage.setItem(KEY, JSON.stringify({ sortCriteria: 'x', hiddenFields: { a: 1 }, columnFilters: 5 }));
    render(<InanduGrid rows={rows} columns={columns} stateKey="react-test" />);
    expect(screen.getByRole('columnheader', { name: 'Sort by Name' })).toHaveAttribute('aria-sort', 'none');
  });

  it('keeps the search text out of storage when persist leaves it out', () => {
    render(<InanduGrid rows={rows} columns={columns} stateKey="react-test" persist={['sortCriteria']} />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'secret' } });
    expect(localStorage.getItem(KEY)).not.toContain('secret');
  });
});
