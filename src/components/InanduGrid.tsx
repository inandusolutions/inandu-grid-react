import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { InanduGridColumnFilterValue, InanduGridRow, TreeVisibleRow } from '../core';
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
  /** Adds a per-row drag handle to reorder rows. Default: false. Auto-disabled while grouped, same as grid-angular. */
  rowReorder?: boolean;
  /** Called with the fully reordered row array after a row drag-and-drop. The grid never mutates `rows` itself. */
  onRowOrderChange?: (rows: InanduGridRow[]) => void;
  /**
   * Turns on tree mode: the field on each row holding its child rows (a nested array of the same
   * shape). `rows` is then the root rows. Auto-disabled while grouped. Tree rows are display +
   * expand only — inline editing, drag-reorder and clipboard don't apply to them, same as
   * grid-angular.
   */
  treeChildrenKey?: string;
  /** Initial expand state for tree mode. Default: `'none'`. */
  treeDefaultExpanded?: 'none' | 'all' | number;
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
  rowReorder = false,
  onRowOrderChange,
  treeChildrenKey,
  treeDefaultExpanded = 'none',
}: InanduGridProps) {
  const {
    visibleColumns,
    hideableColumns,
    isColumnHidden,
    toggleColumnVisibility,
    onColumnDragStart,
    onColumnDrop,
    effectiveWidth,
    isColumnResized,
    setColumnWidth,
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
    draggingRow,
    onRowDragStart,
    onRowDrop,
    hasTreeData,
    treeRows,
    isTreeRowExpanded,
    toggleTreeRow,
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
    onRowOrderChange,
    treeChildrenKey,
    treeDefaultExpanded,
  });

  const t = useMemo(() => createTranslator(lang ?? locale), [lang, locale]);
  const [dragOverField, setDragOverField] = useState<string | undefined>(undefined);
  const [dragOverRow, setDragOverRow] = useState<InanduGridRow | undefined>(undefined);
  const [resizing, setResizing] = useState<{ field: string; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    onSelectionChange?.(Array.from(selectedRows));
  }, [selectedRows, onSelectionChange]);

  // The resize handle's drag: mousemove/mouseup are tracked on `window` (not the handle itself),
  // since the pointer routinely leaves the handle and even the table while dragging — same reason
  // grid-angular's own onResizeHandleMouseDown attaches its listeners there instead.
  useEffect(() => {
    if (!resizing) return;
    const onMouseMove = (event: MouseEvent) => {
      setColumnWidth(resizing.field, resizing.startWidth + (event.clientX - resizing.startX));
    };
    const onMouseUp = () => setResizing(null);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizing, setColumnWidth]);

  function handleResizeMouseDown(event: ReactMouseEvent<HTMLSpanElement>, field: string) {
    event.preventDefault();
    setResizing({ field, startX: event.clientX, startWidth: effectiveWidth(field) });
  }

  const aggregateColumns = visibleColumns.filter(column => column.aggregate);
  const groupableColumns = visibleColumns.filter(column => column.groupable !== false);
  const isEmpty = groups ? groups.length === 0 : visibleRows.length === 0;
  const hasRowActions = editableColumns.length > 0 || deletable || creatable;
  const hasRowDragHandle = rowReorder && !groupByField;
  const extraColumnCount = (hasRowDragHandle ? 1 : 0) + (selectable ? 1 : 0) + (hasRowActions ? 1 : 0);

  function patchFilterValue(field: string, patch: Partial<InanduGridColumnFilterValue>) {
    setFilterValue(field, { ...filterValues[field], ...patch });
  }

  /**
   * `position: sticky` inline style + width for `column`'s `<th>`/`<td>`, per its `pinned`/
   * `effectiveWidth` — same offsets grid-angular's `stickyOffset`/`stickyOffsetRight` compute,
   * applied via CSS instead of a template class/binding. No explicit `width` unless the column
   * declared one or a resize drag set one — same as grid-angular, where an un-sized column's `<th>`/
   * `<td>` auto-sizes to content and the `?? 80` fallback is only ever used for offset/PDF math.
   */
  function columnStyle(column: InanduGridColumn): CSSProperties {
    const isSized = column.width !== undefined || isColumnResized(column.field);
    const style: CSSProperties = isSized ? { width: effectiveWidth(column.field) } : {};
    if (column.pinned === 'left') return { ...style, position: 'sticky', left: stickyOffset(column.field), zIndex: 1 };
    if (column.pinned === 'right') return { ...style, position: 'sticky', right: stickyOffsetRight(column.field), zIndex: 1 };
    return style;
  }

  function handleHeaderDragStart(event: ReactDragEvent<HTMLTableCellElement>, field: string) {
    onColumnDragStart(field);
    event.dataTransfer.setData('text/plain', field);
  }

  function handleHeaderDragOver(event: ReactDragEvent<HTMLTableCellElement>, field: string) {
    event.preventDefault(); // required so the browser allows a subsequent 'drop' to fire here
    setDragOverField(field);
  }

  function handleHeaderDrop(event: ReactDragEvent<HTMLTableCellElement>, targetField: string) {
    event.preventDefault();
    setDragOverField(undefined);
    onColumnDrop(targetField);
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
            {hasRowDragHandle && <th />}
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
                  className={dragOverField === column.field ? 'inandu-drag-over' : undefined}
                  draggable={column.reorder !== false}
                  onDragStart={e => handleHeaderDragStart(e, column.field)}
                  onDragOver={e => handleHeaderDragOver(e, column.field)}
                  onDragLeave={() => setDragOverField(current => (current === column.field ? undefined : current))}
                  onDrop={e => handleHeaderDrop(e, column.field)}
                  onClick={e => toggleSort(column.field, e.shiftKey)}
                  aria-label={t('MsgSortBy', { column: column.headerText ?? column.field })}
                >
                  {column.headerText ?? column.field}
                  {direction ? (direction === 'asc' ? ' ▲' : ' ▼') : ''}
                  {priority !== undefined && <sup className="inandu-grid-sort-priority">{priority}</sup>}
                  <span
                    className="inandu-grid-resize-handle"
                    onMouseDown={e => handleResizeMouseDown(e, column.field)}
                    onClick={e => e.stopPropagation()}
                    draggable={false}
                  />
                </th>
              );
            })}
            {hasRowActions && <th />}
          </tr>
          <tr className="inandu-grid-filter-row">
            {hasRowDragHandle && <th />}
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
          ) : hasTreeData ? (
            treeRows.map((node, index) => (
              <TreeRow
                key={node.row['id'] != null ? String(node.row['id']) : index}
                node={node}
                rowIndex={index}
                isTreeRowExpanded={isTreeRowExpanded}
                toggleTreeRow={toggleTreeRow}
                {...rowProps}
              />
            ))
          ) : groups ? (
            groups.map(group => (
              <RowGroup key={group.key} group={group} aggregateColumns={aggregateColumns} aggregateLabel={aggregateLabel} extraColumnCount={extraColumnCount} {...rowProps} />
            ))
          ) : (
            visibleRows.map((row, index) => (
              <DataRow
                key={row['id'] != null ? String(row['id']) : index}
                row={row}
                rowIndex={index}
                clipboard={clipboard}
                hasRowDragHandle={hasRowDragHandle}
                isDragOverRow={draggingRow !== undefined && dragOverRow === row}
                onRowDragStart={() => onRowDragStart(row)}
                onRowDragOver={() => setDragOverRow(row)}
                onRowDragLeave={() => setDragOverRow(current => (current === row ? undefined : current))}
                onRowDrop={() => onRowDrop(row)}
                {...rowProps}
              />
            ))
          )}
        </tbody>
        {aggregateColumns.length > 0 && (
          <tfoot>
            <tr className="inandu-grid-totals-row">
              {hasRowDragHandle && <td />}
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
  /** Adds a leading drag-handle `<td>` and wires the whole row for drag-and-drop reordering — only in the flat, non-grouped render path, same restriction grid-angular's `rowReorder` has. */
  hasRowDragHandle?: boolean;
  isDragOverRow?: boolean;
  onRowDragStart?: () => void;
  onRowDragOver?: () => void;
  onRowDragLeave?: () => void;
  onRowDrop?: () => void;
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
  hasRowDragHandle = false,
  isDragOverRow = false,
  onRowDragStart,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop,
}: DataRowProps & { row: InanduGridRow; rowIndex: number }) {
  const editing = isEditingRow(row);

  return (
    <tr
      data-row-index={clipboard ? rowIndex : undefined}
      className={isDragOverRow ? 'inandu-drag-over' : undefined}
      onDragOver={
        hasRowDragHandle
          ? e => {
              e.preventDefault(); // required so the browser allows a subsequent 'drop' to fire here
              onRowDragOver?.();
            }
          : undefined
      }
      onDragLeave={hasRowDragHandle ? onRowDragLeave : undefined}
      onDrop={
        hasRowDragHandle
          ? e => {
              e.preventDefault();
              onRowDrop?.();
            }
          : undefined
      }
    >
      {hasRowDragHandle && (
        <td>
          <span
            className="inandu-grid-row-drag-handle"
            aria-label={t('MsgDragRow')}
            draggable
            onDragStart={e => {
              onRowDragStart?.();
              e.dataTransfer.setData('text/plain', 'row');
            }}
          >
            ⋮⋮
          </span>
        </td>
      )}
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

interface TreeRowProps {
  node: TreeVisibleRow<InanduGridRow>;
  rowIndex: number;
  columns: InanduGridColumn[];
  locale: string;
  t: Translator;
  selectable: boolean;
  selectColumnStyle: CSSProperties | undefined;
  columnStyle: (column: InanduGridColumn) => CSSProperties;
  isRowSelected: (row: InanduGridRow) => boolean;
  toggleRowSelection: (row: InanduGridRow) => void;
  hasRowActions: boolean;
  isTreeRowExpanded: (row: InanduGridRow) => boolean;
  toggleTreeRow: (row: InanduGridRow) => void;
}

/**
 * One tree-data row — display + expand only (no inline editing, drag-reorder or clipboard, same
 * restriction grid-angular has). The first visible column's cell carries the depth indent and an
 * expand/collapse toggle when the node has children; every other cell renders like a normal data
 * cell. Same layout as grid-angular's `#treeRow` template.
 */
function TreeRow({
  node,
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
  isTreeRowExpanded,
  toggleTreeRow,
}: TreeRowProps) {
  const { row, depth, expandable } = node;
  const expanded = isTreeRowExpanded(row);
  const toggleLabel = expanded ? t('MsgCollapseDetail') : t('MsgExpandDetail');

  return (
    <tr aria-level={depth + 1} aria-expanded={expandable ? expanded : undefined}>
      {selectable && (
        <td style={selectColumnStyle}>
          <input aria-label={t('MsgSelectRow', { index: rowIndex + 1 })} type="checkbox" checked={isRowSelected(row)} onChange={() => toggleRowSelection(row)} />
        </td>
      )}
      {columns.map((column, colIndex) => (
        <td key={column.field} style={columnStyle(column)}>
          {colIndex === 0 ? (
            <span className="inandu-grid-tree-cell" style={{ paddingInlineStart: depth * 16 }}>
              {expandable ? (
                <button
                  type="button"
                  className="inandu-grid-tree-toggle"
                  aria-label={toggleLabel}
                  title={toggleLabel}
                  onClick={() => toggleTreeRow(row)}
                >
                  {expanded ? '▾' : '▸'}
                </button>
              ) : (
                <span className="inandu-grid-tree-toggle-spacer" aria-hidden="true" />
              )}
              {formatCellValue(row[column.field], column.type ?? 'string', column.format ?? '', locale)}
            </span>
          ) : (
            formatCellValue(row[column.field], column.type ?? 'string', column.format ?? '', locale)
          )}
        </td>
      ))}
      {hasRowActions && <td className="inandu-grid-row-actions" />}
    </tr>
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
