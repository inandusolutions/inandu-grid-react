import { useMemo, useState } from 'react';
import {
  ColumnConfig,
  InanduColumnAggregate,
  InanduColumnType,
  InanduGridColumnFilterValue,
  InanduGridRow,
  coerceToDate,
  compareCellValues,
  computeGroupAggregates,
  formatCellValue,
  hasMeaningfulFilterValue,
  matchesColumnFilter,
  parseDraftValue,
} from '../core';
import { createTranslator } from '../utils/translate';

/**
 * Plain-value column definition for the React API — friendlier than the core's `ColumnConfig`
 * getter shape (`field()`, `type()`, ...), which exists to match grid-angular's signal-based
 * columns. `toColumnConfig` below adapts one to the other so the ported core needs no changes.
 */
export interface InanduGridColumn {
  field: string;
  headerText?: string;
  type?: InanduColumnType;
  format?: string;
  order?: number;
  aggregate?: InanduColumnAggregate;
  /** Whether this column can be picked in the "group by" control. Default: true. */
  groupable?: boolean;
  /** Whether this field shows an editable control while its row is in edit/add mode. Default: false. */
  editable?: boolean;
  required?: boolean;
  /** `'number'` columns only. */
  min?: number;
  /** `'number'` columns only. */
  max?: number;
  /** Checked against the raw (unparsed) draft value, `'string'`/`'number'`/`'date'` columns only. */
  pattern?: string;
  /** Runs after required/min/max/pattern all pass, against the parsed value and the row's other parsed fields (for cross-field checks). */
  validator?: (parsed: unknown, parsedRow: Record<string, unknown>) => string | null;
  /** Runs only once every synchronous rule (above) has already passed for this field; every field's async check runs concurrently. */
  asyncValidator?: (parsed: unknown, parsedRow: Record<string, unknown>) => Promise<string | null>;
}

/** Passed to `onRowSave` — everything `saveRow()` parsed and validated for one already-existing row. */
export interface InanduGridRowSave {
  row: InanduGridRow;
  values: Record<string, unknown>;
}

function toColumnConfig(column: InanduGridColumn): ColumnConfig {
  return {
    field: () => column.field,
    type: () => column.type ?? 'string',
    format: () => column.format ?? '',
    order: () => column.order,
    aggregate: () => column.aggregate ?? '',
  };
}

export interface InanduGridSort {
  field: string;
  direction: 'asc' | 'desc';
}

/** One bucket of `useInanduGrid`'s `groups` — mirrors grid-angular's `groupedRows`. */
export interface InanduGridGroup {
  /** The grouped column's *formatted* display value for every row in this bucket. */
  key: string;
  rows: InanduGridRow[];
  /** One entry per column with `aggregate` set, keyed by that column's field. */
  aggregates: Record<string, number>;
}

export interface UseInanduGridOptions {
  rows: InanduGridRow[];
  columns: InanduGridColumn[];
  locale?: string;
  /** Drives validation-message translation. Default: `locale`'s primary subtag. */
  lang?: string;
  /** 0 disables pagination — `visibleRows` is the full sorted/filtered set. Default: 0. */
  pageSize?: number;
  /** `window.confirm()`-gates `deleteRow()`, same as grid-angular. Unset: deletes immediately. */
  deleteConfirmMessage?: string;
  /** `window.confirm()`-gates `deleteSelectedRows()`. Unset: deletes immediately. */
  bulkDeleteConfirmMessage?: string;
  /** Emitted by `saveRow()` once validation passes — the grid never mutates `rows` itself; applying the change is the caller's job. */
  onRowSave?: (event: InanduGridRowSave) => void;
  /** Emitted by `saveNewRow()` once validation passes. No row reference — it doesn't exist in `rows` yet. */
  onRowCreate?: (values: Record<string, unknown>) => void;
  /** Emitted by `deleteRow()` (after confirmation, if any). */
  onRowDelete?: (row: InanduGridRow) => void;
  /** Emitted by `deleteSelectedRows()` (after confirmation, if any) — every currently-selected row. */
  onRowsDelete?: (rows: InanduGridRow[]) => void;
}

/**
 * Headless engine for the grid: owns sort + per-column filter + pagination state and derives
 * `visibleRows` (the current page) and `filteredRowCount` (before pagination) from `rows` using
 * the same pure core as grid-angular. No rendering — `<InanduGrid>` is one consumer of this hook,
 * not the only way to use it.
 */
