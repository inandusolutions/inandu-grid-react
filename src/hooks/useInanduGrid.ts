import { useMemo, useState } from 'react';
import {
  ColumnConfig,
  InanduColumnAggregate,
  InanduColumnType,
  InanduGridColumnFilterValue,
  InanduGridRow,
  compareCellValues,
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
  const [page, setPage] = useState(0);

  const columnConfigs = useMemo(
    () => new Map(columns.map(column => [column.field, toColumnConfig(column)])),
    [columns],
  );

  function setFilterValue(field: string, value: InanduGridColumnFilterValue) {
    setPage(0);
    setFilterValues(prev => ({ ...prev, [field]: value }));
  }

  const sortedFilteredRows = useMemo(() => {
    const activeFilters = Object.entries(filterValues).filter(([, value]) => hasMeaningfulFilterValue(value));

    let result = rows;
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
  }, [rows, columnConfigs, filterValues, sort, locale]);

  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(sortedFilteredRows.length / pageSize)) : 1;
  const clampedPage = Math.min(page, pageCount - 1);

  const visibleRows = useMemo(() => {
    if (pageSize <= 0) return sortedFilteredRows;
    const start = clampedPage * pageSize;
    return sortedFilteredRows.slice(start, start + pageSize);
  }, [sortedFilteredRows, pageSize, clampedPage]);

  return {
    visibleRows,
    filteredRowCount: sortedFilteredRows.length,
    sort,
    setSort,
    filterValues,
    setFilterValue,
    page: clampedPage,
    setPage,
    pageCount,
  };
}
