import { describe, expect, it } from 'vitest';
import { compareCellValues, computeGroupAggregates, formatCellValue, hasMeaningfulFilterValue } from './index';

describe('core (ported from grid-angular, zero React/Angular deps)', () => {
  it('formats a number cell', () => {
    expect(formatCellValue(1234.5, 'number', '1.0-2', 'en-US')).toBe('1,234.5');
  });

  it('compares cell values for sorting', () => {
    expect(compareCellValues(1, 2)).toBeLessThan(0);
    expect(compareCellValues('b', 'a')).toBeGreaterThan(0);
  });

  it('detects a meaningful filter value', () => {
    expect(hasMeaningfulFilterValue(undefined)).toBe(false);
    expect(hasMeaningfulFilterValue({ text: 'x' })).toBe(true);
  });

  it('aggregates a group of rows', () => {
    const result = computeGroupAggregates([{ n: 1 }, { n: 2 }, { n: 3 }], [
      {
        field: () => 'n',
        type: () => 'number',
        format: () => '',
        order: () => undefined,
        aggregate: () => 'sum',
      },
    ]);
    expect(result.n).toBe(6);
  });
});
