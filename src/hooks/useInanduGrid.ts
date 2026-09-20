import { useMemo, useState } from 'react';
import {
  ColumnConfig,
  InanduColumnAggregate,
  InanduColumnType,
  InanduGridColumnFilterValue,
  InanduGridRow,
  compareCellValues,
  computeGroupAggregates,
  formatCellValue,
  hasMeaningfulFilterValue,
  matchesColumnFilter,
} from '../core';

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
  /** 0 disables pagination — `visibleRows` is the full sorted/filtered set. Default: 0. */
  pageSize?: number;
}

/**
 * Headless engine for the grid: owns sort + per-column filter + pagination state and derives
 * `visibleRows` (the current page) and `filteredRowCount` (before pagination) from `rows` using
 * the same pure core as grid-angular. No rendering — `<InanduGrid>` is one consumer of this hook,
 * not the only way to use it.
 */
export function useInanduGrid({ rows, columns, locale = 'en', pageSize = 0 }: UseInanduGridOptions) {
  const [sort, setSort] = useState<InanduGridSort | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, InanduGridColumnFilterValue>>({});
  const [filterQuery, setFilterQueryState] = useState('');
  const [page, setPage] = useState(0);
  const [groupByField, setGroupByField] = useState<string | undefined>(undefined);
  const [selectedRows, setSelectedRows] = useState<Set<InanduGridRow>>(new Set());

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

    if (sort) {
      const direction = sort.direction === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => direction * compareCellValues(a[sort.field], b[sort.field], locale));
    }

    return result;
  }, [rows, columns, columnConfigs, filterQuery, filterValues, sort, locale]);

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

  return {
    visibleRows,
    /** Same "what's on screen right now" set the select-all checkbox and CSV/Excel/PDF export use — the current page, or every group's rows while grouped. */
    exportRows: selectionScopeRows,
    filteredRowCount: sortedFilteredRows.length,
    sort,
    setSort,
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
  };
}
