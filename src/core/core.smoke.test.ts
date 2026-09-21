import { describe, expect, it } from 'vitest';
import { compareCellValues, computeGroupAggregates, escapeAttributeSelectorValue, formatCellValue, hasMeaningfulFilterValue } from './index';

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

  it('escapeAttributeSelectorValue: round-trips through a real querySelector, even for a value containing a backslash-quote pair', () => {
    // Security regression (js/incomplete-sanitization, ported from grid-angular): escaping only
    // quotes lets a backslash right before one smuggle a bare, string-terminating quote through —
    // escaping only quotes turns `a\"b` into `a\\"b`, which a CSS parser reads as `a\` (an escaped
    // backslash) followed by a string-ending `"`, leaving `b"]` dangling outside the selector.
    const tricky = 'a\\"b';
    const el = document.createElement('div');
    el.setAttribute('data-field', tricky);
    document.body.appendChild(el);
    try {
      const escaped = escapeAttributeSelectorValue(tricky);
      const matches = document.querySelectorAll(`div[data-field="${escaped}"]`);
      expect(matches.length).toBe(1);
      expect(matches[0]).toBe(el);
    } finally {
      el.remove();
    }
  });
});
