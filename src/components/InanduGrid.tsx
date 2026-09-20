import { useEffect, useMemo } from 'react';
import type { InanduGridColumnFilterValue, InanduGridRow } from '../core';
import { AGGREGATE_SYMBOLS, formatCellValue } from '../core';
import { InanduGridColumn, useInanduGrid } from '../hooks/useInanduGrid';
import { exportCsv, exportExcel, exportPdf } from '../utils/exporters';
import { createTranslator } from '../utils/translate';

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
}

/**
 * Batteries-included table over `useInanduGrid`: sorting, free-text search, a per-column filter
 * row, pagination, single-column grouping with per-group + grand-total aggregates, row selection,
 * CSV/Excel/PDF export, and i18n (built-in UI strings via `INANDU_GRID_TRANSLATIONS`).
 * Virtualization and inline editing (both present in grid-angular) land in later passes.
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
}: InanduGridProps) {
  const {
    visibleRows,
    exportRows,
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

  const t = useMemo(() => createTranslator(lang ?? locale), [lang, locale]);

  useEffect(() => {
    onSelectionChange?.(Array.from(selectedRows));
  }, [selectedRows, onSelectionChange]);

  const aggregateColumns = columns.filter(column => column.aggregate);
  const groupableColumns = columns.filter(column => column.groupable !== false);
  const isEmpty = (groups ? groups.length === 0 : visibleRows.length === 0);

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
          aria-label={t('MsgFilterPlaceholder')}
          type="text"
          placeholder={`${t('MsgFilterPlaceholder')}…`}
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
        />
      </div>
      {exportable && (
        <div className="inandu-grid-toolbar">
          <button type="button" onClick={() => exportCsv(exportRows, columns, locale, exportFilenameBase)}>
            {t('MsgExportCsv')}
          </button>
          <button type="button" onClick={() => exportExcel(exportRows, columns, locale, exportFilenameBase)}>
            {t('MsgExportExcel')}
          </button>
          <button type="button" onClick={() => void exportPdf(exportRows, columns, locale, exportFilenameBase)}>
            {t('MsgExportPdf')}
          </button>
        </div>
      )}
      {groupableColumns.length > 0 && (
        <div className="inandu-grid-group-by">
          <label>
            {groupByField ? t('MsgGroupedBy', { column: groupableColumns.find(c => c.field === groupByField)?.headerText ?? groupByField }) : t('MsgGroupByHint')}{' '}
            {/* No dictionary key names this control itself (grid-angular's equivalent is a drag-and-drop zone, not a picker) — "Group by" is structural chrome, not a translated message. */}
            <select
              aria-label="Group by"
              value={groupByField ?? ''}
              onChange={e => setGroupByField(e.target.value || undefined)}
            >
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
      <table className="inandu-grid">
        <thead>
          <tr>
            {selectable && (
              <th>
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
            {columns.map(column => (
              <th
                key={column.field}
                onClick={() => toggleSort(column.field)}
                aria-label={t('MsgSortBy', { column: column.headerText ?? column.field })}
              >
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
                  t={t}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>{t('MsgNoData')}</td>
            </tr>
          ) : groups ? (
            groups.map(group => (
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
                t={t}
              />
            ))
          ) : (
            visibleRows.map((row, index) => (
              <tr key={row['id'] != null ? String(row['id']) : index}>
                {selectable && (
                  <td>
                    <input
                      aria-label={t('MsgSelectRow', { index: index + 1 })}
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
            ))
          )}
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

type Translator = (key: import('../utils/translate').InanduGridMessageKey, params?: Record<string, string | number>) => string;

interface RowGroupProps {
  group: { key: string; rows: InanduGridRow[]; aggregates: Record<string, number> };
  columns: InanduGridColumn[];
  aggregateColumns: InanduGridColumn[];
  locale: string;
  aggregateLabel: (column: InanduGridColumn, aggregates: Record<string, number>) => string;
  selectable: boolean;
  isRowSelected: (row: InanduGridRow) => boolean;
  toggleRowSelection: (row: InanduGridRow) => void;
  t: Translator;
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
  t,
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
                aria-label={t('MsgSelectRow', { index: index + 1 })}
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
  t: Translator;
}

/** One filter control per column type, all working off the same `InanduGridColumnFilterValue` shape the core understands. */
function FilterControl({ column, value, onChange, t }: FilterControlProps) {
  const type = column.type ?? 'string';
  const label = t('MsgFilterColumn', { column: column.headerText ?? column.field });

  if (type === 'number') {
    return (
      <span className="inandu-grid-filter-range">
        <input
          aria-label={`${label} ${t('MsgFilterMin')}`}
          type="number"
          value={value?.min ?? ''}
          onChange={e => onChange({ min: e.target.value })}
        />
        <input
          aria-label={`${label} ${t('MsgFilterMax')}`}
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
          aria-label={`${label} ${t('MsgFilterFrom')}`}
          type="date"
          value={value?.from ?? ''}
          onChange={e => onChange({ from: e.target.value })}
        />
        <input
          aria-label={`${label} ${t('MsgFilterTo')}`}
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
        <option value="">{t('MsgAll')}</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  return <input aria-label={label} type="text" value={value?.text ?? ''} onChange={e => onChange({ text: e.target.value })} />;
}
