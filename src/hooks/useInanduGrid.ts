import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ColumnConfig,
  collectTreeRows,
  flattenTree,
  InanduColumnAggregate,
  InanduColumnStickySide,
  InanduColumnType,
  InanduGridColumnFilterValue,
  InanduGridRow,
  coerceToDate,
  compareCellValues,
  computeGroupAggregates,
  formatCellValue,
  hasMeaningfulFilterValue,
  matchesColumnFilter,
  MIN_COLUMN_WIDTH,
  parseDraftValue,
  parsePastedCellValue,
  SELECT_COLUMN_WIDTH,
  TreeVisibleRow,
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
  /** Whether this column can be hidden via the column-visibility toggle. Default: true. */
  hideable?: boolean;
  /** Pins the column to that side of the table, `position: sticky`, regardless of scroll. Unset: not pinned. */
  pinned?: InanduColumnStickySide;
  /** Fixed column width in px — also what `stickyOffset`/`stickyOffsetRight` stack against. Default (unset): 80, same fallback grid-angular's `effectiveWidth() || 80` uses. */
  width?: number;
  /** Whether this column's header can be dragged to reorder columns. Default: true. */
  reorder?: boolean;
  /** Custom rendering for this column's cells, in place of the built-in formatted text. Doesn't affect editing — pair with `renderEditor` if this column is also `editable`. */
  renderCell?: (ctx: InanduCellRenderContext) => ReactNode;
  /** Custom rendering for this column's header label, in place of the built-in plain text. The sort arrow, multi-sort priority badge, and resize handle next to it are unaffected — same scope as grid-angular's `#inanduHeaderTemplate`. */
  renderHeader?: (ctx: InanduHeaderRenderContext) => ReactNode;
  /** Custom editor for this column's cells while their row is in edit/create mode, in place of the built-in type-aware `<input>`/`<select>`. The column must still be `editable`; save-time parsing/validation is unaffected — call `setValue` with the same raw control shape the built-in control would produce (a string for `'string'`/`'number'`/`'date'`, a boolean for `'boolean'`). */
  renderEditor?: (ctx: InanduEditRenderContext) => ReactNode;
}

/** Passed to a column's `renderCell` — the same information the built-in formatted-text cell would use. */
export interface InanduCellRenderContext {
  value: unknown;
  row: InanduGridRow;
  field: string;
}

/** Passed to a column's `renderHeader`. `title` is the resolved display label (`headerText` if set, else `field` — the same fallback the built-in plain-text header uses). */
export interface InanduHeaderRenderContext {
  title: string;
  field: string;
}

/** Passed to a column's `renderEditor`. `row` is `{}` for the add-new-row draft. */
export interface InanduEditRenderContext {
  value: unknown;
  row: InanduGridRow;
  field: string;
  setValue: (value: unknown) => void;
  error: string | undefined;
}

/** Passed to `onRowSave` — everything `saveRow()` parsed and validated for one already-existing row. */
export interface InanduGridRowSave {
  row: InanduGridRow;
  values: Record<string, unknown>;
}

