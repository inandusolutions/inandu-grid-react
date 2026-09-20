import type { InanduGridColumnFilterValue, InanduGridRow } from '../core';
import { formatCellValue } from '../core';
import { InanduGridColumn, useInanduGrid } from '../hooks/useInanduGrid';

export interface InanduGridProps {
  rows: InanduGridRow[];
  columns: InanduGridColumn[];
  locale?: string;
  /** 0 (default) disables pagination — every filtered/sorted row renders. */
  pageSize?: number;
}

/**
 * Batteries-included table over `useInanduGrid`: sorting, a per-column filter row, and pagination.
 * Grouping, virtualization and inline editing (all present in grid-angular) land in later passes.
 */
export function InanduGrid({ rows, columns, locale = 'en', pageSize = 0 }: InanduGridProps) {
  const { visibleRows, filteredRowCount, sort, setSort, filterValues, setFilterValue, page, setPage, pageCount } =
    useInanduGrid({ rows, columns, locale, pageSize });

  function toggleSort(field: string) {
    setSort(current => {
      if (!current || current.field !== field) return { field, direction: 'asc' };
      return current.direction === 'asc' ? { field, direction: 'desc' } : null;
    });
  }

  function patchFilterValue(field: string, patch: Partial<InanduGridColumnFilterValue>) {
    setFilterValue(field, { ...filterValues[field], ...patch });
  }

  return (
    <div className="inandu-grid-react">
      <table className="inandu-grid">
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.field} onClick={() => toggleSort(column.field)}>
                {column.headerText ?? column.field}
                {sort?.field === column.field ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
          <tr className="inandu-grid-filter-row">
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
          {visibleRows.map((row, index) => (
            <tr key={row['id'] != null ? String(row['id']) : index}>
              {columns.map(column => (
                <td key={column.field}>
                  {formatCellValue(row[column.field], column.type ?? 'string', column.format ?? '', locale)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pageSize > 0 && (
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
