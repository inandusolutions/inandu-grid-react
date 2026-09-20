import { formatCellValue } from '../core';
import { InanduGridColumn, useInanduGrid } from '../hooks/useInanduGrid';
import type { InanduGridRow } from '../core';

export interface InanduGridProps {
  rows: InanduGridRow[];
  columns: InanduGridColumn[];
  locale?: string;
}

/**
 * First vertical slice of the React port: sortable columns over `useInanduGrid`. Filtering,
 * grouping, pagination, virtualization and inline editing (all present in grid-angular) land in
 * later passes — this establishes the component/hook split, not the full feature set yet.
 */
export function InanduGrid({ rows, columns, locale = 'en' }: InanduGridProps) {
  const { visibleRows, sort, setSort } = useInanduGrid({ rows, columns, locale });

  function toggleSort(field: string) {
    setSort(current => {
      if (!current || current.field !== field) return { field, direction: 'asc' };
      return current.direction === 'asc' ? { field, direction: 'desc' } : null;
    });
  }

  return (
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
  );
}