/** One cell update from a `pasteAt()` call — one entry per pasted cell that landed on an existing row and an editable column. */
export interface InanduGridCellPaste {
  row: InanduGridRow;
  field: string;
  value: unknown;
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
  /** Whether the caller renders a select-checkbox column — `stickyOffset()` needs to know, since that column (when present) is always sticky-left too. Default: false. */
  selectable?: boolean;
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
  /** Emitted by `pasteAt()` with every parsed cell update — the grid never mutates `rows` itself. */
  onCellsPaste?: (updates: InanduGridCellPaste[]) => void;
  /** Emitted by `onRowDrop()` with the fully reordered row array — the grid never mutates `rows` itself. */
  onRowOrderChange?: (rows: InanduGridRow[]) => void;
  /**
   * Turns on tree mode: the name of the field on each row holding its child rows (a nested array
   * of the same shape). `rows` is then the root rows; free-text/column filters keep a node when it
   * or any descendant matches, and the active sort orders each level of siblings. Auto-disabled
   * while grouped, same restriction grid-angular's `treeChildrenKey` has (there it also excludes
   * virtual-scroll/server-side, neither of which this port has). Unset (default): tree mode off.
   */
  treeChildrenKey?: string;
  /** Initial expand state for tree mode: `'none'` (default), `'all'`, or a max depth to open to. */
  treeDefaultExpanded?: 'none' | 'all' | number;
  /** Whether master-detail is on — the caller checks this itself (by passing a `renderDetail`), this only controls `toggleRowExpanded`'s accordion behavior. Off (any number of rows can be expanded at once) by default. */
  singleDetailExpand?: boolean;
  /**
   * Opt-in row virtualization for large datasets — bypasses pagination entirely (same as grouping),
   * feeding the windowing logic the full sorted/filtered set instead. Auto-disables grouping,
   * master-detail, tree data, row drag-reorder and clipboard, same restrictions grid-angular's
   * `virtualScroll` has (there it also covers server-side infinite-scroll, which this port doesn't
   * have). The actual DOM windowing (which rows are mounted, given a real scroll position) is the
   * `<InanduGrid>` component's job, not this hook's — it has no way to observe scroll state itself.
   */
  virtualScroll?: boolean;
  /** An extra per-row predicate ANDed onto the free-text + column filters — same as grid-angular's `extraRowFilter`. Lets a caller layer its own filtering (e.g. an advanced-filter query) on top of the grid's own. Unset: no extra filtering. */
  extraRowFilter?: (row: InanduGridRow) => boolean;
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
  selectable = false,
  deleteConfirmMessage,
  bulkDeleteConfirmMessage,
  onRowSave,
  onRowCreate,
  onRowDelete,
  onRowsDelete,
  onCellsPaste,
  onRowOrderChange,
  treeChildrenKey,
  treeDefaultExpanded = 'none',
  singleDetailExpand = false,
  virtualScroll = false,
  extraRowFilter,
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
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set());
  const [reorderedFields, setReorderedFields] = useState<string[] | undefined>(undefined);
  const [draggingField, setDraggingField] = useState<string | undefined>(undefined);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [pinnedOverrides, setPinnedOverrides] = useState<Record<string, InanduColumnStickySide | 'none'>>({});
  const [draggingRow, setDraggingRow] = useState<InanduGridRow | undefined>(undefined);
  const [expandedTreeRows, setExpandedTreeRows] = useState<Set<InanduGridRow>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<InanduGridRow>>(new Set());
  const treeSeededForRef = useRef<InanduGridRow[] | undefined>(undefined);

  const t = useMemo(() => createTranslator(lang ?? locale), [lang, locale]);

  /**
   * `columns` in `reorderedFields`'s order, if any drag-reorder (or `setColumnOrder()`) has
   * happened yet — a field `reorderedFields` doesn't mention (new since the last reorder) "flows in
   * at the end", same as grid-angular's `displayColumns()`. Includes hidden columns, same as
   * grid-angular's `displayColumns()` — only `visibleColumns` (below) filters those out.
   */
  const orderedColumns = useMemo(() => {
    if (!reorderedFields) return columns;
    const byField = new Map(columns.map(column => [column.field, column]));
    const ordered: InanduGridColumn[] = [];
    for (const field of reorderedFields) {
      const column = byField.get(field);
      if (column) {
        ordered.push(column);
        byField.delete(field);
      }
    }
    ordered.push(...byField.values());
    return ordered;
  }, [columns, reorderedFields]);

  /**
   * `orderedColumns` minus whatever's currently hidden — what every other computation below
   * operates over (search, filters, sort, grouping, aggregates, export, paste), same as
   * grid-angular's `visibleColumns`. Always non-empty (see `toggleColumnVisibility`'s floor).
   */
  const visibleColumns = useMemo(
    () => (hiddenFields.size === 0 ? orderedColumns : orderedColumns.filter(column => !hiddenFields.has(column.field))),
    [orderedColumns, hiddenFields],
  );

  /** Every column that can be hidden, from the *full* `orderedColumns` list (not `visibleColumns`) — the toggle popup's checklist needs to list a currently-hidden column too, so it can be shown again. */
  const hideableColumns = useMemo(() => orderedColumns.filter(column => column.hideable !== false), [orderedColumns]);

  /**
   * Sets the full column order directly, bypassing the header drag-and-drop gesture. `fields`
   * should list every column's field, in the desired order; any field it omits keeps its current
   * relative position and is appended after the fields it does list — so passing a subset is safe.
   * Fields that don't match any current column are ignored. Same semantics as grid-angular's
   * `setColumnOrder`.
   */
  function setColumnOrder(fields: readonly string[]): void {
    const current = orderedColumns.map(column => column.field);
    const currentSet = new Set(current);
    const requested = fields.filter(field => currentSet.has(field));
    const requestedSet = new Set(requested);
    const remaining = current.filter(field => !requestedSet.has(field));
    setReorderedFields([...requested, ...remaining]);
  }

  function onColumnDragStart(field: string): void {
    setDraggingField(field);
  }

  /** Dropping a dragged header onto another header — inserts the dragged column immediately before `targetField`. Same semantics (and `reorder: false` opt-out) as grid-angular's `onColumnHeaderDrop`. */
  function onColumnDrop(targetField: string): void {
    const draggedField = draggingField;
    setDraggingField(undefined);
    if (!draggedField || draggedField === targetField) return;

    const draggedColumn = orderedColumns.find(column => column.field === draggedField);
    if (!draggedColumn || draggedColumn.reorder === false) return;

    const fields = orderedColumns.map(column => column.field);
    const fromIndex = fields.indexOf(draggedField);
    let toIndex = fields.indexOf(targetField);
    if (fromIndex === -1 || toIndex === -1) return;

    fields.splice(fromIndex, 1);
    if (fromIndex < toIndex) toIndex--; // the removal above shifted every later index down by one
    fields.splice(toIndex, 0, draggedField);
    setColumnOrder(fields);
  }

  function isColumnHidden(field: string): boolean {
    return hiddenFields.has(field);
  }

  /** Un-hiding is always allowed; hiding is refused if `field` is currently the only visible column left — see grid-angular's `toggleColumnVisibility` for why that floor exists. */
  function toggleColumnVisibility(field: string): void {
    if (hiddenFields.has(field)) {
      setHiddenFields(fields => {
        const next = new Set(fields);
        next.delete(field);
        return next;
      });
      return;
    }
    if (visibleColumns.length <= 1) return;
    setHiddenFields(fields => new Set(fields).add(field));
  }

  const editableColumns = useMemo(() => visibleColumns.filter(column => column.editable), [visibleColumns]);

  function setFilterQuery(query: string) {
    setPage(0);
    setFilterQueryState(query);
  }

  const columnConfigs = useMemo(
    () => new Map(visibleColumns.map(column => [column.field, toColumnConfig(column)])),
    [visibleColumns],
  );

  const aggregateColumnConfigs = useMemo(
    () => visibleColumns.filter(column => column.aggregate).map(column => columnConfigs.get(column.field)!),
    [visibleColumns, columnConfigs],
  );

  function setFilterValue(field: string, value: InanduGridColumnFilterValue) {
    setPage(0);
    setFilterValues(prev => ({ ...prev, [field]: value }));
  }

  /** Removes every column's filter entry at once — same as grid-angular's `clearAllColumnFilters`. */
  function clearAllFilters(): void {
    setPage(0);
    setFilterValues({});
  }

  const sortedFilteredRows = useMemo(() => {
    let result = rows;

    // Free-text search: a row matches if ANY column's formatted display value contains the query
    // (case-insensitive) — same semantics as grid-angular's `filteredData`, applied before the
    // per-column filters below.
    const query = filterQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(row =>
        visibleColumns.some(column => {
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

    if (extraRowFilter) {
      result = result.filter(extraRowFilter);
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
  }, [rows, visibleColumns, columnConfigs, filterQuery, filterValues, sortCriteria, locale, extraRowFilter]);

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

  /** Tree mode is on, and grouping/virtual-scroll (its incompatible render paths in this port) aren't. */
  const hasTreeData = !!treeChildrenKey && !groupByField && !virtualScroll;

  function childrenOf(row: InanduGridRow): readonly InanduGridRow[] | undefined {
    const value = treeChildrenKey ? row[treeChildrenKey] : undefined;
    return Array.isArray(value) ? (value as InanduGridRow[]) : undefined;
  }

  /**
   * `rows` walked into the flat, expansion-aware list tree mode renders — free-text + column
   * filters as a single per-row predicate (keeping a node when it or a descendant matches), the
   * active sort ordering each level of siblings. Same semantics as grid-angular's `treeRows`.
   */
  const treeRows = useMemo<TreeVisibleRow<InanduGridRow>[]>(() => {
    if (!hasTreeData) return [];

    const query = filterQuery.trim().toLowerCase();
    const activeFilters = Object.entries(filterValues).filter(([, value]) => hasMeaningfulFilterValue(value));
    const anyFilter = !!query || activeFilters.length > 0 || !!extraRowFilter;
    const matches = anyFilter
      ? (row: InanduGridRow): boolean => {
          if (
            query &&
            !visibleColumns.some(column => {
              const config = columnConfigs.get(column.field)!;
              return formatCellValue(row[column.field], config.type(), config.format(), locale).toLowerCase().includes(query);
            })
          ) {
            return false;
          }
          if (!activeFilters.every(([field, value]) => {
            const column = columnConfigs.get(field);
            return column ? matchesColumnFilter(column, row, value, locale) : true;
          })) {
            return false;
          }
          return extraRowFilter ? extraRowFilter(row) : true;
        }
      : undefined;

    const compare =
      sortCriteria.length > 0
        ? (a: InanduGridRow, b: InanduGridRow): number => {
            for (const { field, direction } of sortCriteria) {
              const cmp = compareCellValues(a[field], b[field], locale) * (direction === 'asc' ? 1 : -1);
              if (cmp !== 0) return cmp;
            }
            return 0;
          }
        : undefined;

    return flattenTree(rows, { getChildren: childrenOf, isExpanded: row => expandedTreeRows.has(row), match: matches, compare });
  }, [hasTreeData, rows, treeChildrenKey, visibleColumns, columnConfigs, filterQuery, filterValues, sortCriteria, expandedTreeRows, locale, extraRowFilter]);

  // Seeds `expandedTreeRows` from `treeDefaultExpanded` the first time a given `rows` array is
  // seen — same "once per distinct data(), not on every re-render" behavior grid-angular's own
  // seeding effect has (a user's own subsequent expand/collapse clicks must survive re-renders).
  useEffect(() => {
    if (!hasTreeData || treeSeededForRef.current === rows) return;
    treeSeededForRef.current = rows;
    if (treeDefaultExpanded === 'none') {
      setExpandedTreeRows(new Set());
      return;
    }
    const next = new Set<InanduGridRow>();
    if (treeDefaultExpanded === 'all') {
      for (const row of collectTreeRows(rows, childrenOf)) {
        if (childrenOf(row)?.length) next.add(row);
      }
    } else {
      const walk = (level: readonly InanduGridRow[], depth: number): void => {
        if (depth >= treeDefaultExpanded) return;
        for (const row of level) {
          const kids = childrenOf(row);
          if (kids?.length) {
            next.add(row);
            walk(kids, depth + 1);
          }
        }
      };
      walk(rows, 0);
    }
    setExpandedTreeRows(next);
  }, [hasTreeData, rows, treeDefaultExpanded]);

  function isTreeRowExpanded(row: InanduGridRow): boolean {
    return expandedTreeRows.has(row);
  }

  function toggleTreeRow(row: InanduGridRow): void {
    setExpandedTreeRows(open => {
      const next = new Set(open);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }

  /** Expand or collapse every expandable node at once. */
  function setAllTreeRowsExpanded(expanded: boolean): void {
    if (!expanded) {
      setExpandedTreeRows(new Set());
      return;
    }
    const next = new Set<InanduGridRow>();
    for (const row of collectTreeRows(rows, childrenOf)) {
      if (childrenOf(row)?.length) next.add(row);
    }
    setExpandedTreeRows(next);
  }

  /** Virtualization is on, and grouping (this port's one incompatible combo — see the option's doc comment) isn't. */
  const hasVirtualScroll = virtualScroll && !groupByField;

  // Grouping, tree mode, and virtualization all bypass pagination entirely, same as grid-angular —
  // none of them has a meaningful "page" (rows are bucketed by group, nested by parent/child, or
  // windowed by scroll position instead).
  const paginationActive = pageSize > 0 && !groupByField && !hasTreeData && !hasVirtualScroll;
  const pageCount = paginationActive ? Math.max(1, Math.ceil(sortedFilteredRows.length / pageSize)) : 1;
  const clampedPage = Math.min(page, pageCount - 1);

  const visibleRows = useMemo(() => {
    if (hasTreeData) return treeRows.map(t => t.row);
    if (!paginationActive) return sortedFilteredRows;
    const start = clampedPage * pageSize;
    return sortedFilteredRows.slice(start, start + pageSize);
  }, [hasTreeData, treeRows, sortedFilteredRows, paginationActive, pageSize, clampedPage]);

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

  /** The formatted text `Ctrl+C` would copy for the cell at `visibleRows[rowIndex]`/`field` — `''` if it doesn't resolve to a real, currently-paged cell. */
  function copyCellText(rowIndex: number, field: string): string {
    const row = visibleRows[rowIndex];
    const column = columnConfigs.get(field);
    if (!row || !column) return '';
    return formatCellValue(row[field], column.type(), column.format(), locale);
  }

  /**
   * Parses `text` as TSV (rows on line breaks, columns on tabs) and, anchored at `visibleRows[anchorRowIndex]`/`anchorField`'s
   * position within `visibleRows`/`columns`, builds the `{ row, field, value }` updates for every
   * pasted cell that lands on both an existing row and an *editable* column — same semantics as
   * grid-angular's `pasteAt()`. A pasted block bigger than the remaining grid, or touching a
   * non-editable column, is simply clipped there. Calls `onCellsPaste` once, only if there's at
   * least one update.
   */
  function pasteAt(anchorRowIndex: number, anchorField: string, text: string): void {
    const colIndex = visibleColumns.findIndex(c => c.field === anchorField);
    if (anchorRowIndex === -1 || colIndex === -1) return;

    const updates: InanduGridCellPaste[] = [];
    // Excel/Sheets terminate a copied block with a trailing line break; without stripping it, the
    // split below would produce one extra, entirely-empty phantom row past the real data.
    const pastedRows = text.replace(/\r\n$|\r$|\n$/, '').split(/\r\n|\r|\n/).map(line => line.split('\t'));
    pastedRows.forEach((pastedRow, rOffset) => {
      const targetRow = visibleRows[anchorRowIndex + rOffset];
      if (!targetRow) return;
      pastedRow.forEach((cellText, cOffset) => {
        const targetColumn = visibleColumns[colIndex + cOffset];
        if (!targetColumn || !targetColumn.editable) return;
        updates.push({ row: targetRow, field: targetColumn.field, value: parsePastedCellValue(cellText, targetColumn.type ?? 'string') });
      });
    });
    if (updates.length > 0) onCellsPaste?.(updates);
  }

  /** A column's current rendered width: a resize-drag override if one exists, else its declared `width` (defaulting to 80, same fallback grid-angular's `effectiveWidth() || 80` uses). Same semantics as grid-angular's `effectiveWidth`. */
  function effectiveWidth(field: string): number {
    if (columnWidths[field] !== undefined) return columnWidths[field];
    return orderedColumns.find(column => column.field === field)?.width ?? 80;
  }

  /** Whether `field` has a resize-drag (or `setColumnWidth()`) override — the caller uses this to decide whether to render an explicit `width` at all, vs. leaving an un-sized column to auto-size to content. */
  function isColumnResized(field: string): boolean {
    return columnWidths[field] !== undefined;
  }

  /** Sets a column's width directly, bypassing the resize-handle drag — clamped to `MIN_COLUMN_WIDTH`, same floor the drag handle enforces. No-ops if `field` doesn't match any current column. Same semantics as grid-angular's `setColumnWidth`. */
  function setColumnWidth(field: string, width: number): void {
    if (!orderedColumns.some(column => column.field === field)) return;
    setColumnWidths(widths => ({ ...widths, [field]: Math.max(MIN_COLUMN_WIDTH, width) }));
  }

  function onRowDragStart(row: InanduGridRow): void {
    setDraggingRow(row);
  }

  function isRowExpanded(row: InanduGridRow): boolean {
    return expandedRows.has(row);
  }

  /** Toggles `row`'s master-detail visibility. Multiple rows can be expanded at once by default; `singleDetailExpand` collapses any other expanded row first, accordion-style. Same semantics as grid-angular's `toggleRowExpanded`. */
  function toggleRowExpanded(row: InanduGridRow): void {
    setExpandedRows(expanded => {
      const next = singleDetailExpand ? new Set<InanduGridRow>() : new Set(expanded);
      if (expanded.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }

  /** Dropping a dragged row onto another row — inserts the dragged row immediately before the target, mirroring `onColumnDrop`'s semantics. Same as grid-angular's `onRowDrop`, operating over `sortedFilteredRows` (grid-angular's `sortedData()`). */
  function onRowDrop(targetRow: InanduGridRow): void {
    const draggedRow = draggingRow;
    setDraggingRow(undefined);
    if (!draggedRow || draggedRow === targetRow) return;

    const reordered = [...sortedFilteredRows];
    const fromIndex = reordered.indexOf(draggedRow);
    let toIndex = reordered.indexOf(targetRow);
    if (fromIndex === -1 || toIndex === -1) return;

    reordered.splice(fromIndex, 1);
    if (fromIndex < toIndex) toIndex--; // the removal above shifted every later index down by one
    reordered.splice(toIndex, 0, draggedRow);
    onRowOrderChange?.(reordered);
  }

  /**
   * `field`'s current pin side, considering any runtime override (`setColumnPinned()`) — an
   * override if one was ever set for this field, else its own declared `pinned`. `undefined` means
   * not pinned. Same semantics as grid-angular's `columnPinnedSide`.
   */
  function columnPinnedSide(field: string): InanduColumnStickySide | undefined {
    const override = pinnedOverrides[field];
    if (override === 'left' || override === 'right') return override;
    if (override === 'none') return undefined;
    return orderedColumns.find(column => column.field === field)?.pinned;
  }

  /** Pins `field` to `side` at runtime, or un-pins it when `side` is `undefined` — independent of that column's own declared `pinned`. See `columnPinnedSide`. Same semantics as grid-angular's `setColumnPinned`. */
  function setColumnPinned(field: string, side: InanduColumnStickySide | undefined): void {
    setPinnedOverrides(overrides => ({ ...overrides, [field]: side ?? 'none' }));
  }

  /**
   * The `left` offset (px) a left-pinned column's `<th>`/`<td>` needs: the select-checkbox
   * column's width (always sticky-left, when rendered) plus every *other* left-pinned column's
   * `effectiveWidth` that renders before this one in `visibleColumns`. Same semantics as
   * grid-angular's `stickyOffset`.
   */
  function stickyOffset(field: string): number {
    let offset = selectable ? SELECT_COLUMN_WIDTH : 0;
    for (const other of visibleColumns) {
      if (other.field === field) break;
      if (columnPinnedSide(other.field) === 'left') offset += effectiveWidth(other.field);
    }
    return offset;
  }

  /** The `right` offset (px) a right-pinned column needs — the mirror image of `stickyOffset`, stacking from the table's right edge inward. Same semantics as grid-angular's `stickyOffsetRight`. */
  function stickyOffsetRight(field: string): number {
    let offset = 0;
    let seen = false;
    for (const other of visibleColumns) {
      if (other.field === field) {
        seen = true;
        continue;
      }
      if (seen && columnPinnedSide(other.field) === 'right') offset += effectiveWidth(other.field);
    }
    return offset;
  }

  return {
    visibleColumns,
    /** Every column in current drag-reorder order, hidden ones included — same as grid-angular's `displayColumns()`. Most rendering should use `visibleColumns` instead; this is for callers (like a saved-view restore) that need to address a currently-hidden column too. */
    allColumns: orderedColumns,
    stickyOffset,
    stickyOffsetRight,
    columnPinnedSide,
    setColumnPinned,
    hideableColumns,
    isColumnHidden,
    toggleColumnVisibility,
    setColumnOrder,
    draggingField,
    onColumnDragStart,
    onColumnDrop,
    effectiveWidth,
    isColumnResized,
    setColumnWidth,
    draggingRow,
    onRowDragStart,
    onRowDrop,
    hasTreeData,
    treeRows,
    isTreeRowExpanded,
    toggleTreeRow,
    setAllTreeRowsExpanded,
    isRowExpanded,
    toggleRowExpanded,
    hasVirtualScroll,
    visibleRows,
    /** Same "what's on screen right now" set the select-all checkbox and CSV/Excel/PDF export use — the current page, or every group's rows while grouped. */
    exportRows: selectionScopeRows,
    /** Every row matching the current filter and sort, in sort order, regardless of pagination or grouping — same as grid-angular's `sortedData()`. Unlike `exportRows`, this never stops at one page: a full-dataset export/print reads from here instead. */
    sortedRows: sortedFilteredRows,
    filteredRowCount: sortedFilteredRows.length,
    locale,
    sortCriteria,
    setSort: setSortCriteria,
    toggleSort,
    sortDirectionFor,
    sortPriorityFor,
    filterValues,
    setFilterValue,
    clearAllFilters,
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
    copyCellText,
    pasteAt,
  };
}
