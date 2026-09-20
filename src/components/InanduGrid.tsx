import { useEffect } from 'react';
import type { InanduGridColumnFilterValue, InanduGridRow } from '../core';
import { AGGREGATE_SYMBOLS, formatCellValue } from '../core';
import { InanduGridColumn, useInanduGrid } from '../hooks/useInanduGrid';

export interface InanduGridProps {
  rows: InanduGridRow[];
  columns: InanduGridColumn[];
  locale?: string;
  /** 0 (default) disables pagination — every filtered/sorted row renders. Ignored while grouped. */
  pageSize?: number;
  /** Adds a checkbox column with row + select-all selection. Default: false. */
  selectable?: boolean;
  /** Called after every selection change with the current full selection, as an array. */
  onSelectionChange?: (selectedRows: InanduGridRow[]) => void;
}

/**
 * Batteries-included table over `useInanduGrid`: sorting, a per-column filter row, pagination, and
 * single-column grouping with per-group + grand-total aggregates. Virtualization and inline
 * editing (both present in grid-angular) land in later passes.
 */
export function InanduGrid({ rows, columns, locale = 'en', pageSize = 0, selectable = false, onSelectionChange }: InanduGridProps) {
  const {
    visibleRows,
    filteredRowCount,
    sort,
    setSort,
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
  } = useInanduGrid({ rows, columns, locale, pageSize });

  useEffect(() => {
    onSelectionChange?.(Array.from(selectedRows));
  }, [selectedRows, onSelectionChange]);

  const aggregateColumns = columns.filter(column => column.aggregate);
  const groupableColumns = columns.filter(column => column.groupable !== false);

  function toggleSort(field: string) {
    setSort(current => {
      if (!current || current.field !== field) return { field, direction: 'asc' };
      return current.direction === 'asc' ? { field, direction: 'desc' } : null;
    });
  }

  function patchFilterValue(field: string, patch: Partial<InanduGridColumnFilterValue>) {
    setFilterValue(field, { ...filterValues[field], ...patch });
  }

  function aggregateLabel(column: InanduGridColumn, aggregates: Record<string, number>): string {
    const kind = column.aggregate;
    const value = aggregates[column.field];
    if (!kind || value === undefined) return '';
    const formatted = kind === 'count' ? String(value) : formatCellValue(value, 'number', column.format ?? '', locale);
    return `${column.headerText ?? column.field} ${AGGREGATE_SYMBOLS[kind]}: ${formatted}`;
  }

  return (
    <div className="inandu-grid-react">
      <div className="inandu-grid-search">
        <input
          aria-label="Search"
          type="text"
          placeholder="Search…"
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
        />
      </div>
      {groupableColumns.length > 0 && (
        <div className="inandu-grid-group-by">
          <label>
            Group by{' '}
            <select
              aria-label="Group by"
              value={groupByField ?? ''}
              onChange={e => setGroupByField(e.target.value || undefined)}
            >
              <option value="">(no grouping)</option>
              {groupableColumns.map(column => (
                <option key={column.field} value={column.field}>
                  {column.headerText ?? column.field}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <table className="inandu-grid">
        <thead>
          <tr>
            {selectable && (
              <th>
                <input
                  aria-label="Select all"
                  type="checkbox"
                  checked={allSelected}
                  ref={el => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleSelectAll}
                />
              </th>
            )}
            {columns.map(column => (
              <th key={column.field} onClick={() => toggleSort(column.field)}>
                {column.headerText ?? column.field}
                {sort?.field === column.field ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
          <tr className="inandu-grid-filter-row">
            {selectable && <th />}
            {columns.map(column => (
              <th key={column.field}>
                <FilterControl
                  column={column}
                  value={filterValues[column.field]}
                  onChange={patch => patchFilterValue(column.field, patch)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups
            ? groups.map(group => (
                <RowGroup
                  key={group.key}
                  group={group}
                  columns={columns}
                  aggregateColumns={aggregateColumns}
                  locale={locale}
                  aggregateLabel={aggregateLabel}
                  selectable={selectable}
                  isRowSelected={isRowSelected}
                  toggleRowSelection={toggleRowSelection}
                />
              ))
            : visibleRows.map((row, index) => (
                <tr key={row['id'] != null ? String(row['id']) : index}>
                  {selectable && (
                    <td>
                      <input
                        aria-label="Select row"
                        type="checkbox"
                        checked={isRowSelected(row)}
                        onChange={() => toggleRowSelection(row)}
                      />
                    </td>
                  )}
                  {columns.map(column => (
                    <td key={column.field}>
                      {formatCellValue(row[column.field], column.type ?? 'string', column.format ?? '', locale)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
        {aggregateColumns.length > 0 && (
          <tfoot>
            <tr className="inandu-grid-totals-row">
              {selectable && <td />}
              {columns.map(column => (
                <td key={column.field}>{column.aggregate ? aggregateLabel(column, totals) : ''}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      {pageSize > 0 && !groupByField && (
        <div className="inandu-grid-pagination">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
            ‹ Prev
          </button>
          <span>
            Page {page + 1} of {pageCount} ({filteredRowCount} rows)
          </span>
          <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}

interface RowGroupProps {
  group: { key: string; rows: InanduGridRow[]; aggregates: Record<string, number> };
  columns: InanduGridColumn[];
  aggregateColumns: InanduGridColumn[];
  locale: string;
  aggregateLabel: (column: InanduGridColumn, aggregates: Record<string, number>) => string;
  selectable: boolean;
  isRowSelected: (row: InanduGridRow) => boolean;
  toggleRowSelection: (row: InanduGridRow) => void;
}

/** One group header row (key + row count + per-aggregate-column labels) followed by its own data rows. */
function RowGroup({
  group,
  columns,
  aggregateColumns,
  locale,
  aggregateLabel,
  selectable,
  isRowSelected,
  toggleRowSelection,
}: RowGroupProps) {
  return (
    <>
      <tr className="inandu-grid-group-row">
        <td colSpan={columns.length + (selectable ? 1 : 0)}>
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
        <tr key={row['id'] != null ? String(row['id']) : `${group.key}:${index}`}>
          {selectable && (
            <td>
              <input
                aria-label="Select row"
                type="checkbox"
                checked={isRowSelected(row)}
                onChange={() => toggleRowSelection(row)}
              />
            </td>
          )}
          {columns.map(column => (
            <td key={column.field}>
              {formatCellValue(row[column.field], column.type ?? 'string', column.format ?? '', locale)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

interface FilterControlProps {
  column: InanduGridColumn;
  value: InanduGridColumnFilterValue | undefined;
  onChange: (patch: Partial<InanduGridColumnFilterValue>) => void;
}

/** One filter control per column type, all working off the same `InanduGridColumnFilterValue` shape the core understands. */
function FilterControl({ column, value, onChange }: FilterControlProps) {
  const type = column.type ?? 'string';
  const label = `Filter ${column.headerText ?? column.field}`;

  if (type === 'number') {
    return (
      <span className="inandu-grid-filter-range">
        <input
          aria-label={`${label} min`}
          type="number"
          value={value?.min ?? ''}
          onChange={e => onChange({ min: e.target.value })}
        />
        <input
          aria-label={`${label} max`}
          type="number"
          value={value?.max ?? ''}
          onChange={e => onChange({ max: e.target.value })}
        />
      </span>
    );
  }

  if (type === 'date') {
    return (
      <span className="inandu-grid-filter-range">
        <input
          aria-label={`${label} from`}
          type="date"
          value={value?.from ?? ''}
          onChange={e => onChange({ from: e.target.value })}
        />
        <input
          aria-label={`${label} to`}
          type="date"
          value={value?.to ?? ''}
          onChange={e => onChange({ to: e.target.value })}
        />
      </span>
    );
  }

  if (type === 'boolean') {
    return (
      <select aria-label={label} value={value?.bool ?? ''} onChange={e => onChange({ bool: e.target.value })}>
        <option value="">(any)</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  return <input aria-label={label} type="text" value={value?.text ?? ''} onChange={e => onChange({ text: e.target.value })} />;
}