export function useInanduGrid({
  rows,
  columns,
  locale = 'en',
  lang,
  pageSize = 0,
  deleteConfirmMessage,
  bulkDeleteConfirmMessage,
  onRowSave,
  onRowCreate,
  onRowDelete,
  onRowsDelete,
}: UseInanduGridOptions) {
  const [sortCriteria, setSortCriteria] = useState<InanduGridSort[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, InanduGridColumnFilterValue>>({});
  const [filterQuery, setFilterQueryState] = useState('');
  const [page, setPage] = useState(0);
  const [groupByField, setGroupByField] = useState<string | undefined>(undefined);
  const [selectedRows, setSelectedRows] = useState<Set<InanduGridRow>>(new Set());
  const [editingRow, setEditingRow] = useState<InanduGridRow | undefined>(undefined);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [rowDraft, setRowDraft] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);

  const t = useMemo(() => createTranslator(lang ?? locale), [lang, locale]);
  const editableColumns = useMemo(() => columns.filter(column => column.editable), [columns]);

  function setFilterQuery(query: string) {
    setPage(0);
    setFilterQueryState(query);
  }

  const columnConfigs = useMemo(
    () => new Map(columns.map(column => [column.field, toColumnConfig(column)])),
    [columns],
  );

  const aggregateColumnConfigs = useMemo(
    () => columns.filter(column => column.aggregate).map(column => columnConfigs.get(column.field)!),
    [columns, columnConfigs],
  );

  function setFilterValue(field: string, value: InanduGridColumnFilterValue) {
    setPage(0);
    setFilterValues(prev => ({ ...prev, [field]: value }));
  }

  const sortedFilteredRows = useMemo(() => {
    let result = rows;

    // Free-text search: a row matches if ANY column's formatted display value contains the query
    // (case-insensitive) — same semantics as grid-angular's `filteredData`, applied before the
    // per-column filters below.
    const query = filterQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(row =>
        columns.some(column => {
          const config = columnConfigs.get(column.field)!;
          return formatCellValue(row[column.field], config.type(), config.format(), locale).toLowerCase().includes(query);
        }),
      );
    }

    const activeFilters = Object.entries(filterValues).filter(([, value]) => hasMeaningfulFilterValue(value));
    if (activeFilters.length > 0) {
      result = result.filter(row =>
        activeFilters.every(([field, value]) => {
          const column = columnConfigs.get(field);
          return column ? matchesColumnFilter(column, row, value, locale) : true;
        }),
      );
    }

    if (sortCriteria.length > 0) {
      result = [...result].sort((a, b) => {
        for (const { field, direction } of sortCriteria) {
          const sign = direction === 'asc' ? 1 : -1;
          const cmp = compareCellValues(a[field], b[field], locale) * sign;
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    }

    return result;
  }, [rows, columns, columnConfigs, filterQuery, filterValues, sortCriteria, locale]);

  /**
   * `sortedFilteredRows` bucketed by the grouped column's *formatted* value, in first-seen order
   * (which, since it reads from `sortedFilteredRows`, follows the active sort) — same semantics as
   * grid-angular's `groupedRows`. `null` when ungrouped.
   */
  const groups = useMemo<InanduGridGroup[] | null>(() => {
    if (!groupByField) return null;
    const column = columnConfigs.get(groupByField);
    if (!column) return null;

    const buckets = new Map<string, InanduGridRow[]>();
    for (const row of sortedFilteredRows) {
      const key = formatCellValue(row[groupByField], column.type(), column.format(), locale);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(row);
      else buckets.set(key, [row]);
    }

    return Array.from(buckets.entries()).map(([key, groupRows]) => ({
      key,
      rows: groupRows,
      aggregates: computeGroupAggregates(groupRows, aggregateColumnConfigs),
    }));
  }, [sortedFilteredRows, groupByField, columnConfigs, aggregateColumnConfigs, locale]);

  /** Grand-total aggregate for every `aggregate`-bearing column, across all of `sortedFilteredRows` — shown regardless of whether the grid is currently grouped, same as grid-angular's `totalsAggregates`. */
  const totals = useMemo(
    () => computeGroupAggregates(sortedFilteredRows, aggregateColumnConfigs),
    [sortedFilteredRows, aggregateColumnConfigs],
  );

  // Grouping bypasses pagination entirely, same as grid-angular — no meaningful "page" once rows
  // are bucketed by group.
  const paginationActive = pageSize > 0 && !groupByField;
  const pageCount = paginationActive ? Math.max(1, Math.ceil(sortedFilteredRows.length / pageSize)) : 1;
  const clampedPage = Math.min(page, pageCount - 1);

  const visibleRows = useMemo(() => {
    if (!paginationActive) return sortedFilteredRows;
    const start = clampedPage * pageSize;
    return sortedFilteredRows.slice(start, start + pageSize);
  }, [sortedFilteredRows, paginationActive, pageSize, clampedPage]);

  /** Rows the "select all" checkbox governs — every group's rows when grouped, or just the current page otherwise (mirrors grid-angular's `pagedData()`/grouped `rows` distinction, minus its virtual-scroll case). */
  const selectionScopeRows = groupByField ? sortedFilteredRows : visibleRows;

  function isRowSelected(row: InanduGridRow): boolean {
    return selectedRows.has(row);
  }

  function toggleRowSelection(row: InanduGridRow): void {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }

  const allSelected = selectionScopeRows.length > 0 && selectionScopeRows.every(row => selectedRows.has(row));
  const someSelected = !allSelected && selectionScopeRows.some(row => selectedRows.has(row));

  function toggleSelectAll(): void {
    const selectAll = !allSelected;
    setSelectedRows(prev => {
      const next = new Set(prev);
      for (const row of selectionScopeRows) {
        if (selectAll) next.add(row);
        else next.delete(row);
      }
      return next;
    });
  }

  function clearSelection(): void {
    setSelectedRows(new Set());
  }

  /**
   * The sort header's click handler. A plain click always collapses the sort to just `field`
   * (toggling asc/desc if it was already the *sole* active criterion, else resetting to ascending).
   * `additive` (a shift-click) instead builds a multi-column sort: appends `field` as a new
   * lowest-priority criterion, or toggles its direction in place if already active. Same semantics
   * as grid-angular's `toggleSort`.
   */
  function toggleSort(field: string, additive = false): void {
    setPage(0);
    setSortCriteria(criteria => {
      const index = criteria.findIndex(c => c.field === field);
      if (additive) {
        if (index === -1) return [...criteria, { field, direction: 'asc' }];
        const next = [...criteria];
        next[index] = { field, direction: criteria[index].direction === 'asc' ? 'desc' : 'asc' };
        return next;
      }
      if (criteria.length === 1 && criteria[0].field === field) {
        return [{ field, direction: criteria[0].direction === 'asc' ? 'desc' : 'asc' }];
      }
      return [{ field, direction: 'asc' }];
    });
  }

  function sortDirectionFor(field: string): 'asc' | 'desc' | undefined {
    return sortCriteria.find(c => c.field === field)?.direction;
  }

  /** `field`'s 1-based priority once a *multi*-column sort is active, or `undefined` when it isn't sorted or there's only one active criterion overall. */
  function sortPriorityFor(field: string): number | undefined {
    if (sortCriteria.length < 2) return undefined;
    const index = sortCriteria.findIndex(c => c.field === field);
    return index === -1 ? undefined : index + 1;
  }

  function isEditingRow(row: InanduGridRow): boolean {
    return editingRow === row;
  }

  /** Whether `row`'s own edit/delete controls should be disabled — some *other* row-level action is already in progress. Mirrors grid-angular's `isAnotherRowEditing`. */
  function isAnotherRowEditing(row: InanduGridRow): boolean {
    if (isAddingRow) return true;
    return editingRow !== undefined && editingRow !== row;
  }

  /** The initial draft value for one field when a row enters edit mode — already in the same *raw control* shape a change handler would write back (a string for text/number/date, a boolean for the checkbox). */
  function seedDraftValue(row: InanduGridRow, column: InanduGridColumn): unknown {
    const type = column.type ?? 'string';
    if (type === 'boolean') return !!row[column.field];
    if (type === 'date') {
      const date = coerceToDate(row[column.field]);
      if (Number.isNaN(date.getTime())) return '';
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
    const raw = row[column.field];
    return raw == null ? '' : String(raw);
  }

  function startEditingRow(row: InanduGridRow): void {
    const draft: Record<string, unknown> = {};
    for (const column of editableColumns) {
      draft[column.field] = seedDraftValue(row, column);
    }
    setEditingRow(row);
    setRowDraft(draft);
    setFieldErrors({});
  }

  function cancelRowEdit(): void {
    setEditingRow(undefined);
    setRowDraft({});
    setFieldErrors({});
  }

  function setRowDraftValue(field: string, value: unknown): void {
    setRowDraft(prev => ({ ...prev, [field]: value }));
  }

  /** Runs required/min/max/pattern/validator for one field, in that order, stopping at the first failure — same rule chain (and translated messages) as grid-angular's `validateColumnValue`. */
  function validateColumnValue(
    column: InanduGridColumn,
    raw: unknown,
    parsed: unknown,
    parsedRow: Record<string, unknown>,
  ): string | null {
    if (column.required && (raw === '' || raw === undefined || raw === null)) {
      return t('MsgValidationRequired');
    }
    if ((column.type ?? 'string') === 'number' && typeof parsed === 'number') {
      if (column.min !== undefined && parsed < column.min) return t('MsgValidationMin', { min: column.min });
      if (column.max !== undefined && parsed > column.max) return t('MsgValidationMax', { max: column.max });
    }
    if (column.pattern && typeof raw === 'string' && raw !== '') {
      let regExp: RegExp | undefined;
      try {
        regExp = new RegExp(column.pattern);
      } catch {
        regExp = undefined;
      }
      if (regExp && !regExp.test(raw)) return t('MsgValidationPattern');
    }
    if (column.validator) return column.validator(parsed, parsedRow);
    return null;
  }

  /** Cell-level validation for any value, outside the row-edit flow — the same synchronous rule chain `saveRow()` uses, minus `asyncValidator`. */
  function validateCell(column: InanduGridColumn, value: unknown, row: Record<string, unknown> = {}): string | null {
    return validateColumnValue(column, value, value, row);
  }

  /** Parses + validates every `editableColumns` field of `draft` — shared by `saveRow`/`saveNewRow`. `errors` is non-empty exactly when the draft should not be saved. */
  async function validateAndParseDraft(draft: Record<string, unknown>): Promise<{ errors: Record<string, string>; values: Record<string, unknown> }> {
    const parsedRow: Record<string, unknown> = {};
    for (const column of editableColumns) {
      parsedRow[column.field] = parseDraftValue(draft[column.field], column.type ?? 'string');
    }
    const errors: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const pendingAsyncChecks: Promise<void>[] = [];
    for (const column of editableColumns) {
      const field = column.field;
      const message = validateColumnValue(column, draft[field], parsedRow[field], parsedRow);
      if (message) {
        errors[field] = message;
        continue;
      }
      if (!column.asyncValidator) {
        if (parsedRow[field] !== undefined) values[field] = parsedRow[field];
        continue;
      }
      pendingAsyncChecks.push(
        column.asyncValidator(parsedRow[field], parsedRow).then(asyncMessage => {
          if (asyncMessage) errors[field] = asyncMessage;
          else if (parsedRow[field] !== undefined) values[field] = parsedRow[field];
        }),
      );
    }
    if (pendingAsyncChecks.length > 0) {
      setIsValidating(true);
      try {
        await Promise.all(pendingAsyncChecks);
      } finally {
        setIsValidating(false);
      }
    }
    return { errors, values };
  }

  async function saveRow(row: InanduGridRow): Promise<void> {
    if (editingRow !== row) return;
    const { errors, values } = await validateAndParseDraft(rowDraft);
    if (editingRow !== row) return; // stale: cancelled (or a different row started editing) while awaiting an asyncValidator
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setEditingRow(undefined);
    setRowDraft({});
    setFieldErrors({});
    onRowSave?.({ row, values });
  }

  function deleteRow(row: InanduGridRow): void {
    if (deleteConfirmMessage && !window.confirm(deleteConfirmMessage)) return;
    onRowDelete?.(row);
  }

  function deleteSelectedRows(): void {
    if (bulkDeleteConfirmMessage && !window.confirm(bulkDeleteConfirmMessage)) return;
    const rows = Array.from(selectedRows);
    clearSelection();
    onRowsDelete?.(rows);
  }

  function startAddingRow(): void {
    setIsAddingRow(true);
    setRowDraft({});
    setFieldErrors({});
  }

  function cancelAddRow(): void {
    setIsAddingRow(false);
    setRowDraft({});
    setFieldErrors({});
  }

  async function saveNewRow(): Promise<void> {
    if (!isAddingRow) return;
    const { errors, values } = await validateAndParseDraft(rowDraft);
    if (!isAddingRow) return; // stale: cancelled while awaiting an asyncValidator
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setIsAddingRow(false);
    setRowDraft({});
    setFieldErrors({});
    onRowCreate?.(values);
  }

  return {
    visibleRows,
    /** Same "what's on screen right now" set the select-all checkbox and CSV/Excel/PDF export use — the current page, or every group's rows while grouped. */
    exportRows: selectionScopeRows,
    filteredRowCount: sortedFilteredRows.length,
    sortCriteria,
    setSort: setSortCriteria,
    toggleSort,
    sortDirectionFor,
    sortPriorityFor,
    filterValues,
    setFilterValue,
    filterQuery,
    setFilterQuery,
    page: clampedPage,
    setPage,
    pageCount: paginationActive ? pageCount : 1,
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
    clearSelection,
    editableColumns,
    editingRow,
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
    validateCell,
  };
}
