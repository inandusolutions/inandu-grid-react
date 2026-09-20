import { useEffect, useMemo, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { InanduGridColumnFilterValue, InanduGridRow } from '../core';
import { AGGREGATE_SYMBOLS, formatCellValue } from '../core';
import { InanduGridCellPaste, InanduGridColumn, InanduGridRowSave, useInanduGrid } from '../hooks/useInanduGrid';
import { exportCsv, exportExcel, exportPdf, printTable } from '../utils/exporters';
import { createTranslator, InanduGridMessageKey } from '../utils/translate';

type Translator = (key: InanduGridMessageKey, params?: Record<string, string | number>) => string;

export interface InanduGridProps {
  rows: InanduGridRow[];
  columns: InanduGridColumn[];
  /** Drives number/date formatting (`Intl`-based). Default: 'en'. */
  locale?: string;
  /** Drives built-in UI string translation (one of `INANDU_GRID_TRANSLATIONS`'s keys). Default: `locale`'s primary subtag. */
  lang?: string;
  /** 0 (default) disables pagination — every filtered/sorted row renders. Ignored while grouped. */
  pageSize?: number;
  /** Adds a checkbox column with row + select-all selection. Default: false. */
  selectable?: boolean;
  /** Called after every selection change with the current full selection, as an array. */
  onSelectionChange?: (selectedRows: InanduGridRow[]) => void;
  /** Adds a CSV/Excel/PDF export toolbar above the table. Default: false. */
  exportable?: boolean;
  /** Base filename (without extension) for exports. Default: 'inandu-grid'. */
  exportFilenameBase?: string;
  /** Adds a per-row "Delete" button. Default: false. */
  deletable?: boolean;
  /** `window.confirm()`-gates a single row's delete. Unset: deletes immediately. */
  deleteConfirmMessage?: string;
  /** `window.confirm()`-gates the "Delete selected" bulk action (shown when `selectable && deletable` with at least one row selected). Unset: deletes immediately. */
  bulkDeleteConfirmMessage?: string;
  /** Adds an "Add row" trigger with a blank draft row. Default: false. Has no effect unless at least one column is `editable`. */
  creatable?: boolean;
  /** Called once a row edit passes validation. The grid never mutates `rows` itself — applying `values` onto `row` is the caller's job. */
  onRowSave?: (event: InanduGridRowSave) => void;
  /** Called once a new row's draft passes validation. No row reference — it doesn't exist in `rows` yet. */
  onRowCreate?: (values: Record<string, unknown>) => void;
  /** Called after a single-row delete is confirmed (or clicked, if no `deleteConfirmMessage`). */
  onRowDelete?: (row: InanduGridRow) => void;
  /** Called after the bulk "Delete selected" action is confirmed (or clicked, if no `bulkDeleteConfirmMessage`). */
  onRowsDelete?: (rows: InanduGridRow[]) => void;
  /** Opts into `Ctrl+C`/`Ctrl+V` cell copy/paste (Excel-style TSV). Default: false. */
  clipboard?: boolean;
  /** Called with every parsed cell update from a `Ctrl+V`. The grid never mutates `rows` itself. */
  onCellsPaste?: (updates: InanduGridCellPaste[]) => void;
  /** Adds a "Columns" toolbar button + popup letting the user show/hide individual columns at runtime. Default: false. */
  columnToggle?: boolean;
}

/**
 * Batteries-included table over `useInanduGrid`: sorting, free-text search, a per-column filter
 * row, pagination, single-column grouping with per-group + grand-total aggregates, row selection,
 * CSV/Excel/PDF export, i18n, and inline row editing/creation/deletion with validation.
 * Virtualization (present in grid-angular) lands in a later pass.
 */
export function InanduGrid({
  rows,
  columns,
  locale = 'en',
  lang,
  pageSize = 0,
  selectable = false,
  onSelectionChange,
  exportable = false,
  exportFilenameBase = 'inandu-grid',
  deletable = false,
  deleteConfirmMessage,
  bulkDeleteConfirmMessage,
  creatable = false,
  onRowSave,
  onRowCreate,
  onRowDelete,
  onRowsDelete,
  clipboard = false,
  onCellsPaste,
  columnToggle = false,
}: InanduGridProps) {
  const {
    visibleColumns,
    hideableColumns,
    isColumnHidden,
    toggleColumnVisibility,
    visibleRows,
    exportRows,
    filteredRowCount,
    toggleSort,
    sortDirectionFor,
    sortPriorityFor,
    filterValues,
    setFilterValue,
    filterQuery,
    setFilterQuery,
    page,
    setPage,
    pageCount,
    groupByField,
    setGroupByField,
    groups,
    totals,
    selectedRows,
    isRowSelected,
    toggleRowSelection,
    allSelected,
    someSelected,
    toggleSelectAll,
    editableColumns,
    isAddingRow,
    rowDraft,
    fieldErrors,
    isValidating,
    isEditingRow,
    isAnotherRowEditing,
    startEditingRow,
    cancelRowEdit,
    setRowDraftValue,
    saveRow,
    deleteRow,
    deleteSelectedRows,
    startAddingRow,
    cancelAddRow,
    saveNewRow,
    copyCellText,
    pasteAt,
    stickyOffset,
    stickyOffsetRight,
  } = useInanduGrid({
    rows,
    columns,
    locale,
    lang,
    pageSize,
    selectable,
    deleteConfirmMessage,
    bulkDeleteConfirmMessage,
    onRowSave,
    onRowCreate,
    onRowDelete,
    onRowsDelete,
    onCellsPaste,
  });

  const t = useMemo(() => createTranslator(lang ?? locale), [lang, locale]);

  useEffect(() => {
    onSelectionChange?.(Array.from(selectedRows));
  }, [selectedRows, onSelectionChange]);

  const aggregateColumns = visibleColumns.filter(column => column.aggregate);
  const groupableColumns = visibleColumns.filter(column => column.groupable !== false);
  const isEmpty = groups ? groups.length === 0 : visibleRows.length === 0;
  const hasRowActions = editableColumns.length > 0 || deletable || creatable;
  const extraColumnCount = (selectable ? 1 : 0) + (hasRowActions ? 1 : 0);

  function patchFilterValue(field: string, patch: Partial<InanduGridColumnFilterValue>) {
    setFilterValue(field, { ...filterValues[field], ...patch });
  }

  /** `position: sticky` inline style + width for `column`'s `<th>`/`<td>`, per its `pinned`/`width` — same offsets grid-angular's `stickyOffset`/`stickyOffsetRight` compute, applied via CSS instead of a template class/binding. */
  function columnStyle(column: InanduGridColumn): CSSProperties {
    const style: CSSProperties = column.width !== undefined ? { width: column.width } : {};
    if (column.pinned === 'left') return { ...style, position: 'sticky', left: stickyOffset(column.field), zIndex: 1 };
    if (column.pinned === 'right') return { ...style, position: 'sticky', right: stickyOffsetRight(column.field), zIndex: 1 };
    return style;
  }

  /** The select-checkbox column is always sticky-left (offset 0) when rendered — grid-angular's posture too. */
  const selectColumnStyle: CSSProperties | undefined = selectable ? { position: 'sticky', left: 0, zIndex: 1 } : undefined;

  function aggregateLabel(column: InanduGridColumn, aggregates: Record<string, number>): string {
    const kind = column.aggregate;
    const value = aggregates[column.field];
    if (!kind || value === undefined) return '';
    const formatted = kind === 'count' ? String(value) : formatCellValue(value, 'number', column.format ?? '', locale);
    return `${column.headerText ?? column.field} ${AGGREGATE_SYMBOLS[kind]}: ${formatted}`;
  }

  /**
   * The `Ctrl+C`/`Ctrl+V` half of grid-angular's `handleClipboardShortcut` — resolves the focused
   * cell via the `data-row-index`/`data-field` attributes each `<td>`/`<tr>` carries (only in the
   * flat, non-grouped render path, same restriction), then defers to `copyCellText()`/`pasteAt()`.
   * Ignored while focus is inside a cell's own edit control — native copy/paste of the *selected
   * text* there should win, not a whole-cell copy/paste.
   */
  function handleTableKeyDown(event: ReactKeyboardEvent<HTMLTableElement>) {
    if (!clipboard || !(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key !== 'c' && key !== 'v') return;
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

    const cell = target.closest<HTMLElement>('td[data-field]');
    const field = cell?.getAttribute('data-field');
    const rowIndexAttr = cell?.closest('tr')?.getAttribute('data-row-index');
    if (!cell || !field || rowIndexAttr === null || rowIndexAttr === undefined) return;
    const rowIndex = Number(rowIndexAttr);

    event.preventDefault();
    if (key === 'c') {
      navigator.clipboard?.writeText(copyCellText(rowIndex, field))?.catch(() => undefined);
    } else {
      navigator.clipboard?.readText()?.then(text => pasteAt(rowIndex, field, text)).catch(() => undefined);
    }
  }

  const rowProps: DataRowProps = {
    columns: visibleColumns,
    locale,
    t,
    selectable,
    selectColumnStyle,
    columnStyle,
    isRowSelected,
    toggleRowSelection,
    hasRowActions,
    editableColumns,
    isEditingRow,
    isAnotherRowEditing,
    startEditingRow,
    cancelRowEdit,
    saveRow,
    deleteRow,
    deletable,
    rowDraft,
    fieldErrors,
    isValidating,
    setRowDraftValue,
  };

  return (
    <div className="inandu-grid-react">
      <div className="inandu-grid-search">
        <input
          aria-label={t('MsgFilterPlaceholder')}
          type="text"
          placeholder={`${t('MsgFilterPlaceholder')}…`}
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
        />
      </div>
      <div className="inandu-grid-toolbar">
        {exportable && (
          <>
            <button type="button" onClick={() => exportCsv(exportRows, visibleColumns, locale, exportFilenameBase)}>
              {t('MsgExportCsv')}
            </button>
            <button type="button" onClick={() => exportExcel(exportRows, visibleColumns, locale, exportFilenameBase)}>
              {t('MsgExportExcel')}
            </button>
            <button type="button" onClick={() => void exportPdf(exportRows, visibleColumns, locale, exportFilenameBase)}>
              {t('MsgExportPdf')}
            </button>
            <button type="button" onClick={() => printTable(exportRows, visibleColumns, locale, exportFilenameBase)}>
              {t('MsgPrint')}
            </button>
          </>
        )}
        {creatable && editableColumns.length > 0 && !isAddingRow && (
          <button type="button" onClick={startAddingRow}>
            {t('MsgAddRow')}
          </button>
        )}
        {selectable && deletable && selectedRows.size > 0 && (
          <button type="button" onClick={deleteSelectedRows}>
            {t('MsgDeleteSelected', { count: selectedRows.size })}
          </button>
        )}
        {columnToggle && (
          <details className="inandu-grid-column-toggle">
            <summary>{t('MsgToggleColumns')}</summary>
            <ul>
              {hideableColumns.map(column => (
                <li key={column.field}>
                  <label>
                    <input
                      aria-label={t('MsgToggleColumn', { column: column.headerText ?? column.field })}
                      type="checkbox"
                      checked={!isColumnHidden(column.field)}
                      onChange={() => toggleColumnVisibility(column.field)}
                    />{' '}
                    {column.headerText ?? column.field}
                  </label>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {groupableColumns.length > 0 && (
        <div className="inandu-grid-group-by">
          <label>
            {groupByField
              ? t('MsgGroupedBy', { column: groupableColumns.find(c => c.field === groupByField)?.headerText ?? groupByField })
              : t('MsgGroupByHint')}{' '}
            {/* No dictionary key names this control itself (grid-angular's equivalent is a drag-and-drop zone, not a picker) — "Group by" is structural chrome, not a translated message. */}
            <select aria-label="Group by" value={groupByField ?? ''} onChange={e => setGroupByField(e.target.value || undefined)}>
              <option value="">{t('MsgCancelGrouping')}</option>
              {groupableColumns.map(column => (
                <option key={column.field} value={column.field}>
                  {column.headerText ?? column.field}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <table className="inandu-grid" onKeyDown={handleTableKeyDown}>
        <thead>
          <tr>
            {selectable && (
              <th style={selectColumnStyle}>
                <input
                  aria-label={t('MsgSelectAll')}
                  type="checkbox"
                  checked={allSelected}
                  ref={el => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleSelectAll}
                />
              </th>
            )}
            {visibleColumns.map(column => {
              const direction = sortDirectionFor(column.field);
              const priority = sortPriorityFor(column.field);
              return (
                <th
                  key={column.field}
                  style={columnStyle(column)}
                  onClick={e => toggleSort(column.field, e.shiftKey)}
                  aria-label={t('MsgSortBy', { column: column.headerText ?? column.field })}
                >
                  {column.headerText ?? column.field}
                  {direction ? (direction === 'asc' ? ' ▲' : ' ▼') : ''}
                  {priority !== undefined && <sup className="inandu-grid-sort-priority">{priority}</sup>}
                </th>
              );
            })}
            {hasRowActions && <th />}
          </tr>
          <tr className="inandu-grid-filter-row">
            {selectable && <th style={selectColumnStyle} />}
            {visibleColumns.map(column => (
              <th key={column.field} style={columnStyle(column)}>
                <FilterControl column={column} value={filterValues[column.field]} onChange={patch => patchFilterValue(column.field, patch)} t={t} />
              </th>
            ))}
            {hasRowActions && <th />}
          </tr>
        </thead>
        <tbody>
          {isAddingRow && <NewRowDraft {...rowProps} onSave={() => void saveNewRow()} onCancel={cancelAddRow} />}
          {isEmpty ? (
            <tr>
              <td colSpan={visibleColumns.length + extraColumnCount}>{t('MsgNoData')}</td>
            </tr>
          ) : groups ? (
            groups.map(group => (
              <RowGroup key={group.key} group={group} aggregateColumns={aggregateColumns} aggregateLabel={aggregateLabel} extraColumnCount={extraColumnCount} {...rowProps} />
            ))
          ) : (
            visibleRows.map((row, index) => (
              <DataRow key={row['id'] != null ? String(row['id']) : index} row={row} rowIndex={index} clipboard={clipboard} {...rowProps} />
            ))
          )}
        </tbody>
        {aggregateColumns.length > 0 && (
          <tfoot>
            <tr className="inandu-grid-totals-row">
              {selectable && <td style={selectColumnStyle} />}
              {visibleColumns.map(column => (
                <td key={column.field} style={columnStyle(column)}>
                  {column.aggregate ? aggregateLabel(column, totals) : ''}
                </td>
              ))}
              {hasRowActions && <td />}
            </tr>
          </tfoot>
        )}
      </table>
      {pageSize > 0 && !groupByField && (
        <div className="inandu-grid-pagination">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
            ‹ {t('MsgPreviousPage')}
          </button>
          <span>
            {t('MsgPageOf', { page: page + 1, total: pageCount })} ({filteredRowCount})
          </span>
          <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
            {t('MsgNextPage')} ›
          </button>
        </div>
      )}
    </div>
  );
}

interface DataRowProps {
  columns: InanduGridColumn[];
  locale: string;
  t: Translator;
  selectable: boolean;
  selectColumnStyle: CSSProperties | undefined;
  columnStyle: (column: InanduGridColumn) => CSSProperties;
  isRowSelected: (row: InanduGridRow) => boolean;
  toggleRowSelection: (row: InanduGridRow) => void;
  hasRowActions: boolean;
  editableColumns: InanduGridColumn[];
  isEditingRow: (row: InanduGridRow) => boolean;
  isAnotherRowEditing: (row: InanduGridRow) => boolean;
  startEditingRow: (row: InanduGridRow) => void;
  cancelRowEdit: () => void;
  saveRow: (row: InanduGridRow) => void;
  deleteRow: (row: InanduGridRow) => void;
  deletable: boolean;
  rowDraft: Record<string, unknown>;
  fieldErrors: Record<string, string>;
  isValidating: boolean;
  setRowDraftValue: (field: string, value: unknown) => void;
  /** Adds the `data-row-index`/`data-field`/`tabIndex` attributes `handleTableKeyDown` resolves a Ctrl+C/Ctrl+V onto — only in the flat, non-grouped render path, same restriction grid-angular's clipboard has. */
  clipboard?: boolean;
}

/** One data row — its own read-only cells, or (while it's the row being edited) `editableColumns` as controls bound to the shared draft, plus a trailing Edit/Save/Cancel/Delete actions cell when `hasRowActions`. */
function DataRow({
  row,
  rowIndex,
  columns,
  locale,
  t,
  selectable,
  selectColumnStyle,
  columnStyle,
  isRowSelected,
  toggleRowSelection,
  hasRowActions,
  editableColumns,
  isEditingRow,
  isAnotherRowEditing,
  startEditingRow,
  cancelRowEdit,
  saveRow,
  deleteRow,
  deletable,
  rowDraft,
  fieldErrors,
  isValidating,
  setRowDraftValue,
  clipboard = false,
}: DataRowProps & { row: InanduGridRow; rowIndex: number }) {
  const editing = isEditingRow(row);

  return (
    <tr data-row-index={clipboard ? rowIndex : undefined}>
      {selectable && (
        <td style={selectColumnStyle}>
          <input aria-label={t('MsgSelectRow', { index: rowIndex + 1 })} type="checkbox" checked={isRowSelected(row)} onChange={() => toggleRowSelection(row)} />
        </td>
      )}
      {columns.map(column => (
        <td key={column.field} style={columnStyle(column)} data-field={clipboard ? column.field : undefined} tabIndex={clipboard ? 0 : undefined}>
          {editing && column.editable ? (
            <EditCell column={column} value={rowDraft[column.field]} error={fieldErrors[column.field]} onChange={value => setRowDraftValue(column.field, value)} t={t} />
          ) : (
            formatCellValue(row[column.field], column.type ?? 'string', column.format ?? '', locale)
          )}
        </td>
      ))}
      {hasRowActions && (
        <td className="inandu-grid-row-actions">
          {editing ? (
            <>
              <button type="button" disabled={isValidating} onClick={() => saveRow(row)}>
                {t('MsgSaveRow')}
              </button>
              <button type="button" disabled={isValidating} onClick={cancelRowEdit}>
                {t('MsgCancelRowEdit')}
              </button>
            </>
          ) : (
            <>
              {editableColumns.length > 0 && (
                <button type="button" disabled={isAnotherRowEditing(row)} onClick={() => startEditingRow(row)}>
                  {t('MsgEditRow')}
                </button>
              )}
              {deletable && (
                <button type="button" disabled={isAnotherRowEditing(row)} onClick={() => deleteRow(row)}>
                  {t('MsgDeleteRow')}
                </button>
              )}
            </>
          )}
        </td>
      )}
    </tr>
  );
}

/** The blank draft row shown above the data while `creatable`'s "Add row" trigger is active — every `editableColumns` field starts empty, nothing needs seeding (unlike editing an existing row). */
function NewRowDraft({
  columns,
  t,
  selectable,
  selectColumnStyle,
  columnStyle,
  hasRowActions,
  rowDraft,
  fieldErrors,
  isValidating,
  setRowDraftValue,
  onSave,
  onCancel,
}: DataRowProps & { onSave: () => void; onCancel: () => void }) {
  return (
    <tr className="inandu-grid-new-row">
      {selectable && <td style={selectColumnStyle} />}
      {columns.map(column => (
        <td key={column.field} style={columnStyle(column)}>
          {column.editable ? (
            <EditCell column={column} value={rowDraft[column.field]} error={fieldErrors[column.field]} onChange={value => setRowDraftValue(column.field, value)} t={t} />
          ) : null}
        </td>
      ))}
      {hasRowActions && (
        <td className="inandu-grid-row-actions">
          <button type="button" disabled={isValidating} onClick={onSave}>
            {t('MsgSaveRow')}
          </button>
          <button type="button" disabled={isValidating} onClick={onCancel}>
            {t('MsgCancelRowEdit')}
          </button>
        </td>
      )}
    </tr>
  );
}

interface RowGroupProps extends DataRowProps {
  group: { key: string; rows: InanduGridRow[]; aggregates: Record<string, number> };
  aggregateColumns: InanduGridColumn[];
  aggregateLabel: (column: InanduGridColumn, aggregates: Record<string, number>) => string;
  extraColumnCount: number;
}

/** One group header row (key + row count + per-aggregate-column labels) followed by its own data rows. */
function RowGroup({ group, columns, aggregateColumns, aggregateLabel, extraColumnCount, ...rowProps }: RowGroupProps) {
  return (
    <>
      <tr className="inandu-grid-group-row">
        <td colSpan={columns.length + extraColumnCount}>
          <strong>{group.key}</strong> ({group.rows.length})
          {aggregateColumns.length > 0 && (
            <span className="inandu-grid-group-aggregates">
              {aggregateColumns.map(column => (
                <span key={column.field}> · {aggregateLabel(column, group.aggregates)}</span>
              ))}
            </span>
          )}
        </td>
      </tr>
      {group.rows.map((row, index) => (
        <DataRow key={row['id'] != null ? String(row['id']) : `${group.key}:${index}`} row={row} rowIndex={index} columns={columns} {...rowProps} />
      ))}
    </>
  );
}

interface EditCellProps {
  column: InanduGridColumn;
  value: unknown;
  error: string | undefined;
  onChange: (value: unknown) => void;
  t: Translator;
}

/** One editable cell's control, bound to the shared row draft in the same *raw control* shape `parseDraftValue()` expects (a string for text/number/date, a boolean for the checkbox) — plus its inline validation message, if any. */
function EditCell({ column, value, error, onChange, t }: EditCellProps) {
  const type = column.type ?? 'string';
  const label = t('MsgEditCell', { column: column.headerText ?? column.field });

  const control =
    type === 'boolean' ? (
      <input aria-label={label} type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
    ) : type === 'date' ? (
      <input aria-label={label} type="date" value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} />
    ) : (
      <input
        aria-label={label}
        type={type === 'number' ? 'number' : 'text'}
        value={typeof value === 'string' ? value : ''}
        onChange={e => onChange(e.target.value)}
      />
    );

  return (
    <span className="inandu-grid-edit-cell">
      {control}
      {error && <span className="inandu-grid-field-error">{error}</span>}
    </span>
  );
}

interface FilterControlProps {
  column: InanduGridColumn;
  value: InanduGridColumnFilterValue | undefined;
  onChange: (patch: Partial<InanduGridColumnFilterValue>) => void;
  t: Translator;
}

/** One filter control per column type, all working off the same `InanduGridColumnFilterValue` shape the core understands. */
function FilterControl({ column, value, onChange, t }: FilterControlProps) {
  const type = column.type ?? 'string';
  const label = t('MsgFilterColumn', { column: column.headerText ?? column.field });

  if (type === 'number') {
    return (
      <span className="inandu-grid-filter-range">
        <input aria-label={`${label} ${t('MsgFilterMin')}`} type="number" value={value?.min ?? ''} onChange={e => onChange({ min: e.target.value })} />
        <input aria-label={`${label} ${t('MsgFilterMax')}`} type="number" value={value?.max ?? ''} onChange={e => onChange({ max: e.target.value })} />
      </span>
    );
  }

  if (type === 'date') {
    return (
      <span className="inandu-grid-filter-range">
        <input aria-label={`${label} ${t('MsgFilterFrom')}`} type="date" value={value?.from ?? ''} onChange={e => onChange({ from: e.target.value })} />
        <input aria-label={`${label} ${t('MsgFilterTo')}`} type="date" value={value?.to ?? ''} onChange={e => onChange({ to: e.target.value })} />
      </span>
    );
  }

  if (type === 'boolean') {
    return (
      <select aria-label={label} value={value?.bool ?? ''} onChange={e => onChange({ bool: e.target.value })}>
        <option value="">{t('MsgAll')}</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  return <input aria-label={label} type="text" value={value?.text ?? ''} onChange={e => onChange({ text: e.target.value })} />;
}
